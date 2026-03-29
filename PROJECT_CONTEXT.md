# Charlie Bull — Backend Project Context (charlie-ai-server)

**Purpose of this file:** This document exists so that any AI assistant (Claude, Gemini, GPT, or future models) can be dropped into this codebase cold and immediately understand the full project, architecture, current state, and what to do next. Read this file first before touching anything.

**Last updated:** March 29, 2026  
**Server version:** 0.1.0  
**Related repo:** official-charlie-bull (frontend — has its own PROJECT_CONTEXT.md)

---

## 1. Project Overview

Charlie Bull is a cross-chain cryptocurrency project combining:

- **$CHAR** — an ERC-20 token deployed on 9 Ethereum-compatible blockchains
- **Charlie** — an autonomous AI social agent that posts and engages across Bluesky, X/Twitter, Telegram, and the project website
- **$BULL** — an educational companion token on Pump.fun (Solana) that bridges into the $CHAR ecosystem on graduation
- **Charlie's Angels** — a planned NFT collection on Solana for $BULL graduates

| Detail | Value |
|--------|-------|
| Website | https://charliebull.art |
| Woof Paper (docs) | https://charliebull.art/docs |
| Founder | Viktor Khachatryan — Full Stack Developer |
| LinkedIn (Personal) | https://www.linkedin.com/in/viktor-khachatryan-78a6a064/ |
| LinkedIn (Company) | https://www.linkedin.com/company/charlie-bull-inc/ |

---

## 2. What This Repo Does

`charlie-ai-server` is the **Node.js backend** powering everything behind the scenes:

- Serves a REST API that the Next.js frontend calls for chat (`POST /v1/chat`)
- Runs the Telegram bot (long-polling)
- Runs the Bluesky bot (automated posting + auto-replies to mentions)
- Runs the X/Twitter bot (automated scheduled posts — replies pending API tier upgrade)
- Contains all of Charlie's knowledge base, persona, and system prompt logic
- Manages session memory, rate limiting, and input safety

---

## 3. Repository Structure

```
charlie-ai-server/
├── src/
│   ├── index.ts                   # Entry point — Fastify server, scheduler init, Telegram start
│   ├── lib/
│   │   ├── config.ts              # Zod-validated env config — all env vars parsed here
│   │   └── logger.ts              # Pino logger instance
│   ├── routes/
│   │   ├── health.ts              # GET /healthz + GET /api/health
│   │   ├── chat.ts                # POST /v1/chat — main AI chat endpoint
│   │   └── social.ts              # GET|POST /api/social/* — status, test posts, interactions
│   ├── services/
│   │   ├── persona.ts             # SYSTEM_PERSONA prompt builder, buildPrompt(), ensureDogEmoji()
│   │   ├── knowledgeBase.ts       # Single source of truth for all project data
│   │   ├── geminiClient.ts        # Google Gemini AI client (SDK + REST fallback, model chain)
│   │   ├── memoryStore.ts         # In-memory session conversation history (pruned to ~10 turns)
│   │   ├── rateLimiter.ts         # Sliding window rate limiter (per-session + global)
│   │   ├── safety.ts              # Input safety filter (banned patterns)
│   │   ├── telegramBot.ts         # Telegram long-polling bot (DMs + group mentions + /woof)
│   │   ├── blueskyClient.ts       # AT Protocol client — post + reply to mentions
│   │   ├── xClient.ts             # Twitter API v2 client — post only (Free tier)
│   │   ├── socialMediaScheduler.ts # cron-based orchestrator for posts + interaction checks
│   │   ├── socialMediaQueue.ts    # Queue management for outbound social posts
│   │   └── responseFormatter.ts  # Platform-specific response formatting (X vs Bluesky vs Telegram)
│   └── types/
│       ├── chat.ts                # ChatMessage type
│       └── social.ts              # SocialPost, Platform, DEFAULT_SCHEDULE types
├── scripts/
│   └── run-with-env.sh            # Helper: loads deploy.env then runs docker
├── Dockerfile                     # Multi-stage build (deps → build → prod-deps → prod)
├── deploy.env.example             # Template for all env vars (copy → deploy.env, fill secrets)
├── deploy.env                     # ⚠️ NEVER COMMIT — real secrets live here
├── deploy-to-aws.sh               # Local → EC2 deploy script (save image, SCP, SSH, run)
├── push-to-ecr.sh                 # Push Docker image to AWS ECR
├── update-from-ecr.sh             # Pull latest image from ECR on EC2 and restart
├── package.json
├── tsconfig.json
├── cspell.json                    # Spell check config (VS Code CSpell extension)
├── ARCHITECTURE.md                # System architecture diagram
├── AWS_DEPLOYMENT.md              # Step-by-step EC2 deployment guide
├── SOCIAL_MEDIA_TESTING.md        # How to test Bluesky/X endpoints manually
├── FRONTEND_PROMPT.md             # Prompt used to generate the frontend context
└── PROJECT_CONTEXT.md             # ← you are here
```

