#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/113012DavidT/Arroyo_seco_app.git}"
TARGET_DIR="${2:-$HOME/back-alojamientos}"

echo "==> Installing base packages"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable docker
  sudo systemctl start docker
fi

sudo usermod -aG docker "$USER" || true

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "==> Cloning repository into $TARGET_DIR"
  git clone "$REPO_URL" "$TARGET_DIR"
else
  echo "==> Repository already exists, pulling latest changes"
  git -C "$TARGET_DIR" pull origin main
fi

echo
echo "Bootstrap complete. Next steps:"
echo "1. Create $TARGET_DIR/back-alojamientos-main/.env"
echo "2. Create $TARGET_DIR/front-alojamientos-main/.env"
echo "3. Run docker login ghcr.io if packages are private"
echo "4. Start backend: cd $TARGET_DIR/back-alojamientos-main && docker compose up -d"
echo "5. Start frontend: cd $TARGET_DIR/front-alojamientos-main && docker compose up -d"