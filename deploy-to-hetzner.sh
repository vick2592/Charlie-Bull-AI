#!/bin/bash
# Deploy Charlie AI Server to a Hetzner host over SSH.

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <user> <host> <image-ref> [local-env-file] [remote-env-file] [ssh-key-file] [container-name] [host-port] [container-port]"
  echo "Example: $0 root 204.168.199.235 ghcr.io/org/charlie-ai-server:latest ./deploy.env ~/charlie-ai.env ~/.ssh/id_ed25519 charlie-ai 80 8080"
  exit 1
fi

REMOTE_USER="$1"
REMOTE_HOST="$2"
IMAGE_REF="$3"
LOCAL_ENV_FILE="${4:-./deploy.env}"
REMOTE_ENV_FILE="${5:-~/charlie-ai.env}"
SSH_KEY_FILE="${6:-}"
CONTAINER_NAME="${7:-charlie-ai}"
HOST_PORT="${8:-80}"
CONTAINER_PORT="${9:-8080}"

SSH_OPTS=(-o BatchMode=yes)
SCP_OPTS=(-o BatchMode=yes)

if [[ -n "${SSH_KEY_FILE}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY_FILE}")
  SCP_OPTS+=(-i "${SSH_KEY_FILE}")
fi

ARCHIVE_NAME="charlie-ai-server.tar.gz"

echo "Building image for linux/amd64..."
docker build --platform linux/amd64 -t charlie-ai-server:latest .

echo "Saving image to ${ARCHIVE_NAME}..."
docker save charlie-ai-server:latest | gzip > "${ARCHIVE_NAME}"

echo "Copying image archive to Hetzner..."
scp "${SCP_OPTS[@]}" "${ARCHIVE_NAME}" "${REMOTE_USER}@${REMOTE_HOST}:~/"

if [[ ! -f "${LOCAL_ENV_FILE}" ]]; then
  echo "Missing local env file: ${LOCAL_ENV_FILE}" >&2
  exit 1
fi

echo "Copying environment file to Hetzner..."
scp "${SCP_OPTS[@]}" "${LOCAL_ENV_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:~/charlie-ai.env"

echo "Running remote deployment..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" bash -s -- "${IMAGE_REF}" "${REMOTE_ENV_FILE}" "${CONTAINER_NAME}" "${HOST_PORT}" "${CONTAINER_PORT}" <<'EOF'
set -euo pipefail

IMAGE_REF="$1"
REMOTE_ENV_FILE="$2"
CONTAINER_NAME="$3"
HOST_PORT="$4"
CONTAINER_PORT="$5"

echo "Loading image archive..."
docker load < ~/charlie-ai-server.tar.gz

echo "Tagging loaded image as ${IMAGE_REF}..."
docker tag charlie-ai-server:latest "${IMAGE_REF}"

echo "Stopping existing container if present..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

echo "Starting new container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  --env-file "${REMOTE_ENV_FILE}" \
  "${IMAGE_REF}"

sleep 5

echo "Recent logs:"
docker logs --tail 30 "${CONTAINER_NAME}"

echo "Health check:"
curl -f "http://127.0.0.1:${HOST_PORT}/healthz"
echo
curl -f "http://127.0.0.1:${HOST_PORT}/api/health"
echo
curl -f "http://127.0.0.1:${HOST_PORT}/api/social/status"
echo
EOF

echo "Deployment complete."
