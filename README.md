# Charlie AI Server (Gemini Powered)

Fastify + TypeScript microservice exposing `POST /v1/chat` backed by Google Gemini, providing a persona-driven DeFi assistant named **Charlie Bull**. Features automated social media management for Bluesky (full integration) and X/Twitter (scheduled posts on free tier).

---

## Status
✅ **Production** — deployed on Hetzner CX23 via Docker

### Core Features
- ✅ Config validation (zod)
- ✅ Memory store with session management
- ✅ Rate limiting (session + global)
- ✅ Safety filter
- ✅ Persona prompt with full knowledge base integration
- ✅ Gemini client with fallback model chain + 60s timeout (prevents indefinite hangs)
- ✅ `/v1/chat` route with platform-specific responses
- ✅ Telegram bot integration (polling)
- ✅ Social media automation — Bluesky (posts + replies) and X/Twitter (posts only)
- ✅ 14-topic rotation system with post-type variety to prevent repetitive posts
- ✅ Comprehensive knowledge base (tokenomics, roadmap, chains, contracts, social links)

---

## Quick Start (Dev)

```bash
cp deploy.env.example deploy.env   # fill in secrets
pnpm install
pnpm dev
curl -s localhost:8080/healthz
```

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness probe. Returns `{ "status": "ok" }`. Fast, no Gemini calls. |
| POST | `/v1/chat` | — | Chat with Charlie (persona + safety + rate limiting + memory). |
| GET | `/api/social/status` | — | Social automation status, quotas, scheduler state. |
| GET | `/social/quota` | — | Daily quota breakdown per platform. |
| GET | `/social/x/tier` | — | X API tier detection (free vs Basic). Legacy info endpoint. |
| GET | `/social/interactions/pending` | — | Pending Bluesky interaction queue. |
| POST | `/social/check-interactions` | Admin | Manually trigger Bluesky interaction fetch. |
| POST | `/social/test/bluesky` | Admin | Test Bluesky post with custom content. |
| POST | `/social/test/x` | Admin | Test X post with custom content. |
| POST | `/social/reply/x` | Admin | **Legacy** — Manual X reply by tweet ID. For future Basic tier use. |

> **Admin endpoints** require `Authorization: Bearer <ADMIN_API_KEY>` header. If `ADMIN_API_KEY` is not set, endpoints are open (backwards compatible but not recommended in production).

---

## Environment Variables

See `deploy.env.example` (production) or `.env.example` (local dev).

### Core
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `GEMINI_API_KEY` | — | Google Gemini API key (required) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Primary model (GA since May 7 2026) |
| `GEMINI_MODELS` | `gemini-3.1-flash-lite,gemini-2.5-flash-lite` | Comma-separated fallback models |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins |

### Persona
| Variable | Default | Description |
|----------|---------|-------------|
| `CHARLIE_NAME` | `Charlie` | Bot display name |
| `CHARLIE_CREATOR` | `Charlie Bull` | Creator attribution |
| `CHARLIE_PERSONA_EXTRA` | — | Extra persona instructions injected into prompts |
| `CHAR_TOKEN_ADDRESS` | `0x7F9532...` | $CHAR contract address |
| `BULL_TOKEN_ADDRESS` | — | $BULL contract address (set at TGE) |

### Social Media
| Variable | Description |
|----------|-------------|
| `BLUESKY_IDENTIFIER` | Bluesky handle (e.g. `charliebull.art`) |
| `BLUESKY_PASSWORD` | App password from https://bsky.app/settings/app-passwords |
| `X_API_KEY` | X/Twitter API key |
| `X_API_SECRET` | X/Twitter API secret |
| `X_ACCESS_TOKEN` | X/Twitter access token |
| `X_ACCESS_SECRET` | X/Twitter access token secret |
| `X_BEARER_TOKEN` | X/Twitter bearer token |
| `SOCIAL_POSTS_ENABLED` | `false` — enable automated posting |
| `SOCIAL_REPLIES_ENABLED` | `false` — enable Bluesky automated replies |
| `ADMIN_API_KEY` | Secret for write endpoints (generate with `openssl rand -hex 32`) |

