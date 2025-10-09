# Charlie AI Server (Gemini Powered)

Fastify + TypeScript microservice exposing `POST /v1/chat` backed by Gemini, providing a persona-driven DeFi assistant named **Charlie**.

## Status
Scaffolding in progress. Core features to be added next: config validation, memory store, rate limiting, safety filter, persona enforcement, Gemini wrapper, chat route.

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
| Method | Path      | Description |
|--------|-----------|-------------|
| GET    | /healthz  | Lightweight liveness probe that does not touch Gemini; returns `{ "status": "ok" }`. Useful for Docker/Kubernetes readiness & uptime checks. |
| POST   | /v1/chat  | Chat with Charlie (persona + safety + rate limiting + memory). |

### Health Endpoint Details
`GET /healthz` is intentionally minimal so that infrastructure (load balancers, k8s probes, uptime monitors) can call it frequently without generating model usage or mutating any state. If this returns a non-200, something is fundamentally wrong with the service process (crashed dependencies, event loop blocked, etc.). In future you could expand it to include dependency checks (Redis, DB) but keep it fast (<5ms) and avoid external network calls.

## Env Vars
See `.env.example`. `GEMINI_API_KEY` optional during development (returns mocked responses if absent in future implementation).

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

## Roadmap
- [ ] Config validation (zod)
- [ ] Memory store with truncation meta
- [ ] Rate limiting (session + global)
- [ ] Safety filter
- [ ] Persona prompt & emoji rule
- [ ] Gemini client wrapper + fallback
- [ ] /v1/chat route
- [ ] Tests (vitest)

## License
Proprietary (adjust as needed).
