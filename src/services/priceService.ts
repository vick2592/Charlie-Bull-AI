/**
 * Price Service
 * Fetches live market data from two sources:
 *   1. DexScreener — $CHAR on-chain price across all 9 DEX pairs
 *   2. CoinGecko (free, no key) — native/governance token prices for all 9 chains Charlie lives on,
 *      plus BTC as a market-wide indicator.
 *
 * Tracked chain tokens:
 *   BTC (market), ETH (Ethereum/Base/Linea/Blast), BNB (BSC), AVAX (Avalanche),
 *   ARB (Arbitrum), MNT (Mantle), POL/MATIC (Polygon), BLAST (Blast), SOL (roadmap bridge)
 *
 * Data is cached for 5 minutes to avoid hammering free APIs.
 * All fetches fail gracefully — if data is unavailable Charlie posts/replies without price info.
 */

import fetch from 'node-fetch';
import { logger } from '../lib/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharPrice {
  chain: string;
  dex: string;
  priceUsd: string;       // e.g. "0.000000012"
  priceChange24h: string; // e.g. "+5.2%" or "-3.1%"
  liquidity: string;      // e.g. "$12,400"
  pairUrl: string;
}

export interface TopTokenPrice {
  symbol: string;
  name: string;
  priceUsd: string;
  priceChange24h: string;
  marketCapRank: number;
}

export interface MarketSnapshot {
  charPrices: CharPrice[];       // $CHAR price on each chain (may be empty pre-TGE)
  topTokens: TopTokenPrice[];    // Native/gov tokens for Charlie's 9 chains + BTC
  fetchedAt: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// $CHAR contract address (same on all 9 chains)
const CHAR_CONTRACT = '0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1';

// Native/governance tokens for all 9 chains Charlie is deployed on, plus BTC as market indicator.
// Covers: Ethereum, Base (ETH), Linea (ETH), Blast (ETH+BLAST), BSC (BNB),
//         Avalanche (AVAX), Arbitrum (ARB), Mantle (MNT), Polygon (POL/MATIC)
// Also includes SOL for the roadmap Base↔Solana bridge and Raydium pair.
const CHAIN_TOKEN_COINGECKO_IDS = [
  'bitcoin',       // BTC — market-wide indicator
  'ethereum',      // ETH — Ethereum, Base, Linea, Blast gas token
  'binancecoin',   // BNB — BNB Smart Chain
  'avalanche-2',   // AVAX — Avalanche
  'matic-network', // POL/MATIC — Polygon
  'arbitrum',      // ARB — Arbitrum
  'mantle',        // MNT — Mantle
  'blast',         // BLAST — Blast L2 governance token
  'solana',        // SOL — roadmap: Base↔Solana bridge + Raydium pair
];

// Human-readable symbol map
const COINGECKO_SYMBOL: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  binancecoin: 'BNB',
  'avalanche-2': 'AVAX',
  'matic-network': 'POL',
  arbitrum: 'ARB',
  mantle: 'MNT',
  blast: 'BLAST',
  solana: 'SOL',
};

// ─── Cache ────────────────────────────────────────────────────────────────────

let cache: MarketSnapshot | null = null;
let lastFetch: number = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  if (value < 0.000001) return `$${value.toExponential(2)}`;
  if (value < 0.01) return `$${value.toFixed(8)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatLiquidity(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

// ─── DexScreener — $CHAR prices ──────────────────────────────────────────────

async function fetchCharPrices(): Promise<CharPrice[]> {
  try {
    // DexScreener search by token address across all chains
    const url = `https://api.dexscreener.com/latest/dex/tokens/${CHAR_CONTRACT}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CharlieBull-AI-Agent/1.0' },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'DexScreener returned non-200');
      return [];
    }

    const json: any = await res.json();
    const pairs: any[] = json?.pairs ?? [];

    if (!pairs.length) {
      logger.info('DexScreener returned no pairs for $CHAR — pre-TGE or no liquidity yet');
      return [];
    }

    // Sort by liquidity descending, take best pair per chain
    const byChain = new Map<string, any>();
    for (const pair of pairs) {
      const chain = pair.chainId as string;
      const existing = byChain.get(chain);
      const liq = pair.liquidity?.usd ?? 0;
      if (!existing || liq > (existing.liquidity?.usd ?? 0)) {
        byChain.set(chain, pair);
      }
    }

    return Array.from(byChain.values()).map((pair) => ({
      chain: pair.chainId,
      dex: pair.dexId,
      priceUsd: formatUsd(parseFloat(pair.priceUsd ?? '0')),
      priceChange24h: formatChange(pair.priceChange?.h24 ?? 0),
      liquidity: formatLiquidity(pair.liquidity?.usd ?? 0),
      pairUrl: pair.url ?? '',
    }));
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'DexScreener fetch failed — skipping $CHAR price');
    return [];
  }
}