---

## 4. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | ≥20 |
| Language | TypeScript | ^5.4 |
| Web Framework | Fastify | ^4.28 |
| CORS | @fastify/cors | ^9.0 |
| AI Model | Google Gemini (via `@google/generative-ai`) | ^0.21 |
| Telegram Bot | Custom long-polling (node-fetch) | — |
| Bluesky Bot | @atproto/api | ^0.18 |
| X/Twitter Bot | twitter-api-v2 | ^1.28 |
| Scheduling | node-cron | ^4.2 |
| HTTP Client | node-fetch | ^3.3 |
| Validation | Zod | ^3.23 |
| Logging | Pino + pino-pretty | ^9.3 |
| Build (dev) | tsx (watch mode) | ^4.7 |
| Build (prod) | tsc → dist/ | — |
| Containerization | Docker (multi-stage) | — |
| Hosting | AWS EC2 (Docker container) | — |
| CI/CD | Manual deploy scripts | — |

---

## 5. API Endpoints

### Chat
```
POST /v1/chat
```
Main AI conversation endpoint. Called by the Next.js frontend proxy (`/api/chat`).

**Request body:**
```json
{
  "sessionId": "string (1–128 chars)",
  "message": "string (1–300 chars)",
  "history": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ]
}
```

**Response:**
```json
{
  "message": "Charlie's response text 🐕",
  "meta": {
    "truncation": false,
    "latencyMs": 1234,
    "modelUsed": "gemini-1.5-pro-latest"
  }
}
```

**Flow:** Rate check → safety filter → merge server memory + frontend history → build Gemini prompt → generate → ensure dog emoji → persist to memory → return.

### Health
```
GET /healthz          ← legacy, used by frontend proxy
GET /api/health       ← preferred
```
Returns `{ "status": "ok" }`.

### Social (admin-protected endpoints require `Authorization: Bearer <ADMIN_API_KEY>`)
```
GET  /api/social/status              — Current scheduler status, queue depth
POST /api/social/test/bluesky        — Trigger a test post to Bluesky (admin)
POST /api/social/test/x              — Trigger a test post to X (admin)
POST /api/social/check-interactions  — Manually trigger interaction check (admin)
POST /api/social/reply/x             — Manual X reply (legacy, admin, free tier workaround)
```

---

## 6. Environment Variables

