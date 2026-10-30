import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { GasWarningBanner } from './components/GasWarningBanner';
import { ExplorePage } from './pages/ExplorePage';
import { DaoDetailPage } from './pages/DaoDetailPage';
import { ProposalDetailPage } from './pages/ProposalDetailPage';
import { CreateDaoPage } from './pages/CreateDaoPage';
import { FAUCET_HUB_URL, litvm, SUBGRAPH_URL } from './config/chain';
import { ExternalLink, Shield } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100">
        <GasWarningBanner />
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ExplorePage />} />
            <Route path="/dao/:governorAddress" element={<DaoDetailPage />} />
            <Route path="/dao/:governorAddress/proposal/:proposalId" element={<ProposalDetailPage />} />
            <Route path="/create" element={<CreateDaoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/80 bg-[#0c121e]/80 py-8 mt-16 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="font-semibold text-slate-300">LitDAO Protocol</span>
              <span>•</span>
              <span>Built for LitVM LiteForge (Chain ID: 4441)</span>
            </div>

            <div className="flex items-center gap-6 font-medium">
              <a
                href={litvm.blockExplorers.default.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-200 transition flex items-center gap-1"
              >
                <span>LiteForge Explorer</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>

              <a
                href={FAUCET_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-200 transition flex items-center gap-1"
              >
                <span>Caldera Gas Faucet</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>

              <a
                href={SUBGRAPH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-200 transition flex items-center gap-1"
              >
                <span>Goldsky Subgraph</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
