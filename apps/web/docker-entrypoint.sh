#!/usr/bin/env sh

set -eu

APP_DIR="/app/apps/web"
TEMPLATE_DIR="${APP_DIR}/.next-template"
TARGET_DIR="${APP_DIR}/.next"

escape_replacement() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

replace_placeholder() {
  placeholder="$1"
  value="$2"
  escaped_value="$(escape_replacement "$value")"
  files="$(grep -rl "$placeholder" "$TARGET_DIR" 2>/dev/null || true)"

  if [ -z "$files" ]; then
    return 0
  fi

  printf '%s\n' "$files" | while IFS= read -r file; do
    [ -n "$file" ] || continue
    sed -i "s|$placeholder|$escaped_value|g" "$file"
  done
}

replace_url_placeholder() {
  placeholder="$1"
  value="$2"
  replace_placeholder "$placeholder" "$value"
  replace_placeholder "$(printf '%s' "$placeholder" | tr '[:upper:]' '[:lower:]')" "$value"
}

replace_runtime_env_value() {
  key="$1"
  value="$2"
  escaped_value="$(escape_replacement "$value")"
  files="$(grep -rl "$key" "$TARGET_DIR" 2>/dev/null || true)"

  if [ -z "$files" ]; then
    return 0
  fi

  printf '%s\n' "$files" | while IFS= read -r file; do
    [ -n "$file" ] || continue
    sed -i "s|${key}:[^,}]*env\\.${key}|${key}:\"${escaped_value}\"|g" "$file"
  done
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"

  if [ -z "$value" ]; then
    printf '[crikket] error: Missing required env %s\n' "$name" >&2
    exit 1
  fi
}

prepare_build_output() {
  rm -rf "$TARGET_DIR"
  cp -R "$TEMPLATE_DIR" "$TARGET_DIR"
}

main() {
  require_env NEXT_PUBLIC_SITE_URL
  require_env NEXT_PUBLIC_APP_URL
  require_env NEXT_PUBLIC_SERVER_URL

  : "${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:=false}"
  : "${NEXT_PUBLIC_CRIKKET_KEY:=}"
  : "${NEXT_PUBLIC_DEMO_URL:=}"
  : "${NEXT_PUBLIC_POSTHOG_KEY:=}"
  : "${NEXT_PUBLIC_POSTHOG_HOST:=}"

  prepare_build_output

  replace_url_placeholder "https://__CRIKKET_SITE_URL__" "$NEXT_PUBLIC_SITE_URL"
  replace_url_placeholder "https://__CRIKKET_APP_URL__" "$NEXT_PUBLIC_APP_URL"
  replace_url_placeholder "https://__CRIKKET_SERVER_URL__" "$NEXT_PUBLIC_SERVER_URL"
  replace_placeholder "__CRIKKET_CAPTURE_KEY__" "$NEXT_PUBLIC_CRIKKET_KEY"
  replace_url_placeholder "https://__CRIKKET_DEMO_URL__" "$NEXT_PUBLIC_DEMO_URL"
  replace_placeholder "__CRIKKET_POSTHOG_KEY__" "$NEXT_PUBLIC_POSTHOG_KEY"
  replace_url_placeholder "https://__CRIKKET_POSTHOG_HOST__" "$NEXT_PUBLIC_POSTHOG_HOST"
  replace_runtime_env_value "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED" "$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED"
  replace_runtime_env_value "NEXT_PUBLIC_DEMO_URL" "$NEXT_PUBLIC_DEMO_URL"
  replace_runtime_env_value "NEXT_PUBLIC_POSTHOG_KEY" "$NEXT_PUBLIC_POSTHOG_KEY"
  replace_runtime_env_value "NEXT_PUBLIC_POSTHOG_HOST" "$NEXT_PUBLIC_POSTHOG_HOST"

  exec "$@"
}

main "$@"