Copy `deploy.env.example` to `deploy.env` and fill in secrets. **Never commit `deploy.env`.**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port |
| `GEMINI_API_KEY` | — | **Required** for real AI responses (Google AI Studio) |
| `GEMINI_API_VERSION` | `v1` | API version (`v1` = GA) |
| `GEMINI_MODEL` | `gemini-1.5-pro-latest` | Primary model |
| `GEMINI_MODELS` | `gemini-1.5-pro-latest,gemini-1.5-flash-latest,gemini-1.5-flash-8b-latest` | Model fallback chain (comma-separated) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins (comma-separated) |
| `GLOBAL_RATE_LIMIT` | `100` | Max requests per window (all sessions) |
| `SESSION_RATE_LIMIT` | `8` | Max requests per window per sessionId |
| `WINDOW_SECONDS` | `60` | Rate limit window in seconds |
| `MAX_TOKENS` | `1024` | Max Gemini output tokens |
| `CHARLIE_NAME` | `Charlie` | AI persona name |
| `CHARLIE_CREATOR` | `Charlie Bull` | Creator name injected into persona |
| `CHARLIE_PERSONA_EXTRA` | `""` | Additional persona instructions (appended to system prompt) |
| `CHAR_TOKEN_ADDRESS` | `0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1` | $CHAR contract address |
| `BULL_TOKEN_ADDRESS` | `""` | $BULL Pump.fun address (set when live) |
| `TOKENOMICS_EXTRA` | `""` | Additional tokenomics notes for the system prompt |
| `TELEGRAM_BOT_TOKEN` | `""` | From BotFather |
| `TELEGRAM_ALLOWED_USER_IDS` | `""` | Comma-separated numeric user IDs (empty = allow all) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | `""` | Comma-separated chat IDs (empty = allow all) |
| `TELEGRAM_POLLING` | `false` | Set `true` to enable polling on startup |
| `BLUESKY_IDENTIFIER` | `""` | e.g. `charliebull.art` |
| `BLUESKY_PASSWORD` | `""` | Bluesky App Password (not main account password) |
| `BLUESKY_SERVICE` | `https://bsky.social` | AT Protocol PDS URL |
| `X_API_KEY` | `""` | Twitter API v2 consumer key |
| `X_API_SECRET` | `""` | Twitter API v2 consumer secret |
| `X_ACCESS_TOKEN` | `""` | Twitter OAuth access token |
| `X_ACCESS_SECRET` | `""` | Twitter OAuth access secret |
| `X_BEARER_TOKEN` | `""` | Twitter bearer token (read-only operations) |
| `SOCIAL_POSTS_ENABLED` | `false` | Enable automated Bluesky + X scheduled posts |
| `SOCIAL_REPLIES_ENABLED` | `false` | Enable automated Bluesky reply-to-mentions |
| `ADMIN_API_KEY` | `""` | Secures write social endpoints. Generate with `openssl rand -hex 32` |

---

## 7. Charlie AI Agent

Charlie is an autonomous AI persona built on Google Gemini. His full identity and knowledge are injected via a system prompt built in `src/services/persona.ts` using data from `src/services/knowledgeBase.ts`.

### Persona Rules (enforced in system prompt)
- Enthusiastic, friendly DeFi dog assistant
- Concise answers — short paragraphs or bullet points
- Never fabricates protocols, token addresses, partnerships, audits, APRs, or yields
- Encourages DYOR, self-custody, scam vigilance
- Refuses investment advice, tax advice, illegal activity
- Redirects unrelated chit-chat back to crypto/DeFi
- **Signature rule:** Every response ends with exactly one dog emoji (`🐕` or `🐶`) — enforced by `ensureDogEmoji()`

### Response Formatting by Platform
| Platform | Rules |
|----------|-------|
| X/Twitter | No direct URLs — use conversational references ("check our docs", "LinkTree in bio") |
| Bluesky | Links OK, keep under 300 chars |
| Telegram | Full markdown formatting allowed |
| Website chat | Detailed, comprehensive answers |

### Social Posting System

**Schedule (cron, UTC):**
| Job | Schedule | Description |
|-----|----------|-------------|
| Morning post | `0 8 * * *` | 8:00 AM — both Bluesky + X |
| Afternoon/evening post | `0 17 * * *` / `0 21 * * *` | Alternates between 5:00 PM and 9:00 PM |
| Interaction check | Every 30 minutes | Checks Bluesky mentions + replies |
| Queue processing | `0 0 * * *` | Midnight queue flush |
| Cleanup | `0 1 * * *` | 1:00 AM cleanup |

**14 Topic Categories:**
`chain_spotlight`, `tokenomics_fact`, `roadmap_tge`, `roadmap_bull`, `roadmap_nft`, `bridge_tech`, `same_contract`, `why_base_l2`, `community_airdrop`, `defi_education`, `market_perspective`, `fun_personality`, `chain_comparison`, `bull_burn_event`

**7 Post Structure Types:**
`educational_fact`, `opinion`, `story`, `announcement`, `fun`, `question`, `comparison`

