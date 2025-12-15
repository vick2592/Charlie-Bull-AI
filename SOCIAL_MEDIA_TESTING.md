# Social Media Integration - Testing Guide

## Overview
This guide will help you test the Bluesky and X/Twitter integration for Charlie Bull AI.

## Phase 1: Bluesky Setup & Testing

### Prerequisites
1. A Bluesky account for Charlie Bull
2. Generate an app password at: https://bsky.app/settings/app-passwords

### Configuration

1. **Copy the environment file:**
   ```bash
   cp deploy.env.example deploy.env
   ```

2. **Add Bluesky credentials to `deploy.env`:**
   ```env
   # Bluesky Configuration
   BLUESKY_IDENTIFIER=charliebull.bsky.social
   BLUESKY_PASSWORD=your-app-password-here
   BLUESKY_SERVICE=https://bsky.social
   
   # Enable Bluesky features for testing
   SOCIAL_POSTS_ENABLED=true
   SOCIAL_REPLIES_ENABLED=true
   ```

3. **Keep X credentials disabled for now:**
   ```env
   X_API_KEY=
   X_API_SECRET=
   X_ACCESS_TOKEN=
   X_ACCESS_SECRET=
   X_BEARER_TOKEN=
   ```

### Testing Steps

#### 1. Start the Server
```bash
npm run dev
```

The server should log:
- `Successfully authenticated with Bluesky`
- `social_media_scheduler_initialized`

#### 2. Check Status
```bash
curl http://localhost:8080/social/status
```

Expected response:
```json
{
  "enabled": {
    "posts": true,
    "replies": true
  },
  "platforms": {
    "bluesky": true,
    "x": false
  },
  "scheduler": {
    "jobsRunning": 5,
    "currentAfternoonIndex": 0,
    "nextAfternoonTime": "17:00",
    "queueStats": {
      "quota": {
        "date": "2025-12-15",
        "postsCount": 0,
        "repliesCount": 0,
        "postsLimit": 2,
        "repliesLimit": 3
      },
      "pendingInteractions": 0,
      "scheduledPosts": 0,
      "sentRepliesToday": 0
    }
  }
}
```

#### 3. Test Manual Post
```bash
curl -X POST http://localhost:8080/social/test/bluesky \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Charlie Bull! 🐂 Testing the new social integration."}'
```

Check your Bluesky account to verify the post appeared.

#### 4. Test Interaction Detection

**On Bluesky:**
1. Mention @charliebull in a post or reply to Charlie's post
2. Wait 30 seconds (or trigger manually)

**Trigger manual check:**
```bash
curl -X POST http://localhost:8080/social/check-interactions
```

**View pending interactions:**
```bash
curl http://localhost:8080/social/interactions/pending
```

Expected response:
```json
{
  "count": 1,
  "interactions": [
    {
      "id": "at://...",
      "platform": "bluesky",
      "type": "mention",
      "author": "someuser.bsky.social",
      "content": "Hey @charliebull, tell me about...",
      "timestamp": "2025-12-15T...",
      "processed": false
    }
  ]
}
```

#### 5. Check Daily Quota
```bash
curl http://localhost:8080/social/quota
```

#### 6. Monitor Logs
Watch for:
- ✅ Authentication success
- ✅ Post creation logs
- ✅ Interaction fetching
- ✅ Reply generation and sending
- ✅ Quota updates

### Scheduled Posts Testing

To test scheduled posts without waiting:

1. **Temporarily modify the schedule** in `src/services/socialMediaScheduler.ts`:
   ```typescript
   // Change from '0 8 * * *' to run every 2 minutes
   const job = cron.schedule('*/2 * * * *', async () => {
     logger.info('Running morning post');
     await this.createScheduledPost('morning');
   });
   ```

2. Restart the server and wait 2 minutes to see a post.

3. **Revert the change** after testing.

### Rate Limit Testing

1. Create 2 test posts (should succeed)
2. Try a 3rd post (should fail due to daily limit)
3. Check quota: `curl http://localhost:8080/social/quota`
4. Trigger midnight reset manually by restarting the server the next day

## Phase 2: X/Twitter Setup & Testing

### Prerequisites
1. X Developer Account: https://developer.twitter.com/
2. Create a Project and App
3. Generate OAuth 1.0a User Access Tokens with Read & Write permissions

### Configuration

Add to `deploy.env`:
```env
# X/Twitter Configuration
X_API_KEY=your-api-key
X_API_SECRET=your-api-secret
X_ACCESS_TOKEN=your-access-token
X_ACCESS_SECRET=your-access-secret
X_BEARER_TOKEN=your-bearer-token
```

### Testing Steps

Follow the same steps as Bluesky, but use:
```bash
curl -X POST http://localhost:8080/social/test/x \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello from Charlie Bull on X! 🐂"}'
```

## Important Notes

### Rate Limits
- **Posts:** 2 per day (8am, alternating 5pm/9pm)
- **Replies:** 3 per day (processed at midnight)

### Content Generation
- Uses Gemini AI to generate posts and replies
- Maintains Charlie Bull's persona
- Keeps content under 280 characters

### Scheduling
- **00:00** - Process pending interactions queue
- **01:00** - Clean up old data
- **08:00** - Morning post
- **17:00** - Afternoon post (odd days)
- **21:00** - Evening post (even days)
- **Every 30 min** - Check for new interactions

## Monitoring & Debugging

### Health Check
```bash
curl http://localhost:8080/health
```

### View All Status
```bash
curl http://localhost:8080/social/status | jq
```

### Common Issues

**Issue:** "Bluesky authentication failed"
- **Solution:** Verify your app password is correct and not expired

**Issue:** "Daily post limit reached"
- **Solution:** Wait until midnight or restart server the next day

**Issue:** "Failed to generate content"
- **Solution:** Check GEMINI_API_KEY is set correctly

**Issue:** Scheduler not running
- **Solution:** Ensure SOCIAL_POSTS_ENABLED=true or SOCIAL_REPLIES_ENABLED=true

## Production Deployment

Before deploying to production:

1. ✅ Test all features thoroughly on Bluesky
2. ✅ Test X integration separately
3. ✅ Verify rate limits work correctly
4. ✅ Test scheduled posts over 24-48 hours
5. ✅ Monitor error logs
6. ✅ Set up proper monitoring/alerts
7. ✅ Keep X features disabled until ready
8. ✅ Gradually enable features

## Next Steps

After successful testing:
1. Deploy to AWS
2. Monitor initial interactions
3. Adjust content generation prompts based on engagement
4. Update Charlie's knowledge base (Phase 3)
5. Add analytics tracking

## Support

If you encounter issues:
1. Check logs: `npm run dev` shows detailed logs
2. Verify environment variables are set
3. Test API credentials separately
4. Check Bluesky/X API status pages
