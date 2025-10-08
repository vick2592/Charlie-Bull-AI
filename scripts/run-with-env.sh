#!/usr/bin/env bash
# Helper script to run the charlie container using an env file.
# Usage: ./scripts/run-with-env.sh /path/to/envfile [image-tag]
# Defaults to ./deploy.env and image tag tokenomics2 if not supplied.

set -euo pipefail
ENV_FILE=${1:-./deploy.env}
IMAGE_TAG=${2:-184198557383.dkr.ecr.us-east-1.amazonaws.com/charlie-ai-server:tokenomics2}

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

echo "Using env file: $ENV_FILE" >&2
echo "Image: $IMAGE_TAG" >&2

# Stop existing
if docker ps --format '{{.Names}}' | grep -q '^charlie$'; then
  docker stop charlie >/dev/null 2>&1 || true
fi
if docker ps -a --format '{{.Names}}' | grep -q '^charlie$'; then
  docker rm charlie >/dev/null 2>&1 || true
fi

docker run -d --name charlie -p 80:8080 --env-file "$ENV_FILE" "$IMAGE_TAG"
echo "Container started. Inspect with: docker logs -f charlie"