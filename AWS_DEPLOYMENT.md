# AWS EC2 Deployment Guide - Charlie AI Server

## Prerequisites
- ✅ Docker image built: `charlie-ai-server:latest`
- ✅ AWS EC2 instance running
- ✅ SSH access configured
- ✅ Security group allows port 8080 (or your chosen port)

## Deployment Steps

### Step 1: Save Docker Image
```bash
# On your local machine
cd "/Users/vickzmacbook/Documents/Sites/Charlie Bull/charlie-ai-server"
docker save charlie-ai-server:latest | gzip > charlie-ai-server.tar.gz
```

### Step 2: Transfer to EC2
```bash
# Replace with your EC2 details
scp -i /path/to/your-key.pem charlie-ai-server.tar.gz ec2-user@YOUR-EC2-IP:~/
```

### Step 3: Transfer Environment File
```bash
# Copy your .env file (with real credentials)
scp -i /path/to/your-key.pem .env ec2-user@YOUR-EC2-IP:~/charlie-ai.env
```

### Step 4: SSH into EC2 and Deploy
```bash
# SSH into your EC2 instance
ssh -i /path/to/your-key.pem ec2-user@YOUR-EC2-IP

# Load Docker image
docker load < charlie-ai-server.tar.gz

# Stop any existing container
docker stop charlie-ai 2>/dev/null || true
docker rm charlie-ai 2>/dev/null || true

# Run the container
docker run -d \
  --name charlie-ai \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file ~/charlie-ai.env \
  charlie-ai-server:latest

# Check logs
docker logs -f charlie-ai
```

### Step 5: Verify Deployment
```bash
# Test health endpoint
curl http://YOUR-EC2-IP:8080/healthz

# Test chat endpoint
curl -X POST http://YOUR-EC2-IP:8080/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "message": "Hello Charlie!"}'

# Check social media status
curl http://YOUR-EC2-IP:8080/social/status
```

## Alternative: Using Docker Hub

### Option A: Push to Docker Hub (Public)
```bash
# Tag image
docker tag charlie-ai-server:latest YOUR-DOCKERHUB-USERNAME/charlie-ai-server:latest

# Login to Docker Hub
docker login

# Push
docker push YOUR-DOCKERHUB-USERNAME/charlie-ai-server:latest

# On EC2, pull and run
docker pull YOUR-DOCKERHUB-USERNAME/charlie-ai-server:latest
docker run -d \
  --name charlie-ai \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file ~/charlie-ai.env \
  YOUR-DOCKERHUB-USERNAME/charlie-ai-server:latest
```

### Option B: AWS ECR (Private Registry)
```bash
# Create ECR repository (one-time)
aws ecr create-repository --repository-name charlie-ai-server --region us-east-1

# Get login command
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag charlie-ai-server:latest YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/charlie-ai-server:latest
docker push YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/charlie-ai-server:latest

# On EC2, pull and run
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com
docker pull YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/charlie-ai-server:latest
docker run -d \
  --name charlie-ai \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file ~/charlie-ai.env \
  YOUR-AWS-ACCOUNT-ID.dkr.ecr.us-east-1.amazonaws.com/charlie-ai-server:latest
```

## Environment Variables on EC2

Make sure your `charlie-ai.env` file on EC2 has:

```bash
# Core
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MODELS=gemini-2.0-flash,gemini-2.5-flash,gemini-2.5-pro
PORT=8080

# Social Media - ENABLE automation
BLUESKY_IDENTIFIER=charliebull.art
BLUESKY_PASSWORD=your-app-password
X_API_KEY=your-key
X_API_SECRET=your-secret
X_ACCESS_TOKEN=your-token
X_ACCESS_SECRET=your-secret
SOCIAL_POSTS_ENABLED=true
SOCIAL_REPLIES_ENABLED=true

# Optional: Telegram
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_POLLING=true
```

## Monitoring Commands

```bash
# View logs
docker logs -f charlie-ai

# Check if container is running
docker ps | grep charlie-ai

# Restart container
docker restart charlie-ai

# Update to new version
docker pull YOUR-IMAGE:latest
docker stop charlie-ai
docker rm charlie-ai
docker run -d --name charlie-ai --restart unless-stopped -p 8080:8080 --env-file ~/charlie-ai.env YOUR-IMAGE:latest

# Check resource usage
docker stats charlie-ai
```

## Troubleshooting

### Container won't start
```bash
docker logs charlie-ai
# Check for env var issues or port conflicts
```

### Port already in use
```bash
# Find what's using port 8080
sudo lsof -i :8080
# Kill that process or use a different port
```

### Social media not posting
```bash
# Check logs for authentication errors
docker logs charlie-ai | grep -i "bluesky\|twitter\|error"

# Verify env vars are set
docker exec charlie-ai printenv | grep -i "bluesky\|x_api"
```

## Security Best Practices

1. **Firewall Rules**: Only open port 8080 to necessary IPs
2. **Environment Variables**: Never commit .env with real credentials
3. **Updates**: Regularly update the image and rebuild
4. **Logs**: Monitor logs for suspicious activity
5. **Backups**: Keep backup of your .env file securely

## Next Steps After Deployment

1. Verify health endpoint is accessible
2. Test chat functionality
3. Confirm social media automation is running
4. Check scheduler logs at 8:00 AM for first post
5. Monitor for 24 hours to ensure stability
6. Set up CloudWatch or monitoring alerts (optional)

---

**Need Help?**
- Check logs: `docker logs charlie-ai`
- Test locally first before deploying
- Ensure EC2 security group allows inbound traffic on port 8080
