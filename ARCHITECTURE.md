# Social Media Integration Architecture

## System Overview

The Charlie Bull AI Server now includes automated social media management for Bluesky and X (Twitter), with rate limiting, scheduling, and intelligent content generation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Charlie AI Server                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  Fastify     │──────│    Routes    │                   │
│  │   Server     │      │  /social/*   │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                                                   │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐ │
│  │         Social Media Scheduler (node-cron)           │ │
│  │  • 00:00 - Process pending queue                     │ │
│  │  • 08:00 - Morning post                              │ │
│  │  • 17:00/21:00 - Afternoon/Evening (alternating)     │ │
│  │  • */30 - Check interactions                         │ │
│  └──────┬───────────────────────────────────────────────┘ │
│         │                                                   │
│  ┌──────▼──────────┐    ┌────────────────┐               │
│  │ Social Media    │    │  Gemini AI     │               │
│  │     Queue       │    │   (Content)    │               │
│  │  • Pending      │    │  Generation    │               │
│  │  • Quotas       │    └────────────────┘               │
│  │  • History      │                                       │
│  └──────┬──────────┘                                       │
│         │                                                   │
│    ┌────┴─────┐                                           │
│    │          │                                           │
│ ┌──▼───┐  ┌──▼───┐                                      │
│ │ BSky │  │  X   │                                      │
│ │Client│  │Client│                                      │
│ └──┬───┘  └──┬───┘                                      │
└────┼─────────┼────────────────────────────────────────────┘
     │         │
     │         │
┌────▼───┐ ┌──▼────┐
│Bluesky │ │   X   │
│  API   │ │  API  │
└────────┘ └───────┘
```

## Core Components

### 1. Configuration (`src/lib/config.ts`)
- Manages all environment variables
- Validates and parses credentials
- Feature flags for enabling/disabling features

**Key Settings:**
- `BLUESKY_IDENTIFIER`, `BLUESKY_PASSWORD`
- `X_API_KEY`, `X_API_SECRET`, etc.
- `SOCIAL_POSTS_ENABLED`, `SOCIAL_REPLIES_ENABLED`

### 2. Platform Clients

#### BlueskyClient (`src/services/blueskyClient.ts`)
- Uses AT Protocol (`@atproto/api`)
- Handles authentication via app passwords
- Operations:
  - `authenticate()` - Login to Bluesky
  - `createPost(content)` - Create a new post
  - `replyToPost(uri, cid, content)` - Reply to a post
  - `fetchInteractions()` - Get mentions and replies
  - `markAsRead(timestamp)` - Mark notifications as read

#### XClient (`src/services/xClient.ts`)
- Uses Twitter API v2 (`twitter-api-v2`)
- OAuth 1.0a authentication
- Operations:
  - `authenticate()` - Verify credentials
  - `createPost(content)` - Create a tweet
  - `replyToPost(tweetId, content)` - Reply to a tweet
  - `fetchInteractions()` - Get mentions

### 3. Queue Management (`src/services/socialMediaQueue.ts`)

**Responsibilities:**
- Track pending interactions
- Manage daily quotas
- Store scheduled posts
- Track sent replies

**Key Methods:**
- `canPost()` / `canReply()` - Check rate limits
- `incrementPostCount()` / `incrementReplyCount()` - Update quotas
- `resetDailyQuota()` - Reset at midnight
- `addPendingInteraction()` - Queue new interactions
- `getPendingInteractions()` - Retrieve unprocessed items
- `cleanup()` - Remove old data

**Data Structures:**
```typescript
DailyQuota {
  date: string
  postsCount: number
  repliesCount: number
  postsLimit: 2
  repliesLimit: 3
}

SocialInteraction {
  id: string
  platform: 'bluesky' | 'x'
  type: 'mention' | 'reply' | 'quote'
  authorHandle: string
  content: string
  processed: boolean
}
```

### 4. Scheduler (`src/services/socialMediaScheduler.ts`)

**Cron Jobs:**
```javascript
'0 0 * * *'      // Midnight - Process queue & reset quotas
'0 8 * * *'      // 8 AM - Morning post
'0 17 * * *'     // 5 PM - Afternoon post (alternating)
'0 21 * * *'     // 9 PM - Evening post (alternating)
'*/30 * * * *'   // Every 30 min - Check interactions
'0 1 * * *'      // 1 AM - Cleanup old data
```

**Workflow:**
1. **Scheduled Posts:**
   - Check if quota allows posting
   - Generate content via Gemini AI
   - Post to enabled platforms
   - Increment quota counter

2. **Interaction Processing:**
   - Fetch new mentions/replies
   - Add to pending queue
   - Generate AI responses
   - Send replies (respecting quota)
   - Mark as processed

3. **Midnight Queue Processing:**
   - Reset daily quotas
   - Process up to 3 pending interactions
   - Send responses

### 5. Routes (`src/routes/social.ts`)

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/social/status` | Get scheduler & queue status |
| GET | `/social/quota` | Get current daily quota |
| POST | `/social/test/bluesky` | Test Bluesky post (dev only) |
| POST | `/social/test/x` | Test X post (dev only) |
| POST | `/social/check-interactions` | Manually trigger interaction check |
| GET | `/social/interactions/pending` | List pending interactions |

