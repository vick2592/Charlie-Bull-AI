import { AbiCoder, getAddress, hexlify, isHexString } from 'ethers';

export const AMPLIFIER_DESTINATION_CHAIN = 'hyperliquid';
export const AXELAR_GATEWAY_DESTINATION_CHAIN = 'axelar';
export const ITS_HUB_DESTINATION_CONTRACT = 'its_hub';
export const MESSAGE_TYPE_SEND_TO_HUB = 3;

const abiCoder = AbiCoder.defaultAbiCoder();

export interface HubRoutingMessage {
  destinationChain?: string;
  itsPayload: string;
}

export function buildHubRoutingPayload({
  destinationChain = AMPLIFIER_DESTINATION_CHAIN,
  itsPayload,
}: HubRoutingMessage): string {
  if (!destinationChain.trim()) throw new Error('destinationChain must not be empty');
  if (!isHexString(itsPayload)) throw new Error('itsPayload must be a hex string');

  return abiCoder.encode(
    ['uint256', 'string', 'bytes'],
    [MESSAGE_TYPE_SEND_TO_HUB, destinationChain, hexlify(itsPayload)],
  );
}

export function buildCanonicalDeploymentPayload(
  tokenAddress: string,
  gasValue: bigint = 0n,
): string {
  return abiCoder.encode(
    ['address', 'string', 'uint256'],
    [getAddress(tokenAddress), AMPLIFIER_DESTINATION_CHAIN, gasValue],
  );
}