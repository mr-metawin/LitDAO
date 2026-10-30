import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
} from 'lucide-react';
import { ABIS } from '../config/contracts';
import { litvm } from '../config/chain';
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
  const { data: userPowerData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'getPastVotes',
    args: address && snapshotData ? [address, snapshotData] : undefined,
    query: { enabled: !!address && !!snapshotData && !!tokenAddress },
  });

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
  const hasVoted = Boolean(hasVotedData);

  const descriptionText = proposalData?.description || 'Governance Proposal on LitVM';
  const descriptionLines = descriptionText.split('\n');
  const title = descriptionLines[0].replace(/^#+\s*/, '') || `Proposal #${proposalId}`;
  const bodyText = descriptionLines.slice(1).join('\n').trim();

  const handleCastVote = (support: number) => {
    setSelectedSupport(support);
    if (voteReason.trim()) {
      writeVote({
        address: governor,
        abi: ABIS.daoGovernor,
        functionName: 'castVoteWithReason',
        args: [rawProposalId, support, voteReason.trim()],
      });
    } else {
      writeVote({
        address: governor,
        abi: ABIS.daoGovernor,
        functionName: 'castVote',
        args: [rawProposalId, support],
      });
    }
  };

  const handleQueue = () => {
    if (!proposalData) return;
    const descriptionHash = keccak256(stringToBytes(proposalData.description));
    writeQueue({
      address: governor,
      abi: ABIS.daoGovernor,
      functionName: 'queue',
      args: [
        proposalData.targets as `0x${string}`[],
        proposalData.values.map((v: string) => BigInt(v)),
        proposalData.calldatas as `0x${string}`[],
        descriptionHash,
      ],
    });
  };

  const handleExecute = () => {
    if (!proposalData) return;
    const descriptionHash = keccak256(stringToBytes(proposalData.description));
    writeExecute({
      address: governor,
      abi: ABIS.daoGovernor,
      functionName: 'execute',
      args: [
        proposalData.targets as `0x${string}`[],
        proposalData.values.map((v: string) => BigInt(v)),
        proposalData.calldatas as `0x${string}`[],
        descriptionHash,
      ],
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <Link
        to={`/dao/${governor}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to DAO</span>
      </Link>

      {/* Proposal Main Header */}
      <div className="bg-[#101726] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span>Proposal #{proposalId?.slice(0, 8)}...</span>
              <span>•</span>
              <span>LitVM LiteForge</span>
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
                ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                : stateIndex === 3
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {stateIndex === 1 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
              {stateLabel}
            </span>
          </div>
        </div>

        {/* Voting Progress */}
        <div className="space-y-2 pt-4 border-t border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span className="text-emerald-400 font-semibold">
              For: {Number(formatUnits(forVotesRaw, 18)).toLocaleString()} ({forPct}%)
            </span>
            <span className="text-rose-400 font-semibold">
              Against: {Number(formatUnits(againstVotesRaw, 18)).toLocaleString()} ({againstPct}%)
            </span>
            <span className="text-slate-400 font-semibold">
              Abstain: {Number(formatUnits(abstainVotesRaw, 18)).toLocaleString()} ({abstainPct}%)
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
            <div style={{ width: `${forPct}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
            <div style={{ width: `${againstPct}%` }} className="h-full bg-rose-500 transition-all duration-500" />
            <div style={{ width: `${abstainPct}%` }} className="h-full bg-slate-500 transition-all duration-500" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Proposal Details & Voting/Execution Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Description & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white">Proposal Description</h3>
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-normal">
              {bodyText || 'No description body provided.'}
            </div>
          </div>

          {/* Subgraph Votes Record */}
          {proposalData?.votes && proposalData.votes.length > 0 && (
            <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white">
                Recorded Votes ({proposalData.votes.length})
              </h3>
              <div className="divide-y divide-slate-800">
                {proposalData.votes.map((v: any) => (
                  <div key={v.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-slate-300">{v.voter.slice(0, 6)}...{v.voter.slice(-4)}</span>
                      {v.reason && <p className="text-slate-400 italic mt-0.5">"{v.reason}"</p>}
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${
                        v.support === 1 ? 'text-emerald-400' : v.support === 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {v.support === 1 ? 'For' : v.support === 0 ? 'Against' : 'Abstain'}
                      </span>
                      <span className="block font-mono text-slate-400">
                        {Number(formatUnits(BigInt(v.weight), 18)).toLocaleString()} votes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions (Vote / Queue / Execute) */}
        <div className="space-y-6">
          {/* Cast Vote Card (Only when Active) */}
          {stateIndex === 1 && (
            <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white">Cast Your Vote</h3>

              {!isConnected ? (
                <p className="text-xs text-slate-400">Connect your wallet to vote.</p>
              ) : hasVoted ? (
                <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>You have already cast your vote on this proposal.</span>
                </div>
              ) : userPower === 0n ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Your voting power at snapshot was 0. Tokens must be delegated before proposal creation.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Your Voting Weight: <strong className="text-white font-mono">{Number(formatUnits(userPower, 18)).toLocaleString()}</strong>
                  </p>

                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={voteReason}
                    onChange={(e) => setVoteReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  />

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      onClick={() => handleCastVote(1)}
                      disabled={isVotePending || isVoteWaiting}
                      className="py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition flex flex-col items-center gap-1"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>For</span>
                    </button>

                    <button
                      onClick={() => handleCastVote(0)}
                      disabled={isVotePending || isVoteWaiting}
                      className="py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition flex flex-col items-center gap-1"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>Against</span>
                    </button>

                    <button
                      onClick={() => handleCastVote(2)}
                      disabled={isVotePending || isVoteWaiting}
                      className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex flex-col items-center gap-1"
                    >
                      <MinusCircle className="w-4 h-4" />
                      <span>Abstain</span>
                    </button>
                  </div>

                  {(isVotePending || isVoteWaiting) && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                      <span>Submitting vote to LitVM...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timelock Queue Action (When Succeeded) */}
          {stateIndex === 4 && (
            <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white">Queue in Timelock</h3>
              <p className="text-xs text-slate-400">
                This proposal has passed! Anyone can queue it into the Timelock controller to start the execution delay.
              </p>
              <button
                onClick={handleQueue}
                disabled={isQueuePending || isQueueWaiting}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-purple-500/10"
              >
                {isQueueWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                <span>Queue in Timelock</span>
              </button>
            </div>
          )}

          {/* Timelock Execute Action (When Queued) */}
          {stateIndex === 5 && (
            <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-base font-bold text-white">Execute Proposal</h3>
              <p className="text-xs text-slate-400">
                The timelock delay has elapsed or is ready for execution on LitVM.
              </p>
              <button
                onClick={handleExecute}
                disabled={isExecutePending || isExecuteWaiting}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
              >
                {isExecuteWaiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>Execute Proposal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
