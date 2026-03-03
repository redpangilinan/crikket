ROOT_ENV_FILE="${ROOT_DIR}/.env"
SERVER_ENV_FILE="${ROOT_DIR}/apps/server/.env"
WEB_ENV_FILE="${ROOT_DIR}/apps/web/.env"

DOCKER_COMPOSE=()
COMPOSE_FILE_ARGS=()

info() {
  printf '[crikket] %s\n' "$1"
}

warn() {
  printf '[crikket] warning: %s\n' "$1" >&2
}

die() {
  printf '[crikket] error: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

detect_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker compose)
    return 0
  fi

  if command_exists docker-compose; then
    DOCKER_COMPOSE=(docker-compose)
    return 0
  fi

  return 1
}

require_command() {
  if ! command_exists "$1"; then
    die "Required command not found: $1"
  fi
}

read_env_value() {
  local file_path="$1"
  local key="$2"

  if [[ ! -f "$file_path" ]]; then
    return 1
  fi

  awk -v key="$key" '
    $0 ~ "^[[:space:]]*" key "=" {
      line = $0
      sub(/^[^=]*=/, "", line)
      value = line
      found = 1
    }
    END {
      if (found == 1) {
        print value
      }
    }
  ' "$file_path"
}

default_value() {
  local file_path="$1"
  local key="$2"
  local fallback="${3:-}"
  local value

  value="$(read_env_value "$file_path" "$key" || true)"
  if [[ -n "$value" ]]; then
    printf '%s\n' "$value"
    return 0
  fi

  printf '%s\n' "$fallback"
}

prompt_value() {
  local label="$1"
  local default="${2:-}"
  local value=""

  if [[ -n "$default" ]]; then
    read -r -p "${label} [${default}]: " value
    printf '%s\n' "${value:-$default}"
    return 0
  fi

  read -r -p "${label}: " value
  printf '%s\n' "$value"
}

prompt_required_value() {
  local label="$1"
  local default="${2:-}"
  local value=""

  while true; do
    value="$(prompt_value "$label" "$default")"
    if [[ -n "$value" ]]; then
      printf '%s\n' "$value"
      return 0
    fi
    warn "${label} is required."
  done
}

prompt_yes_no() {
  local label="$1"
  local default="${2:-yes}"
  local prompt_suffix="[Y/n]"
  local value=""

  if [[ "$default" == "no" ]]; then
    prompt_suffix="[y/N]"
  fi

  while true; do
    read -r -p "${label} ${prompt_suffix}: " value
    value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"

    if [[ -z "$value" ]]; then
      value="$default"
    fi

    case "$value" in
      y|yes)
        return 0
        ;;
      n|no)
        return 1
        ;;
      *)
        warn "Please answer yes or no."
        ;;
    esac
  done
}

normalize_url() {
  local value="$1"

  while [[ "$value" == */ ]]; do
    value="${value%/}"
  done

  printf '%s\n' "$value"
}

normalize_host_input() {
  local value="$1"

  value="$(normalize_url "$value")"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"

  printf '%s\n' "$value"
}

validate_url() {
  local value="$1"
  [[ "$value" =~ ^https?://[^[:space:]]+$ ]]
}

url_authority() {
  local value="$1"
  value="${value#*://}"
  value="${value%%/*}"
  printf '%s\n' "$value"
}

url_host() {
  local value="$1"
  value="$(url_authority "$value")"
  value="${value%%:*}"
  printf '%s\n' "$value"
}

is_local_host() {
  local value="$1"
  case "$value" in
    localhost|127.0.0.1|0.0.0.0|::1)
      return 0
      ;;
  esac
  return 1
}

validate_host_input() {
  local value="$1"

  if [[ -z "$value" || "$value" == *"/"* || "$value" == *" "* ]]; then
    return 1
  fi

  [[ "$value" =~ ^[A-Za-z0-9.-]+(:[0-9]+)?$ ]]
}

validate_caddy_host() {
  local value="$1"

  if ! validate_host_input "$value"; then
    return 1
  fi

  value="${value%%:*}"

  if is_local_host "$value"; then
    return 1
  fi

  if [[ "$value" =~ ^[0-9.]+$ ]]; then
    return 1
  fi

  [[ "$value" == *.* ]]
}

validate_port_number() {
  local value="$1"

  if [[ ! "$value" =~ ^[0-9]{1,5}$ ]]; then
    return 1
  fi

  (( value >= 1 && value <= 65535 ))
}

validate_host_port_binding() {
  local value="$1"
  local host_part="$value"
  local port_part="$value"

  if [[ "$value" == *:* ]]; then
    host_part="${value%:*}"
    port_part="${value##*:}"

    if [[ -z "$host_part" ]]; then
      return 1
    fi
  fi

  validate_port_number "$port_part"
}

generate_secret() {
  local length="${1:-48}"
  local secret=""

  if command_exists openssl; then
    secret="$(openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-"$length")"
  else
    secret="$(
      set +o pipefail
      LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
    )"
  fi

  if [[ -z "$secret" ]]; then
    die "Failed to generate a secure random secret."
  fi

  printf '%s\n' "$secret"
}

