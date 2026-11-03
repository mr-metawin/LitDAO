import { defineChain } from 'viem';

export const litvm = defineChain({
  id: 4441,
  name: 'LitVM LiteForge',
  nativeCurrency: {
    decimals: 18,
    name: 'zkLTC',
    symbol: 'zkLTC',
  },
  rpcUrls: {
    default: {
      http: ['https://liteforge.rpc.caldera.xyz/http'],
      webSocket: ['wss://liteforge.rpc.caldera.xyz/ws'],
    },
    public: {
      http: ['https://liteforge.rpc.caldera.xyz/http'],
      webSocket: ['wss://liteforge.rpc.caldera.xyz/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Caldera LiteForge Explorer',
      url: 'https://liteforge.explorer.caldera.xyz',
      apiUrl: 'https://liteforge.explorer.caldera.xyz/api',
    },
  },
  fees: {
    baseFeeMultiplier: 1.5, // 50% buffer to prevent "max fee per gas less than block base fee" on Caldera
    defaultPriorityFee: 50000000n, // 0.05 Gwei priority fee (Caldera RPC returns 0x0 by default)
  },
  testnet: true,
});

export const FAUCET_HUB_URL = 'https://liteforge.hub.caldera.xyz';
export const SUBGRAPH_URL = import.meta.env.VITE_GOLDSKY_GRAPHQL_URL || 'https://api.goldsky.com/api/public/project_cm2amh4pghfqk01wega7t4x7l/subgraphs/litdao/1.0.1/gn';

/**
 * Helper to obtain safe fee parameters with a buffer for LitVM transactions
 */
export async function getSafeGasFees(publicClient?: any) {
  if (!publicClient) {
    return {
      maxFeePerGas: 300000000n, // 0.3 Gwei safe default
      maxPriorityFeePerGas: 50000000n, // 0.05 Gwei
    };
  }
  try {
    const fees = await publicClient.estimateFeesPerGas();
    const safeMaxFeePerGas = fees.maxFeePerGas
      ? (BigInt(fees.maxFeePerGas) * 15n) / 10n
      : 300000000n;
    const safePriorityFee = fees.maxPriorityFeePerGas && BigInt(fees.maxPriorityFeePerGas) > 0n
      ? BigInt(fees.maxPriorityFeePerGas)
      : 50000000n;
    return {
      maxFeePerGas: safeMaxFeePerGas,
      maxPriorityFeePerGas: safePriorityFee,
    };
  } catch (err) {
    console.warn('Could not estimate gas fees, using safe fallback:', err);
    return {
      maxFeePerGas: 300000000n,
      maxPriorityFeePerGas: 50000000n,
    };
  }
}



