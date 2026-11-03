import React, { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, isAddress } from 'viem';
import { ShieldCheck, UserCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { ABIS } from '../config/contracts';
import { getSafeGasFees } from '../config/chain';

interface DelegateCardProps {
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
}

export const DelegateCard: React.FC<DelegateCardProps> = ({ tokenAddress, tokenSymbol }) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
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

  const handleSelfDelegate = async () => {
    if (!address) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeContract as any)({
        address: tokenAddress,
        abi: ABIS.daoToken,
        functionName: 'delegate',
        args: [address],
        ...feeOverrides,
      });
    } catch (err: any) {
      console.error('Failed to self delegate:', err);
    }
  };

  const handleCustomDelegate = async () => {
    if (!isAddress(customDelegatee)) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeContract as any)({
        address: tokenAddress,
        abi: ABIS.daoToken,
        functionName: 'delegate',
        args: [customDelegatee as `0x${string}`],
        ...feeOverrides,
      });
    } catch (err: any) {
      console.error('Failed to custom delegate:', err);
    }
  };

  const isPending = isWritePending || isTxWaiting;

  return (
    <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
            <ShieldCheck className="w-5 h-5 text-[#c8ff00]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Voting Delegation</h3>
            <p className="text-xs text-[#777777]">ERC20Votes checkpointing</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-mono bg-[#1c1c1c] border border-[#282828] text-white">
          {tokenSymbol}
        </span>
      </div>

      {!isConnected ? (
        <div className="text-center py-6 text-sm text-[#777777]">
          Connect your wallet to inspect balance & activate voting power.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Balance & Voting Power Stats */}
          <div className="grid grid-cols-2 gap-3 bg-[#181818] p-4 rounded-2xl border border-[#242424]">
            <div>
              <span className="text-xs text-[#777777] block mb-1">Your Token Balance</span>
              <span className="text-lg font-bold text-white font-mono">
                {formattedBalance} <span className="text-xs font-normal text-[#888888]">{tokenSymbol}</span>
              </span>
            </div>
            <div>
              <span className="text-xs text-[#777777] block mb-1">Active Voting Power</span>
              <span className={`text-lg font-bold font-mono ${rawVotes > 0n ? 'text-[#c8ff00]' : 'text-[#888888]'}`}>
                {formattedVotes} <span className="text-xs font-normal text-[#777777]">Votes</span>
              </span>
            </div>
          </div>

          {/* Delegation Status Alert */}
          {hasTokensWithoutVotes && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <strong>Voting power is inactive!</strong> You hold {tokenSymbol} tokens, but haven't delegated voting rights yet. Click <strong>Activate Voting Power</strong> below.
              </div>
            </div>
          )}

          {isSelfDelegated && (
            <div className="p-3 rounded-2xl bg-[#162300] border border-[#c8ff00]/30 text-[#c8ff00] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#c8ff00]" />
              <span>Self-delegated. Your tokens count towards your voting power!</span>
            </div>
          )}

          {/* Current Delegatee Info */}
          <div className="flex items-center justify-between text-xs py-1 px-1">
            <span className="text-[#777777]">Delegated To</span>
            <span className="font-mono text-white">
              {hasZeroDelegation
                ? 'None (0x0)'
                : isSelfDelegated
                ? 'Self (' + address?.slice(0, 6) + '...' + address?.slice(-4) + ')'
                : currentDelegatee?.slice(0, 6) + '...' + currentDelegatee?.slice(-4)}
            </span>
          </div>

          {/* Action Buttons: OKX Style */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleSelfDelegate}
              disabled={isPending || isSelfDelegated}
              className={`w-full py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] ${
                isSelfDelegated
                  ? 'bg-[#181818] text-[#555555] cursor-not-allowed border border-[#242424]'
                  : 'bg-[#c8ff00] hover:bg-[#b5e600] text-black shadow-lg shadow-[#c8ff00]/10'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
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
              className="text-xs text-[#888888] hover:text-white underline self-center py-1 transition"
            >
              {showCustomInput ? 'Cancel custom delegation' : 'Delegate to another address'}
            </button>

            {showCustomInput && (
              <div className="pt-2 space-y-2">
                <input
                  type="text"
                  placeholder="0x... delegatee address"
                  value={customDelegatee}
                  onChange={(e) => setCustomDelegatee(e.target.value)}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-2xl px-4 py-2.5 text-xs text-white font-mono focus:border-[#c8ff00] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCustomDelegate}
                  disabled={isPending || !isAddress(customDelegatee)}
                  className="w-full py-2.5 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold disabled:opacity-50 transition"
                >
                  Delegate to Custom Address
                </button>
              </div>
            )}
          </div>

          {writeError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 break-words">
              {writeError.message.includes('max fee per gas less than block base fee')
                ? 'Gas fee fluctuation on LitVM. Please try again with updated gas.'
                : (writeError as any).shortMessage || writeError.message.slice(0, 180)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