backup_file_if_exists() {
  local file_path="$1"

  if [[ -f "$file_path" ]]; then
    local backup_path="${file_path}.bak.$(date +%Y%m%d%H%M%S)"
    cp "$file_path" "$backup_path"
    info "Backed up $(basename "$file_path") to ${backup_path}"
  fi
}

ensure_repo_layout() {
  [[ -f "${ROOT_DIR}/docker-compose.yml" ]] || die "Run this script from the Crikket repository."
  [[ -f "${ROOT_DIR}/docker-compose.caddy.yml" ]] || die "Missing docker-compose.caddy.yml."
  [[ -f "${ROOT_DIR}/docker-compose.external-db.yml" ]] || die "Missing docker-compose.external-db.yml."
  [[ -f "${ROOT_DIR}/Caddyfile" ]] || die "Missing Caddyfile."
  [[ -d "${ROOT_DIR}/apps/server" ]] || die "Missing apps/server."
  [[ -d "${ROOT_DIR}/apps/web" ]] || die "Missing apps/web."
}

default_host_from_url() {
  local file_path="$1"
  local key="$2"
  local fallback="$3"
  local raw_value

  raw_value="$(default_value "$file_path" "$key" "")"
  if [[ -z "$raw_value" ]]; then
    printf '%s\n' "$fallback"
    return 0
  fi

  printf '%s\n' "$(normalize_host_input "$raw_value")"
}

build_public_urls() {
  NEXT_PUBLIC_APP_URL="https://${PUBLIC_HOST}"
  NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_APP_URL"
  NEXT_PUBLIC_SERVER_URL="$NEXT_PUBLIC_APP_URL"
  BETTER_AUTH_URL="$NEXT_PUBLIC_APP_URL"
  CORS_ORIGINS="$NEXT_PUBLIC_APP_URL"
}

configure_domains() {
  local public_default existing_cookie_domain

  public_default="$(default_host_from_url "$WEB_ENV_FILE" "NEXT_PUBLIC_APP_URL" "app.example.com")"
  existing_cookie_domain="$(default_value "$SERVER_ENV_FILE" "BETTER_AUTH_COOKIE_DOMAIN" "")"

  PUBLIC_HOST="$(normalize_host_input "$(prompt_required_value "Public domain" "$public_default")")"
  validate_host_input "$PUBLIC_HOST" || die "Public domain must be a hostname like app.example.com"

  build_public_urls
  FRONTEND_HOST="$PUBLIC_HOST"

  if [[ -n "$existing_cookie_domain" ]]; then
    BETTER_AUTH_COOKIE_DOMAIN="$existing_cookie_domain"
  else
    BETTER_AUTH_COOKIE_DOMAIN="${PUBLIC_HOST%%:*}"
  fi
}

configure_proxy() {
  local proxy_default

  PROXY_MODE_EXISTING="$(default_value "$ROOT_ENV_FILE" "CRIKKET_PROXY_MODE" "")"
  proxy_default="yes"

  if [[ "$PROXY_MODE_EXISTING" == "none" ]]; then
    proxy_default="no"
  fi

  if prompt_yes_no "Enable built-in Caddy reverse proxy with automatic HTTPS" "$proxy_default"; then
    PROXY_MODE="caddy"
    PROXY_MODE_LABEL="Caddy with automatic HTTPS"

    validate_caddy_host "$PUBLIC_HOST" || die "Caddy mode requires a real public domain."

    CADDY_ACME_EMAIL="$(prompt_required_value "Email for Caddy TLS certificates" "$(default_value "$ROOT_ENV_FILE" "CADDY_ACME_EMAIL" "")")"
    CADDY_PUBLIC_HOST="$PUBLIC_HOST"
    CADDY_HTTP_PORT="$(default_value "$ROOT_ENV_FILE" "CADDY_HTTP_PORT" "80")"
    CADDY_HTTPS_PORT="$(default_value "$ROOT_ENV_FILE" "CADDY_HTTPS_PORT" "443")"
    validate_port_number "$CADDY_HTTP_PORT" || die "Caddy HTTP port must be a number between 1 and 65535."
    validate_port_number "$CADDY_HTTPS_PORT" || die "Caddy HTTPS port must be a number between 1 and 65535."
    return 0
  fi

  PROXY_MODE="none"
  PROXY_MODE_LABEL="No built-in reverse proxy"
  CADDY_ACME_EMAIL=""
  CADDY_PUBLIC_HOST=""
  CADDY_HTTP_PORT=""
  CADDY_HTTPS_PORT=""
}

