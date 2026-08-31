# Charlie Bull — Backend Context (charlie-ai-server)

**Read this file first.** Last updated: July 9, 2026 (v8) · Server version: 0.1.6

## 1. What This Is

Cross-chain crypto project: **$CHAR** (ERC-20 on 9 EVM chains), **Charlie** (autonomous AI social agent), **$BULL** (Pump.fun/Solana companion token), **Charlie's Angels** (planned NFTs).

`charlie-ai-server` is the **Node.js backend**: REST chat API, Telegram bot, Bluesky bot (posts + auto-replies), X/Twitter bot (posts only), persona/knowledge base, session memory, rate limiting, input safety.

| | |
|---|---|
| Website | https://charliebull.art |
| Docs | https://charliebull.art/docs |
| Founder | Viktor Khachatryan |

---

## 2. Structure

```
src/
├── index.ts                 # Entry: Fastify + scheduler + Telegram
├── lib/config.ts            # Zod-validated env config
├── lib/logger.ts            # Pino
├── routes/                  # health, chat, social endpoints
├── services/
│   ├── persona.ts           # SYSTEM_PERSONA, buildPrompt(), buildPromptWithMarket(), ensureDogEmoji()
│   ├── knowledgeBase.ts     # Single source of truth for project data
│   ├── geminiClient.ts      # Gemini SDK + REST fallback, model chain
│   ├── priceService.ts      # DexScreener + CoinGecko, 5-min cache, never throws
│   ├── memoryStore.ts       # In-memory sessions (~10 turns)
│   ├── rateLimiter.ts       # Sliding window (per-session + global)
│   ├── safety.ts            # Input filter (banned patterns)
│   ├── telegramBot.ts       # Long-polling bot
│   ├── blueskyClient.ts     # AT Protocol (post + reply)
│   ├── xClient.ts           # Twitter v2 (post only, Free tier)
│   ├── socialMediaScheduler.ts  # cron orchestrator
│   ├── socialMediaQueue.ts  # Outbound post queue
│   └── responseFormatter.ts # Platform formatting (X / Bluesky / Telegram)
└── types/                   # chat.ts, social.ts
```

## 3. Tech Stack

Node.js ≥20 · TypeScript ^5.4 · Fastify ^4.28 · Gemini ^0.21 · @atproto/api · twitter-api-v2 · node-cron · Zod · Pino · Docker multi-stage · Hetzner CX23

---

## 4. API Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/chat` | Main chat. Body: `{ sessionId, message, history[] }`. Flow: rate check → safety → merge memory → `buildPromptWithMarket()` → generate → `ensureDogEmoji` → persist |
| GET | `/healthz` / `/api/health` | Returns `{ status: "ok" }` |
| GET | `/api/social/status` | Scheduler status + queue depth |
| POST | `/api/social/test/bluesky` | Admin: test Bluesky post |
| POST | `/api/social/test/x` | Admin: test X post |
| POST | `/api/social/check-interactions` | Admin: trigger interaction check |
| POST | `/api/social/reply/x` | Admin: manual X reply (Free tier workaround) |

---

## 5. Environment Variables

Copy `deploy.env.example` → `deploy.env`. **Never commit `deploy.env`.**

| Group | Key Variables | Notes |
|-------|--------------|-------|
| **AI** | `GEMINI_API_KEY` (required), `GEMINI_MODELS`, `MAX_TOKENS` | Model chain: `gemini-3.1-flash-lite,gemini-2.5-flash-lite`. `gemini-1.5-*` deprecated — do not use. |
| **Server** | `PORT` (8080), `ALLOWED_ORIGINS`, `GLOBAL_RATE_LIMIT` (100), `SESSION_RATE_LIMIT` (8), `WINDOW_SECONDS` (60) | |
| **Persona** | `CHARLIE_NAME`, `CHARLIE_CREATOR`, `CHARLIE_PERSONA_EXTRA`, `CHAR_TOKEN_ADDRESS`, `BULL_TOKEN_ADDRESS`, `TOKENOMICS_EXTRA` | |
| **Telegram** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_POLLING` (false), `TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_ALLOWED_CHAT_IDS` | |
| **Bluesky** | `BLUESKY_IDENTIFIER`, `BLUESKY_PASSWORD` (App Password, not main), `BLUESKY_SERVICE` | |
| **X/Twitter** | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_BEARER_TOKEN` | Free tier = post only |
| **Social toggles** | `SOCIAL_POSTS_ENABLED`, `SOCIAL_REPLIES_ENABLED`, `SOCIAL_DEV_MODE` | `SOCIAL_DEV_MODE`: verbose logging only. Errors never posted. Keep `false` in prod. |
| **Security** | `ADMIN_API_KEY` | `openssl rand -hex 32` |