// ─── CoinGecko — Chain native token market context ───────────────────────────

async function fetchTopTokens(): Promise<TopTokenPrice[]> {
  try {
    const ids = CHAIN_TOKEN_COINGECKO_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=${CHAIN_TOKEN_COINGECKO_IDS.length}&page=1&sparkline=false&price_change_percentage=24h`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CharlieBull-AI-Agent/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'CoinGecko returned non-200');
      return [];
    }

    const json = await res.json() as any[];

    return json.map((coin, idx) => ({
      symbol: COINGECKO_SYMBOL[coin.id] ?? coin.symbol.toUpperCase(),
      name: coin.name,
      priceUsd: formatUsd(coin.current_price ?? 0),
      priceChange24h: formatChange(coin.price_change_percentage_24h ?? 0),
      marketCapRank: idx + 1,
    }));
  } catch (err: any) {
    logger.warn({ err: err?.message }, 'CoinGecko fetch failed — skipping top tokens');
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get current market snapshot.
 * Returns cached data if fresh (< 5 min). Fetches both sources in parallel.
 * Never throws — returns empty arrays on failure.
 */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL_MS) {
    return cache;
  }

  logger.info('Fetching fresh market data (DexScreener + CoinGecko)');
  const [charPrices, topTokens] = await Promise.all([
    fetchCharPrices(),
    fetchTopTokens(),
  ]);

  cache = { charPrices, topTokens, fetchedAt: new Date() };
  lastFetch = now;

  logger.info(
    { charPairs: charPrices.length, topTokens: topTokens.length },
    'Market snapshot updated'
  );

  return cache;
}

/**
 * Format the market snapshot as a compact string for injection into prompts.
 * Returns empty string if no data available (graceful degradation).
 */
export function formatMarketContext(snapshot: MarketSnapshot): string {
  const lines: string[] = [];

  if (snapshot.charPrices.length > 0) {
    lines.push('$CHAR LIVE PRICES (on-chain via DexScreener):');
    for (const p of snapshot.charPrices) {
      lines.push(`  ${p.chain} (${p.dex}): ${p.priceUsd} | 24h: ${p.priceChange24h} | Liquidity: ${p.liquidity}`);
    }
    lines.push('');
  }

  if (snapshot.topTokens.length > 0) {
    lines.push('CHAIN NATIVE TOKENS (live via CoinGecko — covers all 9 Charlie Bull chains):');
    lines.push('  ETH = Ethereum, Base, Linea, Blast gas token | BNB = BSC | AVAX = Avalanche | ARB = Arbitrum | MNT = Mantle | POL = Polygon | BLAST = Blast governance | SOL = Solana (roadmap bridge)');
    for (const t of snapshot.topTokens) {
      lines.push(`  ${t.symbol}: ${t.priceUsd} (24h: ${t.priceChange24h})`);
    }
    lines.push('');
    lines.push('NOTE: Only comment on tokens in this list if directly asked. For any other token, politely redirect conversation back to $CHAR and the Charlie Bull ecosystem.');
  }

  return lines.join('\n');
}

/**
 * Format a user-friendly response when asked about $CHAR price.
 * Falls back gracefully if no data yet.
 */
export function formatCharPriceResponse(snapshot: MarketSnapshot): string {
  if (snapshot.charPrices.length === 0) {
    return '$CHAR is currently in pre-TGE phase — trading data will be available on DexScreener once the liquidity pool goes live on Base via Aerodrome in Q3 2026.';
  }

  const lines = ['Here are the current $CHAR prices across chains:'];
  for (const p of snapshot.charPrices) {
    lines.push(`• ${p.chain} (${p.dex}): ${p.priceUsd} | 24h: ${p.priceChange24h} | Liquidity: ${p.liquidity}`);
  }
  return lines.join('\n');
}
