import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Sparkles, Layers, ExternalLink, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DaoCard } from '../components/DaoCard';
import { querySubgraph, GET_ALL_DAOS_QUERY } from '../services/subgraph';
import { CONTRACT_ADDRESSES } from '../config/contracts';
import { FAUCET_HUB_URL, litvm } from '../config/chain';
import { DAORecord } from '../types';

export const ExplorePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch DAOs from Goldsky Subgraph
  const { data: daosData, isLoading, error } = useQuery({
    queryKey: ['explore-daos'],
    queryFn: async () => {
      try {
        const result = await querySubgraph<{ daos: any[] }>(GET_ALL_DAOS_QUERY);
        if (result?.daos && result.daos.length > 0) {
          return result.daos.map((dao) => ({
            id: dao.id,
            governor: dao.governor,
            token: {
              id: dao.token,
              name: 'LitForge Token',
              symbol: 'LFT',
              decimals: 18,
            },
            timelock: dao.timelock,
            creator: dao.registrant,
            name: dao.name,
            proposalCount: Number(dao.proposalCount || 0),
            voterCount: Number(dao.voterCount || 0),
            holderCount: Number(dao.holderCount || 0),
          })) as DAORecord[];
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

  const filteredDaos = daos.filter((dao) => {
    const q = searchQuery.toLowerCase();
    const tokenSymbol = typeof dao.token === 'object' ? dao.token.symbol.toLowerCase() : '';
    return (
      dao.name.toLowerCase().includes(q) ||
      dao.governor.toLowerCase().includes(q) ||
      tokenSymbol.includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-b from-[#111a2e] to-[#0b101c] border border-slate-800/80 p-8 sm:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built exclusively for LitVM LiteForge (Chain ID: 4441)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Decentralized Governance <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-emerald-300 to-teal-400">
              Native to LitVM
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
            Deploy timestamp-based DAOs, manage timelocks, testnet faucets, and vote onchain with Cancun EVM compatibility.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create New DAO</span>
            </Link>

            <a
              href={FAUCET_HUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition border border-slate-700/60"
            >
              <span>Get zkLTC Gas Faucet</span>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by DAO name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101726] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Total DAOs on LitVM:</span>
          <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {daos.length}
          </span>
        </div>
      </div>

      {/* DAO Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filteredDaos.length === 0 ? (
        <div className="bg-[#101726] border border-slate-800/80 rounded-2xl p-12 text-center space-y-4">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No DAOs Found</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No DAOs matched "${searchQuery}". Try a different keyword.`
              : 'No DAOs have been registered yet on LitVM.'}
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-semibold text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
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
    </div>
  );
};