---

## 6. Charlie AI Agent

Persona built in `persona.ts`, data from `knowledgeBase.ts`. Enthusiastic DeFi dog. Plain text only (no markdown). Never fabricates data. Refuses financial/illegal advice. `ensureDogEmoji()` strips markdown and ensures exactly one trailing dog emoji on every response.

**Platform formatting:** X = no URLs (conversational refs only), Bluesky = links OK ≤300 chars, Telegram = full markdown, Website = detailed.

### Social Posting System

**Schedule (UTC):** Morning `0 8 * * *` · Afternoon/evening `0 17 * * *` / `0 21 * * *` (alternates) · Interaction check every 30 min · Queue flush midnight · Cleanup 1AM.

**14 topics** × **7 post types** with 14-post rotation memory to prevent repetition.

**Two-tier character budget (X):** `targetChars = 220` (told to Gemini) / `maxContentChars = 249` (hard ceiling = 280 − 31 char signature). Truncation is last-resort only — fires if Gemini overshoots target by 29+ chars.

**`stripSocialSignature()`:** Called before formatter on all post/reply output. Removes trailing dog emojis (surrogate-pair safe with `u` flag), other trailing pictographic emoji, empty lines, model sign-off lines, and `#CharlieBull` lines. Prevents double-signature with the official `- Charlie AI 🐾🐶 #CharlieBull` footer.

**Pre-TGE rule:** $CHAR is NOT tradeable yet. No DEX pools. TGE = Q3 2026 on Base via Aerodrome. Enforced across `knowledgeBase.ts`, `persona.ts`, and `socialMediaScheduler.ts` topic prompts.

### Platform Status
| Platform | Handle | Status |
|----------|--------|--------|
| Bluesky | @charliebull.art | ✅ Posts + auto-replies |
| X/Twitter | @CharlieBullArt | 🔄 Posts only (replies need Basic tier — **do not document as active**) |
| Telegram | @Charlie_Bull_bot | ✅ DMs + group mentions + `/woof` |
| Website | charliebull.art | ✅ Full chat |

---

## 7. Knowledge Base (`knowledgeBase.ts`)

**Single source of truth.** First file to update when project data changes. Feeds the system prompt automatically.

**$CHAR:** ERC-20 · 420.69B supply · `0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1` (same on all 9 chains)
- Distribution: 50% Liquidity (locked) · 35% Community · 15% Team
- Chains: Base ⭐ (Aerodrome), Ethereum (Uniswap), Arbitrum (Uniswap), Polygon (QuickSwap), Avalanche (LFGJ), BSC (PancakeSwap), Mantle (Fusion X), Linea (Linea DEX), Blast (Blast DEX)
- Bridges: Axelar, Squid Router, Base↔Solana

**$BULL:** Pump.fun/Solana · 1B supply · Launch Q3 2026 post-TGE
- Graduation: 1B $CHAR permanently burned → CHAR/BULL pair on Raydium + Charlie's Angels NFT access

---

## 8. Core Services

