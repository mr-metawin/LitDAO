import React, { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress, parseEther, encodeFunctionData, formatUnits } from 'viem';
import { X, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ABIS } from '../config/contracts';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  governorAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
}

export const CreateProposalModal: React.FC<CreateProposalModalProps> = ({
  isOpen,
  onClose,
  governorAddress,
  tokenAddress,
  tokenSymbol,
}) => {
  const { address, isConnected } = useAccount();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [proposalType, setProposalType] = useState<'signaling' | 'custom'>('signaling');
  const [targetAddress, setTargetAddress] = useState('');
  const [ethValue, setEthValue] = useState('0');
  const [calldataHex, setCalldataHex] = useState('0x');

  // Check user's current voting power
  const { data: userVotesData } = useReadContract({
    address: tokenAddress,
    abi: ABIS.daoToken,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check required proposal threshold
  const { data: thresholdData } = useReadContract({
    address: governorAddress,
    abi: ABIS.daoGovernor,
    functionName: 'proposalThreshold',
  });

  // Write: propose()
  const { data: proposeHash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isTxWaiting, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: proposeHash,
  });

  if (!isOpen) return null;

  const userVotes = userVotesData ? BigInt(userVotesData.toString()) : 0n;
  const threshold = thresholdData ? BigInt(thresholdData.toString()) : 0n;
  const hasThreshold = userVotes >= threshold;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const fullDescription = `# ${title.trim()}\n\n${description.trim()}`;

    let targets: `0x${string}`[] = [];
    let values: bigint[] = [];
    let calldatas: `0x${string}`[] = [];

    if (proposalType === 'signaling') {
      // Signaling: targets governor address with value 0 and empty calldata
      targets = [governorAddress];
      values = [0n];
      calldatas = ['0x'];
    } else {
      if (!isAddress(targetAddress)) return;
      targets = [targetAddress as `0x${string}`];
      values = [parseEther(ethValue || '0')];
      calldatas = [(calldataHex.startsWith('0x') ? calldataHex : `0x${calldataHex}`) as `0x${string}`];
    }

    (writeContract as any)({
      address: governorAddress,
      abi: ABIS.daoGovernor,
      functionName: 'propose',
      args: [targets, values, calldatas, fullDescription],
    });
  };

  const isPending = isWritePending || isTxWaiting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#101726] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Create Governance Proposal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Propose actions or community votes governed on LitVM LiteForge.
          </p>
        </div>

        {/* Voting Power / Threshold Warning */}
        {!hasThreshold && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Insufficient Voting Power:</strong> You need at least {formatUnits(threshold, 18)} {tokenSymbol} voting power to propose. You currently have {formatUnits(userVotes, 18)} votes. Please activate or delegate voting power first.
            </div>
          </div>
        )}

        {isTxSuccess ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Proposal Submitted Successfully!</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Your proposal has been created on LitVM. After the voting delay expires, voting will become active.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition"
            >
              Close and Refresh
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Proposal Type Selector */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setProposalType('signaling')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  proposalType === 'signaling'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Signaling / Community Proposal
              </button>
              <button
                type="button"
                onClick={() => setProposalType('custom')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  proposalType === 'custom'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Executable / Onchain Action
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Proposal Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., LIT-1: Fund Community Development"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Description / Rationale <span className="text-rose-400">*</span>
              </label>
              <textarea
                placeholder="Explain the background, justification, and expected outcome of this proposal..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={5}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none font-sans"
              />
            </div>

            {/* Custom Action Fields */}
            {proposalType === 'custom' && (
              <div className="space-y-4 pt-3 border-t border-slate-800">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">
                    Target Contract Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">
                      zkLTC Value (ETH)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={ethValue}
                      onChange={(e) => setEthValue(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">
                      Calldata (Hex)
                    </label>
                    <input
                      type="text"
                      value={calldataHex}
                      onChange={(e) => setCalldataHex(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {writeError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {writeError.message}
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isConnected || !hasThreshold || isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-brand-500/10 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Broadcasting to LitVM...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Proposal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
