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
  testnet: true,
});

export const FAUCET_HUB_URL = 'https://liteforge.hub.caldera.xyz';
export const SUBGRAPH_URL = import.meta.env.VITE_GOLDSKY_GRAPHQL_URL || 'https://api.goldsky.com/api/public/project_cm2amh4pghfqk01wega7t4x7l/subgraphs/litdao/1.0.1/gn';

