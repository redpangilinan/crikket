#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

# shellcheck source=./lib/selfhost-common.sh
source "${SCRIPT_DIR}/lib/selfhost-common.sh"

main() {
  info "Crikket restart"
  ensure_selfhost_layout
  ensure_docker_access
  load_selfhost_mode

  warn "restart.sh only restarts existing containers."
  warn "If you changed env files, images, Compose config, or Caddyfile, use update.sh or docker compose up -d --force-recreate instead."

  if [[ "$#" -eq 0 ]]; then
    info "Restarting all services..."
    compose_run restart
  else
    info "Restarting services: $*"
    compose_run restart "$@"
  fi

  compose_run ps
}

main "$@"
