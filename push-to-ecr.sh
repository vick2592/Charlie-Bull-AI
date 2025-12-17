#!/bin/bash
# Push Docker Image to AWS ECR
# Run this from your LOCAL machine after building a new version

set -e

# Configuration
ECR_REGISTRY="184198557383.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPO="charlie-ai-server"
AWS_REGION="us-east-1"

# Get version from user or use timestamp
if [ -z "$1" ]; then
  VERSION="v$(date +%Y%m%d-%H%M%S)"
  echo "No version specified, using: $VERSION"
else
  VERSION="$1"
  echo "Using version: $VERSION"
fi

echo "🔐 Authenticating with AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

echo "🏷️  Tagging image..."
docker tag charlie-ai-server:latest $ECR_REGISTRY/$ECR_REPO:$VERSION
docker tag charlie-ai-server:latest $ECR_REGISTRY/$ECR_REPO:latest

echo "📤 Pushing to ECR..."
docker push $ECR_REGISTRY/$ECR_REPO:$VERSION
docker push $ECR_REGISTRY/$ECR_REPO:latest

echo ""
echo "✅ Push complete!"
echo ""
echo "📋 Deployment info:"
echo "  Image: $ECR_REGISTRY/$ECR_REPO:$VERSION"
echo "  Latest: $ECR_REGISTRY/$ECR_REPO:latest"
echo ""
echo "🚀 To deploy on EC2, run:"
echo "  ssh ec2-user@54.88.112.222"
echo "  ./update-from-ecr.sh $VERSION"
echo ""