configure_bindings() {
  local localhost_only_default postgres_port_default

  localhost_only_default="yes"
  postgres_port_default="127.0.0.1:5432"
  if [[ "$PROXY_MODE" != "caddy" ]]; then
    if prompt_yes_no "Bind container ports to localhost only" "$localhost_only_default"; then
      WEB_PORT="$(default_value "$ROOT_ENV_FILE" "WEB_PORT" "127.0.0.1:3001")"
      SERVER_PORT="$(default_value "$ROOT_ENV_FILE" "SERVER_PORT" "127.0.0.1:3000")"
    else
      WEB_PORT="$(default_value "$ROOT_ENV_FILE" "WEB_PORT" "3001")"
      SERVER_PORT="$(default_value "$ROOT_ENV_FILE" "SERVER_PORT" "3000")"
      postgres_port_default="5432"
    fi
  else
    WEB_PORT="$(default_value "$ROOT_ENV_FILE" "WEB_PORT" "127.0.0.1:3001")"
    SERVER_PORT="$(default_value "$ROOT_ENV_FILE" "SERVER_PORT" "127.0.0.1:3000")"
  fi

  if [[ "$DATABASE_MODE" == "bundled" ]]; then
    POSTGRES_PORT="$(default_value "$ROOT_ENV_FILE" "POSTGRES_PORT" "$postgres_port_default")"
  else
    POSTGRES_PORT=""
  fi

  validate_host_port_binding "$WEB_PORT" || die "Web host binding must be a port or host:port pair."
  validate_host_port_binding "$SERVER_PORT" || die "API host binding must be a port or host:port pair."
  if [[ "$DATABASE_MODE" == "bundled" ]]; then
    validate_host_port_binding "$POSTGRES_PORT" || die "Postgres host binding must be a port or host:port pair."
  fi
}

configure_database() {
  local external_database_default database_default

  POSTGRES_USER="$(default_value "$ROOT_ENV_FILE" "POSTGRES_USER" "postgres")"
  POSTGRES_DB="$(default_value "$ROOT_ENV_FILE" "POSTGRES_DB" "crikket")"
  POSTGRES_PASSWORD="$(default_value "$ROOT_ENV_FILE" "POSTGRES_PASSWORD" "$(generate_secret 32)")"

  external_database_default="$( [[ "$(default_value "$ROOT_ENV_FILE" "CRIKKET_DATABASE_MODE" "bundled")" == "external" ]] && printf 'yes' || printf 'no' )"
  database_default="$(default_value "$SERVER_ENV_FILE" "DATABASE_URL" "")"

  if [[ "$external_database_default" != "yes" && -n "$database_default" && "$database_default" != *"@postgres:5432/"* ]]; then
    external_database_default="yes"
  fi

  if prompt_yes_no "Use an external PostgreSQL database" "$external_database_default"; then
    DATABASE_MODE="external"
    DATABASE_URL="$(prompt_required_value "Database URL" "$database_default")"
    if [[ "$DATABASE_URL" != postgresql://* && "$DATABASE_URL" != postgres://* ]]; then
      die "Database URL must start with postgresql:// or postgres://"
    fi
    return 0
  fi

  DATABASE_MODE="bundled"
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
}

configure_auth() {
  BETTER_AUTH_SECRET="$(default_value "$SERVER_ENV_FILE" "BETTER_AUTH_SECRET" "$(generate_secret 64)")"
  CAPTURE_SUBMIT_TOKEN_SECRET="$(default_value "$SERVER_ENV_FILE" "CAPTURE_SUBMIT_TOKEN_SECRET" "$(generate_secret 64)")"

  if [[ "${#BETTER_AUTH_SECRET}" -lt 32 ]]; then
    die "BETTER_AUTH_SECRET must be at least 32 characters."
  fi

  if [[ "${#CAPTURE_SUBMIT_TOKEN_SECRET}" -lt 32 ]]; then
    die "CAPTURE_SUBMIT_TOKEN_SECRET must be at least 32 characters."
  fi

  GOOGLE_CLIENT_ID=""
  GOOGLE_CLIENT_SECRET=""
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="false"

  if prompt_yes_no "Configure Google OAuth sign-in" "$( [[ -n "$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_ID" "")" && -n "$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_SECRET" "")" ]] && printf 'yes' || printf 'no' )"; then
    GOOGLE_CLIENT_ID="$(prompt_required_value "Google OAuth client ID" "$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_ID" "")")"
    GOOGLE_CLIENT_SECRET="$(prompt_required_value "Google OAuth client secret" "$(default_value "$SERVER_ENV_FILE" "GOOGLE_CLIENT_SECRET" "")")"
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"
  fi
}

