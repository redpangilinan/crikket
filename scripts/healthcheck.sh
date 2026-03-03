#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

# shellcheck source=./lib/selfhost-common.sh
source "${SCRIPT_DIR}/lib/selfhost-common.sh"

CHECK_FAILED=0
APP_URL=""
API_URL=""
BETTER_AUTH_URL=""
CORS_ORIGINS=""
GOOGLE_AUTH_ENABLED=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

pass() {
  printf '[crikket] pass: %s\n' "$1"
}

fail() {
  printf '[crikket] fail: %s\n' "$1" >&2
  CHECK_FAILED=1
}

warn_check() {
  printf '[crikket] warn: %s\n' "$1" >&2
}

load_health_env() {
  APP_URL="$(default_value "$WEB_ENV_FILE" "NEXT_PUBLIC_APP_URL" "")"
  API_URL="$(default_value "$WEB_ENV_FILE" "NEXT_PUBLIC_SERVER_URL" "")"
  BETTER_AUTH_URL="$(default_value "$SERVER_ENV_FILE" "BETTER_AUTH_URL" "")"
  CORS_ORIGINS="$(default_value "$SERVER_ENV_FILE" "CORS_ORIGINS" "")"
  GOOGLE_AUTH_ENABLED="$(default_value "$WEB_ENV_FILE" "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED" "false")"
  GOOGLE_CLIENT_ID="$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_ID" "")"
  GOOGLE_CLIENT_SECRET="$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_SECRET" "")"
}

database_mode_label() {
  if is_bundled_postgres; then
    printf 'bundled\n'
    return 0
  fi

  printf 'external\n'
}

check_compose_services() {
  local expected_services service output
  expected_services=(server web)

  if is_bundled_postgres; then
    expected_services=(postgres "${expected_services[@]}")
  fi

  if [[ "$PROXY_MODE" == "caddy" ]]; then
    expected_services+=(caddy)
  fi

  output="$(compose_run ps --services --status running)"

  for service in "${expected_services[@]}"; do
    if printf '%s\n' "$output" | grep -qx "$service"; then
      pass "service '$service' is running"
    else
      fail "service '$service' is not running"
    fi
  done
}

check_env_alignment() {
  if [[ -n "$APP_URL" ]]; then
    pass "NEXT_PUBLIC_APP_URL is set"
  else
    fail "NEXT_PUBLIC_APP_URL is missing"
  fi

  if [[ -n "$API_URL" ]]; then
    pass "NEXT_PUBLIC_SERVER_URL is set"
  else
    fail "NEXT_PUBLIC_SERVER_URL is missing"
  fi

  if [[ "$BETTER_AUTH_URL" == "$API_URL" ]]; then
    pass "BETTER_AUTH_URL matches NEXT_PUBLIC_SERVER_URL"
  else
    fail "BETTER_AUTH_URL must match NEXT_PUBLIC_SERVER_URL"
  fi

  if [[ "$CORS_ORIGINS" == *"$APP_URL"* ]]; then
    pass "CORS_ORIGINS includes NEXT_PUBLIC_APP_URL"
  else
    fail "CORS_ORIGINS must include NEXT_PUBLIC_APP_URL"
  fi

  if [[ "$GOOGLE_AUTH_ENABLED" == "true" ]]; then
    if [[ -n "$GOOGLE_CLIENT_ID" && -n "$GOOGLE_CLIENT_SECRET" ]]; then
      pass "Google OAuth is enabled and credentials are configured"
    else
      fail "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    fi
  elif [[ -n "$GOOGLE_CLIENT_ID" || -n "$GOOGLE_CLIENT_SECRET" ]]; then
    warn_check "Google credentials are present but NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is false"
  else
    pass "Google OAuth is disabled"
  fi
}

check_http_endpoint() {
  local label="$1"
  local url="$2"
  local expected_body="${3:-}"
  local response_file http_code body

  response_file="$(mktemp /tmp/crikket-health.XXXXXX)"

  http_code="$(
    curl -fsSL \
      --connect-timeout 10 \
      --max-time 20 \
      --output "$response_file" \
      --write-out "%{http_code}" \
      "$url" \
      || true
  )"

  if [[ -z "$http_code" ]]; then
    rm -f "$response_file"
    fail "${label} is not reachable at ${url}"
    return 0
  fi

  if [[ "$http_code" =~ ^[23] ]]; then
    pass "${label} responded with HTTP ${http_code}"
  else
    rm -f "$response_file"
    fail "${label} responded with HTTP ${http_code}"
    return 0
  fi

  if [[ -n "$expected_body" ]]; then
    body="$(tr -d '\r\n' <"$response_file")"
    if [[ "$body" == "$expected_body" ]]; then
      pass "${label} returned expected body"
    else
      fail "${label} did not return expected body"
    fi
  fi

  rm -f "$response_file"
}

check_bundled_postgres() {
  if ! is_bundled_postgres; then
    warn_check "Skipping bundled postgres readiness check because DATABASE_URL points to an external database"
    return 0
  fi

  local postgres_user postgres_db
  postgres_user="$(default_value "$ROOT_ENV_FILE" "POSTGRES_USER" "postgres")"
  postgres_db="$(default_value "$ROOT_ENV_FILE" "POSTGRES_DB" "crikket")"

  if compose_run exec -T postgres pg_isready -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; then
    pass "bundled postgres is accepting connections"
  else
    fail "bundled postgres is not accepting connections"
  fi
}

main() {
  info "Crikket healthcheck"
  ensure_selfhost_layout
  ensure_docker_access
  require_command curl
  load_selfhost_mode
  load_health_env

  printf 'Proxy mode: %s\n' "$PROXY_MODE"
  printf 'Database mode: %s\n' "$(database_mode_label)"
  printf 'Compose files: %s\n' "$(compose_file_summary)"

  check_compose_services
  check_env_alignment
  check_bundled_postgres

  if [[ -n "$APP_URL" ]]; then
    check_http_endpoint "app URL" "$APP_URL"
  fi

  if [[ -n "$API_URL" ]]; then
    check_http_endpoint "auth session endpoint" "${API_URL}/api/auth/get-session" "null"
  fi

  if [[ "$CHECK_FAILED" -ne 0 ]]; then
    exit 1
  fi

  info "Healthcheck passed."
}

main "$@"
