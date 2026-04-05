#!/usr/bin/env bash
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "${CYAN}[....]${NC}  $*"; }

# ── Change to project root ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Pick docker compose binary ─────────────────────────────────────────────────
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi

# ── Confirm ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║   ⚠  FULL CLEAN – this will permanently delete:     ║${NC}"
echo -e "${RED}║      • all project containers                        ║${NC}"
echo -e "${RED}║      • all project images                            ║${NC}"
echo -e "${RED}║      • all project volumes  (DATABASE WILL BE LOST)  ║${NC}"
echo -e "${RED}║      • all project networks                          ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
read -r -p "  Type YES to continue: " confirm
if [ "$confirm" != "YES" ]; then
  info "Aborted."
  exit 0
fi
echo ""

# ── 1. Stop & remove containers, networks, volumes defined in compose ──────────
step "Stopping and removing containers, networks, volumes..."
$DC down --volumes --remove-orphans 2>/dev/null && info "Containers/networks/volumes removed." \
  || warn "docker compose down had warnings (containers may not have been running)."

# ── 2. Remove images built by this project ────────────────────────────────────
step "Removing project images..."
PROJECT_NAME="$(basename "$SCRIPT_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"

# Collect image IDs for images whose names match this project
IMAGE_IDS=$(docker images --format '{{.Repository}}:{{.ID}}' \
  | grep -E "^${PROJECT_NAME}[-_]|^${PROJECT_NAME}/" \
  | awk -F: '{print $2}' \
  | sort -u 2>/dev/null || true)

# Also grab any images listed directly by compose
COMPOSE_IMAGES=$(docker compose images -q 2>/dev/null || true)

ALL_IMAGES=$(printf '%s\n%s\n' "$IMAGE_IDS" "$COMPOSE_IMAGES" | grep -v '^$' | sort -u || true)

if [ -n "$ALL_IMAGES" ]; then
  echo "$ALL_IMAGES" | xargs docker rmi -f 2>/dev/null && info "Project images removed." \
    || warn "Some images could not be removed (may be used elsewhere)."
else
  warn "No project images found to remove."
fi

# ── 3. Prune dangling images left over from builds ────────────────────────────
step "Pruning dangling (untagged) images..."
DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null || true)
if [ -n "$DANGLING" ]; then
  echo "$DANGLING" | xargs docker rmi -f 2>/dev/null && info "Dangling images removed." \
    || warn "Some dangling images could not be removed."
else
  info "No dangling images found."
fi

# ── 4. Remove any leftover named volumes with the project prefix ───────────────
step "Checking for leftover named volumes..."
LEFTOVER_VOLS=$(docker volume ls --format '{{.Name}}' \
  | grep -E "^${PROJECT_NAME}[_-]" 2>/dev/null || true)
if [ -n "$LEFTOVER_VOLS" ]; then
  echo "$LEFTOVER_VOLS" | xargs docker volume rm 2>/dev/null && info "Leftover volumes removed." \
    || warn "Some volumes could not be removed."
else
  info "No leftover volumes found."
fi

# ── 5. Remove leftover networks ───────────────────────────────────────────────
step "Checking for leftover networks..."
LEFTOVER_NETS=$(docker network ls --format '{{.Name}}' \
  | grep -E "^${PROJECT_NAME}[_-]" 2>/dev/null || true)
if [ -n "$LEFTOVER_NETS" ]; then
  echo "$LEFTOVER_NETS" | xargs docker network rm 2>/dev/null && info "Leftover networks removed." \
    || warn "Some networks could not be removed."
else
  info "No leftover networks found."
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Clean complete. Slate is wiped. ✓  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Run ${YELLOW}bash start.sh${NC} to rebuild and start fresh."
echo ""