**`geminiClient.ts`:** SDK + REST fallback. Tries `GEMINI_MODELS` chain in order. Normalizes deprecated model names to current equivalents. **60s timeout on both SDK and REST call paths** — prevents indefinite hangs if the API accepts the TCP connection but never responds (timeout rejects → caught → next model in chain or `isError: true` fallback). Returns `{ text, isError: true }` on failure — **callers must check `isError`**. Always applies `ensureDogEmoji()` (stripped by `stripSocialSignature()` for social posts).

**`priceService.ts`:** DexScreener ($CHAR on-chain, highest-liquidity pair per chain, `[]` pre-TGE) + CoinGecko (sole source for chain tokens: BTC, ETH, BNB, AVAX, POL, ARB, MNT, BLAST, SOL). 5-min cache, parallel fetch, 8s timeout, **never throws**. Key exports: `getMarketSnapshot()`, `formatMarketContext()`, `formatCharPriceResponse()`. CoinGecko ID gotchas: POL=`polygon-ecosystem-token`, BLAST=`blast`, MNT=`mantle`. Zero-price filter excludes null/≤0 prices.

**`memoryStore.ts`:** In-memory only (cleared on restart). ~10 turns, 5000 char budget. Server memory takes precedence over frontend-supplied history.

**`rateLimiter.ts`:** Sliding window. 8/session/60s + 100/global/60s (configurable). Returns `retryAfter` on 429.

**`safety.ts`:** Regex filter for banned patterns. Returns friendly refusal.

**`telegramBot.ts`:** Long-polling (no webhook). Calls its own `/v1/chat` internally. Responds to DMs, group mentions, `/woof`. Keep-alive HTTPS agent.

**`blueskyClient.ts`:** AT Protocol `AtpAgent`. App Password auth. `RichText.detectFacets()` before posting. `handleApiError()` resets auth on 401/403/ExpiredToken for auto re-auth.

**`xClient.ts`:** OAuth 1.0a. **Post only** (Free tier) — do NOT implement auto-replies until Basic tier. `handleApiError()` resets auth on 401/403. **280 weighted char limit** (not 300).

---

## 9. Session Memory Architecture

```
Frontend (Next.js)
  └── POST /api/chat (proxy)
        └── POST /v1/chat (this server)
              ├── memoryStore.prune(sessionId)         → server-side history
              ├── merge with req.body.history           → frontend-supplied last 10 msgs
              ├── buildPromptWithMarket(merged, userMsg)→ getMarketSnapshot() → inject into system prompt
              ├── generateWithGemini(messages)
              ├── ensureDogEmoji(response)
              └── memoryStore.append(sessionId, [user, assistant])
```

Memory is **in-process only** — a server restart clears all sessions. This is intentional for the current scale.

---

## 10. Deployment

### Infrastructure
- **Platform:** Hetzner CX23 (Docker container)
- **Port:** 8080 in-container, usually mapped to host port 80 or 8080
- **Container:** Node.js 20 slim, multi-stage build
- **Restart policy:** `--restart unless-stopped`
- **Env injection:** `--env-file ~/charlie-ai.env` (file lives on Hetzner, never in the image)

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
| `deploy-to-hetzner.sh` | Build image locally, SCP to Hetzner, load, restart container |
| `scripts/run-with-env.sh` | Load `deploy.env` and run Docker locally for testing |

### Deploy Checklist
1. Update `deploy.env` with any new env vars
2. Run `npm run build` locally to verify TypeScript compiles
3. Run deploy script of choice
4. SSH into Hetzner and verify: `curl http://localhost:8080/healthz`
5. Check `docker logs -f charlie-ai` for startup errors
6. Verify social scheduler initialized: look for `social_media_scheduler_initialized` log line
7. Test chat: `curl -X POST http://localhost:8080/v1/chat -H "Content-Type: application/json" -d '{"sessionId":"test","message":"Hello Charlie!"}'`

---

## 11. Roadmap

