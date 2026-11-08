#!/usr/bin/env tsx

import { Contract, Interface, JsonRpcProvider, isError } from 'ethers';
import abi from './abi.json' with { type: 'json' };
import {
  AMPLIFIER_DESTINATION_CHAIN,
  AXELAR_GATEWAY_DESTINATION_CHAIN,
  ITS_HUB_DESTINATION_CONTRACT,
  buildCanonicalDeploymentPayload,
  buildHubRoutingPayload,
} from './hubPayloadBuilder.js';

const RPC_URL = 'https://arb1.arbitrum.io/rpc';
const CHAR_TOKEN = '0x7F9532940e98eB7c2da6ba23c3f3D06315BfaAF1';
const GATEWAY_ADDRESS = '0xe432150cce91c13360172075d655fc8000df1e81';
const FACTORY_ADDRESS = '0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66';
const NOT_SUPPORTED_SELECTOR = '0x2dd85afc';

function extractRevertData(error: unknown): string | undefined {
  if (isError(error, 'CALL_EXCEPTION')) return error.data ?? error.info?.error?.data;
  return undefined;
}

function describeError(error: unknown, iface: Interface): string {
  const data = extractRevertData(error);
  if (!data) return error instanceof Error ? error.message : String(error);
  try {
    return iface.parseError(data)?.name ?? data;
  } catch {
    return data;
  }
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC_URL, 42161);
  const factoryInterface = new Interface(abi.interchainTokenFactory);
  const gatewayInterface = new Interface(abi.axelarGateway);
  const factory = new Contract(FACTORY_ADDRESS, factoryInterface, provider);

  console.log(`RPC: ${RPC_URL}`);
  console.log(`Destination: ${AMPLIFIER_DESTINATION_CHAIN}`);
  console.log(`Expected NotSupported() selector: ${NOT_SUPPORTED_SELECTOR}`);

  try {
    await factory.deployRemoteCanonicalInterchainToken.staticCall(
      CHAR_TOKEN,
      AMPLIFIER_DESTINATION_CHAIN,
      0n,
    );
    console.log('canonical deployment simulation: unexpectedly succeeded');
  } catch (error) {
    const revertData = extractRevertData(error);
    console.log(`canonical deployment simulation: ${describeError(error, factoryInterface)}`);
    console.log(`canonical deployment revert data: ${revertData ?? 'unavailable'}`);
    console.log(`NotSupported() captured: ${revertData?.startsWith(NOT_SUPPORTED_SELECTOR) ?? false}`);
    console.log(
      "Direct EVM factory calls are blocked because trustedAddress('hyperliquid') resolves to 'hub' (Amplifier Hub routing required).",
    );
  }

  const hubPayload = buildHubRoutingPayload({
    itsPayload: buildCanonicalDeploymentPayload(CHAR_TOKEN),
  });

  try {
    const gatewayCode = await provider.getCode(GATEWAY_ADDRESS);
    if (gatewayCode === '0x') {
      console.log(
        `Gateway callContract simulation: skipped; no bytecode at ${GATEWAY_ADDRESS} on Arbitrum (check the current Gateway proxy address if needed)`,
      );
    } else {
      const gateway = new Contract(GATEWAY_ADDRESS, gatewayInterface, provider);
      await gateway.callContract.staticCall(
        AXELAR_GATEWAY_DESTINATION_CHAIN,
        ITS_HUB_DESTINATION_CONTRACT,
        hubPayload,
      );
      console.log('Gateway callContract simulation: accepted payload');
    }
  } catch (error) {
    console.log(`Gateway callContract simulation: unavailable (${error instanceof Error ? error.message : String(error)})`);
    console.log(`Gateway callContract revert data: ${extractRevertData(error) ?? 'unavailable'}`);
  }

  console.log(`Hub payload bytes: ${(hubPayload.length - 2) / 2}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});