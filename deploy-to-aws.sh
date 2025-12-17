#!/bin/bash
# AWS EC2 Deployment Commands for Charlie AI Server
# Run these commands ON the EC2 instance after transferring the image

set -e  # Exit on any error

echo "🚀 Deploying Charlie AI Server on EC2..."

# Load Docker image (run this after transferring charlie-ai-server.tar.gz to EC2)
echo "📦 Loading Docker image..."
docker load < ~/charlie-ai-server.tar.gz

# Stop and remove existing container
echo "🛑 Stopping existing container..."
docker stop charlie-ai 2>/dev/null || true
docker rm charlie-ai 2>/dev/null || true

# Start new container
echo "🐳 Starting new container..."
docker run -d \
  --name charlie-ai \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file ~/charlie-ai.env \
  charlie-ai-server:latest

# Wait for startup
echo "⏳ Waiting for container to start..."
sleep 5

# Check status
echo "✅ Container status:"
docker ps | grep charlie-ai

# Show logs
echo ""
echo "📋 Recent logs:"
docker logs --tail 30 charlie-ai

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test with:"
echo "  curl http://54.88.112.222:8080/healthz"
echo "  curl http://54.88.112.222:8080/social/status"
echo ""
echo "📊 Monitor with:"
echo "  docker logs -f charlie-ai"
echo "  docker stats charlie-ai"
echo ""
