#!/bin/bash
# Update Charlie AI Server from ECR
# Run this script ON THE EC2 SERVER

set -e

# Configuration
ECR_REGISTRY="184198557383.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPO="charlie-ai-server"
AWS_REGION="us-east-1"
CONTAINER_NAME="charlie-ai"

# Get version from user or use latest
if [ -z "$1" ]; then
  IMAGE_TAG="latest"
  echo "No version specified, pulling latest..."
else
  IMAGE_TAG="$1"
  echo "Pulling version: $IMAGE_TAG"
fi

echo "🔐 Authenticating with AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

echo "📥 Pulling image from ECR..."
docker pull $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG

echo "🛑 Stopping and removing old container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "🚀 Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p 80:8080 \
  --env-file ~/deploy.env \
  --restart unless-stopped \
  $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG

echo ""
echo "⏳ Waiting for container to be ready..."
sleep 5

echo ""
echo "🔍 Checking container status..."
docker ps | grep $CONTAINER_NAME

echo ""
echo "🏥 Health check..."
curl -f http://localhost/healthz || echo "❌ Health check failed"

echo ""
echo "📊 Social media status..."
curl -s http://localhost/api/social/status | jq '.' || echo "Response received"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Useful commands:"
echo "  View logs:     docker logs -f $CONTAINER_NAME"
echo "  Restart:       docker restart $CONTAINER_NAME"
echo "  Stop:          docker stop $CONTAINER_NAME"
echo "  Health check:  curl http://localhost/healthz"
echo ""
