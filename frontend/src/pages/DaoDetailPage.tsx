import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Layers,
  ExternalLink,
  Plus,
  Vote,
  Users,
  Coins,
  Clock,
  ArrowLeft,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { ABIS, CONTRACT_ADDRESSES } from '../config/contracts';
import { litvm } from '../config/chain';
import { DelegateCard } from '../components/DelegateCard';
import { FaucetCard } from '../components/FaucetCard';
import { ProposalCard } from '../components/ProposalCard';
import { CreateProposalModal } from './CreateProposalModal';
import { querySubgraph, GET_DAO_BY_ID_QUERY } from '../services/subgraph';
import { ProposalRecord } from '../types';

export const DaoDetailPage: React.FC = () => {
  const { governorAddress } = useParams<{ governorAddress: string }>();
  const governor = (governorAddress || CONTRACT_ADDRESSES.demoGovernor) as `0x${string}`;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'proposals' | 'overview'>('proposals');
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  // Read Token Address from Governor
  const { data: tokenAddressData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'token',
  });
  const tokenAddress = (tokenAddressData as `0x${string}`) || CONTRACT_ADDRESSES.demoToken;

  // Read Timelock Address from Governor
  const { data: timelockAddressData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'timelock',
  });
  const timelockAddress = (timelockAddressData as `0x${string}`) || CONTRACT_ADDRESSES.demoTimelock;

  // Read Token Name & Symbol
  const { data: tokenNameData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'name',
  });
  const { data: tokenSymbolData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'symbol',
  });

  // Read Governor Name
  const { data: governorNameData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'name',
  });

  // Read Voting Parameters from Governor
  const { data: votingDelayData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'votingDelay',
  });
  const { data: votingPeriodData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'votingPeriod',
  });
  const { data: proposalThresholdData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'proposalThreshold',
  });

  // Dynamically resolve Faucet address for this token from FaucetFactory
  const { data: faucetAddressData } = useReadContract({
    address: CONTRACT_ADDRESSES.faucetFactory,
    abi: ABIS.faucetFactory,
    functionName: 'faucetByToken',
    args: [tokenAddress],
  });

  const faucetAddress =
    faucetAddressData && faucetAddressData !== '0x0000000000000000000000000000000000000000'
      ? (faucetAddressData as `0x${string}`)
      : (governor.toLowerCase() === CONTRACT_ADDRESSES.demoGovernor.toLowerCase()
          ? CONTRACT_ADDRESSES.demoFaucet
          : undefined);

  // Default known proposal for the live Demo DAO (in case subgraph is indexing or experiencing connect delay)
  const DEMO_PROPOSAL_FALLBACK: ProposalRecord[] = [
    {
      id: `${CONTRACT_ADDRESSES.demoGovernor.toLowerCase()}-93311177256154683551789108490515870860146786192619853049945901443477999242955`,
      proposalId: '93311177256154683551789108490515870860146786192619853049945901443477999242955',
      governor: CONTRACT_ADDRESSES.demoGovernor,
      proposer: '0x7a0BD8E647e6fa7A8B23d1E926F4C0ef03332A01',
      targets: [CONTRACT_ADDRESSES.demoGovernor],
      values: ['0'],
      signatures: [''],
      calldatas: ['0x'],
      voteStart: '1793438654',
      voteEnd: '1793442254',
      description: "# Adopt the LitForge Alpha Community Charter\n\nLet's agree on a simple charter for LitForge Alpha DAO: our mission is to build and test governance tooling on LitVM, and our values are transparency, open participation, and learning by doing. Vote For to adopt it.",
      state: 'Active',
      forVotes: '1000000000000000000000000',
      againstVotes: '0',
      abstainVotes: '0',
      quorum: '40000000000000000000000',
      executed: false,
      canceled: false,
      createdAt: '1793438594',
    },
  ];

  // Query Subgraph for DAO proposals and detailed stats
  const { data: subgraphDao, isLoading: isSubgraphLoading, refetch: refetchSubgraph } = useQuery({
    queryKey: ['dao-detail', governor.toLowerCase()],
    queryFn: async () => {
      try {
        const result = await querySubgraph<{ dao: any }>(GET_DAO_BY_ID_QUERY, {
          id: governor.toLowerCase(),
        });
        return result.dao;
      } catch (err) {
        console.warn('Subgraph dao fetch failed:', err);
        return null;
      }
    },
    refetchInterval: 7000,
  });

  const daoName = (governorNameData as string) || subgraphDao?.name || 'LitForge Alpha DAO';
  const tokenSymbol = (tokenSymbolData as string) || 'LFT';
  const tokenName = (tokenNameData as string) || 'LitForge Token';

  const isDemoGovernor = governor.toLowerCase() === CONTRACT_ADDRESSES.demoGovernor.toLowerCase();
  const rawProposals: ProposalRecord[] = subgraphDao?.proposals || [];
  const proposals: ProposalRecord[] =
    rawProposals.length > 0
      ? rawProposals
      : (isDemoGovernor ? DEMO_PROPOSAL_FALLBACK : []);

  const handleCopy = () => {
    navigator.clipboard.writeText(governor);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button & Network indicator */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to DAOs</span>
        </Link>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
          LitVM Network
        </span>
      </div>

      {/* DAO Header Card */}
      <div className="bg-[#101726] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 p-0.5 shadow-lg shadow-brand-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Layers className="w-8 h-8 text-brand-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {daoName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-brand-300 border border-slate-700">
                  {tokenSymbol}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                <span className="flex items-center gap-1">
                  Governor: {governor.slice(0, 6)}...{governor.slice(-4)}
                  <button onClick={handleCopy} className="hover:text-white transition">
                    {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
                <span>•</span>
                <a
                  href={`${litvm.blockExplorers.default.url}/address/${governor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-300 transition flex items-center gap-1"
                >
                  <span>Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsProposalModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition shadow-md shadow-brand-500/10"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Proposal</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Vote className="w-3.5 h-3.5 text-slate-400" />
              Proposals
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {subgraphDao?.proposalCount ?? proposals.length}
            </span>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Voting Delay
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {votingDelayData ? `${votingDelayData.toString()}s` : '1s'}
            </span>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Voting Period
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {votingPeriodData ? `${votingPeriodData.toString()}s` : '300s'}
            </span>
          </div>

          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              Proposal Threshold
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {proposalThresholdData ? `${proposalThresholdData.toString()} ${tokenSymbol}` : `0 ${tokenSymbol}`}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Section: Delegation Card & Faucet Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DelegateCard
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
        />
        <FaucetCard
          faucetAddress={faucetAddress}
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
        />
      </div>

      {/* Governance Proposals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Governance Proposals</span>
            <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
              {proposals.length}
            </span>
          </h2>
        </div>

        {isSubgraphLoading && proposals.length === 0 ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="bg-[#101726] border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <Vote className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="font-bold text-white text-base">No Proposals Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Be the first to submit a proposal for {daoName}. Make sure your voting power is activated via delegation.
            </p>
            <button
              onClick={() => setIsProposalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Proposal</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                governorAddress={governor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      <CreateProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => {
          setIsProposalModalOpen(false);
          refetchSubgraph();
        }}
        governorAddress={governor}
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
      />
    </div>
  );
};
