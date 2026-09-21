PROMPT FOR FRONTEND AI AGENT — charlie-bull-ai Website Redesign (Whitepaper v1.0.4)

You are working on the Charlie Bull website (Next.js 16, TypeScript, Tailwind CSS). The repo is official-charlie-bull. You need to update all roadmap, timeline, and milestone references to reflect the finalized project roadmap as of Q3 2026.

PROJECT OVERVIEW

Charlie Bull is a cross-chain crypto project with:

$CHAR — Main ERC-20 token (1B supply) on Base via Aerodrome
Charlie — AI social media agent (the "character") that posts on Bluesky/X, answers on Telegram, and powers the website chat
$BULL — Educational companion token (1B supply) launching on Pump.fun (Solana)
Charlie's Angels — NFT collection (planned Q3 2027)
The website is the public-facing hub. It should communicate the project's progress, upcoming milestones, and how to get involved.

FINALIZED ROADMAP (Use these exact dates everywhere)

Quarter	Milestone	Status
Q4 2025	AI Integration (Charlie's brain, first posts, website chat)	✅ Complete
Q1 2026	AI Growth & Analysis (social expansion, data integration)	✅ Complete
Q2 2026	AI Growth Stage 2 (advanced analysis, multi-platform)	✅ Complete
Q3 2026	VPS Integration & Social Growth (Hetzner deployment, 24/7 uptime)	✅ Complete
Q4 2026	CoinGecko & Etherscan Approval	⏳ Upcoming
Q4 2026	$CHAR TGE — Token Generation Event on Base via Aerodrome	⏳ Upcoming
Q4 2026 – Q1 2027	Cross-Chain Expansion (bridging, multi-chain presence)	⏳ Upcoming
Q1 2027	$BULL Launch on Pump.fun (Solana) + 1B $CHAR Burn	⏳ Upcoming
Q2 2027	Base ↔ Solana Bridge + Raydium CHAR/BULL Pair	⏳ Upcoming
Q3 2027	Charlie's Angels NFT Launch + IP Development	⏳ Upcoming
Q4 2027+	Ecosystem Expansion	⏳ Future
KEY CHANGES FROM OLD ROADMAP (What to fix)

If any page, component, or text still references these OLD dates, update them:

Old (WRONG)	New (CORRECT)
TGE in Q3 2026	TGE in Q4 2026
$BULL launch in Q3 2026	$BULL launch in Q1 2027
$BULL launch in Q4 2026	$BULL launch in Q1 2027
NFT in Q4 2026	NFT in Q3 2027
Cross-chain in Q2–Q3 2026	Cross-chain in Q4 2026–Q1 2027
Bridge in Q1 2027	Bridge in Q2 2027
Q1 2026 / Q2 2026 / Q3 2026 shown as "upcoming"	These are all completed
WHAT TO UPDATE

Roadmap/Timeline section — Redesign with the full 11-row table above. Visually distinguish completed (✅, muted/past color) from upcoming (⏳, highlighted/future color). Make Q4 2026 (TGE) the hero milestone since it's the next big thing.

Token section ($CHAR) — Update "TGE expected" to Q4 2026. Network: Base. DEX: Aerodrome. Supply: 1,000,000,000 (1B). If there's a countdown timer, point it to Q4 2026.

$BULL section — Launch: Q1 2027. Network: Solana. Platform: Pump.fun. Supply: 1,000,000,000 (1B). Purpose: educational token, community engagement, 1B $CHAR burn at launch.

NFT section (Charlie's Angels) — Launch: Q3 2027. This is the IP/brand expansion phase.

Progress/Status section — Current state is Q3 2026, all AI growth milestones complete. The project is in the "pre-TGE preparation" phase. Next major event is TGE in Q4 2026.

Any "coming soon" or "up next" text — Should reference Q4 2026 TGE as the immediate next milestone.

Whitepaper document — Bump version to 1.0.4. Update all date references in the PDF/HTML to match the table above. Add a changelog note: "v1.0.4 — Q3 2026: Roadmap finalized. TGE confirmed Q4 2026. $BULL confirmed Q1 2027. NFT confirmed Q3 2027."

DESIGN DIRECTION

Keep the existing visual identity (colors, fonts, Charlie Bull branding)
The roadmap should feel like a progress bar / journey — left to right or top to bottom, with the completed portion filled in and the upcoming portion outlined
Q4 2026 (TGE) should be the visual focal point — it's what people are waiting for
Use a "current position" indicator showing we're at Q3 2026 (all green checks, next milestone highlighted)
Mobile responsive
API ENDPOINT REFERENCE (if the site fetches live data)

The backend server is at the same domain (or a configurable NEXT_PUBLIC_API_URL):

GET /api/health → {"status":"ok"}
GET /api/social/status → scheduler state, quota, platform status
GET /api/chat (POST) → Charlie's AI responses
GET /api/price → live token prices (returns [] pre-TGE)
DO NOT

Do not change the project name, token tickers, or branding
Do not add features that don't exist yet (no wallet connect, no buy button — TGE hasn't happened)
Do not reference the old Q3 2026 TGE date anywhere
Do not make up dates or milestones not in the table above
That's the full context. Update the site to reflect Whitepaper v1.0.4.