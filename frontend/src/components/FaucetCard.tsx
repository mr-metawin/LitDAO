import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Droplets, Clock, Loader2, Sparkles, CheckCircle2, AlertCircle, Settings, KeyRound } from 'lucide-react';
import { ABIS } from '../config/contracts';
import { getSafeGasFees } from '../config/chain';

const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6' as `0x${string}`;
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

interface FaucetCardProps {
  faucetAddress?: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  isLoadingFaucet?: boolean;
}

export const FaucetCard: React.FC<FaucetCardProps> = ({
  faucetAddress,
  tokenAddress,
  tokenSymbol,
  isLoadingFaucet = false,
}) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [editCooldownSecs, setEditCooldownSecs] = useState<string>('');
  const [editClaimAmount, setEditClaimAmount] = useState<string>('');

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

  const { data: cooldownData, refetch: refetchCooldown } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'cooldownPeriod',
    query: { enabled: !!faucetAddress },
  });

  const { data: pausedData, refetch: refetchPaused } = useReadContract({
    address: faucetAddress,
    abi: ABIS.daoFaucet,
    functionName: 'isPaused',
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

  // Check if faucet holds MINTER_ROLE on the token (required for Mint mode)
  const { data: hasMinterRoleData, isLoading: isCheckingMinterRole, refetch: refetchMinterRole } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'hasRole',
    args: faucetAddress ? [MINTER_ROLE, faucetAddress] : undefined,
    query: { enabled: !!faucetAddress && !!tokenAddress },
  });
  const hasMinterRole = Boolean(hasMinterRoleData);

  // Check if connected wallet is token admin (can grant roles)
  const { data: isTokenAdminData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'hasRole',
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  });
  const isTokenAdmin = Boolean(isTokenAdminData);

  // Write: Grant MINTER_ROLE to Faucet
  const {
    data: grantHash,
    writeContract: writeGrantRole,
    isPending: isGrantPending,
    error: grantError,
  } = useWriteContract();
  const { isLoading: isGrantWaiting, isSuccess: isGrantSuccess } = useWaitForTransactionReceipt({
    hash: grantHash,
  });

  // Write: Claim Tokens
  const { data: claimHash, writeContract: writeClaim, isPending: isClaimPending, error: claimError } = useWriteContract();
  const { isLoading: isClaimWaiting, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Write: Admin Set Cooldown
  const { data: cdHash, writeContract: writeCd, isPending: isCdPending } = useWriteContract();
  const { isLoading: isCdWaiting, isSuccess: isCdSuccess } = useWaitForTransactionReceipt({
    hash: cdHash,
  });

  // Write: Admin Set Claim Amount
  const { data: amtHash, writeContract: writeAmt, isPending: isAmtPending } = useWriteContract();
  const { isLoading: isAmtWaiting, isSuccess: isAmtSuccess } = useWaitForTransactionReceipt({
    hash: amtHash,
  });

  // Write: Admin Toggle Pause
  const { data: pauseHash, writeContract: writePause, isPending: isPausePending } = useWriteContract();
  const { isLoading: isPauseWaiting, isSuccess: isPauseSuccess } = useWaitForTransactionReceipt({
    hash: pauseHash,
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

  // Refetch on claim or admin success
  useEffect(() => {
    if (isClaimSuccess) {
      refetchCanClaim();
      refetchFaucetBalance();
      refetchClaimAmount();
    }
  }, [isClaimSuccess, refetchCanClaim, refetchFaucetBalance, refetchClaimAmount]);

  useEffect(() => {
    if (isCdSuccess) refetchCooldown();
  }, [isCdSuccess, refetchCooldown]);

  useEffect(() => {
    if (isAmtSuccess) refetchClaimAmount();
  }, [isAmtSuccess, refetchClaimAmount]);

  useEffect(() => {
    if (isPauseSuccess) refetchPaused();
  }, [isPauseSuccess, refetchPaused]);

  useEffect(() => {
    if (isGrantSuccess) {
      refetchMinterRole();
      refetchCanClaim();
    }
  }, [isGrantSuccess, refetchMinterRole, refetchCanClaim]);

  if (isLoadingFaucet || (!faucetAddress && isLoadingFaucet !== false)) {
    return (
      <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md animate-pulse">
        {/* Header Skeleton */}
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
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold border bg-slate-800/80 text-slate-400 border-slate-700/60">
            Connecting...
          </span>
        </div>

        <div className="space-y-4">
          {/* Info Box Skeleton */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block mb-0.5">Claim Allowance</span>
              <span className="text-base font-bold text-slate-300 font-mono">
                100 <span className="text-xs font-normal text-slate-400">{tokenSymbol}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block mb-0.5">Cooldown</span>
              <span className="text-xs font-semibold text-slate-300 font-mono">
                1 hr
              </span>
            </div>
          </div>

          {/* Placeholder Claim Button */}
          <button
            disabled
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-slate-800 text-slate-400 border border-slate-700/40 cursor-wait"
          >
            <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
            <span>Claim 100 {tokenSymbol}</span>
          </button>
        </div>
      </div>
    );
  }

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
  const rawClaimAmount = claimAmountData ? BigInt(claimAmountData.toString()) : parseUnits('100', 18);
  const formattedClaimAmount = claimAmountData
    ? Number(formatUnits(BigInt(claimAmountData.toString()), 18)).toLocaleString()
    : '100';
  const cooldownSecs = cooldownData ? Number(cooldownData) : 3600;

  const formatCooldownDisplay = (secs: number) => {
    if (secs === 0) return 'None (0s)';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)} min (${secs}s)`;
    return `${(secs / 3600).toFixed(1)} hrs (${secs}s)`;
  };

  const [eligible] = canClaimData ? (canClaimData as [boolean, bigint]) : [false, 0n];
  const isAdmin = Boolean(address && adminData && (adminData as string).toLowerCase() === address.toLowerCase());

  const rawFaucetBalance = faucetBalanceData ? BigInt(faucetBalanceData.toString()) : 0n;
  const formattedFaucetBalance = Number(formatUnits(rawFaucetBalance, 18)).toLocaleString();

  const isMintMode = mode === 0;
  const isPreFundedMode = mode === 1;
  // CRITICAL: NEVER flag missing minter role while the query is in flight!
  // Only flag if the query has finished and returned explicitly false.
  const isMissingMinterRole = isMintMode && hasMinterRoleData === false;
  const isUnderfunded = isPreFundedMode && faucetBalanceData !== undefined && rawFaucetBalance < rawClaimAmount;

  // Track initial contract checks in flight to avoid jarring flash
  const isInitialStateLoading =
    isConnected && (canClaimData === undefined || (isMintMode && hasMinterRoleData === undefined));

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

  const handleGrantMinterRole = async () => {
    if (!faucetAddress) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeGrantRole as any)({
        address: tokenAddress,
        abi: ABIS.daoToken,
        functionName: 'grantRole',
        args: [MINTER_ROLE, faucetAddress],
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to grant minter role:', err);
    }
  };

  const handleClaim = async () => {
    if (!faucetAddress) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeClaim as any)({
        address: faucetAddress,
        abi: ABIS.daoFaucet,
        functionName: 'claim',
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to claim tokens:', err);
    }
  };

  const handleUpdateCooldown = async () => {
    if (!editCooldownSecs || Number(editCooldownSecs) <= 0 || !faucetAddress) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeCd as any)({
        address: faucetAddress,
        abi: ABIS.daoFaucet,
        functionName: 'setCooldownPeriod',
        args: [BigInt(editCooldownSecs)],
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to update cooldown:', err);
    }
  };

  const handleUpdateClaimAmount = async () => {
    if (!editClaimAmount || Number(editClaimAmount) <= 0 || !faucetAddress) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeAmt as any)({
        address: faucetAddress,
        abi: ABIS.daoFaucet,
        functionName: 'setClaimAmount',
        args: [parseUnits(editClaimAmount, 18)],
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to update claim amount:', err);
    }
  };

  const handleTogglePause = async () => {
    if (!faucetAddress) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writePause as any)({
        address: faucetAddress,
        abi: ABIS.daoFaucet,
        functionName: 'setPaused',
        args: [!isPaused],
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    }
  };

  const handleDepositTokens = async () => {
    if (!depositAmount || Number(depositAmount) <= 0 || !faucetAddress) return;
    try {
      const parsed = parseUnits(depositAmount, 18);
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeDeposit as any)({
        address: tokenAddress,
        abi: ABIS.daoToken,
        functionName: 'transfer',
        args: [faucetAddress, parsed],
        ...feeOverrides,
      });
    } catch (err) {
      console.error('Failed to deposit tokens:', err);
    }
  };

  const isClaiming = isClaimPending || isClaimWaiting;

  return (
    <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
            <Droplets className="w-5 h-5 text-[#c8ff00]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Token Faucet</h3>
            <p className="text-xs text-[#777777]">Instant testnet voting tokens</p>
          </div>
        </div>

        {/* Faucet Mode Badge */}
        <span className="text-xs px-3 py-1 rounded-full font-semibold border bg-[#181818] text-white border-[#282828]">
          {mode === 0 ? 'Mint Mode' : 'Pre-Funded'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Info Box */}
        <div className="bg-[#181818] p-4 rounded-2xl border border-[#242424] flex items-center justify-between">
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
              {formatCooldownDisplay(cooldownSecs)}
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

        {/* Missing Minter Role Alert for Mint Mode */}
        {isMissingMinterRole && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
            <div className="flex items-start gap-2.5 text-amber-300">
              <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-200">Minter Permission Required</p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  This faucet is in Mint Mode. It requires <span className="font-mono text-amber-200">MINTER_ROLE</span> permission on the <span className="font-mono text-amber-200">{tokenSymbol}</span> token contract to distribute tokens.
                </p>
              </div>
            </div>

            {isTokenAdmin ? (
              <button
                type="button"
                onClick={handleGrantMinterRole}
                disabled={isGrantPending || isGrantWaiting}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10"
              >
                {isGrantWaiting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Granting Minter Role on LitVM...</span>
                  </>
                ) : isGrantPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirm in Wallet...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Grant Minter Role to Faucet (1-Click)</span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Only the DAO token creator ({tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}) can grant minting rights to this faucet.
              </p>
            )}

            {grantError && (
              <p className="text-[11px] text-rose-400">
                Grant role failed: {grantError.message.slice(0, 100)}
              </p>
            )}
          </div>
        )}

        {/* Underfunded Alert for Pre-Funded Mode */}
        {isUnderfunded && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Faucet reserve pool is currently insufficient to satisfy claims. Deposit tokens below.</span>
          </div>
        )}

        {Boolean(isClaimSuccess) ? (
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
          disabled={!isConnected || isInitialStateLoading || !eligible || remainingSeconds > 0 || isClaiming || isPaused || isMissingMinterRole || isUnderfunded}
          className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] ${
            isInitialStateLoading || !eligible || remainingSeconds > 0 || isPaused || !isConnected || isMissingMinterRole || isUnderfunded
              ? 'bg-[#181818] text-[#555555] cursor-not-allowed border border-[#242424]'
              : 'bg-[#c8ff00] hover:bg-[#b5e600] text-black shadow-lg shadow-[#c8ff00]/10 cursor-pointer'
          }`}
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Claiming on LitVM...</span>
            </>
          ) : isInitialStateLoading ? (
            <>
              <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
              <span>Claim {formattedClaimAmount} {tokenSymbol}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {!isConnected
                  ? 'Connect Wallet to Claim'
                  : isMissingMinterRole
                  ? 'Faucet Requires Minter Role'
                  : isUnderfunded
                  ? 'Faucet Pool Depleted'
                  : remainingSeconds > 0
                  ? `Cooldown Active (${formatTime(remainingSeconds)})`
                  : isPaused
                  ? 'Faucet Paused'
                  : `Claim ${formattedClaimAmount} ${tokenSymbol}`}
              </span>
            </>
          )}
        </button>

        {claimError && (
          <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
            Claim failed: {claimError.message.slice(0, 120)}
          </p>
        )}

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
              <div className="mt-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3.5">
                {/* 1. Update Cooldown Period */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Update Cooldown Period (seconds)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={`Current: ${cooldownSecs}s`}
                      value={editCooldownSecs}
                      onChange={(e) => setEditCooldownSecs(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 flex-1 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateCooldown}
                      disabled={isCdPending || isCdWaiting || !editCooldownSecs}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 font-semibold text-xs transition border border-slate-700 disabled:opacity-50"
                    >
                      {isCdWaiting ? 'Updating...' : 'Set Cooldown'}
                    </button>
                  </div>
                  {isCdSuccess && <span className="text-[11px] text-brand-400 mt-1 block">Cooldown updated!</span>}
                </div>

                {/* 2. Update Claim Amount */}
                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Update Claim Amount ({tokenSymbol})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={`Current: ${formattedClaimAmount}`}
                      value={editClaimAmount}
                      onChange={(e) => setEditClaimAmount(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 flex-1 font-mono focus:outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateClaimAmount}
                      disabled={isAmtPending || isAmtWaiting || !editClaimAmount}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 font-semibold text-xs transition border border-slate-700 disabled:opacity-50"
                    >
                      {isAmtWaiting ? 'Updating...' : 'Set Amount'}
                    </button>
                  </div>
                  {isAmtSuccess && <span className="text-[11px] text-brand-400 mt-1 block">Claim amount updated!</span>}
                </div>

                {/* 3. Pause / Resume Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <div>
                    <span className="text-xs text-slate-300 block">Faucet Status</span>
                    <span className="text-[11px] text-slate-500">{isPaused ? 'Currently Paused' : 'Currently Active'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    disabled={isPausePending || isPauseWaiting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      isPaused
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600 hover:text-white'
                        : 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600 hover:text-white'
                    }`}
                  >
                    {isPauseWaiting ? 'Processing...' : isPaused ? 'Resume Faucet' : 'Pause Faucet'}
                  </button>
                </div>

                {/* 4. Top-up for pre-funded mode */}
                {mode === 1 && (
                  <div className="pt-1 border-t border-slate-800">
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

                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
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