## Content Generation

Uses Gemini AI for intelligent content:

### Post Generation
```
Prompt: "Generate a short, engaging social media post for Charlie Bull token.
Time of day: {morning/afternoon/evening}
Keep it under 280 characters.
Be friendly, informative, and community-focused."
```

### Reply Generation
```
Prompt: "You received this message: {original}
Generate a friendly, helpful reply as Charlie Bull.
Keep it under 280 characters.
Be engaging and professional."
```

## Rate Limiting Strategy

### Why These Limits?
- **X API Free Tier:** Strict limits on posting
- **Quality over Quantity:** Avoid spam
- **Community Engagement:** Focus on meaningful interactions

### Implementation
- **Posts:** 2/day (morning + afternoon/evening)
- **Replies:** 3/day (processed at midnight)
- **Alternating Times:** 5pm and 9pm alternate daily to vary posting schedule

### Quota Tracking
```typescript
{
  date: "2025-12-15",
  postsCount: 1,     // Current
  repliesCount: 2,   // Current
  postsLimit: 2,     // Max
  repliesLimit: 3    // Max
}
```

## Data Flow

### Posting Flow
```
Scheduler (8am)
  → Check canPost()
  → Generate content via Gemini
  → blueskyClient.createPost()
  → xClient.createPost()
  → incrementPostCount()
  → Log success
```

### Interaction Flow
```
Scheduler (every 30min)
  → blueskyClient.fetchInteractions()
  → xClient.fetchInteractions()
  → socialMediaQueue.addPendingInteraction()
  → If canReply():
      → Generate reply via Gemini
      → Send reply
      → incrementReplyCount()
      → markInteractionProcessed()
```

### Midnight Queue Processing
```
Scheduler (midnight)
  → resetDailyQuota()
  → Get pendingInteractions (up to 3)
  → For each:
      → If canReply():
          → Generate reply
          → Send reply
          → incrementReplyCount()
          → markProcessed()
```

## Error Handling

### Authentication Failures
- Retry mechanism built-in
- Logs detailed error messages
- Graceful degradation (continues with other platforms)

### Rate Limit Protection
- Pre-check before posting
- Queue overflow handling
- Graceful quota exhaustion

### Content Generation Failures
- Fallback messages
- Retry logic
- Detailed error logging

## Monitoring & Observability

### Logs
- Authentication events
- Post/reply success/failure
- Quota updates
- Interaction processing
- Error details with context

### Status Endpoint
Real-time visibility into:
- Enabled features
- Platform connectivity
- Running cron jobs
- Queue statistics
- Daily quotas

## Security Considerations

### Credentials
- Environment variables only
- Never committed to git
- App passwords for Bluesky (not main password)
- OAuth tokens for X (scoped permissions)

### API Access
- No public posting endpoints
- Test endpoints for development only
- Should add authentication in production

### Rate Limiting
- Prevents abuse
- Protects API quotas
- Respects platform terms of service

## Scalability

### Current State
- In-memory queue (sufficient for MVP)
- Single instance

### Future Enhancements
- Persistent storage (Redis/Database)
- Multiple instances with distributed locks
- Analytics and engagement tracking
- A/B testing for content
- Sentiment analysis

## Testing Strategy

### Unit Tests
- Queue management logic
- Quota calculations
- Content generation

### Integration Tests
- Platform authentication
- Post creation
- Interaction fetching

### Manual Testing
- Use test endpoints
- Monitor logs
- Verify platform visibility
- Check rate limits

## Deployment Considerations

### Environment Variables
Required in production:
```env
BLUESKY_IDENTIFIER=charliebull.bsky.social
BLUESKY_PASSWORD=****
X_API_KEY=****
X_API_SECRET=****
X_ACCESS_TOKEN=****
X_ACCESS_SECRET=****
SOCIAL_POSTS_ENABLED=true
SOCIAL_REPLIES_ENABLED=true
```

### Server Requirements
- Node.js 20+
- Persistent uptime (for cron jobs)
- Timezone consideration (UTC recommended)

### Monitoring
- Health checks
- Error alerting
- Quota monitoring
- Platform status checks

## Future Enhancements (Phase 3)

### Knowledge Base Updates
- Tokenomics information
- Social media links
- DeFi interactions
- Supported chains
- Project milestones

### Advanced Features
- Thread creation
- Image posting
- Link previews
- Hashtag optimization
- Engagement analytics
- Community sentiment tracking
- Automated reporting

### Content Strategy
- Topic rotation
- Market updates
- Community highlights
- Educational content
- Event announcements
