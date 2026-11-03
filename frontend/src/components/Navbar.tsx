import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Plus } from 'lucide-react';

import agoraLogo from '../../agora.jpeg';

export const AgoraLogo: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <img
    src={agoraLogo}
    alt="Agora Logo"
    className={`${className} rounded-full object-cover`}
  />
);

export const PixelXLogo = AgoraLogo;

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="border-b border-[#1c1c1c] bg-[#000000]/95 backdrop-blur-xl sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: OKX-Style Brand & Navigation */}
        <div className="flex items-center gap-4 sm:gap-7">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex items-center justify-center group-hover:scale-105 transition-transform">
              <AgoraLogo className="w-8 h-8 rounded-full object-cover drop-shadow-[0_0_12px_rgba(45,212,191,0.35)]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                Agora
              </span>
              <span className="hidden xs:inline-block text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-md bg-[#181818] text-[#8e8e8e] border border-[#282828]">
                Web3
              </span>
            </div>
          </Link>

          {/* Navigation Menu */}
          <nav className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-full transition ${
                isActive('/')
                  ? 'text-white bg-[#1a1a1a] font-semibold'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Explore DAOs
            </Link>
            <Link
              to="/create"
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-[#c8ff00] hover:bg-[#b8eb00] text-black font-extrabold text-xs sm:text-sm tracking-tight transition shadow-lg shadow-[#c8ff00]/10 flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Launch New DAO</span>
            </Link>
          </nav>
        </div>

        {/* Right: Connect Wallet */}
        <div className="flex items-center">
          {/* Custom RainbowKit Connect Button styled like OKX Connect */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    style: {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          type="button"
                          className="px-5 h-11 rounded-full bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-xs sm:text-sm tracking-tight transition shadow-lg shadow-[#c8ff00]/10 flex items-center gap-2 active:scale-95"
                        >
                          Connect wallet
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={openChainModal}
                          type="button"
                          className="px-4 h-11 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition flex items-center"
                        >
                          Wrong Network
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={openAccountModal}
                          type="button"
                          className="flex items-center gap-2.5 px-4 h-11 rounded-full bg-[#141414] hover:bg-[#1e1e1e] border border-[#2c2c2c] text-sm font-semibold text-white transition active:scale-95 shadow-sm"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#c8ff00] ring-2 ring-[#c8ff00]/25"></span>
                          <span className="tracking-tight font-mono">{account.displayName}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
    </header>
  );
};
