import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, keccak256, stringToBytes } from 'viem';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Loader2,
  ExternalLink,
  Shield,
  Play,
  Layers,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { ABIS } from '../config/contracts';
import { litvm, getSafeGasFees } from '../config/chain';
import { querySubgraph, GET_PROPOSAL_DETAILS_QUERY } from '../services/subgraph';
import { useQuery } from '@tanstack/react-query';

const STATE_NAMES = [
  'Pending',
  'Active',
  'Canceled',
  'Defeated',
  'Succeeded',
  'Queued',
  'Expired',
  'Executed',
];

export const ProposalDetailPage: React.FC = () => {
  const { governorAddress, proposalId } = useParams<{
    governorAddress: string;
    proposalId: string;
  }>();

  const governor = governorAddress as `0x${string}`;
  const rawProposalId = proposalId ? BigInt(proposalId) : 0n;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [voteReason, setVoteReason] = useState('');
  const [selectedSupport, setSelectedSupport] = useState<number | null>(null);

  // Read live Proposal State from Governor
  const { data: stateData, refetch: refetchState } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'state',
    args: [rawProposalId],
    query: { enabled: !!governor && rawProposalId > 0n },
  });

  // Read live Votes from Governor
  const { data: proposalVotesData, refetch: refetchVotes } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'proposalVotes',
    args: [rawProposalId],
    query: { enabled: !!governor && rawProposalId > 0n },
  });

  // Read Proposal Deadline / Snapshot
  const { data: deadlineData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'proposalDeadline',
    args: [rawProposalId],
    query: { enabled: !!governor && rawProposalId > 0n },
  });

  const { data: snapshotData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'proposalSnapshot',
    args: [rawProposalId],
    query: { enabled: !!governor && rawProposalId > 0n },
  });

  // Read Token address
  const { data: tokenAddressData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'token',
  });
  const tokenAddress = tokenAddressData as `0x${string}` | undefined;

  // Read user's voting power at snapshot
  const { data: userPowerData, isLoading: isUserPowerLoading } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'getPastVotes',
    args: address && snapshotData ? [address, snapshotData] : undefined,
    query: { enabled: !!address && !!snapshotData && !!tokenAddress },
  });

  // Current balance & active voting power to provide clear context
  const { data: currentBalanceData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  });
  const { data: currentVotesData, refetch: refetchCurrentVotes } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress },
  });

  // Delegate action right from proposal page
  const { writeContract: writeDelegate, isPending: isDelegatePending } = useWriteContract();

  // Read whether user has already voted
  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'hasVoted',
    args: address ? [rawProposalId, address] : undefined,
    query: { enabled: !!address && rawProposalId > 0n },
  });

  // Subgraph query for details
  const { data: proposalData, refetch: refetchDetails } = useQuery({
    queryKey: ['proposal-details', governor.toLowerCase(), proposalId],
    queryFn: async () => {
      try {
        const id = `${governor.toLowerCase()}-${rawProposalId.toString()}`;
        const res = await querySubgraph<{ proposal: any }>(GET_PROPOSAL_DETAILS_QUERY, { id });
        return res?.proposal;
      } catch (e) {
        console.warn('Subgraph proposal details error:', e);
        return null;
      }
    },
    refetchInterval: 5000,
  });

  // Write: castVoteWithReason / castVote
  const { data: castVoteHash, writeContract: writeVote, isPending: isVotePending } = useWriteContract();
  const { isLoading: isVoteWaiting, isSuccess: isVoteSuccess } = useWaitForTransactionReceipt({
    hash: castVoteHash,
  });

  // Write: queue()
  const { data: queueHash, writeContract: writeQueue, isPending: isQueuePending } = useWriteContract();
  const { isLoading: isQueueWaiting, isSuccess: isQueueSuccess } = useWaitForTransactionReceipt({
    hash: queueHash,
  });

  // Write: execute()
  const { data: executeHash, writeContract: writeExecute, isPending: isExecutePending } = useWriteContract();
  const { isLoading: isExecuteWaiting, isSuccess: isExecuteSuccess } = useWaitForTransactionReceipt({
    hash: executeHash,
  });

  // Refetch when transactions complete
  React.useEffect(() => {
    if (isVoteSuccess || isQueueSuccess || isExecuteSuccess) {
      refetchState();
      refetchVotes();
      refetchHasVoted();
      refetchDetails();
    }
  }, [isVoteSuccess, isQueueSuccess, isExecuteSuccess, refetchState, refetchVotes, refetchHasVoted, refetchDetails]);

  const stateIndex = stateData !== undefined ? Number(stateData) : 0;
  const stateLabel = STATE_NAMES[stateIndex] || 'Pending';

  const [againstVotesRaw, forVotesRaw, abstainVotesRaw] = proposalVotesData
    ? (proposalVotesData as [bigint, bigint, bigint])
    : [0n, 0n, 0n];

  const totalVotes = againstVotesRaw + forVotesRaw + abstainVotesRaw;
  const forPct = totalVotes > 0n ? Number((forVotesRaw * 100n) / totalVotes) : 0;
  const againstPct = totalVotes > 0n ? Number((againstVotesRaw * 100n) / totalVotes) : 0;
  const abstainPct = totalVotes > 0n ? Number((abstainVotesRaw * 100n) / totalVotes) : 0;

  const userPower = userPowerData ? BigInt(userPowerData.toString()) : 0n;
  const rawBalance = currentBalanceData ? BigInt(currentBalanceData.toString()) : 0n;
  const rawCurrentVotes = currentVotesData ? BigInt(currentVotesData.toString()) : 0n;
  const hasVoted = Boolean(hasVotedData);

  const descriptionText = proposalData?.description || 'Governance Proposal on LitVM';
  const descriptionLines = descriptionText.split('\n');
  const title = descriptionLines[0].replace(/^#+\s*/, '') || `Proposal #${proposalId}`;
  const bodyText = descriptionLines.slice(1).join('\n').trim();

  const handleCastVote = async (support: number) => {
    setSelectedSupport(support);
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      if (voteReason.trim()) {
        (writeVote as any)({
          address: governor,
          abi: ABIS.daoGovernor,
          functionName: 'castVoteWithReason',
          args: [rawProposalId, support, voteReason.trim()],
          ...feeOverrides,
        });
      } else {
        (writeVote as any)({
          address: governor,
          abi: ABIS.daoGovernor,
          functionName: 'castVote',
          args: [rawProposalId, support],
          ...feeOverrides,
        });
      }
    } catch (err: any) {
      console.error('Failed to cast vote:', err);
    }
  };

  const handleQueue = async () => {
    if (!proposalData) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      const descriptionHash = keccak256(stringToBytes(proposalData.description));
      (writeQueue as any)({
        address: governor,
        abi: ABIS.daoGovernor,
        functionName: 'queue',
        args: [
          proposalData.targets as `0x${string}`[],
          proposalData.values.map((v: string) => BigInt(v)),
          proposalData.calldatas as `0x${string}`[],
          descriptionHash,
        ],
        ...feeOverrides,
      });
    } catch (err: any) {
      console.error('Failed to queue proposal:', err);
    }
  };

  const handleExecute = async () => {
    if (!proposalData) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      const descriptionHash = keccak256(stringToBytes(proposalData.description));
      (writeExecute as any)({
        address: governor,
        abi: ABIS.daoGovernor,
        functionName: 'execute',
        args: [
          proposalData.targets as `0x${string}`[],
          proposalData.values.map((v: string) => BigInt(v)),
          proposalData.calldatas as `0x${string}`[],
          descriptionHash,
        ],
        ...feeOverrides,
      });
    } catch (err: any) {
      console.error('Failed to execute proposal:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <Link
        to={`/dao/${governor}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#888888] hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to DAO</span>
      </Link>

      {/* Proposal Main Header */}
      <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-[#777777]">
              <span>Proposal #{proposalId?.slice(0, 8)}...</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
          </div>

          <div>
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
              stateIndex === 1
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : stateIndex === 5
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : stateIndex === 7
                ? 'bg-[#c8ff00]/15 text-[#c8ff00] border-[#c8ff00]/30'
                : stateIndex === 3
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-[#181818] text-[#888888] border-[#262626]'
            }`}>
              {stateIndex === 1 && <span className="w-2 h-2 rounded-full bg-[#c8ff00] animate-pulse"></span>}
              {stateLabel}
            </span>
          </div>
        </div>

        {/* Voting Progress */}
        <div className="space-y-2 pt-4 border-t border-[#1e1e1e]">
          <div className="flex justify-between text-xs text-[#888888] font-medium">
            <span className="text-white font-semibold">
              For: {Number(formatUnits(forVotesRaw, 18)).toLocaleString()} (<span className="text-[#c8ff00] font-mono">{forPct}%</span>)
            </span>
            <span className="text-[#888888] font-semibold">
              Against: {Number(formatUnits(againstVotesRaw, 18)).toLocaleString()} (<span className="text-[#cccccc] font-mono">{againstPct}%</span>)
            </span>
            <span className="text-[#666666] font-semibold">
              Abstain: {Number(formatUnits(abstainVotesRaw, 18)).toLocaleString()} (<span className="text-[#888888] font-mono">{abstainPct}%</span>)
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-[#1e1e1e] overflow-hidden flex">
            <div style={{ width: `${forPct}%` }} className="h-full bg-[#c8ff00] transition-all duration-500" />
            <div style={{ width: `${againstPct}%` }} className="h-full bg-[#555555] transition-all duration-500" />
            <div style={{ width: `${abstainPct}%` }} className="h-full bg-[#333333] transition-all duration-500" />
          </div>
        </div>
      </div>

      {/* Proposal Description */}
      <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Proposal Description</h3>
        <div className="text-sm text-[#cccccc] leading-relaxed whitespace-pre-line font-normal">
          {bodyText || 'No description body provided.'}
        </div>
      </div>

      {/* Cast Your Vote Section (Immediately below description) */}
      {stateIndex === 1 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e1e1e] pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Cast Your Vote</h3>
              <p className="text-xs text-[#777777] mt-0.5">Submit your onchain vote for this proposal</p>
            </div>
            {isConnected && !hasVoted && userPower > 0n && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#888888]">Your Voting Weight:</span>
                <span className="font-mono font-bold text-[#c8ff00] bg-[#1a2800] px-2.5 py-1 rounded-full border border-[#c8ff00]/30">
                  {Number(formatUnits(userPower, 18)).toLocaleString()} votes
                </span>
              </div>
            )}
          </div>

          {!isConnected ? (
            <p className="text-xs text-[#888888]">Connect your wallet to vote.</p>
          ) : hasVoted ? (
            <div className="p-4 rounded-2xl bg-[#1a2800] border border-[#c8ff00]/30 text-[#c8ff00] text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#c8ff00] shrink-0" />
              <span>You have already cast your vote on this proposal.</span>
            </div>
          ) : isUserPowerLoading ? (
            <div className="p-4 rounded-2xl bg-[#181818] border border-[#242424] text-[#888888] text-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[#c8ff00]" />
              <span>Checking your voting power at proposal snapshot...</span>
            </div>
          ) : userPower === 0n ? (
            <div className="p-4 rounded-2xl bg-[#1a1400] border border-amber-500/30 text-xs space-y-2.5">
              <div className="font-semibold text-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>0 Voting Power at Proposal Snapshot</span>
              </div>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Under OpenZeppelin governance, voting power is snapshot at the exact block/timestamp when a proposal is created to prevent flash-loan attacks.
                {rawBalance > 0n && rawCurrentVotes === 0n ? (
                  <> You hold {Number(formatUnits(rawBalance, 18)).toLocaleString()} tokens, but have not delegated them yet to activate voting checkpoints.</>
                ) : rawCurrentVotes > 0n ? (
                  <> You have {Number(formatUnits(rawCurrentVotes, 18)).toLocaleString()} active votes now, but they were delegated after this proposal was already created. Your voting power is active and will count for future proposals.</>
                ) : (
                  <> You held 0 delegated tokens when this proposal was submitted.</>
                )}
              </p>
              {rawBalance > 0n && rawCurrentVotes === 0n && (
                <button
                  type="button"
                  disabled={isDelegatePending}
                  onClick={async () => {
                    if (!address || !tokenAddress) return;
                    try {
                      const feeOverrides = await getSafeGasFees(publicClient);
                      (writeDelegate as any)({
                        address: tokenAddress,
                        abi: ABIS.daoToken,
                        functionName: 'delegate',
                        args: [address],
                        ...feeOverrides,
                      });
                    } catch (err) {
                      console.error('Failed to delegate:', err);
                    }
                  }}
                  className="mt-1 py-2 px-4 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition inline-flex items-center gap-1.5 shadow"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isDelegatePending ? 'Delegating on LitVM...' : 'Activate Voting Power (Self-Delegate)'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#888888] mb-1.5 font-medium">
                  Voting Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Share the reasoning behind your vote..."
                  value={voteReason}
                  onChange={(e) => setVoteReason(e.target.value)}
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-medium"
                />
              </div>

              {/* The for, against and abstain take the FULL WIDTH */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-1">
                <button
                  onClick={() => handleCastVote(1)}
                  disabled={isVotePending || isVoteWaiting}
                  className="w-full py-4 px-5 rounded-2xl bg-[#1c2800] hover:bg-[#c8ff00] text-[#c8ff00] hover:text-black border border-[#c8ff00]/40 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-[#c8ff00]/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <ThumbsUp className="w-4 h-4 stroke-[2.2] group-hover:scale-110 transition-transform" />
                  <span>Vote For</span>
                </button>

                <button
                  onClick={() => handleCastVote(0)}
                  disabled={isVotePending || isVoteWaiting}
                  className="w-full py-4 px-5 rounded-2xl bg-[#181818] hover:bg-[#252525] text-white border border-[#282828] hover:border-[#383838] font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <ThumbsDown className="w-4 h-4 stroke-[2.2] text-[#888888] group-hover:text-white group-hover:scale-110 transition-transform" />
                  <span>Vote Against</span>
                </button>

                <button
                  onClick={() => handleCastVote(2)}
                  disabled={isVotePending || isVoteWaiting}
                  className="w-full py-4 px-5 rounded-2xl bg-[#141414] hover:bg-[#1f1f1f] text-[#888888] hover:text-[#cccccc] border border-[#222222] hover:border-[#303030] font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <MinusCircle className="w-4 h-4 stroke-[2.2] group-hover:scale-110 transition-transform" />
                  <span>Abstain</span>
                </button>
              </div>

              {(isVotePending || isVoteWaiting) && (
                <div className="flex items-center gap-2 text-xs text-[#888888] justify-center pt-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#c8ff00]" />
                  <span>Submitting your vote to LitVM LiteForge...</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timelock Queue Action (When Succeeded) */}
      {stateIndex === 4 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Queue in Timelock</h3>
              <p className="text-xs text-[#888888] mt-0.5">
                This proposal has passed! Anyone can queue it into the Timelock controller to start the execution delay.
              </p>
            </div>
            <button
              onClick={handleQueue}
              disabled={isQueuePending || isQueueWaiting}
              className="py-3 px-6 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-purple-600/20"
            >
              {isQueueWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              <span>Queue in Timelock</span>
            </button>
          </div>
        </div>
      )}

      {/* Timelock Execute Action (When Queued) */}
      {stateIndex === 5 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Execute Proposal</h3>
              <p className="text-xs text-[#888888] mt-0.5">
                The timelock delay has elapsed or is ready for execution on LitVM.
              </p>
            </div>
            <button
              onClick={handleExecute}
              disabled={isExecutePending || isExecuteWaiting}
              className="py-3 px-6 rounded-full bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-xs transition flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-[#c8ff00]/20"
            >
              {isExecuteWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>Execute Proposal</span>
            </button>
          </div>
        </div>
      )}

      {/* Recorded Votes Transaction Table (Takes Whole Width) */}
      <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Recorded Votes
            </h3>
            <span className="font-mono text-xs font-bold bg-[#181818] text-[#c8ff00] px-2.5 py-0.5 rounded-full border border-[#262626]">
              {proposalData?.votes?.length || 0}
            </span>
          </div>
          <span className="text-xs text-[#777777]">
          </span>
        </div>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#222222] text-[#777777] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Voter</th>
                <th className="py-3.5 px-4">Decision</th>
                <th className="py-3.5 px-4">Voting Weight</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c1c]">
              {!proposalData?.votes || proposalData.votes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#666666] text-xs">
                    No votes recorded yet for this proposal.
                  </td>
                </tr>
              ) : (
                proposalData.votes.map((v: any) => (
                  <tr key={v.id} className="hover:bg-[#161616] transition-colors">
                    {/* Voter Address */}
                    <td className="py-4 px-4 font-mono font-medium">
                      <a
                        href={`${litvm.blockExplorers.default.url}/address/${v.voter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-white hover:text-[#c8ff00] transition group"
                        title={v.voter}
                      >
                        <span>{v.voter.slice(0, 6)}...{v.voter.slice(-4)}</span>
                        <ExternalLink className="w-3 h-3 text-[#555555] group-hover:text-[#c8ff00] transition" />
                      </a>
                    </td>

                    {/* Decision Badge */}
                    <td className="py-4 px-4">
                      {v.support === 1 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1a2800] text-[#c8ff00] border border-[#c8ff00]/30">
                          <ThumbsUp className="w-3 h-3" />
                          <span>For</span>
                        </span>
                      ) : v.support === 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#222222] text-[#cccccc] border border-[#333333]">
                          <ThumbsDown className="w-3 h-3" />
                          <span>Against</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#1a1a1a] text-[#888888] border border-[#2a2a2a]">
                          <MinusCircle className="w-3 h-3" />
                          <span>Abstain</span>
                        </span>
                      )}
                    </td>

                    {/* Voting Weight */}
                    <td className="py-4 px-4 font-mono font-semibold text-white">
                      {Number(formatUnits(BigInt(v.weight), 18)).toLocaleString()}
                      <span className="text-[#666666] font-normal text-[11px] ml-1">votes</span>
                    </td>

                    {/* Reason */}
                    <td className="py-4 px-4 text-[#999999] max-w-xs truncate">
                      {v.reason ? (
                        <span className="italic" title={v.reason}>"{v.reason}"</span>
                      ) : (
                        <span className="text-[#444444]">—</span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-4 px-4 text-right font-mono text-[#777777] whitespace-nowrap">
                      {v.timestamp
                        ? new Date(Number(v.timestamp) * 1000).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
