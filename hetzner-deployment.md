# Hetzner CX23 Deployment Guide - Charlie AI Server

## Target Architecture

- Hetzner CX23 single-node Docker host
- Charlie AI container runs as a single instance with `--restart unless-stopped`
- App listens on container port `8080`
- Host mapping is typically `80:8080` for direct HTTP, or `8080:8080` behind a reverse proxy
- Public origin(s) must be allowed in `ALLOWED_ORIGINS`

## Prerequisites

- Hetzner CX23 server provisioned
- SSH access with a user that can run Docker
- Docker installed on the server
- Public DNS pointed at the Hetzner host if you are using a domain
- `deploy.env` populated with all secrets and production settings

## Recommended Runtime Settings

- `PORT=8080`
- `ALLOWED_ORIGINS=https://your-frontend-domain.com,https://your-backend-domain.com`
- `TELEGRAM_POLLING=true` only on the active production host
- `SOCIAL_POSTS_ENABLED=true` only on the active production host
- `SOCIAL_REPLIES_ENABLED=true` only on the active production host

## Deployment Steps

### Option A: Push from local machine over SSH

```bash
./deploy-to-hetzner.sh ubuntu YOUR-HETZNER-IP ghcr.io/your-org/charlie-ai-server:latest ./deploy.env ~/charlie-ai.env
```

### Option B: Manual Docker run on the Hetzner host

```bash
docker load < ~/charlie-ai-server.tar.gz
docker stop charlie-ai 2>/dev/null || true
docker rm charlie-ai 2>/dev/null || true
docker run -d \
  --name charlie-ai \
  --restart unless-stopped \
  -p 80:8080 \
  --env-file ~/charlie-ai.env \
  charlie-ai-server:latest
```

## Verification

```bash
curl http://YOUR-HETZNER-IP/healthz
curl http://YOUR-HETZNER-IP/api/health
curl http://YOUR-HETZNER-IP/api/social/status
curl -X POST http://YOUR-HETZNER-IP/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","message":"Hello Charlie!"}'
```

## Migration Notes

- Keep the AWS EC2 instance alive until the Hetzner host is verified.
- Do not enable Telegram polling or scheduler activity on both hosts at the same time.
- Update the frontend repository to call the new backend base URL before removing AWS.
- If you use a reverse proxy, make sure it forwards `Host` and preserves HTTPS origin headers for the browser widget.