configure_storage() {
  STORAGE_BUCKET="$(prompt_required_value "Storage bucket name" "$(default_value "$SERVER_ENV_FILE" "STORAGE_BUCKET" "")")"
  STORAGE_ACCESS_KEY_ID="$(prompt_required_value "Storage access key ID" "$(default_value "$SERVER_ENV_FILE" "STORAGE_ACCESS_KEY_ID" "")")"
  STORAGE_SECRET_ACCESS_KEY="$(prompt_required_value "Storage secret access key" "$(default_value "$SERVER_ENV_FILE" "STORAGE_SECRET_ACCESS_KEY" "")")"
  STORAGE_ENDPOINT="$(normalize_url "$(prompt_value "Storage endpoint URL (leave blank for AWS S3)" "$(default_value "$SERVER_ENV_FILE" "STORAGE_ENDPOINT" "")")")"

  if [[ -n "$STORAGE_ENDPOINT" ]]; then
    validate_url "$STORAGE_ENDPOINT" || die "Storage endpoint must start with http:// or https://"
    STORAGE_REGION="$(prompt_value "Storage region (optional for custom S3-compatible providers)" "$(default_value "$SERVER_ENV_FILE" "STORAGE_REGION" "")")"
  else
    STORAGE_REGION="$(prompt_required_value "Storage region" "$(default_value "$SERVER_ENV_FILE" "STORAGE_REGION" "")")"
  fi

  STORAGE_PUBLIC_URL="$(normalize_url "$(prompt_value "Storage public URL (optional)" "$(default_value "$SERVER_ENV_FILE" "STORAGE_PUBLIC_URL" "")")")"
  if [[ -n "$STORAGE_PUBLIC_URL" ]] && ! validate_url "$STORAGE_PUBLIC_URL"; then
    die "Storage public URL must start with http:// or https://"
  fi
}

configure_optional_services() {
  RESEND_API_KEY=""
  RESEND_FROM_EMAIL=""
  if prompt_yes_no "Configure Resend email delivery now" "no"; then
    RESEND_API_KEY="$(prompt_required_value "Resend API key" "$(default_value "$SERVER_ENV_FILE" "RESEND_API_KEY" "")")"
    RESEND_FROM_EMAIL="$(prompt_required_value "Resend from email" "$(default_value "$SERVER_ENV_FILE" "RESEND_FROM_EMAIL" "")")"
  fi

  UPSTASH_REDIS_REST_URL=""
  UPSTASH_REDIS_REST_TOKEN=""
  if prompt_yes_no "Configure Upstash Redis for capture rate limiting" "no"; then
    UPSTASH_REDIS_REST_URL="$(prompt_required_value "Upstash Redis REST URL" "$(default_value "$SERVER_ENV_FILE" "UPSTASH_REDIS_REST_URL" "")")"
    UPSTASH_REDIS_REST_TOKEN="$(prompt_required_value "Upstash Redis REST token" "$(default_value "$SERVER_ENV_FILE" "UPSTASH_REDIS_REST_TOKEN" "")")"
    validate_url "$UPSTASH_REDIS_REST_URL" || die "Upstash Redis REST URL must start with http:// or https://"
  fi

  TURNSTILE_SITE_KEY=""
  TURNSTILE_SECRET_KEY=""
  if prompt_yes_no "Configure Cloudflare Turnstile for capture bot protection" "no"; then
    TURNSTILE_SITE_KEY="$(prompt_required_value "Turnstile site key" "$(default_value "$SERVER_ENV_FILE" "TURNSTILE_SITE_KEY" "")")"
    TURNSTILE_SECRET_KEY="$(prompt_required_value "Turnstile secret key" "$(default_value "$SERVER_ENV_FILE" "TURNSTILE_SECRET_KEY" "")")"
  fi

  NEXT_PUBLIC_POSTHOG_KEY=""
  NEXT_PUBLIC_POSTHOG_HOST=""
  if prompt_yes_no "Configure PostHog client analytics" "no"; then
    NEXT_PUBLIC_POSTHOG_KEY="$(prompt_required_value "PostHog project key" "$(default_value "$WEB_ENV_FILE" "NEXT_PUBLIC_POSTHOG_KEY" "")")"
    NEXT_PUBLIC_POSTHOG_HOST="$(prompt_required_value "PostHog host URL" "$(default_value "$WEB_ENV_FILE" "NEXT_PUBLIC_POSTHOG_HOST" "")")"
    validate_url "$NEXT_PUBLIC_POSTHOG_HOST" || die "PostHog host URL must start with http:// or https://"
  fi
}

