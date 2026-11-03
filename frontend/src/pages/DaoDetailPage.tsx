import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
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
  Camera,
} from 'lucide-react';
import { ABIS, CONTRACT_ADDRESSES } from '../config/contracts';
import { litvm } from '../config/chain';
import { DelegateCard } from '../components/DelegateCard';
import { FaucetCard } from '../components/FaucetCard';
import { ProposalCard } from '../components/ProposalCard';
import { CreateProposalModal } from './CreateProposalModal';
import { UpdateDaoImageModal } from '../components/UpdateDaoImageModal';
import { DaoAvatar } from '../components/DaoAvatar';
import { useDaoMetadata } from '../hooks/useDaoMetadata';
import { querySubgraph, GET_DAO_BY_ID_QUERY } from '../services/subgraph';
import { ProposalRecord } from '../types';


export const DaoDetailPage: React.FC = () => {
  const { governorAddress } = useParams<{ governorAddress: string }>();
  const governor = (governorAddress || CONTRACT_ADDRESSES.demoGovernor) as `0x${string}`;

  const { address: userAddress } = useAccount();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'proposals' | 'overview'>('proposals');
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  // Read DAO registration info from DAORegistry
  const { data: daoRegistryData } = useReadContract({
    address: CONTRACT_ADDRESSES.daoRegistry,
    abi: ABIS.daoRegistry,
    functionName: 'getDAOByGovernor',
    args: [governor],
  });
  const registryDao = daoRegistryData as any;
  const registrantAddress =
    (registryDao?.registrant || registryDao?.[3] || (governor.toLowerCase() === CONTRACT_ADDRESSES.demoGovernor.toLowerCase() ? '0x7a0BD8E647e6fa7A8B23d1E926F4C0ef03332A01' : undefined)) as `0x${string}` | undefined;

  // Query Subgraph for DAO data, proposals, and tokens
  const { data: subgraphData, isLoading: isSubgraphLoading, refetch: refetchSubgraph } = useQuery({
    queryKey: ['dao-detail', governor.toLowerCase()],
    queryFn: async () => {
      try {
        const result = await querySubgraph<{ dao: any; tokens?: any[] }>(GET_DAO_BY_ID_QUERY, {
          id: governor.toLowerCase(),
        });
        return result;
      } catch (err) {
        console.warn('Subgraph dao fetch failed:', err);
        return null;
      }
    },
    refetchInterval: 7000,
  });

  const subgraphDao = subgraphData?.dao;

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const {
    rawImageUri,
    imageUrl,
    description: onChainDescription,
    isAuthorized,
    refetch: refetchMetadata,
  } = useDaoMetadata(governor, subgraphDao?.imageUri, userAddress);

  const isCreatorOrAdmin = Boolean(
    isAuthorized ||
    (userAddress && registrantAddress && userAddress.toLowerCase() === registrantAddress.toLowerCase())
  );

  const { data: tokenAddressData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'token',
  });
  const tokenAddress = (tokenAddressData as `0x${string}`) || (subgraphDao?.token as `0x${string}`) || CONTRACT_ADDRESSES.demoToken;

  // Read Timelock Address from Governor
  const { data: timelockAddressData } = useReadContract({
    address: governor,
    abi: ABIS.daoGovernor,
    functionName: 'timelock',
  });
  const timelockAddress = (timelockAddressData as `0x${string}`) || (subgraphDao?.timelock as `0x${string}`) || CONTRACT_ADDRESSES.demoTimelock;

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

  const subgraphFaucets = (subgraphData as any)?.faucets as Array<{ id: string; token: string; mode: string }> | undefined;

  // Dynamically resolve Faucet address for this token from FaucetFactory
  const { data: faucetAddressData, isLoading: isFaucetContractLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.faucetFactory,
    abi: ABIS.faucetFactory,
    functionName: 'faucetByToken',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: Boolean(tokenAddress),
    },
  });

  // Fast instant resolution from subgraph
  const subgraphMatchedFaucet = tokenAddress && subgraphFaucets
    ? (subgraphFaucets.find((f) => f.token.toLowerCase() === tokenAddress.toLowerCase())?.id as `0x${string}` | undefined)
    : undefined;

  const faucetAddress =
    (faucetAddressData && faucetAddressData !== '0x0000000000000000000000000000000000000000'
      ? (faucetAddressData as `0x${string}`)
      : undefined) ||
    subgraphMatchedFaucet ||
    (governor.toLowerCase() === CONTRACT_ADDRESSES.demoGovernor.toLowerCase()
      ? CONTRACT_ADDRESSES.demoFaucet
      : undefined);

  const isResolvingFaucet =
    !faucetAddress &&
    (isSubgraphLoading || isFaucetContractLoading || (!tokenAddressData && !subgraphDao?.token));

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

  const isDemoGovernor = governor.toLowerCase() === CONTRACT_ADDRESSES.demoGovernor.toLowerCase();
  const matchingToken = subgraphData?.tokens?.find(
    (t: any) => t.id.toLowerCase() === (subgraphDao?.token?.toLowerCase() || tokenAddress?.toLowerCase())
  );

  const daoName = (governorNameData as string) || subgraphDao?.name || (isDemoGovernor ? 'LitForge Alpha DAO' : 'Community DAO');
  const tokenSymbol = (tokenSymbolData as string) || matchingToken?.symbol || (isDemoGovernor ? 'LFT' : 'GOV');
  const tokenName = (tokenNameData as string) || matchingToken?.name || (isDemoGovernor ? 'LitForge Token' : 'Governance Token');
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

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#121212] text-[#888888] border border-[#222222]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00] animate-pulse"></span>
          LitVM LiteForge 4441
        </span>
      </div>

      {/* DAO Header Card */}
      <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative group w-16 h-16 rounded-2xl bg-[#181818] border border-[#262626] p-0.5 shrink-0">
              <div className="w-full h-full bg-[#000000] rounded-[14px] overflow-hidden flex items-center justify-center">
                <DaoAvatar
                  imageUri={rawImageUri || subgraphDao?.imageUri}
                  alt={daoName}
                  fallbackIconClassName="w-8 h-8 text-[#c8ff00]"
                />
              </div>
              {isCreatorOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  title="Update DAO Logo (Creator Access)"
                  className="absolute inset-0 bg-black/80 rounded-[14px] opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-0.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#c8ff00]" />
                  <span>Change</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {daoName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#1a1a1a] text-[#c8ff00] border border-[#2a2a2a]">
                  {tokenSymbol}
                </span>
              </div>

              {(onChainDescription || subgraphDao?.description) && (
                <p className="text-xs text-[#888888] max-w-xl line-clamp-2">
                  {onChainDescription || subgraphDao?.description}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-[#777777] font-mono flex-wrap">
                <span className="flex items-center gap-1">
                  Governor: {governor.slice(0, 6)}...{governor.slice(-4)}
                  <button onClick={handleCopy} className="hover:text-white transition">
                    {copied ? <Check className="w-3.5 h-3.5 text-[#c8ff00]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
                {registrantAddress && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 text-[#777777]">
                      <span>Creator: {registrantAddress.slice(0, 6)}...{registrantAddress.slice(-4)}</span>
                      {isCreatorOrAdmin && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#c8ff00]/15 text-[#c8ff00] border border-[#c8ff00]/30">
                          You (Admin)
                        </span>
                      )}
                    </span>
                  </>
                )}
                <span>•</span>
                <a
                  href={`${litvm.blockExplorers.default.url}/address/${governor}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#c8ff00] transition flex items-center gap-1"
                >
                  <span>Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {isCreatorOrAdmin ? (
              <button
                onClick={() => setIsImageModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1a1a1a] hover:bg-[#222222] text-white font-medium text-xs transition border border-[#333333]"
              >
                <Camera className="w-3.5 h-3.5 text-[#c8ff00]" />
                <span>Update Logo</span>
              </button>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#181818] text-[#777777] text-xs border border-[#262626]"
                title={registrantAddress ? `Metadata is protected. Only creator (${registrantAddress.slice(0, 6)}...${registrantAddress.slice(-4)}) or governance proposals can update it.` : 'Metadata is protected by governance.'}
              >
                <Shield className="w-3.5 h-3.5 text-[#666666]" />
                <span className="text-[11px] font-medium">Creator Protected</span>
              </div>
            )}

            <button
              onClick={() => setIsProposalModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#c8ff00] hover:bg-[#b8eb00] text-black font-semibold text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Proposal</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#222222]">
          <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#222222]">
            <span className="text-xs text-[#777777] flex items-center gap-1 mb-1">
              <Vote className="w-3.5 h-3.5 text-[#777777]" />
              Proposals
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {subgraphDao?.proposalCount ?? proposals.length}
            </span>
          </div>

          <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#222222]">
            <span className="text-xs text-[#777777] flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#777777]" />
              Voting Delay
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {votingDelayData ? `${votingDelayData.toString()}s` : '1s'}
            </span>
          </div>

          <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#222222]">
            <span className="text-xs text-[#777777] flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#777777]" />
              Voting Period
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {votingPeriodData
                ? Number(votingPeriodData) >= 86400
                  ? `${(Number(votingPeriodData) / 86400).toFixed(1).replace(/\.0$/, '')}d`
                  : `${votingPeriodData.toString()}s`
                : '3d'}
            </span>
          </div>

          <div className="bg-[#181818] p-3.5 rounded-2xl border border-[#222222]">
            <span className="text-xs text-[#777777] flex items-center gap-1 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#777777]" />
              Proposal Threshold
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {proposalThresholdData
                ? `${formatUnits(BigInt(proposalThresholdData.toString()), 18)} ${tokenSymbol}`
                : `0 ${tokenSymbol}`}
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
          tokenAddress={tokenAddress || CONTRACT_ADDRESSES.demoToken}
          tokenSymbol={tokenSymbol}
          isLoadingFaucet={isResolvingFaucet}
        />
      </div>

      {/* Governance Proposals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Governance Proposals</span>
            <span className="text-xs font-mono font-bold bg-[#181818] text-[#c8ff00] px-2.5 py-0.5 rounded-full border border-[#262626]">
              {proposals.length}
            </span>
          </h2>
        </div>

        {isSubgraphLoading && proposals.length === 0 ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#121212] border border-[#222222] animate-pulse" />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="bg-[#121212] border border-[#222222] rounded-3xl p-10 text-center space-y-3">
            <Vote className="w-10 h-10 text-[#555555] mx-auto" />
            <h3 className="font-bold text-white text-base">No Proposals Yet</h3>
            <p className="text-xs text-[#888888] max-w-sm mx-auto">
              Be the first to submit a proposal for {daoName}. Make sure your voting power is activated via delegation.
            </p>
            <button
              onClick={() => setIsProposalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#c8ff00] hover:bg-[#b8eb00] text-black font-semibold text-xs transition"
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

      {/* Update DAO Image / Metadata Modal */}
      <UpdateDaoImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        governorAddress={governor}
        daoName={daoName}
        currentImageUri={imageUrl}
        currentDescription={onChainDescription || subgraphDao?.description}
        isAuthorized={isCreatorOrAdmin}
        registrantAddress={registrantAddress}
        onSuccess={() => {
          refetchMetadata();
          refetchSubgraph();
        }}
      />
    </div>
  );
};
