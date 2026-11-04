import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar, LumenLogo } from './components/Navbar';
import { GasWarningBanner } from './components/GasWarningBanner';
import { ExplorePage } from './pages/ExplorePage';
import { DaoDetailPage } from './pages/DaoDetailPage';
import { ProposalDetailPage } from './pages/ProposalDetailPage';
import { CreateDaoPage } from './pages/CreateDaoPage';
import { FAUCET_HUB_URL, litvm, SUBGRAPH_URL } from './config/chain';
import { ExternalLink } from 'lucide-react';

const XSocialIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramSocialIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472z" />
  </svg>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#000000] text-white">
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

        {/* OKX-Style Minimalist Footer */}
        <footer className="border-t border-[#1c1c1c] bg-[#000000] py-10 mt-20 text-xs text-[#777777]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <LumenLogo className="w-6 h-6 rounded-full object-cover" />
              <span className="font-bold text-white tracking-tight">Lumen Protocol</span>
              <span>•</span>
              <span className="text-[#666666]">Native Governance for LitVM LiteForge (4441)</span>
            </div>

            <div className="flex flex-wrap items-center gap-5 sm:gap-6 font-medium">
              {/* Social Links */}
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="hover:text-white transition flex items-center gap-1.5 group"
                title="Follow on X"
              >
                <XSocialIcon className="w-3.5 h-3.5 text-[#777777] group-hover:text-[#c8ff00] transition" />
                <span>X</span>
              </a>

              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="hover:text-white transition flex items-center gap-1.5 group"
                title="Join Telegram"
              >
                <TelegramSocialIcon className="w-3.5 h-3.5 text-[#777777] group-hover:text-[#c8ff00] transition" />
                <span>Telegram</span>
              </a>

              <span className="text-[#333333] hidden sm:inline">|</span>

              <a
                href={litvm.blockExplorers.default.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition flex items-center gap-1.5"
              >
                <span>LiteForge Explorer</span>
                <ExternalLink className="w-3 h-3 text-[#555555]" />
              </a>

              <a
                href={FAUCET_HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition flex items-center gap-1.5"
              >
                <span>zkLTC Gas Faucet</span>
                <ExternalLink className="w-3 h-3 text-[#555555]" />
              </a>

              <a
                href={SUBGRAPH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition flex items-center gap-1.5"
              >
                <span>Goldsky Subgraph</span>
                <ExternalLink className="w-3 h-3 text-[#555555]" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
