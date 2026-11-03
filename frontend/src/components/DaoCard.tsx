import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Vote, Users, Coins } from 'lucide-react';
import { DAORecord } from '../types';
import { useDaoMetadata } from '../hooks/useDaoMetadata';
import { DaoAvatar } from './DaoAvatar';

interface DaoCardProps {
  dao: DAORecord;
}

export const DaoCard: React.FC<DaoCardProps> = ({ dao }) => {
  const { rawImageUri } = useDaoMetadata(dao.governor as `0x${string}`, dao.imageUri);

  const tokenSymbol = typeof dao.token === 'object' && dao.token?.symbol 
    ? dao.token.symbol 
    : 'TOKEN';

  return (
    <div className="bg-[#121212] border border-[#222222] hover:border-[#383838] rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-black group flex flex-col justify-between">
      <div>
        {/* Top: Avatar, Name & Network Badge */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a] overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <DaoAvatar
                imageUri={rawImageUri || dao.imageUri}
                alt={dao.name}
                fallbackIconClassName="w-6 h-6 text-[#c8ff00]"
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-white group-hover:text-[#c8ff00] transition-colors tracking-tight truncate">
                {dao.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-[#888888] font-mono bg-[#1a1a1a] px-2 py-0.5 rounded-md border border-[#262626]">
                  {tokenSymbol}
                </span>
                <span className="text-[11px] text-[#555555] font-mono">
                  {dao.governor.slice(0, 6)}...{dao.governor.slice(-4)}
                </span>
              </div>
            </div>
          </div>

          {/* LitVM Badge with OKX Green Indicator */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#181818] text-white border border-[#262626] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c8ff00]"></span>
            <span>LitVM</span>
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 py-4 my-3 rounded-2xl bg-[#181818] border border-[#222222] text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[#777777] text-xs mb-1">
              <Vote className="w-3.5 h-3.5 text-[#888888]" />
              <span>Proposals</span>
            </div>
            <span className="font-extrabold text-white text-base">
              {dao.proposalCount ?? 0}
            </span>
          </div>

          <div className="flex flex-col items-center border-x border-[#282828]">
            <div className="flex items-center gap-1 text-[#777777] text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-[#888888]" />
              <span>Voters</span>
            </div>
            <span className="font-extrabold text-white text-base">
              {dao.voterCount ?? 0}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[#777777] text-xs mb-1">
              <Coins className="w-3.5 h-3.5 text-[#888888]" />
              <span>Holders</span>
            </div>
            <span className="font-extrabold text-[#c8ff00] text-base">
              {dao.holderCount ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button: OKX High-Contrast White Pill */}
      <Link
        to={`/dao/${dao.governor}`}
        className="w-full mt-3 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all duration-200 shadow-md active:scale-[0.98]"
      >
        <span>Enter DAO</span>
        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
      </Link>
    </div>
  );
};
