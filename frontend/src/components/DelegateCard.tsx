import React, { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ShieldCheck, UserCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { ABIS } from '../config/contracts';

interface DelegateCardProps {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
}

export const DelegateCard: React.FC<DelegateCardProps> = ({ tokenAddress, tokenSymbol }) => {
  const { address, isConnected } = useAccount();
  const [customDelegatee, setCustomDelegatee] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Read Token Balance
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read Current Delegatee
  const { data: delegateeData, refetch: refetchDelegatee } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read Current Voting Power
  const { data: votesData, refetch: refetchVotes } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write Contract
  const { data: txHash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isTxWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Refetch after tx success
  React.useEffect(() => {
    if (isTxSuccess) {
      refetchBalance();
      refetchDelegatee();
      refetchVotes();
    }
  }, [isTxSuccess, refetchBalance, refetchDelegatee, refetchVotes]);

  const rawBalance = balanceData ? BigInt(balanceData.toString()) : 0n;
  const rawVotes = votesData ? BigInt(votesData.toString()) : 0n;
  const currentDelegatee = delegateeData as string | undefined;

  const formattedBalance = Number(formatUnits(rawBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const formattedVotes = Number(formatUnits(rawVotes, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const isSelfDelegated = address && currentDelegatee?.toLowerCase() === address.toLowerCase();
  const hasZeroDelegation = !currentDelegatee || currentDelegatee === '0x0000000000000000000000000000000000000000';
  const hasTokensWithoutVotes = rawBalance > 0n && rawVotes === 0n;

  const handleSelfDelegate = () => {
    if (!address) return;
    writeContract({
      address: tokenAddress,
      abi: ABIS.daoToken,
      functionName: 'delegate',
      args: [address],
    });
  };

  const handleCustomDelegate = () => {
    if (!isAddress(customDelegatee)) return;
    writeContract({
      address: tokenAddress,
      abi: ABIS.daoToken,
      functionName: 'delegate',
      args: [customDelegatee as `0x${string}`],
    });
  };

  const isPending = isWritePending || isTxWaiting;

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Voting Delegation</h3>
            <p className="text-xs text-slate-400">ERC20Votes checkpointing</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-slate-900 border border-slate-800 text-slate-300">
          {tokenSymbol}
        </span>
      </div>

      {!isConnected ? (
        <div className="text-center py-6 text-sm text-slate-400">
          Connect your wallet to inspect balance & activate voting power.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Balance & Voting Power Stats */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Your Token Balance</span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {formattedBalance} <span className="text-xs font-normal text-slate-400">{tokenSymbol}</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Active Voting Power</span>
              <span className={`text-base font-bold font-mono ${rawVotes > 0n ? 'text-brand-400' : 'text-slate-400'}`}>
                {formattedVotes} <span className="text-xs font-normal text-slate-400">Votes</span>
              </span>
            </div>
          </div>

          {/* Delegation Status Alert */}
          {hasTokensWithoutVotes && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Voting power is not active!</strong> You own {tokenSymbol} tokens, but haven't delegated voting rights yet. Click <strong>Activate Voting Power</strong> below.
              </div>
            </div>
          )}

          {isSelfDelegated && (
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-400" />
              <span>Self-delegated. Your tokens count towards your voting power!</span>
            </div>
          )}

          {/* Current Delegatee Info */}
          <div className="flex items-center justify-between text-xs py-1 px-1">
            <span className="text-slate-400">Delegated To</span>
            <span className="font-mono text-slate-300">
              {hasZeroDelegation
                ? 'None (0x0)'
                : isSelfDelegated
                ? 'Self (' + address?.slice(0, 6) + '...' + address?.slice(-4) + ')'
                : currentDelegatee?.slice(0, 6) + '...' + currentDelegatee?.slice(-4)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleSelfDelegate}
              disabled={isPending || isSelfDelegated}
              className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                isSelfDelegated
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
                  : 'bg-brand-600 hover:bg-brand-500 text-slate-950 shadow-md shadow-brand-500/10'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Delegating on LitVM...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>{isSelfDelegated ? 'Voting Power Active (Self-Delegated)' : 'Activate Voting Power (Self-Delegate)'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCustomInput(!showCustomInput)}
              className="text-xs text-slate-400 hover:text-slate-300 underline self-center py-1"
            >
              {showCustomInput ? 'Cancel custom delegation' : 'Delegate to another wallet'}
            </button>

            {showCustomInput && (
              <div className="pt-2 space-y-2">
                <input
                  type="text"
                  placeholder="0x... delegatee address"
                  value={customDelegatee}
                  onChange={(e) => setCustomDelegatee(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCustomDelegate}
                  disabled={isPending || !isAddress(customDelegatee)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white disabled:opacity-50 transition border border-slate-700"
                >
                  Delegate to Custom Address
                </button>
              </div>
            )}
          </div>

          {writeError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              Error: {writeError.message.slice(0, 100)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
