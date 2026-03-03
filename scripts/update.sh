#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

# shellcheck source=./lib/selfhost-common.sh
source "${SCRIPT_DIR}/lib/selfhost-common.sh"

update_source_checkout() {
  if ! command_exists git; then
    warn "git is not installed. Skipping source update check and rebuilding current checkout."
    return 0
  fi

  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "This directory is not a git checkout. Rebuilding current source without pulling."
    return 0
  fi

  if ! git -C "$ROOT_DIR" diff --quiet || ! git -C "$ROOT_DIR" diff --cached --quiet; then
    warn "Working tree has local changes. Skipping git pull and rebuilding current checkout."
    return 0
  fi

  if ! git -C "$ROOT_DIR" rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
    warn "Current branch has no upstream configured. Skipping git pull and rebuilding current checkout."
    return 0
  fi

  info "Fetching latest git refs..."
  git -C "$ROOT_DIR" fetch --quiet

  local rev_counts behind ahead
  rev_counts="$(git -C "$ROOT_DIR" rev-list --left-right --count HEAD...@{u})"
  ahead="${rev_counts%%[[:space:]]*}"
  behind="${rev_counts##*[[:space:]]}"

  if [[ "$behind" == "0" ]]; then
    info "Source checkout is already up to date."
    return 0
  fi

  if [[ "$ahead" != "0" ]]; then
    warn "Local branch has diverged from upstream. Skipping git pull and rebuilding current checkout."
    return 0
  fi

  info "Pulling latest source changes..."
  git -C "$ROOT_DIR" pull --ff-only
}

run_migrations() {
  info "Applying database migrations..."
  compose_run run --rm migrate
}

main() {
  info "Crikket update"
  ensure_selfhost_layout
  ensure_docker_access
  load_selfhost_mode

  info "Deploy mode: ${DEPLOY_MODE}"
  info "Compose files: $(compose_file_summary)"

  if [[ "$DEPLOY_MODE" == "source" ]]; then
    update_source_checkout
    info "Rebuilding images..."
    compose_run build migrate server web
    run_migrations
    info "Restarting the stack..."
    compose_run up -d
  else
    info "Pulling latest images..."
    compose_run pull
    run_migrations
    info "Restarting the stack..."
    compose_run up -d
  fi

  compose_run ps
}

main "$@"
