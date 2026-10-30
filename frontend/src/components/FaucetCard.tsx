import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Droplets, Clock, Loader2, Sparkles, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { ABIS } from '../config/contracts';

interface FaucetCardProps {
  faucetAddress?: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
}

export const FaucetCard: React.FC<FaucetCardProps> = ({
  faucetAddress,
  tokenAddress,
  tokenSymbol,
}) => {
  const { address, isConnected } = useAccount();
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('500');

  // Read Faucet Details
  const { data: modeData } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'mode',
    query: { enabled: !!faucetAddress },
  });

  const { data: claimAmountData, refetch: refetchClaimAmount } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'claimAmount',
    query: { enabled: !!faucetAddress },
  });

  const { data: cooldownData } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'cooldownPeriod',
    query: { enabled: !!faucetAddress },
  });

  const { data: pausedData } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'paused',
    query: { enabled: !!faucetAddress },
  });

  const { data: adminData } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'admin',
    query: { enabled: !!faucetAddress },
  });

  // Read canClaim(address)
  const { data: canClaimData, refetch: refetchCanClaim } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'canClaim',
    args: address ? [address] : undefined,
    query: { enabled: !!faucetAddress && !!address },
  });

  // Read Faucet Token Balance (for Pre-Funded mode)
  const { data: faucetBalanceData, refetch: refetchFaucetBalance } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'balanceOf',
    args: faucetAddress ? [faucetAddress] : undefined,
    query: { enabled: !!faucetAddress },
  });

  // Write: Claim Tokens
  const { data: claimHash, writeContract: writeClaim, isPending: isClaimPending } = useWriteContract();
  const { isLoading: isClaimWaiting, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Write: Admin Deposit
  const { data: depositHash, writeContract: writeDeposit, isPending: isDepositPending } = useWriteContract();
  const { isLoading: isDepositWaiting, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  // Initialize countdown timer
  useEffect(() => {
    if (canClaimData) {
      const remaining = Number((canClaimData as [boolean, bigint])[1]);
      setRemainingSeconds(remaining);
    }
  }, [canClaimData]);

  // Tick countdown timer every second
  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          refetchCanClaim();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, refetchCanClaim]);

  // Refetch on claim success
  useEffect(() => {
    if (isClaimSuccess) {
      refetchCanClaim();
      refetchFaucetBalance();
      refetchClaimAmount();
    }
  }, [isClaimSuccess, refetchCanClaim, refetchFaucetBalance, refetchClaimAmount]);

  if (!faucetAddress || faucetAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md text-slate-400 text-sm text-center">
        <Droplets className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        No testnet faucet configured for this DAO.
      </div>
    );
  }

  const mode = modeData !== undefined ? Number(modeData) : 0; // 0 = MINT, 1 = PRE_FUNDED
  const isPaused = Boolean(pausedData);
  const rawClaimAmount = claimAmountData ? BigInt(claimAmountData.toString()) : 0n;
  const formattedClaimAmount = Number(formatUnits(rawClaimAmount, 18)).toLocaleString();
  const cooldownSecs = cooldownData ? Number(cooldownData) : 0;
  const cooldownHours = Math.round(cooldownSecs / 3600);

  const [eligible] = canClaimData ? (canClaimData as [boolean, bigint]) : [false, 0n];
  const isAdmin = address && adminData && (adminData as string).toLowerCase() === address.toLowerCase();

  const rawFaucetBalance = faucetBalanceData ? BigInt(faucetBalanceData.toString()) : 0n;
  const formattedFaucetBalance = Number(formatUnits(rawFaucetBalance, 18)).toLocaleString();

  // Format remaining cooldown timer mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const handleClaim = () => {
    writeClaim({
      address: faucetAddress,
      abi: ABIS.daoFaucet,
      functionName: 'claimTokens',
    });
  };

  const handleDepositTokens = () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    const parsed = parseUnits(depositAmount, 18);
    writeDeposit({
      address: tokenAddress,
      abi: ABIS.daoToken,
      functionName: 'transfer',
      args: [faucetAddress, parsed],
    });
  };

  const isClaiming = isClaimPending || isClaimWaiting;

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Droplets className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Token Faucet</h3>
            <p className="text-xs text-slate-400">Instant testnet voting tokens</p>
          </div>
        </div>

        {/* Faucet Mode Badge */}
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
          mode === 0 
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }`}>
          {mode === 0 ? 'Mint Mode' : 'Pre-Funded'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Info Box */}
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Claim Allowance</span>
            <span className="text-base font-bold text-slate-100 font-mono">
              {formattedClaimAmount} <span className="text-xs font-normal text-slate-400">{tokenSymbol}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block mb-0.5">Cooldown Period</span>
            <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1 justify-end">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {cooldownHours}h ({cooldownSecs}s)
            </span>
          </div>
        </div>

        {/* Pre-funded mode balance preview */}
        {mode === 1 && (
          <div className="text-xs text-slate-400 flex items-center justify-between px-1">
            <span>Faucet Reserve Pool:</span>
            <span className="font-mono text-slate-300">{formattedFaucetBalance} {tokenSymbol}</span>
          </div>
        )}

        {/* Cooldown Timer Alert */}
        {remainingSeconds > 0 && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span>Next claim available in:</span>
            </div>
            <span className="font-mono font-bold text-cyan-400 text-sm">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        )}

        {isClaimSuccess ? (
          <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
            <span>Tokens successfully claimed! Remember to activate voting power if not already delegated.</span>
          </div>
        ) : null}

        {isPaused && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Faucet is currently paused by the administrator.</span>
          </div>
        )}

        {/* Claim Action Button */}
        <button
          onClick={handleClaim}
          disabled={!isConnected || !eligible || remainingSeconds > 0 || isClaiming || isPaused}
          className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
            !eligible || remainingSeconds > 0 || isPaused || !isConnected
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/10'
          }`}
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Claiming on LitVM...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {!isConnected
                  ? 'Connect Wallet to Claim'
                  : remainingSeconds > 0
                  ? `Cooldown Active (${formatTime(remainingSeconds)})`
                  : isPaused
                  ? 'Faucet Paused'
                  : `Claim ${formattedClaimAmount} ${tokenSymbol}`}
              </span>
            </>
          )}
        </button>

        {/* Admin Section (Only visible to faucet admin) */}
        {isAdmin && (
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setShowAdminModal(!showAdminModal)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Admin Controls (You are Faucet Admin)
              </span>
              <span>{showAdminModal ? 'Hide' : 'Configure'}</span>
            </button>

            {showAdminModal && (
              <div className="mt-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                {mode === 1 && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Top-up Faucet Pool ({tokenSymbol})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 flex-1 font-mono focus:outline-none"
                      />
                      <button
                        onClick={handleDepositTokens}
                        disabled={isDepositPending || isDepositWaiting}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                      >
                        {isDepositWaiting ? 'Depositing...' : 'Deposit'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-slate-500">
                  Faucet Address: <span className="font-mono text-slate-400">{faucetAddress}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
