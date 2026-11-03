import React from 'react';
import { useAccount, useBalance } from 'wagmi';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { FAUCET_HUB_URL, litvm } from '../config/chain';

export const GasWarningBanner: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address,
    chainId: litvm.id,
  });

  if (!isConnected || isLoading || !balance) {
    return null;
  }

  // Show if zkLTC balance is 0 or very low (< 0.0005 zkLTC)
  const isLowGas = balance.value === 0n || balance.value < 500000000000000n;

  if (!isLowGas) {
    return null;
  }

  return (
    <div className="bg-[#1a1405] border-b border-amber-500/20 px-4 py-2 text-amber-300 text-xs sm:text-sm flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Low zkLTC Gas:</strong> You need zkLTC on LitVM to interact, create DAOs, vote, and claim tokens.
        </span>
      </div>
      <a
        href={FAUCET_HUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 font-semibold text-xs transition border border-amber-400/30"
      >
        <span>Get zkLTC Gas</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};