### Telegram
| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_POLLING` | `true` to start polling on boot |
| `TELEGRAM_ALLOWED_USER_IDS` | Comma-separated user ID allowlist (empty = open) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Comma-separated chat ID allowlist (empty = all chats) |

---

## Social Media Automation

### Platform Strategy

| Platform | Posts | Replies | Notes |
|----------|-------|---------|-------|
| **Bluesky** | 2/day | ✅ Automatic | Full integration — posts + replies to mentions |
| **X/Twitter** | 2/day | ❌ Disabled | Free tier only. `userMentionTimeline` requires Basic ($100/mo). Reply code kept as legacy template. |

X free tier allows **writing** tweets (including replies) but not **reading** mentions. Until the project upgrades to Basic tier, X is scheduled posts only.

### Post Schedule (all times server timezone)
| Time | Event |
|------|-------|
| `00:00` | Reset daily quotas |
| `08:00` | Morning post — both platforms |
| `17:00` or `21:00` | Evening post — alternates daily — both platforms |
| `*/15 * * * *` | Bluesky: check for new interactions/replies |
| `01:00` | Cleanup old queue data |

### Topic Rotation System

Charlie's posts rotate across **14 distinct topics** to prevent repetition:

| Topic | Content |
|-------|---------|
| `chain_spotlight` | Feature one specific chain + DEX (rotates across all 9) |
| `tokenomics_fact` | Real $CHAR numbers: 420.69B supply, allocations, contract |
| `roadmap_tge` | $CHAR TGE on Base/Aerodrome — Q4 2026 |
| `roadmap_bull` | $BULL on Pump.fun, graduation mechanics |
| `bull_burn_event` | $BULL graduation triggers permanent 1B $CHAR burn |
| `roadmap_nft` | NFT collection on Solana for $BULL graduates |
| `bridge_tech` | Axelar, LayerZero, Squid Router — how cross-chain works |
| `same_contract` | Same contract address across all 9 chains |
| `why_base_l2` | Why Base, Aerodrome, Coinbase Superchain |
| `community_airdrop` | 35% = 147B tokens for community rewards |
| `defi_education` | DeFi concepts — gas, LPs, DEX vs CEX, bridges |
| `market_perspective` | Charlie's opinion on cross-chain trends |
| `chain_comparison` | Compare two chains Charlie is deployed on |
| `fun_personality` | Humor-first, minimal crypto — pure character |

Each post also rotates across **7 structural types**: `educational_fact`, `opinion`, `story`, `announcement`, `fun`, `question`, `comparison` — preventing the same format appearing twice in a row.

A **14-entry post memory log** tracks recent topic+type combos. Topic selection avoids the last 5 used topics. Post type selection avoids the last 2 used types.

### Bluesky Reply Setup

1. Go to https://bsky.app/settings/app-passwords — create an app password
2. Set `BLUESKY_IDENTIFIER=charliebull.art` and `BLUESKY_PASSWORD=xxxx-xxxx-xxxx-xxxx`
3. Set `SOCIAL_REPLIES_ENABLED=true`

Charlie will monitor mentions every 15 minutes and reply using Gemini with context from the knowledge base.

### X/Twitter Manual Reply (Legacy — Future Basic Tier)

When the project upgrades to Basic tier ($100/mo), automated X replies can be re-enabled. Until then, replies can be sent manually via:

```bash
curl -X POST https://your-server/api/social/reply/x \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tweetId": "1234567890123456789",
    "originalMessage": "hey charlie what chains are you on?"
  }'
```

If `originalMessage` is provided, Gemini generates the reply. If `content` is provided, it posts that text directly.

---

## Hetzner Deployment Workflow

The server now runs on Hetzner CX23 using Docker. The recommended path is to build locally and push the image plus environment file to the Hetzner host with `deploy-to-hetzner.sh`.

### Full Deploy from Local

```bash
# 1. Build and ship to Hetzner over SSH
./deploy-to-hetzner.sh ubuntu YOUR-HETZNER-IP ghcr.io/your-org/charlie-ai-server:latest

# 2. Verify on the Hetzner host
curl http://YOUR-HETZNER-IP/healthz
curl http://YOUR-HETZNER-IP/api/social/status
docker logs -f charlie-ai
```

### Hetzner Environment File

The container reads `~/charlie-ai.env` on the Hetzner instance. Ensure it contains all required vars including `ADMIN_API_KEY`. Copy from `deploy.env.example` as a reference.

---

## Telegram Bot

The server runs a Telegram bot forwarding messages to `/v1/chat` and replying back.

1. Create a bot with BotFather, copy the token
2. Set in `deploy.env`:
   - `TELEGRAM_BOT_TOKEN=123456:ABC...`
   - `TELEGRAM_ALLOWED_USER_IDS=11111111,22222222` (optional allowlist)
   - `TELEGRAM_POLLING=true`
3. Restart the container

**Notes:**
- Uses long polling (`getUpdates`). Webhook mode not implemented.
- Each chat gets a persistent `sessionId` like `tg-<chat_id>`
- In groups with Telegram privacy mode, bot only receives `/commands` or `@mentions` — disable privacy mode via BotFather if you want all messages
- Use `/woof` instead of `/help` to avoid conflicts with moderation bots
- Set `TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890` to restrict to a specific group

---

## Frontend Integration

`/app/api/chat/route.ts` (Next.js):

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

---

## Project Roadmap

- [x] Config validation (zod)
- [x] Memory store with session management
- [x] Rate limiting (session + global)
- [x] Safety filter
- [x] Persona prompt + knowledge base
- [x] Gemini client with fallback chain
- [x] `/v1/chat` route
- [x] Telegram bot (polling)
- [x] Bluesky integration — posts + automated replies
- [x] X/Twitter integration — scheduled posts (free tier)
- [x] Social media scheduler with cron jobs
- [x] 14-topic rotation + 7 post-type variety system
- [x] 14-entry post memory (prevents topic/type repetition)
- [x] Platform-specific formatting (X vs Bluesky)
- [x] X free-tier compatibility fix (legacy reply endpoint)
- [x] Admin API key for write endpoint security
- [x] Hetzner CX23 deployment pipeline
- [x] Double-signature fix (`stripSocialSignature()` — strips model-generated sign-offs before formatter appends official signature)
- [x] Broken emoji fix (`u` flag + `\p{Extended_Pictographic}` strip in `stripSocialSignature` — prevents lone surrogate rendering as ?)
- [x] Pre-TGE accuracy — Charlie no longer implies $CHAR is buyable/tradeable; knowledgeBase, system prompt, topic prompts, and reply prompt all corrected
- [x] Live market data (DexScreener + CoinGecko) injected into all AI prompts for real-time price awareness
- [x] USD price formatting fix — persona instruction now explicitly requires `$` symbol before all USD prices (prevents Gemini from dropping it)
- [ ] X Basic tier upgrade → automated reply re-enable
- [ ] Tests (vitest)
- [ ] Blog post management system
- [ ] Analytics and performance monitoring

---

## License
Proprietary.
