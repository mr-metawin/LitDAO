import React from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { CheckCircle2, XCircle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { ProposalRecord } from '../types';

interface ProposalCardProps {
  proposal: ProposalRecord;
  governorAddress: string;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, governorAddress }) => {
  const forVotes = BigInt(proposal.forVotes || '0');
  const againstVotes = BigInt(proposal.againstVotes || '0');
  const abstainVotes = BigInt(proposal.abstainVotes || '0');
  const totalVotes = forVotes + againstVotes + abstainVotes;

  const forPct = totalVotes > 0n ? Number((forVotes * 100n) / totalVotes) : 0;
  const againstPct = totalVotes > 0n ? Number((againstVotes * 100n) / totalVotes) : 0;
  const abstainPct = totalVotes > 0n ? Number((abstainVotes * 100n) / totalVotes) : 0;

  // Extract title and description
  const descriptionLines = proposal.description.split('\n');
  const title = descriptionLines[0].replace(/^#+\s*/, '') || `Proposal #${proposal.proposalId.slice(0, 8)}`;
  const snippet = descriptionLines.slice(1).join(' ').trim().slice(0, 140);

  // Status Badge Styling
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Clock className="w-3 h-3" />
            Queued in Timelock
          </span>
        );
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-400 border border-brand-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Executed
          </span>
        );
      case 'defeated':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Defeated
          </span>
        );
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Succeeded
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Pending Delay
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600">
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500 font-semibold">
              #{proposal.proposalId.slice(0, 6)}...{proposal.proposalId.slice(-4)}
            </span>
            {getStatusBadge(proposal.state || 'Active')}
          </div>
          <h4 className="font-bold text-base text-white hover:text-brand-300 transition">
            <Link to={`/dao/${governorAddress}/proposal/${proposal.proposalId}`}>
              {title}
            </Link>
          </h4>
        </div>

        <Link
          to={`/dao/${governorAddress}/proposal/${proposal.proposalId}`}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-brand-600 hover:text-slate-950 text-slate-400 hover:border-brand-500 transition shrink-0"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {snippet && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-4">
          {snippet}
        </p>
      )}

      {/* Vote Progress Bar */}
      <div className="space-y-2 mt-4 pt-3 border-t border-slate-800/80">
        <div className="flex justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            For: {forPct}% ({Number(formatUnits(forVotes, 18)).toLocaleString()} votes)
          </span>
          <span className="flex items-center gap-1 text-rose-400 font-semibold">
            Against: {againstPct}% ({Number(formatUnits(againstVotes, 18)).toLocaleString()} votes)
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
          <div style={{ width: `${forPct}%` }} className="h-full bg-emerald-500" />
          <div style={{ width: `${againstPct}%` }} className="h-full bg-rose-500" />
          <div style={{ width: `${abstainPct}%` }} className="h-full bg-slate-500" />
        </div>
      </div>
    </div>
  );
};