**14-post memory:** The scheduler tracks the last 14 topic+type combinations to prevent repetition.

### Platform Status
| Platform | Handle | Status | Notes |
|----------|--------|--------|-------|
| Bluesky | @charliebull.art | ✅ Full auto-replies active | 2× daily posts + real-time reply to mentions |
| X/Twitter | @CharlieBullArt | 🔄 Posts only | 2× daily scheduled posts. Auto-replies require X API Basic tier (not yet upgraded — **do not document as active**) |
| Telegram | @Charlie_Bull_bot | ✅ Active | Responds to DMs, group mentions, and `/woof` command |
| Website | charliebull.art | ✅ Active | Full chat via ChatWidget → `/v1/chat` |

---

## 8. Knowledge Base (`src/services/knowledgeBase.ts`)

This is the **single source of truth** for all project data. It is the first file to update when project details change. It feeds the system prompt automatically.

### $CHAR Token
| Property | Value |
|----------|-------|
| Name | Charlie Bull |
| Ticker | $CHAR |
| Standard | ERC-20 |
| Total Supply | 420,690,000,000 (420.69 Billion) |
| Contract Address | `0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1` |
| Contract Consistency | Same address across all 9 chains |

**Token Distribution:**
| Allocation | % | Tokens | Purpose |
|------------|---|--------|---------|
| Liquidity | 50% | 210,345,000,000 | DEX Liquidity Pools (locked) |
| Community | 35% | 147,241,500,000 | Community Airdrop & rewards |
| Team & Dev | 15% | 63,103,500,000 | IP and Project Expansion |

**9-Chain Deployment:**
| Chain | DEX |
|-------|-----|
| Base ⭐ | Aerodrome (launch pool) |
| Ethereum | Uniswap |
| Arbitrum | Uniswap |
| Polygon | QuickSwap |
| Avalanche | LFGJ |
| Binance Smart Chain | PancakeSwap |
| Mantle | Fusion X |
| Linea | Linea DEX |
| Blast | Blast DEX |

**Bridge Technology:** Axelar Network, Squid Router, LayerZero

### $BULL Token
| Property | Value |
|----------|-------|
| Name | $BULL |
| Platform | Pump.fun (Solana) |
| Supply | 1,000,000,000 (1 Billion) |
| Launch Timeline | Q3 2026 (after $CHAR TGE) |

**Graduation mechanics:**
- Pre-graduation: $BULL used for educational streams, 1B $CHAR tokens locked
- On graduation: 1B $CHAR is **permanently burned** (deflationary event)
- Post-graduation: CHAR/BULL swap pair launches on Raydium, $BULL holders get exclusive access to Charlie's Angels NFT collection on Solana

---

## 9. Core Service Details

### `geminiClient.ts` — AI Generation
- Uses `@google/generative-ai` SDK with REST fallback
- Tries models in the `GEMINI_MODELS` chain order until one succeeds
- Model normalization: maps legacy names (e.g. `gemini-1.5-pro`) to current `-latest` suffixed GA names
- Falls back to mock response if `GEMINI_API_KEY` is not set (safe for dev)
- Always applies `ensureDogEmoji()` to output

### `memoryStore.ts` — Session Memory
- In-memory `Map<sessionId, messages[]>` — **does not persist across server restarts**
- Kept to ~10 user+assistant turn pairs (`MAX_TURNS = 10`)
- Hard char budget: 5,000 chars (`MAX_CHAR_BUDGET`) — older messages dropped if exceeded
- Server memory + frontend-provided history are merged on each request (server takes precedence)

### `rateLimiter.ts` — Rate Limiting
- Sliding window algorithm
- Limits: 8 requests/session/60s + 100 requests/all sessions/60s (configurable via env)
- Returns `retryAfter` seconds on 429

### `safety.ts` — Input Safety
- Regex-based filter for banned patterns: `illegal`, `scam`, `pump and dump`, `hack`, `exploit`
- Returns a friendly refusal, does not reveal the filter rules

