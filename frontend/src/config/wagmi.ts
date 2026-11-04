import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { litvm } from './chain';

export const config = getDefaultConfig({
  appName: 'Lumen',
  projectId: 'a05b38d3ca3484f707f1f0a2ba18e77a', // standard public demo project ID
  chains: [litvm],
  transports: {
    [litvm.id]: http('https://liteforge.rpc.caldera.xyz/http'),
  },
  ssr: false,
});