| Quarter | Milestone | Status |
|---------|-----------|--------|
| Q4 2025 | Charlie AI launched — Telegram, Bluesky, X/Twitter, website chat. Bluesky auto-replies active. | ✅ Complete |
| Q1 2026 | AI growth & analysis. Server upgrades. 14-topic/7-structure post system. Gemini 2.5 migration. Live market data (DexScreener + CoinGecko) injected into all AI prompts. X Free tier stabilization. | ✅ Complete |
| Q2 2026 | Submit token listing forms on CoinGecko and Etherscan prior to $CHAR TGE. | 🔄 Current |
| Q3 2026 | $CHAR TGE on Base via Aerodrome. Cross-chain expansion to all 9 chains via Axelar Network + Squid Router + Base↔Solana Bridge. | ⏳ Upcoming |
| Q3–Q4 2026 | $BULL launch on Pump.fun (Solana). Upon graduation: 1B $CHAR permanently burned (from Ethereum liquidity — hardcoded, not manual). CHAR/BULL swap pair on Raydium. Weekly Pump.fun podcasts begin. | ⏳ Upcoming |
| Q4 2026 | $BULL companion token launch. Charlie's Angels NFT collection on Solana for $BULL graduates. | ⏳ Upcoming |
| Q1 2027 | Base ↔ Solana bridge live. Raydium CHAR/BULL pair active. | ⏳ Upcoming |
| Q2 2027 | Charlie's Angels NFT launch on Solana. IP partnerships, merchandise, multimedia. | ⏳ Upcoming |
| Q3 2027+ | DeFi utilities, governance, strategic partnerships, Web3 ecosystem expansion. | ⏳ Future |

---

## 12. Development Workflow

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

## 13. Known Issues & Important Notes

### X/Twitter Auto-Replies — NOT ACTIVE
Auto-replies on X require the **X API Basic tier**. Do not implement, document as active, or enable `SOCIAL_REPLIES_ENABLED` for X until the account is upgraded. Bluesky auto-replies are fully active and unaffected.

### Memory Is Not Persistent
`InMemoryStore` clears on every server restart. If persistent memory across restarts becomes a requirement, replace with Redis or a database. For current scale this is acceptable.

### Gemini Model Deprecation
Gemini model names deprecate over time and return 404s. The current chain is `gemini-3.1-flash-lite,gemini-2.5-flash-lite`. `gemini-1.5-*` and `gemini-2.0-flash` are fully deprecated — do not use. The normalizer in `geminiClient.ts` maps legacy names to current equivalents as a safety net. Watch for `gemini_configured_models_missing_from_list` warnings in logs and update `GEMINI_MODELS` in `deploy.env` when a new deprecation is announced.

### Social Post Failure & Retry Behaviour
When Gemini fails (rate limit, network error, etc.) `generateWithGemini` returns `isError: true`. The scheduler detects this and **never posts the error string to social media**. Instead it retries up to 3 times with a 30-minute delay between attempts. If all 3 fail, the post slot is skipped and the scheduler waits for the next scheduled time. If you see 3 or more consecutive missing posts, check `docker logs charlie-ai` for the root cause.

### Telegram Polling on Hetzner
Only one polling process should run at a time. If `TELEGRAM_POLLING=true` and more than one container is running, Telegram updates will be split between instances. Use a single container deployment.

### Admin API Key
If `ADMIN_API_KEY` is left empty in `deploy.env`, write endpoints (`/api/social/test/*`, `/api/social/check-interactions`) are open. Always set a strong key in production. Generate with: `openssl rand -hex 32`

### Bluesky App Password
Use a Bluesky **App Password** (generated at bsky.app/settings/app-passwords), never the main account password.

---

## 14. Social Links

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

## 15. Related Repository

The `official-charlie-bull` repository contains:
- Next.js 16 frontend
- Chat widget (`ChatWidget.tsx`) that calls this server
- Squid cross-chain bridge widget (`SquidWidgetWrapper.tsx`)
- Woof Paper docs (`/docs` page — tokenomics and roadmap)
- Vercel auto-deploy from `main` branch
- See `PROJECT_CONTEXT.md` in the frontend repo for full documentation

---

*This file should be updated whenever significant architecture changes, new environment variables, platform status changes, or roadmap updates are made.*
