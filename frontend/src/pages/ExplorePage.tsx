import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Plus, 
  Layers, 
  ExternalLink, 
  Zap, 
  Copy, 
  Headphones 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DaoCard } from '../components/DaoCard';
import { querySubgraph, GET_ALL_DAOS_QUERY } from '../services/subgraph';
import { CONTRACT_ADDRESSES } from '../config/contracts';
import { FAUCET_HUB_URL, litvm, SUBGRAPH_URL } from '../config/chain';
import { DAORecord } from '../types';

export const ExplorePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCA, setCopiedCA] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Fetch DAOs from Goldsky Subgraph
  const { data: daosData, isLoading } = useQuery({
    queryKey: ['explore-daos'],
    queryFn: async () => {
      try {
        const result = await querySubgraph<{ daos: any[]; tokens?: any[] }>(GET_ALL_DAOS_QUERY);
        if (result?.daos && result.daos.length > 0) {
          const tokenMap = new Map<string, { name: string; symbol: string }>();
          if (result.tokens) {
            for (const t of result.tokens) {
              tokenMap.set(t.id.toLowerCase(), { name: t.name, symbol: t.symbol });
            }
          }

          return result.daos.map((dao) => {
            const tokenInfo = tokenMap.get(dao.token.toLowerCase());
            return {
              id: dao.id,
              governor: dao.governor,
              token: {
                id: dao.token,
                name: tokenInfo?.name || 'Governance Token',
                symbol: tokenInfo?.symbol || 'GOV',
                decimals: 18,
              },
              timelock: dao.timelock,
              creator: dao.registrant,
              name: dao.name,
              proposalCount: Number(dao.proposalCount || 0),
              voterCount: Number(dao.voterCount || 0),
              holderCount: Number(dao.holderCount || 0),
            } as DAORecord;
          });
        }
      } catch (e) {
        console.warn('Subgraph fetch failed, falling back to deployed contracts:', e);
      }

      // Fallback: Default Demo DAO from deployment
      return [
        {
          id: CONTRACT_ADDRESSES.demoGovernor.toLowerCase(),
          governor: CONTRACT_ADDRESSES.demoGovernor,
          token: {
            id: CONTRACT_ADDRESSES.demoToken,
            name: 'LitForge Token',
            symbol: 'LFT',
            decimals: 18,
          },
          timelock: CONTRACT_ADDRESSES.demoTimelock,
          creator: '0x7a0BD8E647e6fa7A8B23d1E926F4C0ef03332A01',
          name: 'LitForge Alpha DAO',
          proposalCount: 0,
          voterCount: 1,
          holderCount: 1,
        },
      ] as DAORecord[];
    },
    refetchInterval: 10000,
  });

  const daos = daosData || [];
  const totalProposals = daos.reduce((sum, d) => sum + (d.proposalCount || 0), 0);
  const totalHolders = daos.reduce((sum, d) => sum + (d.holderCount || 0), 0);

  const filteredDaos = daos.filter((dao) => {
    const q = searchQuery.toLowerCase();
    const tokenSymbol = typeof dao.token === 'object' ? dao.token.symbol.toLowerCase() : '';
    return (
      dao.name.toLowerCase().includes(q) ||
      dao.governor.toLowerCase().includes(q) ||
      tokenSymbol.includes(q)
    );
  });

  const handleCopyCA = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESSES.daoRegistry);
    setCopiedCA(true);
    setTimeout(() => setCopiedCA(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* OKX Two-Column Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Governance Hub Overview Card */}
        <div className="lg:col-span-6 bg-[#121212] border border-[#222222] rounded-3xl p-7 sm:p-9 shadow-2xl flex flex-col justify-center">
          <div className="space-y-6">
            {/* Header: Title & Action Pill */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Governance Hub
                </h2>
                <p className="text-xs text-[#888888] mt-0.5">
                  Decentralized onchain governance and community treasuries
                </p>
              </div>
              <button
                onClick={handleCopyCA}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] border border-[#282828] text-xs font-mono text-[#a0a0a0] transition"
                title="Copy DAORegistry Address"
              >
                <Copy className="w-3.5 h-3.5 text-[#888888]" />
                <span>{copiedCA ? 'Copied!' : 'Registry CA'}</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#181818] border border-[#242424] rounded-2xl p-4">
                <span className="text-xs text-[#777777] block mb-1">Active DAOs</span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  {daos.length}
                </span>
              </div>
              <div className="bg-[#181818] border border-[#242424] rounded-2xl p-4">
                <span className="text-xs text-[#777777] block mb-1">Proposals</span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  {totalProposals}
                </span>
              </div>
              <div className="bg-[#181818] border border-[#242424] rounded-2xl p-4">
                <span className="text-xs text-[#777777] block mb-1">Token Holders</span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                  {totalHolders}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Feature Showcase Card */}
        <div className="lg:col-span-6 bg-[#121212] border border-[#222222] rounded-3xl p-7 sm:p-9 shadow-2xl flex flex-col justify-center">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Govern with absolute <br />
              <span className="text-[#c8ff00]">onchain transparency</span>
            </h2>

            <p className="text-[#888888] text-sm sm:text-base leading-relaxed max-w-lg">
              Freely deploy timestamped DAOs, distribute governance tokens via automated faucets, and execute proposals with battle-tested OpenZeppelin Governor and TimelockController contracts.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Search Bar & Filter Options */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#777777] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by DAO name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212] border border-[#222222] rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-[#888888]">
          <span>Verified DAOs:</span>
          <span className="font-mono font-bold text-white bg-[#181818] px-2.5 py-1 rounded-lg border border-[#262626]">
            {daos.length}
          </span>
        </div>
      </div>

      {/* 4. DAO Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-[#121212] border border-[#222222] animate-pulse" />
          ))}
        </div>
      ) : filteredDaos.length === 0 ? (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-12 text-center space-y-4">
          <Layers className="w-12 h-12 text-[#444444] mx-auto" />
          <h3 className="text-lg font-bold text-white">No DAOs Found</h3>
          <p className="text-sm text-[#888888] max-w-md mx-auto">
            {searchQuery
              ? `No DAOs matched "${searchQuery}". Try a different keyword.`
              : 'No DAOs have been registered yet on LitVM.'}
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Launch First DAO</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDaos.map((dao) => (
            <DaoCard key={dao.id} dao={dao} />
          ))}
        </div>
      )}

      {/* Floating Help/Support Icon (Circular Green Button at Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowSupportModal(true)}
          className="w-14 h-14 p-3.5 rounded-full bg-[#c8ff00] hover:bg-[#b5e600] text-black shadow-xl shadow-[#c8ff00]/20 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
          title="LitDAO Protocol Hub"
        >
          <Headphones className="w-6 h-6 stroke-[2.2]" />
        </button>
      </div>

      {/* Support / Quick Info Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#262626] rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">LitDAO Quick Hub</h3>
                  <p className="text-xs text-[#777777]">LiteForge Network & Resources</p>
                </div>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-8 h-8 rounded-full bg-[#1c1c1c] hover:bg-[#262626] text-[#888888] hover:text-white flex items-center justify-center text-sm transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <a
                href={FAUCET_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181818] hover:bg-[#202020] border border-[#242424] text-white transition group"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#c8ff00]" />
                  <span className="font-semibold">Caldera zkLTC Gas Faucet</span>
                </div>
                <ExternalLink className="w-4 h-4 text-[#666666] group-hover:text-white" />
              </a>

              <a
                href={litvm.blockExplorers.default.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181818] hover:bg-[#202020] border border-[#242424] text-white transition group"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#c8ff00]" />
                  <span className="font-semibold">LiteForge Block Explorer</span>
                </div>
                <ExternalLink className="w-4 h-4 text-[#666666] group-hover:text-white" />
              </a>

              <a
                href={SUBGRAPH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#181818] hover:bg-[#202020] border border-[#242424] text-white transition group"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#c8ff00]" />
                  <span className="font-semibold">Goldsky GraphQL Endpoint</span>
                </div>
                <ExternalLink className="w-4 h-4 text-[#666666] group-hover:text-white" />
              </a>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#242424] text-xs space-y-1">
              <span className="text-[#666666] block font-mono">DAORegistry Contract:</span>
              <span className="text-white font-mono break-all block">
                {CONTRACT_ADDRESSES.daoRegistry}
              </span>
            </div>

            <button
              onClick={() => setShowSupportModal(false)}
              className="w-full py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
