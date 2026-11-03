import React from 'react';
import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1a2800] text-[#c8ff00] border border-[#c8ff00]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] animate-pulse"></span>
            Active
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Clock className="w-3 h-3" />
            Queued in Timelock
          </span>
        );
      case 'executed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Executed
          </span>
        );
      case 'defeated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Defeated
          </span>
        );
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Succeeded
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Pending Delay
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#222222] text-[#888888] border border-[#333333]">
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#222222] text-[#888888]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#121212] border border-[#222222] hover:border-[#383838] rounded-3xl p-6 transition-all duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#666666] font-semibold">
              #{proposal.proposalId.slice(0, 6)}...{proposal.proposalId.slice(-4)}
            </span>
            {getStatusBadge(proposal.state || 'Active')}
          </div>
          <h4 className="font-bold text-base text-white hover:text-[#c8ff00] transition">
            <Link to={`/dao/${governorAddress}/proposal/${proposal.proposalId}`}>
              {title}
            </Link>
          </h4>
        </div>

        <Link
          to={`/dao/${governorAddress}/proposal/${proposal.proposalId}`}
          className="p-2.5 rounded-2xl bg-[#1a1a1a] border border-[#282828] hover:bg-white hover:text-black text-[#888888] transition shrink-0"
        >
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </Link>
      </div>

      {snippet && (
        <p className="text-xs text-[#888888] line-clamp-2 mb-4 leading-relaxed">
          {snippet}
        </p>
      )}

      {/* Vote Progress Bar */}
      <div className="space-y-2 mt-4 pt-3 border-t border-[#1e1e1e]">
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-white font-semibold">
            For: <span className="text-[#c8ff00] font-mono">{forPct}%</span> ({Number(formatUnits(forVotes, 18)).toLocaleString()} votes)
          </span>
          <span className="flex items-center gap-1 text-[#888888] font-semibold">
            Against: <span className="text-[#cccccc] font-mono">{againstPct}%</span> ({Number(formatUnits(againstVotes, 18)).toLocaleString()} votes)
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-[#1e1e1e] overflow-hidden flex">
          <div style={{ width: `${forPct}%` }} className="h-full bg-[#c8ff00]" />
          <div style={{ width: `${againstPct}%` }} className="h-full bg-[#555555]" />
          <div style={{ width: `${abstainPct}%` }} className="h-full bg-[#333333]" />
        </div>
      </div>
    </div>
  );
};
