export interface ActiveEvmNetwork {
  name: string;
  dex: string;
  nativeToken: string;
  isHomeChain?: boolean;
  isLaunchPool?: boolean;
}

export const ACTIVE_EVM_NETWORKS: readonly ActiveEvmNetwork[] = [
  { name: 'Arbitrum (Home Chain)', dex: 'Uniswap', nativeToken: 'ARB', isHomeChain: true },
  { name: 'Ethereum Mainnet', dex: 'Uniswap', nativeToken: 'ETH' },
  { name: 'Base', dex: 'Aerodrome', nativeToken: 'ETH', isLaunchPool: true },
  { name: 'Polygon', dex: 'QuickSwap', nativeToken: 'POL' },
  { name: 'Optimism', dex: 'Velodrome', nativeToken: 'OP' },
  { name: 'BNB Chain', dex: 'PancakeSwap', nativeToken: 'BNB' },
  { name: 'Avalanche', dex: 'LFGJ', nativeToken: 'AVAX' },
  { name: 'Linea', dex: 'Linea DEX', nativeToken: 'ETH' },
];

export const ACTIVE_EVM_NETWORK_COUNT = ACTIVE_EVM_NETWORKS.length;

export const HYPERLIQUID_ROADMAP_CONTEXT =
  "Hyperliquid is designated as our primary 8+ expansion target. Canonical deployment is currently staged on our roadmap pending Axelar Amplifier ITS Hub routing confirmation.";
