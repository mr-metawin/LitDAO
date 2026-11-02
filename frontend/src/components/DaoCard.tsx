import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Vote, Users, Coins, Layers } from 'lucide-react';
import { DAORecord } from '../types';
import { useDaoMetadata } from '../hooks/useDaoMetadata';

interface DaoCardProps {
  dao: DAORecord;
}

export const DaoCard: React.FC<DaoCardProps> = ({ dao }) => {
  const [imgError, setImgError] = React.useState(false);
  const { imageUrl } = useDaoMetadata(dao.governor as `0x${string}`, dao.imageUri);

  const tokenSymbol = typeof dao.token === 'object' && dao.token?.symbol 
    ? dao.token.symbol 
    : 'TOKEN';

  return (
    <div className="bg-[#101726] border border-slate-800/80 rounded-2xl p-6 hover:border-brand-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/5 group flex flex-col justify-between">
      <div>
        {/* Top bar: Network Badge & Icon */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/60 overflow-hidden flex items-center justify-center text-brand-400 group-hover:border-brand-500/50 group-hover:scale-105 transition shrink-0">
              {imageUrl && !imgError ? (
                <img
                  src={imageUrl}
                  alt={dao.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Layers className="w-5 h-5 text-brand-400" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white group-hover:text-brand-300 transition tracking-tight line-clamp-1">
                {dao.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {tokenSymbol} Governance
              </p>
            </div>
          </div>


          {/* Network Badge - Explicitly LitVM */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
            LitVM
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 py-4 my-2 border-y border-slate-800/80 text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
              <Vote className="w-3.5 h-3.5 text-slate-400" />
              <span>Proposals</span>
            </div>
            <span className="font-bold text-slate-100 text-base">
              {dao.proposalCount ?? 0}
            </span>
          </div>

          <div className="flex flex-col items-center border-x border-slate-800/80">
            <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Voters</span>
            </div>
            <span className="font-bold text-slate-100 text-base">
              {dao.voterCount ?? 0}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              <span>Holders</span>
            </div>
            <span className="font-bold text-slate-100 text-base">
              {dao.holderCount ?? 0}
            </span>
          </div>
        </div>

        {/* Address snippet */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-4 pt-1">
          <span>Governor</span>
          <span className="text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
            {dao.governor.slice(0, 6)}...{dao.governor.slice(-4)}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={`/dao/${dao.governor}`}
        className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-brand-600 text-slate-200 hover:text-slate-950 font-semibold text-sm transition-all duration-200 border border-slate-700/60 hover:border-brand-500 shadow-sm"
      >
        <span>View Governance</span>
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  );
};