### `telegramBot.ts` — Telegram Integration
- Pure long-polling (no webhook) — enabled by `TELEGRAM_POLLING=true`
- Calls its own `/v1/chat` endpoint internally (`http://127.0.0.1:<PORT>/v1/chat`)
- Responds to: direct DMs, group mentions (`@Charlie_Bull_bot`), replies to Charlie's messages
- `/woof` command triggers introduction message
- Respects `TELEGRAM_ALLOWED_USER_IDS` and `TELEGRAM_ALLOWED_CHAT_IDS` allowlists
- Uses keep-alive HTTPS agent to reduce socket churn on EC2

### `blueskyClient.ts` — Bluesky Integration
- Uses AT Protocol (`@atproto/api`) with `AtpAgent`  
- Authenticates with App Password (not main account password)
- Detects facets (links, mentions) via `RichText.detectFacets()` before posting
- Auto-replies poll for new mentions/replies every 30 minutes via the scheduler

### `xClient.ts` — X/Twitter Integration
- Uses `twitter-api-v2` with OAuth 1.0a (User Auth)
- Currently only posts (Free tier) — auto-replies require Basic tier upgrade
- Do NOT implement auto-replies until the X API tier is upgraded and documented

---

## 10. Session Memory Architecture

```
Frontend (Next.js)
  └── POST /api/chat (proxy)
        └── POST /v1/chat (this server)
              ├── memoryStore.prune(sessionId)   → server-side history
              ├── merge with req.body.history     → frontend-supplied last 10 msgs
              ├── buildPrompt(merged, userMessage)→ [system, ...history, user]
              ├── generateWithGemini(messages)
              ├── ensureDogEmoji(response)
              └── memoryStore.append(sessionId, [user, assistant])
```

Memory is **in-process only** — a server restart clears all sessions. This is intentional for the current scale.

---

## 11. Deployment

### Infrastructure
- **Platform:** AWS EC2 (Docker container)
- **Port:** 8080 (exposed via EC2 Security Group)
- **Container:** Node.js 20 slim, multi-stage build
- **Restart policy:** `--restart unless-stopped`
- **Env injection:** `--env-file ~/charlie-ai.env` (file lives on EC2, never in the image)

### Docker — Multi-Stage Build
```
Stage 1 (deps)      — npm ci (all deps incl. dev)
Stage 2 (build)     — tsc → dist/
Stage 3 (prod-deps) — npm ci --omit=dev
Stage 4 (prod)      — final image: node_modules (prod only) + dist/
```
Final image is lean — no TypeScript toolchain, no dev dependencies.

### Deploy Scripts
| Script | Purpose |
|--------|---------|
| `deploy-to-aws.sh` | Build image locally, SCP to EC2, load, restart container |
| `push-to-ecr.sh` | Tag and push image to AWS ECR |
| `update-from-ecr.sh` | Pull latest ECR image on EC2 and restart |
| `scripts/run-with-env.sh` | Load `deploy.env` and run Docker locally for testing |

### Deploy Checklist
1. Update `deploy.env` with any new env vars
2. Run `npm run build` locally to verify TypeScript compiles
3. Run deploy script of choice
4. SSH into EC2 and verify: `curl http://localhost:8080/healthz`
5. Check `docker logs -f charlie-ai` for startup errors
6. Verify social scheduler initialized: look for `social_media_scheduler_initialized` log line
7. Test chat: `curl -X POST http://localhost:8080/v1/chat -H "Content-Type: application/json" -d '{"sessionId":"test","message":"Hello Charlie!"}'`

---

## 12. Roadmap

| Quarter | Milestone | Status |
|---------|-----------|--------|
| Q4 2025 | Charlie AI launched — Telegram, Bluesky, X/Twitter, website chat. Bluesky auto-replies active. | ✅ Complete |
| Q1 2026 | AI growth & analysis. Server infrastructure upgrades. 14-topic/7-structure post system deployed. X Free tier stabilization. | 🔄 Current |
| Q2 2026 | Submit token update forms on CoinGecko and Etherscan prior to $CHAR TGE | ⏳ Upcoming |
| Q2–Q3 2026 | $CHAR TGE on Base via Aerodrome. Cross-chain expansion to all 9 chains via Axelar + Squid Router. | ⏳ Upcoming |
| Q3 2026 | $BULL launch on Pump.fun (Solana). Upon graduation: 1B $CHAR permanently burned. CHAR/BULL pair on Raydium. | ⏳ Upcoming |
| Q4 2026 | Charlie's Angels NFT collection on Solana. IP partnerships, merchandise, multimedia. | ⏳ Upcoming |
| Q1 2027 | Base ↔ Solana bridge. Weekly Pump.fun podcasts. | ⏳ Upcoming |
| Q2 2027+ | DeFi utilities, governance, strategic partnerships, Web3 expansion. | ⏳ Future |

