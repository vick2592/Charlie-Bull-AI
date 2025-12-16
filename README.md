# Charlie AI Server (Gemini Powered)

Fastify + TypeScript microservice exposing `POST /v1/chat` backed by Gemini, providing a persona-driven DeFi assistant named **Charlie**. Now featuring automated social media management for Bluesky and X/Twitter!

## Status
✅ **Production Ready** - Core features implemented:
- ✅ Config validation (zod)
- ✅ Memory store with session management
- ✅ Rate limiting (session + global)
- ✅ Safety filter
- ✅ Persona prompt with knowledge base integration
- ✅ Gemini client wrapper with fallback models
- ✅ /v1/chat route with platform-specific responses
- ✅ Telegram bot integration
- ✅ **Social Media Automation** (Bluesky & X/Twitter)
- ✅ Automated posting scheduler (2 posts/day)
- ✅ Intelligent reply system (3 replies/day)
- ✅ Comprehensive knowledge base (tokenomics, roadmap, social links)

## Quick Start (Dev)

1. Copy env file:
```bash
cp .env.example .env
```
2. Install deps (pnpm recommended):
```bash
pnpm install
```
3. Run dev server:
```bash
pnpm dev
```
4. Health check:
```bash
curl -s localhost:8080/healthz
```

## Endpoints
| Method | Path                    | Description |
|--------|-------------------------|-------------|
| GET    | /healthz                | Lightweight liveness probe that does not touch Gemini; returns `{ "status": "ok" }`. |
| POST   | /v1/chat                | Chat with Charlie (persona + safety + rate limiting + memory). |
| GET    | /social/status          | View social media automation status and daily quotas. |
| GET    | /social/queue           | View pending interactions queue for both platforms. |
| POST   | /social/test/bluesky    | Test Bluesky posting functionality. |
| POST   | /social/test/x          | Test X/Twitter posting functionality. |

### Health Endpoint Details
`GET /healthz` is intentionally minimal so that infrastructure (load balancers, k8s probes, uptime monitors) can call it frequently without generating model usage or mutating any state. If this returns a non-200, something is fundamentally wrong with the service process (crashed dependencies, event loop blocked, etc.). In future you could expand it to include dependency checks (Redis, DB) but keep it fast (<5ms) and avoid external network calls.

## Env Vars
See `.env.example` or `deploy.env.example`. Key variables:

### Core Configuration
- `GEMINI_API_KEY` - Your Google Gemini API key (required)
- `GEMINI_MODEL` - Primary model (default: `gemini-2.0-flash`)
- `GEMINI_MODELS` - Comma-separated fallback models
- `PORT` - Server port (default: 8080)

### Social Media Integration
- `BLUESKY_IDENTIFIER` - Your Bluesky handle (e.g., `charliebull.art`)
- `BLUESKY_PASSWORD` - App password from https://bsky.app/settings/app-passwords
- `X_API_KEY` - Twitter API key
- `X_API_SECRET` - Twitter API secret
- `X_ACCESS_TOKEN` - Twitter access token
- `X_ACCESS_SECRET` - Twitter access token secret
- `SOCIAL_POSTS_ENABLED` - Enable automated posting (default: `false`)
- `SOCIAL_REPLIES_ENABLED` - Enable automated replies (default: `false`)

### Telegram Bot
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `TELEGRAM_POLLING` - Enable polling (default: `false`)
- `TELEGRAM_ALLOWED_USER_IDS` - Comma-separated user ID allowlist

## Social Media Automation

Charlie can automatically manage your Bluesky and X/Twitter accounts with intelligent, context-aware posts and replies.

### Features
- **Automated Posting**: 2 posts per day
  - Morning post at 8:00 AM
  - Evening post alternating between 5:00 PM and 9:00 PM
- **Intelligent Replies**: Up to 3 replies per day
  - Monitors mentions and interactions every 30 minutes
  - Context-aware responses using Gemini AI
- **Platform-Specific Formatting**:
  - X/Twitter: No external URLs (platform restrictions)
  - Bluesky: Full link support with rich formatting
- **Rate Limiting**: Built-in daily quotas prevent spam
- **Queue Management**: Automatic cleanup at 1:00 AM daily

### Setup

1. **Bluesky Configuration**:
   - Go to https://bsky.app/settings/app-passwords
   - Create a new app password
   - Add to `.env`: `BLUESKY_IDENTIFIER=your.handle` and `BLUESKY_PASSWORD=xxxx-xxxx-xxxx-xxxx`

2. **X/Twitter Configuration**:
   - Create app at https://developer.twitter.com/en/portal/dashboard
   - Enable OAuth 1.0a with Read and Write permissions
   - Add API keys to `.env`

