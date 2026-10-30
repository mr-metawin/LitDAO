import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, parseEther, isAddress, decodeEventLog } from 'viem';
import {
  Layers,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Droplets,
  Coins,
} from 'lucide-react';
import { CONTRACT_ADDRESSES, ABIS } from '../config/contracts';

export const CreateDaoPage: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();

  // Step 1: Token Configuration
  const [tokenMode, setTokenMode] = useState<'new' | 'existing'>('new');
  const [tokenName, setTokenName] = useState('My Community Token');
  const [tokenSymbol, setTokenSymbol] = useState('MCT');
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [existingTokenAddress, setExistingTokenAddress] = useState('');

  // Step 2: Governor Parameters
  const [votingDelay, setVotingDelay] = useState('5'); // 5 seconds
  const [votingPeriod, setVotingPeriod] = useState('300'); // 5 minutes
  const [proposalThreshold, setProposalThreshold] = useState('100'); // 100 tokens
  const [quorumFraction, setQuorumFraction] = useState('4'); // 4%
  const [timelockDelay, setTimelockDelay] = useState('60'); // 60 seconds

  // Step 3: Faucet Configuration
  const [enableFaucet, setEnableFaucet] = useState(true);
  const [faucetMode, setFaucetMode] = useState<0 | 1>(0); // 0 = Mint, 1 = Pre-funded
  const [claimAmount, setClaimAmount] = useState('100');
  const [cooldownPeriod, setCooldownPeriod] = useState('3600'); // 1 hour

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [deployedTokenAddr, setDeployedTokenAddr] = useState<`0x${string}` | null>(null);
  const [deployedGovernorAddr, setDeployedGovernorAddr] = useState<`0x${string}` | null>(null);

  // Contract Writes
  // 1. Create Token
  const { data: tokenTxHash, writeContract: writeToken, isPending: isTokenPending } = useWriteContract();
  const { isLoading: isTokenWaiting, isSuccess: isTokenSuccess, data: tokenReceipt } = useWaitForTransactionReceipt({
    hash: tokenTxHash,
  });

  // 2. Create Governor
  const { data: govTxHash, writeContract: writeGov, isPending: isGovPending } = useWriteContract();
  const { isLoading: isGovWaiting, isSuccess: isGovSuccess, data: govReceipt } = useWaitForTransactionReceipt({
    hash: govTxHash,
  });

  // 3. Create Faucet
  const { data: faucetTxHash, writeContract: writeFaucet, isPending: isFaucetPending } = useWriteContract();
  const { isLoading: isFaucetWaiting, isSuccess: isFaucetSuccess } = useWaitForTransactionReceipt({
    hash: faucetTxHash,
  });

  // Extract deployed token address from TokenCreated event
  React.useEffect(() => {
    if (tokenReceipt && tokenReceipt.logs) {
      for (const log of tokenReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ABIS.tokenFactory,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'TokenCreated') {
            const token = (decoded.args as any).token;
            setDeployedTokenAddr(token);
            setCurrentStep(2);
            break;
          }
        } catch {
          // continue
        }
      }
    }
  }, [tokenReceipt]);

  // Extract deployed governor address from GovernorCreated event
  React.useEffect(() => {
    if (govReceipt && govReceipt.logs) {
      for (const log of govReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ABIS.governorFactory,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'GovernorCreated') {
            const gov = (decoded.args as any).governor;
            setDeployedGovernorAddr(gov);
            if (enableFaucet) {
              setCurrentStep(3);
            }
            break;
          }
        } catch {
          // continue
        }
      }
    }
  }, [govReceipt, enableFaucet]);

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenMode === 'existing') {
      if (!isAddress(existingTokenAddress)) return;
      setDeployedTokenAddr(existingTokenAddress as `0x${string}`);
      setCurrentStep(2);
      return;
    }

    const supply = parseUnits(initialSupply || '1000000', 18);
    writeToken({
      address: CONTRACT_ADDRESSES.tokenFactory,
      abi: ABIS.tokenFactory,
      functionName: 'createToken',
      args: [tokenName, tokenSymbol, supply],
    });
  };

  const handleCreateGovernor = (e: React.FormEvent) => {
    e.preventDefault();
    const token = deployedTokenAddr;
    if (!token) return;

    const params = {
      token: token,
      votingDelay: BigInt(votingDelay),
      votingPeriod: BigInt(votingPeriod),
      proposalThreshold: parseUnits(proposalThreshold || '0', 18),
      quorumFraction: BigInt(quorumFraction),
      timelockMinDelay: BigInt(timelockDelay),
    };

    writeGov({
      address: CONTRACT_ADDRESSES.governorFactory,
      abi: ABIS.governorFactory,
      functionName: 'createGovernor',
      args: [params],
    });
  };

  const handleCreateFaucet = (e: React.FormEvent) => {
    e.preventDefault();
    const token = deployedTokenAddr;
    if (!token) return;

    writeFaucet({
      address: CONTRACT_ADDRESSES.faucetFactory,
      abi: ABIS.faucetFactory,
      functionName: 'createFaucet',
      args: [
        token,
        faucetMode,
        parseUnits(claimAmount || '100', 18),
        BigInt(cooldownPeriod || '3600'),
      ],
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>No-Code Governance Deployment</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Launch a DAO on LitVM
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Deploy an OpenZeppelin v5 Governor, TimelockController, ERC20Votes token, and testnet faucet in 3 guided steps.
        </p>
      </div>

      {/* Stepper Tabs */}
      <div className="flex items-center justify-center gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${
          currentStep === 1 
            ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' 
            : currentStep > 1 
            ? 'bg-slate-900 text-slate-300 border-slate-800' 
            : 'text-slate-500 border-transparent'
        }`}>
          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">1</span>
          <span>Token</span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-600" />

        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${
          currentStep === 2 
            ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' 
            : currentStep > 2 
            ? 'bg-slate-900 text-slate-300 border-slate-800' 
            : 'text-slate-500 border-transparent'
        }`}>
          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">2</span>
          <span>Governor</span>
        </div>

        <ArrowRight className="w-4 h-4 text-slate-600" />

        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition ${
          currentStep === 3 
            ? 'bg-brand-500/20 text-brand-300 border-brand-500/40' 
            : 'text-slate-500 border-transparent'
        }`}>
          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">3</span>
          <span>Faucet</span>
        </div>
      </div>

      {/* Step 1: Token Setup */}
      {currentStep === 1 && (
        <div className="bg-[#101726] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Coins className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Step 1: Governance Token</h2>
              <p className="text-xs text-slate-400">ERC20Votes with Cancun timestamp clock and auto-delegation</p>
            </div>
          </div>

          <form onSubmit={handleCreateToken} className="space-y-4">
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setTokenMode('new')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  tokenMode === 'new' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Create New Token
              </button>
              <button
                type="button"
                onClick={() => setTokenMode('existing')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  tokenMode === 'existing' ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Use Existing ERC20Votes
              </button>
            </div>

            {tokenMode === 'new' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Token Name</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Initial Supply (Minted & Auto-delegated to your wallet)
                  </label>
                  <input
                    type="number"
                    value={initialSupply}
                    onChange={(e) => setInitialSupply(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Existing Token Address (Must be ERC20Votes)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={existingTokenAddress}
                  onChange={(e) => setExistingTokenAddress(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!isConnected || isTokenPending || isTokenWaiting}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10"
            >
              {isTokenWaiting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deploying Token on LitVM...</span>
                </>
              ) : (
                <>
                  <span>Continue to Governor Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Governor Setup */}
      {currentStep === 2 && (
        <div className="bg-[#101726] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Step 2: Governor & Timelock</h2>
              <p className="text-xs text-slate-400">Configure voting thresholds, delay, quorum, and timelock</p>
            </div>
          </div>

          <form onSubmit={handleCreateGovernor} className="space-y-4">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
              Token Address: <span className="text-brand-400">{deployedTokenAddr}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Voting Delay (seconds before voting starts)
                </label>
                <input
                  type="number"
                  value={votingDelay}
                  onChange={(e) => setVotingDelay(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Voting Period (seconds voting remains active)
                </label>
                <input
                  type="number"
                  value={votingPeriod}
                  onChange={(e) => setVotingPeriod(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Quorum Fraction (%)
                </label>
                <input
                  type="number"
                  value={quorumFraction}
                  onChange={(e) => setQuorumFraction(e.target.value)}
                  required
                  min="1"
                  max="100"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Proposal Threshold
                </label>
                <input
                  type="number"
                  value={proposalThreshold}
                  onChange={(e) => setProposalThreshold(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Timelock Min Delay (s)
                </label>
                <input
                  type="number"
                  value={timelockDelay}
                  onChange={(e) => setTimelockDelay(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isGovPending || isGovWaiting}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10"
            >
              {isGovWaiting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deploying Governor & Timelock...</span>
                </>
              ) : (
                <>
                  <span>Deploy Governor & Timelock</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 3: Testnet Faucet Setup */}
      {currentStep === 3 && (
        <div className="bg-[#101726] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Droplets className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Step 3: Testnet Faucet (Optional)</h2>
              <p className="text-xs text-slate-400">Distribute test tokens with anti-spam cooldown</p>
            </div>
          </div>

          <form onSubmit={handleCreateFaucet} className="space-y-4">
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setFaucetMode(0)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  faucetMode === 0 ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Mint Mode (Direct on-demand minting)
              </button>
              <button
                type="button"
                onClick={() => setFaucetMode(1)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  faucetMode === 1 ? 'bg-slate-800 text-white' : 'text-slate-400'
                }`}
              >
                Pre-Funded Mode (Transfers from reserve)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Claim Amount per Request
                </label>
                <input
                  type="number"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cooldown Period (seconds)
                </label>
                <input
                  type="number"
                  value={cooldownPeriod}
                  onChange={(e) => setCooldownPeriod(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(`/dao/${deployedGovernorAddr}`)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Skip Faucet & View DAO
              </button>

              <button
                type="submit"
                disabled={isFaucetPending || isFaucetWaiting}
                className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10"
              >
                {isFaucetWaiting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deploying Faucet on LitVM...</span>
                  </>
                ) : (
                  <>
                    <span>Create Faucet & Finalize DAO</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
