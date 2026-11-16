export interface ActiveEvmNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  dex: string;
  nativeToken: string;
  blockExplorer: string;
  bridgeProtocol: string;
  tokenContract: string;
  tokenManagerContract?: string;
  isHomeChain?: boolean;
  isLaunchPool?: boolean;
}

export const CHAR_TOKEN_CONTRACT = '0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1';

export const ACTIVE_EVM_NETWORKS: readonly ActiveEvmNetwork[] = [
  { name: 'Arbitrum (Home Chain)', chainId: 42161, rpcUrl: 'https://arb1.arbitrum.io/rpc', dex: 'Uniswap', nativeToken: 'ARB', blockExplorer: 'https://arbiscan.io', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT, isHomeChain: true },
  { name: 'Ethereum Mainnet', chainId: 1, rpcUrl: 'https://ethereum-rpc.publicnode.com', dex: 'Uniswap', nativeToken: 'ETH', blockExplorer: 'https://etherscan.io', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'Base', chainId: 8453, rpcUrl: 'https://mainnet.base.org', dex: 'Aerodrome', nativeToken: 'ETH', blockExplorer: 'https://basescan.org', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT, isLaunchPool: true },
  { name: 'Polygon', chainId: 137, rpcUrl: 'https://polygon-rpc.com', dex: 'QuickSwap', nativeToken: 'POL', blockExplorer: 'https://polygonscan.com', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'Optimism', chainId: 10, rpcUrl: 'https://mainnet.optimism.io', dex: 'Velodrome', nativeToken: 'OP', blockExplorer: 'https://optimistic.etherscan.io', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'BNB Chain', chainId: 56, rpcUrl: 'https://bsc-dataseed.binance.org', dex: 'PancakeSwap', nativeToken: 'BNB', blockExplorer: 'https://bscscan.com', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'Avalanche', chainId: 43114, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', dex: 'LFGJ', nativeToken: 'AVAX', blockExplorer: 'https://snowtrace.io', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'Linea', chainId: 59144, rpcUrl: 'https://rpc.linea.build', dex: 'Linea DEX', nativeToken: 'ETH', blockExplorer: 'https://lineascan.build', bridgeProtocol: 'Axelar Interchain Token Service', tokenContract: CHAR_TOKEN_CONTRACT },
  { name: 'Hyperliquid (HyperEVM)', chainId: 999, rpcUrl: 'https://rpc.hyperliquid.xyz/evm', dex: 'Post-TGE DEX TBD', nativeToken: 'HYPE', blockExplorer: 'https://hyperevmscan.io', bridgeProtocol: 'Axelar Interchain Token Service (ITS Hub)', tokenContract: CHAR_TOKEN_CONTRACT, tokenManagerContract: '0x1312878F2263067C98F93d2Fee8865Ca6b4f02c7' },
];

export const ACTIVE_EVM_NETWORK_COUNT = ACTIVE_EVM_NETWORKS.length;

export const HYPERLIQUID_ROADMAP_CONTEXT =
  'Hyperliquid (HyperEVM) is a live supported chain. $CHAR deployment is live via Axelar Interchain Token Service (ITS Hub).';