3. **Enable Automation**:
   ```bash
   SOCIAL_POSTS_ENABLED=true
   SOCIAL_REPLIES_ENABLED=true
   ```

### Monitoring

Check automation status:
```bash
curl http://localhost:8080/social/status
```

View pending interactions:
```bash
curl http://localhost:8080/social/queue
```

### Schedule

All times are in your server's timezone:
- `00:00` - Reset daily queue
- `08:00` - Morning post
- `17:00/21:00` - Evening post (alternates daily)
- `*/30 * * * *` - Check for new interactions
- `01:00` - Cleanup processed interactions

## Frontend Integration (Preview Snippet)
Next.js `/app/api/chat/route.ts` (will finalize after server route implemented):
```ts
export async function POST(req: Request) {
  const { message, sessionId, history } = await req.json();
  const baseUrl = process.env.AI_SERVER_URL || 'http://localhost:8080';
  try {
    const res = await fetch(`${baseUrl}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, history }),
    });
    if (res.status === 429) {
      return Response.json({ message: 'Please wait a moment before sending another message. 🐕' }, { status: 200 });
    }
    if (!res.ok) {
      return Response.json({ message: 'Woof! Network hiccup—try again shortly. 🐕' }, { status: 200 });
    }
    const data = await res.json();
    return Response.json({ message: data.message || 'Empty response 🐕' });
  } catch (e) {
    return Response.json({ message: 'Woof! Network hiccup—try again shortly. 🐕' }, { status: 200 });
  }
}
```

## Docker (Production Build)
```bash
docker build -t charlie-ai-server .
docker run -p 8080:8080 --env-file .env charlie-ai-server
```

## Telegram Bot (Polling) 
The server can run a simple Telegram bot that forwards messages to `/v1/chat` and replies back.

1) Create a bot with BotFather and copy the token.
2) In your deployment env file (`deploy.env`), set:

- `TELEGRAM_BOT_TOKEN=123456:ABC...` (the token from BotFather)
- `TELEGRAM_ALLOWED_USER_IDS=11111111,22222222` (optional allowlist; leave empty to allow anyone)
- `TELEGRAM_POLLING=true` to enable the polling loop

3) Restart the server/container with the updated env file.

4) Message your bot in Telegram. Each chat is assigned a `sessionId` like `tg-<chat_id>` so context persists per chat. If you configured an allowlist, only those users’ messages are processed.

Notes:
- The bot uses long polling via `getUpdates`. Webhook mode isn’t implemented yet.
- Keep your bot token secret; never commit it to git.
- Logs will include entries like `telegram_polling_started` and `telegram_message_ignored_not_allowed` for visibility.
- Groups: By default, bots only receive commands/mentions due to Telegram "privacy mode". Use BotFather `/setprivacy` → `Disable` to let the bot receive all group messages (or keep it enabled and require mentions).
- Channels: Channel posts arrive as `channel_post` updates and are ignored by this bot by default. If you want the bot to react to channel posts, we can enable `channel_post` handling and the bot must be an admin of that channel to post replies.

Restrict to a specific group only:
- Set `TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890` (replace with your group’s chat ID). The bot will ignore all other chats (including DMs).
- How to find the chat ID: add the bot to the group, send `/help@YourBotName`, then check server logs for `telegram_chat_ignored_not_in_allowlist` (it includes the chatId). Alternatively, temporarily enable DMs and add a small debug to print `msg.chat.id`, or use a helper bot like @RawDataBot.

Commands and moderation:
- Use `/woof` instead of `/help` for Charlie’s help to avoid conflicts with moderation bots like Shieldy.
- In groups, Charlie replies to `/charlie <prompt>`, mentions (`@YourBotName`), or replies to Charlie.
- Greetings: Charlie greets new members after they pass verification. We queue the welcome when members join and send it the first time they speak. This avoids greeting bots and keeps the chat clean with Shieldy.

## Roadmap
- [x] Config validation (zod)
- [x] Memory store with truncation meta
- [x] Rate limiting (session + global)
- [x] Safety filter
- [x] Persona prompt & emoji rule
- [x] Gemini client wrapper + fallback
- [x] /v1/chat route
- [x] Bluesky integration with automated posting
- [x] X/Twitter integration with automated posting
- [x] Social media scheduler with cron jobs
- [x] Intelligent reply system with rate limiting
- [x] Comprehensive knowledge base (tokenomics, roadmap, links)
- [x] Platform-specific response formatting
- [x] Telegram bot integration
- [ ] Tests (vitest)
- [ ] Blog post management system
- [ ] Analytics and performance monitoring
- [ ] Advanced sentiment analysis for replies

## License
Proprietary (adjust as needed).
