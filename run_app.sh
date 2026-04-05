#!/usr/bin/env bash
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Check prerequisites ────────────────────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
  error "Docker not found. Install Docker Desktop and try again."
  exit 1
fi

if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start Docker Desktop and try again."
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1 && ! command -v docker-compose &>/dev/null; then
  error "docker compose / docker-compose not found."
  exit 1
fi

# Use 'docker compose' (v2) if available, else fall back to 'docker-compose' (v1)
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
  warn "Using legacy docker-compose (v1). Consider upgrading to Docker Compose v2."
fi

# ── Change to project root ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
info "Working directory: $SCRIPT_DIR"

# ── Wait for Postgres ──────────────────────────────────────────────────────────
wait_for_postgres() {
  info "Waiting for Postgres to be ready..."
  local retries=30
  until $DC exec -T postgres pg_isready -U idp -d idpdb &>/dev/null; do
    retries=$((retries - 1))
    if [ "$retries" -eq 0 ]; then
      warn "Postgres did not become ready in time."
      return 1
    fi
    sleep 2
  done
  return 0
}

# ── Migrate existing DB (add created_at if missing) ────────────────────────────
migrate_db() {
  info "Running DB migration (created_at column)..."
  $DC exec -T postgres psql -U idp -d idpdb -c \
    "ALTER TABLE \"order\" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();" \
    &>/dev/null && info "Migration OK." || warn "Migration skipped (already up to date)."
}

# ── Seed mock data ─────────────────────────────────────────────────────────────
seed_db() {
  local seed_file="$SCRIPT_DIR/init-db/seed.sql"
  if [ ! -f "$seed_file" ]; then
    warn "seed.sql not found – skipping seed."
    return
  fi
  info "Applying seed data (boxes, items, mock users)..."
  $DC exec -T postgres psql -U idp -d idpdb < "$seed_file" \
    && info "Seed OK." || warn "Seed step produced warnings (may already be applied)."
}

# ── Fix passwords using bcrypt from auth-service container ────────────────────
# The init.sql hash is a placeholder; we recompute the real hash at runtime
# so the passwords actually match what's printed in the summary below.
fix_passwords() {
  info "Generating correct bcrypt hashes (auth-service container)..."

  # Wait up to 20s for auth-service to be up
  local retries=20
  until $DC exec -T auth-service python3 -c "import bcrypt" &>/dev/null 2>&1; do
    retries=$((retries - 1))
    [ "$retries" -eq 0 ] && { warn "auth-service not ready – skipping password fix."; return; }
    sleep 2
  done

  HASH_ADMIN123=$($DC exec -T auth-service python3 -c \
    "import bcrypt; print(bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode())")

  $DC exec -T postgres psql -U idp -d idpdb -c \
    "UPDATE \"user\" SET password = '${HASH_ADMIN123}';" \
    &>/dev/null && info "Passwords updated – all accounts use 'admin123'." \
    || warn "Password update failed."
}

# ── Main ───────────────────────────────────────────────────────────────────────
info "Building images..."
$DC build --parallel

info "Starting all services..."
$DC up -d

# Migrate + seed + fix passwords (all idempotent)
if wait_for_postgres; then
  migrate_db
  seed_db
  fix_passwords
fi

# ── Health summary ─────────────────────────────────────────────────────────────
info "Waiting for services to be healthy (up to 60s)..."
sleep 8

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         MysteryBox is running  🎁        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Frontend   →  ${YELLOW}http://localhost:3000${NC}"
echo -e "  API (Kong) →  ${YELLOW}http://localhost:8000${NC}"
echo -e "  pgAdmin    →  ${YELLOW}http://localhost:5050${NC}  (admin@admin.com / admin)"
echo -e "  Grafana    →  ${YELLOW}http://localhost:3001${NC}  (admin / admin)"
echo -e "  Prometheus →  ${YELLOW}http://localhost:9090${NC}"
echo -e "  Portainer  →  ${YELLOW}http://localhost:9000${NC}"
echo ""
echo -e "  Admin:   ${YELLOW}admin@admin.com${NC}   / ${YELLOW}admin123${NC}
  Creator: ${YELLOW}creator@test.com${NC}  / ${YELLOW}admin123${NC}
  Players: ${YELLOW}veteran@test.com${NC}  / ${YELLOW}admin123${NC}
           ${YELLOW}player@test.com${NC}   / ${YELLOW}admin123${NC}
           ${YELLOW}hunter@test.com${NC}   / ${YELLOW}admin123${NC}
           ${YELLOW}newbie@test.com${NC}   / ${YELLOW}admin123${NC}"
echo ""
echo -e "  To follow logs:  ${YELLOW}$DC logs -f${NC}"
echo -e "  To stop:         ${YELLOW}$DC down${NC}"
echo ""