write_root_env() {
  local postgres_bindings=""
  local postgres_settings=""

  if [[ "$DATABASE_MODE" == "bundled" ]]; then
    postgres_bindings="POSTGRES_PORT=${POSTGRES_PORT}"
    postgres_settings=$(cat <<EOF

# Bundled postgres service settings.
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_HOST_AUTH_METHOD=scram-sha-256
EOF
)
  fi

  cat >"$ROOT_ENV_FILE" <<EOF
# Generated by scripts/setup.sh
# Docker Compose host port bindings.

CRIKKET_PROXY_MODE=${PROXY_MODE}
CRIKKET_DATABASE_MODE=${DATABASE_MODE}
WEB_PORT=${WEB_PORT}
SERVER_PORT=${SERVER_PORT}
${postgres_bindings}
CADDY_HTTP_PORT=${CADDY_HTTP_PORT}
CADDY_HTTPS_PORT=${CADDY_HTTPS_PORT}
CADDY_ACME_EMAIL=${CADDY_ACME_EMAIL}
CADDY_PUBLIC_HOST=${CADDY_PUBLIC_HOST}
${postgres_settings}
EOF
}

write_server_env() {
  cat >"$SERVER_ENV_FILE" <<EOF
NODE_ENV=production

# Database
DATABASE_URL=${DATABASE_URL}
CORS_ORIGINS=${CORS_ORIGINS}

# Better Auth
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=${BETTER_AUTH_URL}
BETTER_AUTH_COOKIE_DOMAIN=${BETTER_AUTH_COOKIE_DOMAIN}

# OAuth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

# Self-hosted instances should keep payments disabled.
ENABLE_PAYMENTS=false
POLAR_ACCESS_TOKEN=
POLAR_SUCCESS_URL=
POLAR_WEBHOOK_SECRET=
POLAR_PRO_PRODUCT_ID=
POLAR_PRO_YEARLY_PRODUCT_ID=
POLAR_STUDIO_PRODUCT_ID=
POLAR_STUDIO_YEARLY_PRODUCT_ID=

# Email
RESEND_API_KEY=${RESEND_API_KEY}
RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL}

# Storage
STORAGE_BUCKET=${STORAGE_BUCKET}
STORAGE_ACCESS_KEY_ID=${STORAGE_ACCESS_KEY_ID}
STORAGE_SECRET_ACCESS_KEY=${STORAGE_SECRET_ACCESS_KEY}
STORAGE_REGION=${STORAGE_REGION}
STORAGE_ENDPOINT=${STORAGE_ENDPOINT}
STORAGE_PUBLIC_URL=${STORAGE_PUBLIC_URL}

# Recommended capture protection
CAPTURE_SUBMIT_TOKEN_SECRET=${CAPTURE_SUBMIT_TOKEN_SECRET}
UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}
EOF
}

write_web_env() {
  cat >"$WEB_ENV_FILE" <<EOF
NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}

# PostHog (optional)
NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}

# Crikket Capture (optional)
NEXT_PUBLIC_CRIKKET_KEY=
EOF
}