---

## 13. Development Workflow

### Local Dev
```bash
# Install dependencies
npm install

# Create local env
cp deploy.env.example deploy.env
# Edit deploy.env — set GEMINI_API_KEY at minimum

# Run in watch mode
npm run dev
# Server starts at http://localhost:8080
```

### Build & Type Check
```bash
npm run build        # tsc → dist/
```

### Run Locally with Docker
```bash
./scripts/run-with-env.sh
```

### Branch Strategy
Feature work on separate branches (e.g. `node-js-upgrade`, `social-media-improvements`), merged to `main` via fast-forward when ready. Each merge triggers a new Docker build + deploy.

---

## 14. Known Issues & Important Notes

### X/Twitter Auto-Replies — NOT ACTIVE
Auto-replies on X require the **X API Basic tier**. Do not implement, document as active, or enable `SOCIAL_REPLIES_ENABLED` for X until the account is upgraded. Bluesky auto-replies are fully active and unaffected.

### Memory Is Not Persistent
`InMemoryStore` clears on every server restart. If persistent memory across restarts becomes a requirement, replace with Redis or a database. For current scale this is acceptable.

### Gemini Model Deprecation
Gemini model names deprecate over time and return 404s. Always use `-latest` suffixed names (e.g. `gemini-1.5-pro-latest`). The model list in `GEMINI_MODELS` should be updated when Google deprecates a model. Watch for `gemini_configured_models_missing_from_list` warnings in logs.

### Telegram Polling on EC2
Only one polling process should run at a time. If `TELEGRAM_POLLING=true` and more than one container is running, Telegram updates will be split between instances. Use a single container deployment.

### Admin API Key
If `ADMIN_API_KEY` is left empty in `deploy.env`, write endpoints (`/api/social/test/*`, `/api/social/check-interactions`) are open. Always set a strong key in production. Generate with: `openssl rand -hex 32`

### Bluesky App Password
Use a Bluesky **App Password** (generated at bsky.app/settings/app-passwords), never the main account password.

---

## 15. Social Links

| Platform | Link / Handle |
|----------|--------------|
| Website | https://charliebull.art |
| Woof Paper | https://charliebull.art/docs |
| LinkTree | https://linktr.ee/charliebullart |
| X/Twitter | https://x.com/CharlieBullArt |
| Bluesky | https://bsky.app/profile/charliebull.art |
| Telegram Bot | @Charlie_Bull_bot |
| Telegram Group | https://t.me/+VUOILe0sPis3MmYx |
| TikTok | https://tiktok.com/@charliebullart |
| Medium Blog | https://medium.com/@charliebullart |
| GitHub | https://github.com/vick2592/Official-Charlie-Bull |
| LinkedIn (Company) | https://www.linkedin.com/company/charlie-bull-inc/ |
| Founder LinkedIn | https://www.linkedin.com/in/viktor-khachatryan-78a6a064/ |
| Email | info@charliebull.art |

---

## 16. Related Repository

The `official-charlie-bull` repository contains:
- Next.js 16 frontend
- Chat widget (`ChatWidget.tsx`) that calls this server
- Squid cross-chain bridge widget (`SquidWidgetWrapper.tsx`)
- Woof Paper docs (`/docs` page — tokenomics and roadmap)
- Vercel auto-deploy from `main` branch
- See `PROJECT_CONTEXT.md` in the frontend repo for full documentation

---

*This file should be updated whenever significant architecture changes, new environment variables, platform status changes, or roadmap updates are made.*