persist_config() {
  backup_file_if_exists "$ROOT_ENV_FILE"
  backup_file_if_exists "$SERVER_ENV_FILE"
  backup_file_if_exists "$WEB_ENV_FILE"

  write_root_env
  write_server_env
  write_web_env

  chmod 600 "$ROOT_ENV_FILE" "$SERVER_ENV_FILE" "$WEB_ENV_FILE"
}

print_summary() {
  cat <<EOF

Crikket configuration written successfully.

Files:
  - ${ROOT_ENV_FILE}
  - ${SERVER_ENV_FILE}
  - ${WEB_ENV_FILE}
EOF

  cat <<EOF

Deploy mode:
  - Prebuilt GHCR images
Proxy mode:
  - ${PROXY_MODE_LABEL}
Database mode:
  - $( [[ "$DATABASE_MODE" == "external" ]] && printf 'External PostgreSQL' || printf 'Bundled PostgreSQL' )

Domains:
  - Public: ${PUBLIC_HOST}

Auto-filled URLs:
  - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
  - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
  - NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
  - BETTER_AUTH_URL=${BETTER_AUTH_URL}
  - CORS_ORIGINS=${CORS_ORIGINS}
  - BETTER_AUTH_COOKIE_DOMAIN=${BETTER_AUTH_COOKIE_DOMAIN}
  - NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}

Local bindings:
  - Web: ${WEB_PORT}
  - API: ${SERVER_PORT}
EOF

  if [[ "$DATABASE_MODE" == "bundled" ]]; then
    cat <<EOF
  - Postgres: ${POSTGRES_PORT}
EOF
  fi

  if [[ "$PROXY_MODE" == "caddy" ]]; then
    cat <<EOF
  - Caddy HTTP: ${CADDY_HTTP_PORT}
  - Caddy HTTPS: ${CADDY_HTTPS_PORT}
EOF
  fi

  cat <<EOF

Google OAuth callback:
  - ${BETTER_AUTH_URL}/api/auth/callback/google
EOF

  if [[ "$PROXY_MODE" == "caddy" ]]; then
    cat <<EOF

Next step:
  - Point DNS for ${PUBLIC_HOST} at this host.
  - Ensure inbound ports ${CADDY_HTTP_PORT} and ${CADDY_HTTPS_PORT} are open.
EOF
    return 0
  fi

  cat <<EOF

Next step:
  - Point your reverse proxy at ${WEB_PORT} for `/` and ${SERVER_PORT} for `/api` and `/rpc`.
EOF
}

build_compose_file_args() {
  if [[ "$DATABASE_MODE" == "external" ]]; then
    COMPOSE_FILE_ARGS=("-f" "docker-compose.external-db.yml")
  else
    COMPOSE_FILE_ARGS=("-f" "docker-compose.yml")
  fi

  if [[ "$PROXY_MODE" == "caddy" ]]; then
    COMPOSE_FILE_ARGS+=("-f" "docker-compose.caddy.yml")
  fi
}

run_compose_config() {
  build_compose_file_args

  "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILE_ARGS[@]}" config >/dev/null
}

start_stack() {
  require_command docker
  detect_docker_compose || die "Docker Compose is required. Install Docker Compose v2 or docker-compose."

  if ! docker info >/dev/null 2>&1; then
    die "Docker is installed but the daemon is not reachable."
  fi

  info "Validating Docker Compose configuration..."
  run_compose_config

  info "Pulling and starting the Crikket stack..."
  "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILE_ARGS[@]}" pull
  "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILE_ARGS[@]}" up -d

  "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILE_ARGS[@]}" ps
}

main() {
  info "Crikket self-host install wizard"
  ensure_repo_layout
  require_command awk
  require_command cp
  require_command cut
  require_command date
  require_command tr

  if [[ -f "$ROOT_ENV_FILE" || -f "$SERVER_ENV_FILE" || -f "$WEB_ENV_FILE" ]]; then
    info "Existing env files were found. Current values will be used as defaults and backed up before rewrite."
  fi

  configure_domains
  configure_proxy
  configure_database
  configure_bindings
  configure_auth
  configure_storage
  configure_optional_services

  persist_config
  print_summary

  if prompt_yes_no "Start Crikket now with Docker Compose" "yes"; then
    start_stack
    info "Crikket is starting. Follow logs with: ${DOCKER_COMPOSE[*]} logs -f"
  else
    info "Skipping Docker Compose startup."
  fi
}
