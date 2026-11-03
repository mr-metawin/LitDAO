import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { parseUnits, isAddress, decodeEventLog } from 'viem';
import {
  Layers,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Droplets,
  Coins,
  AlertCircle,
  Wallet,
  Camera,
  Upload,
  KeyRound,
} from 'lucide-react';
import { CONTRACT_ADDRESSES, ABIS } from '../config/contracts';
import { uploadImageToPinata } from '../services/pinata';
import { getSafeGasFees } from '../config/chain';

const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6' as `0x${string}`;

export const CreateDaoPage: React.FC = () => {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();


  // Local form error
  const [formError, setFormError] = useState<string | null>(null);

  // Step 1: Token Configuration
  const [tokenMode, setTokenMode] = useState<'new' | 'existing'>('new');
  const [tokenName, setTokenName] = useState('My Community Token');
  const [tokenSymbol, setTokenSymbol] = useState('MCT');
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [existingTokenAddress, setExistingTokenAddress] = useState('');

  // Step 2: Governor Parameters
  const [daoName, setDaoName] = useState('My Community DAO');
  const [daoImageFile, setDaoImageFile] = useState<File | null>(null);
  const [daoImagePreview, setDaoImagePreview] = useState<string | null>(null);
  const [daoImageUri, setDaoImageUri] = useState<string | null>(null);
  const [daoDescription, setDaoDescription] = useState<string>('');
  const [isPinningImage, setIsPinningImage] = useState(false);
  const [pinningError, setPinningError] = useState<string | null>(null);
  const [votingDelay, setVotingDelay] = useState('5'); // 5 seconds
  const [votingPeriodDays, setVotingPeriodDays] = useState('3'); // 3 days default
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
  const [deployedFaucetAddr, setDeployedFaucetAddr] = useState<`0x${string}` | null>(null);

  // Contract Writes
  // 1. Create Token
  const { data: tokenTxHash, writeContract: writeToken, isPending: isTokenPending, error: tokenError } = useWriteContract();
  const { isLoading: isTokenWaiting, isSuccess: isTokenSuccess, data: tokenReceipt, error: tokenReceiptError } = useWaitForTransactionReceipt({
    hash: tokenTxHash,
  });

  // 2. Create Governor
  const { data: govTxHash, writeContract: writeGov, isPending: isGovPending, error: govError } = useWriteContract();
  const { isLoading: isGovWaiting, isSuccess: isGovSuccess, data: govReceipt, error: govReceiptError } = useWaitForTransactionReceipt({
    hash: govTxHash,
  });

  // 3. Create Faucet
  const { data: faucetTxHash, writeContract: writeFaucet, isPending: isFaucetPending, error: faucetError } = useWriteContract();
  const { isLoading: isFaucetWaiting, isSuccess: isFaucetSuccess, data: faucetReceipt, error: faucetReceiptError } = useWaitForTransactionReceipt({
    hash: faucetTxHash,
  });

  // 4. Grant MINTER_ROLE to Faucet (Step 3 finalization for Mint Mode)
  const { data: grantTxHash, writeContract: writeGrantRole, isPending: isGrantPending, error: grantError } = useWriteContract();
  const { isLoading: isGrantWaiting, isSuccess: isGrantSuccess, error: grantReceiptError } = useWaitForTransactionReceipt({
    hash: grantTxHash,
  });

  // 5. Set Metadata
  const { writeContract: writeMetadata } = useWriteContract();


  // Error Helper
  const getErrorMessage = (err: any) => {
    if (!err) return null;
    if (typeof err === 'string') return err;
    if (err.message?.includes('max fee per gas less than block base fee') || err.details?.includes('max fee per gas less than block base fee')) {
      return 'Network gas price fluctuation detected. Safe gas fee buffers have been applied — please click Deploy again.';
    }
    if (err.shortMessage) return err.shortMessage;
    if (err.details) return err.details;
    if (err.message) {
      if (err.message.includes('User rejected') || err.message.includes('User denied')) {
        return 'Transaction rejected in your wallet.';
      }
      return err.message.slice(0, 180);
    }
    return 'An unexpected error occurred.';
  };

  const currentError =
    formError ||
    (currentStep === 1 && (getErrorMessage(tokenError) || getErrorMessage(tokenReceiptError) || (tokenReceipt?.status === 'reverted' ? 'Token deployment transaction reverted on-chain.' : null))) ||
    (currentStep === 2 && (getErrorMessage(govError) || getErrorMessage(govReceiptError) || (govReceipt?.status === 'reverted' ? 'Governor deployment transaction reverted on-chain.' : null))) ||
    (currentStep === 3 && (getErrorMessage(faucetError) || getErrorMessage(faucetReceiptError) || getErrorMessage(grantError) || getErrorMessage(grantReceiptError) || (faucetReceipt?.status === 'reverted' ? 'Faucet deployment transaction reverted on-chain.' : null)));

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
            setFormError(null);
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
            setFormError(null);

            // Auto-register metadata on LitVM if image or description was provided
            if (daoImageUri || daoDescription.trim()) {
              getSafeGasFees(publicClient).then((feeOverrides) => {
                try {
                  (writeMetadata as any)({
                    address: CONTRACT_ADDRESSES.daoMetadataRegistry,
                    abi: ABIS.daoMetadataRegistry,
                    functionName: 'setDAOMetadata',
                    args: [gov, daoImageUri || '', daoDescription.trim()],
                    ...feeOverrides,
                  });
                } catch (metaErr) {
                  console.warn('Metadata registration error:', metaErr);
                }
              });
            }

            if (enableFaucet) {
              setCurrentStep(3);
            } else {
              navigate(`/dao/${gov}`);
            }
            break;
          }
        } catch {
          // continue
        }
      }
    }
  }, [govReceipt, enableFaucet, navigate, daoImageUri, daoDescription, writeMetadata, publicClient]);


  // Handle Image Upload & Pinning to Pinata IPFS
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPinningError('Please choose a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPinningError('Image size exceeds 10MB limit');
      return;
    }

    setDaoImageFile(file);
    setPinningError(null);
    setDaoImagePreview(URL.createObjectURL(file));

    try {
      setIsPinningImage(true);
      const res = await uploadImageToPinata(file, { daoName: daoName.trim() || 'DAO' });
      setDaoImageUri(res.ipfsUri);
    } catch (err: any) {
      console.error('Failed to pin to Pinata IPFS:', err);
      setPinningError(err?.message || 'Failed to pin image to Pinata IPFS');
    } finally {
      setIsPinningImage(false);
    }
  };

  // Handle Faucet created: extract address and auto-grant MINTER_ROLE if Mint Mode
  React.useEffect(() => {
    if (faucetReceipt && faucetReceipt.logs) {
      let createdFaucet: `0x${string}` | null = null;
      for (const log of faucetReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ABIS.faucetFactory,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'FaucetCreated') {
            createdFaucet = (decoded.args as any).faucet;
            setDeployedFaucetAddr(createdFaucet);
            break;
          }
        } catch {
          // continue
        }
      }

      if (faucetMode === 0 && createdFaucet && deployedTokenAddr) {
        // Automatically grant MINTER_ROLE on the token to the newly created faucet
        getSafeGasFees(publicClient).then((feeOverrides) => {
          try {
            (writeGrantRole as any)({
              address: deployedTokenAddr,
              abi: ABIS.daoToken,
              functionName: 'grantRole',
              args: [MINTER_ROLE, createdFaucet],
              ...feeOverrides,
            });
          } catch (err) {
            console.error('Auto grantRole initiation error:', err);
          }
        });
      } else if (faucetMode === 1 && deployedGovernorAddr) {
        // Pre-funded mode does not need minter role; redirect to DAO page
        navigate(`/dao/${deployedGovernorAddr}`);
      }
    }
  }, [faucetReceipt, faucetMode, deployedTokenAddr, deployedGovernorAddr, publicClient, writeGrantRole, navigate]);

  // Redirect after minter role grant confirms
  React.useEffect(() => {
    if (isGrantSuccess && deployedGovernorAddr) {
      const timer = setTimeout(() => {
        navigate(`/dao/${deployedGovernorAddr}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isGrantSuccess, deployedGovernorAddr, navigate]);

  const handleManualGrantMinter = async () => {
    if (!deployedFaucetAddr || !deployedTokenAddr) return;
    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeGrantRole as any)({
        address: deployedTokenAddr,
        abi: ABIS.daoToken,
        functionName: 'grantRole',
        args: [MINTER_ROLE, deployedFaucetAddr],
        ...feeOverrides,
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to grant minter role');
    }
  };


  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError(null);

    if (tokenMode === 'existing') {
      const trimmed = existingTokenAddress.trim();
      if (!isAddress(trimmed)) {
        setFormError('Please enter a valid ERC-20 token address (0x...)');
        return;
      }
      setDeployedTokenAddr(trimmed as `0x${string}`);
      setCurrentStep(2);
      return;
    }

    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        setFormError('Please connect your wallet first.');
      }
      return;
    }

    try {
      const supply = parseUnits(initialSupply || '1000000', 18);
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeToken as any)({
        address: CONTRACT_ADDRESSES.tokenFactory,
        abi: ABIS.tokenFactory,
        functionName: 'createToken',
        args: [tokenName.trim(), tokenSymbol.trim(), supply, address],
        ...feeOverrides,
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to initiate token deployment');
    }
  };

  const handleCreateGovernor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const token = deployedTokenAddr;
    if (!token) {
      setFormError('No token address found. Please complete Step 1 first.');
      return;
    }

    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        setFormError('Please connect your wallet first.');
      }
      return;
    }

    try {
      const name = daoName.trim() || `${tokenName} DAO`;
      const periodInSeconds = Math.max(1, Math.round(Number(votingPeriodDays || '3') * 86400));
      const params = {
        name: name,
        token: token,
        votingDelay: BigInt(votingDelay || '5'),
        votingPeriod: BigInt(periodInSeconds),
        proposalThreshold: parseUnits(proposalThreshold || '0', 18),
        quorumFraction: BigInt(quorumFraction || '4'),
        timelockMinDelay: BigInt(timelockDelay || '60'),
      };

      const feeOverrides = await getSafeGasFees(publicClient);
      (writeGov as any)({
        address: CONTRACT_ADDRESSES.governorFactory,
        abi: ABIS.governorFactory,
        functionName: 'createGovernor',
        args: [params],
        ...feeOverrides,
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to initiate governor deployment');
    }
  };

  const handleCreateFaucet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const token = deployedTokenAddr;
    if (!token) {
      setFormError('No token address found.');
      return;
    }

    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        setFormError('Please connect your wallet first.');
      }
      return;
    }

    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeFaucet as any)({
        address: CONTRACT_ADDRESSES.faucetFactory,
        abi: ABIS.faucetFactory,
        functionName: 'createFaucet',
        args: [
          token,
          parseUnits(claimAmount || '100', 18),
          BigInt(cooldownPeriod || '3600'),
          faucetMode,
        ],
        ...feeOverrides,
      });
    } catch (err: any) {
      setFormError(err?.message || 'Failed to initiate faucet deployment');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back to Explore Link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#888888] hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Explore DAOs</span>
      </Link>

      {/* Main Hero Header Card */}
      <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Launch a New DAO
            </h1>
            <p className="text-xs sm:text-sm text-[#888888] max-w-xl leading-relaxed">
              Deploy an immutable OpenZeppelin Governor, TimelockController, ERC20Votes token, and automated testnet faucet in 3 guided steps.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Stepper Progression Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-2xl border transition-all ${
          currentStep === 1 
            ? 'bg-[#181818] border-[#c8ff00] shadow-lg shadow-[#c8ff00]/5' 
            : currentStep > 1 
            ? 'bg-[#121212] border-[#262626]' 
            : 'bg-[#121212] border-[#1e1e1e] opacity-60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition ${
              currentStep === 1 
                ? 'bg-[#c8ff00] text-black font-extrabold' 
                : currentStep > 1 
                ? 'bg-[#1c2800] text-[#c8ff00] border border-[#c8ff00]/30' 
                : 'bg-[#1c1c1c] text-[#777777] border border-[#282828]'
            }`}>
              {currentStep > 1 ? <CheckCircle2 className="w-4 h-4 text-[#c8ff00]" /> : '1'}
            </div>
            <div>
              <span className="text-[10px] text-[#777777] uppercase tracking-wider font-semibold block">Step 1</span>
              <span className={`text-xs font-bold ${currentStep === 1 ? 'text-white' : 'text-[#888888]'}`}>Governance Token</span>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          currentStep === 2 
            ? 'bg-[#181818] border-[#c8ff00] shadow-lg shadow-[#c8ff00]/5' 
            : currentStep > 2 
            ? 'bg-[#121212] border-[#262626]' 
            : 'bg-[#121212] border-[#1e1e1e] opacity-60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition ${
              currentStep === 2 
                ? 'bg-[#c8ff00] text-black font-extrabold' 
                : currentStep > 2 
                ? 'bg-[#1c2800] text-[#c8ff00] border border-[#c8ff00]/30' 
                : 'bg-[#1c1c1c] text-[#777777] border border-[#282828]'
            }`}>
              {currentStep > 2 ? <CheckCircle2 className="w-4 h-4 text-[#c8ff00]" /> : '2'}
            </div>
            <div>
              <span className="text-[10px] text-[#777777] uppercase tracking-wider font-semibold block">Step 2</span>
              <span className={`text-xs font-bold ${currentStep === 2 ? 'text-white' : 'text-[#888888]'}`}>Governor & Timelock</span>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border transition-all ${
          currentStep === 3 
            ? 'bg-[#181818] border-[#c8ff00] shadow-lg shadow-[#c8ff00]/5' 
            : 'bg-[#121212] border-[#1e1e1e] opacity-60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition ${
              currentStep === 3 
                ? 'bg-[#c8ff00] text-black font-extrabold' 
                : 'bg-[#1c1c1c] text-[#777777] border border-[#282828]'
            }`}>
              3
            </div>
            <div>
              <span className="text-[10px] text-[#777777] uppercase tracking-wider font-semibold block">Step 3</span>
              <span className={`text-xs font-bold ${currentStep === 3 ? 'text-white' : 'text-[#888888]'}`}>Community Faucet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: Token Setup */}
      {currentStep === 1 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-[#1e1e1e]">
            <div className="w-12 h-12 rounded-2xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
              <Coins className="w-6 h-6 text-[#c8ff00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Step 1: Governance Token</h2>
              <p className="text-xs text-[#888888] mt-0.5">ERC20Votes with Cancun timestamp clock and auto-delegation</p>
            </div>
          </div>

          <form onSubmit={handleCreateToken} className="space-y-5">
            <div className="p-1 rounded-2xl bg-[#181818] border border-[#242424] flex">
              <button
                type="button"
                onClick={() => {
                  setTokenMode('new');
                  setFormError(null);
                }}
                className={`flex-1 py-3 text-xs font-semibold rounded-xl transition ${
                  tokenMode === 'new' ? 'bg-[#242424] text-white border border-[#333333] shadow-sm' : 'text-[#777777] hover:text-[#cccccc]'
                }`}
              >
                Create New Token
              </button>
              <button
                type="button"
                onClick={() => {
                  setTokenMode('existing');
                  setFormError(null);
                }}
                className={`flex-1 py-3 text-xs font-semibold rounded-xl transition ${
                  tokenMode === 'existing' ? 'bg-[#242424] text-white border border-[#333333] shadow-sm' : 'text-[#777777] hover:text-[#cccccc]'
                }`}
              >
                Use Existing ERC20Votes
              </button>
            </div>

            {tokenMode === 'new' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">Token Name</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => {
                        setTokenName(e.target.value);
                        setDaoName(`${e.target.value} DAO`);
                      }}
                      required
                      placeholder="e.g. LiteDAO Token"
                      className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">Token Symbol</label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value)}
                      required
                      placeholder="e.g. LDAO"
                      className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                    Initial Supply (Minted & Auto-delegated to your wallet)
                  </label>
                  <input
                    type="number"
                    value={initialSupply}
                    onChange={(e) => setInitialSupply(e.target.value)}
                    required
                    className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-mono"
                  />
                  <p className="text-[11px] text-[#777777] mt-1.5">
                    Whole token units. The contract automatically delegates 100% of voting weight to your wallet so checkpoints are immediately active.
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Existing Token Address (Must be ERC20Votes)
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={existingTokenAddress}
                  onChange={(e) => setExistingTokenAddress(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>
            )}

            {currentError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 break-words">{currentError}</span>
              </div>
            )}

            {!isConnected ? (
              <button
                type="button"
                onClick={() => (openConnectModal ? openConnectModal() : null)}
                className="w-full py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet to Continue</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isTokenPending || isTokenWaiting}
                className="w-full py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
              >
                {isTokenPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirm in Wallet...</span>
                  </>
                ) : isTokenWaiting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deploying Token on LitVM...</span>
                  </>
                ) : tokenMode === 'existing' ? (
                  <>
                    <span>Continue to Governor Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Deploy Token & Continue to Governor</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      )}

      {/* Step 2: Governor Setup */}
      {currentStep === 2 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-[#1e1e1e]">
            <div className="w-12 h-12 rounded-2xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
              <Shield className="w-6 h-6 text-[#c8ff00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Step 2: Governor & Timelock</h2>
              <p className="text-xs text-[#888888] mt-0.5">Configure voting thresholds, delay, quorum, and timelock</p>
            </div>
          </div>

          <form onSubmit={handleCreateGovernor} className="space-y-5">
            <div className="p-4 bg-[#181818] rounded-2xl border border-[#242424] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c8ff00]" />
                <span className="text-[#888888]">Governance Token Linked:</span>
              </div>
              <span className="font-mono text-[#c8ff00] font-bold">{deployedTokenAddr}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                DAO / Governor Name
              </label>
              <input
                type="text"
                value={daoName}
                onChange={(e) => setDaoName(e.target.value)}
                required
                className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-medium"
              />
            </div>

            {/* DAO Avatar & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  DAO Avatar / Logo (Optional)
                </label>
                <div className="flex items-center gap-3.5">
                  <div className="w-20 h-20 min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] rounded-2xl bg-[#181818] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0 aspect-square shadow-inner">
                    {daoImagePreview ? (
                      <img src={daoImagePreview} alt="DAO Preview" className="w-full h-full object-cover aspect-square rounded-2xl block" />
                    ) : (
                      <Camera className="w-6 h-6 text-[#555555]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1c1c1c] hover:bg-[#252525] text-white text-xs font-semibold border border-[#282828] cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-[#c8ff00]" />
                      <span>{daoImagePreview ? 'Change Image' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                    {isPinningImage && (
                      <p className="text-[11px] text-[#c8ff00] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        <span>Pinning to IPFS via Pinata...</span>
                      </p>
                    )}
                    {daoImageUri && !isPinningImage && (
                      <p className="text-[11px] text-[#c8ff00] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Pinned to Pinata IPFS</span>
                      </p>
                    )}
                    {pinningError && (
                      <p className="text-[11px] text-rose-400">{pinningError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  DAO Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Protocol governance & community treasury"
                  value={daoDescription}
                  onChange={(e) => setDaoDescription(e.target.value)}
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#444444] transition font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Voting Delay (seconds before voting starts)
                </label>
                <input
                  type="number"
                  value={votingDelay}
                  onChange={(e) => setVotingDelay(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#a0a0a0]">
                    Voting Period (days voting remains active)
                  </label>
                  {Number(votingPeriodDays) > 0 && (
                    <span className="text-[10px] text-[#777777] font-mono">
                      ≈ {(Math.round(Number(votingPeriodDays) * 86400)).toLocaleString()}s
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={votingPeriodDays}
                  onChange={(e) => setVotingPeriodDays(e.target.value)}
                  required
                  placeholder="3"
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Quorum Fraction (%)
                </label>
                <input
                  type="number"
                  value={quorumFraction}
                  onChange={(e) => setQuorumFraction(e.target.value)}
                  required
                  min="1"
                  max="100"
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Proposal Threshold
                </label>
                <input
                  type="number"
                  value={proposalThreshold}
                  onChange={(e) => setProposalThreshold(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Timelock Min Delay (s)
                </label>
                <input
                  type="number"
                  value={timelockDelay}
                  onChange={(e) => setTimelockDelay(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-[#181818] rounded-2xl border border-[#242424]">
              <input
                type="checkbox"
                id="enableFaucetCheckbox"
                checked={enableFaucet}
                onChange={(e) => setEnableFaucet(e.target.checked)}
                className="w-4 h-4 text-[#c8ff00] bg-[#121212] border-[#333333] rounded focus:ring-[#c8ff00] cursor-pointer"
              />
              <label htmlFor="enableFaucetCheckbox" className="text-xs text-[#cccccc] cursor-pointer select-none">
                Deploy testnet faucet in Step 3 <span className="text-[#777777]">(Recommended for community faucet testing)</span>
              </label>
            </div>

            {currentError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 break-words">{currentError}</span>
              </div>
            )}

            {!isConnected ? (
              <button
                type="button"
                onClick={() => (openConnectModal ? openConnectModal() : null)}
                className="w-full py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet to Continue</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isGovPending || isGovWaiting}
                className="w-full py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
              >
                {isGovPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirm in Wallet...</span>
                  </>
                ) : isGovWaiting ? (
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
            )}
          </form>
        </div>
      )}

      {/* Step 3: Testnet Faucet Setup */}
      {currentStep === 3 && (
        <div className="bg-[#121212] border border-[#222222] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-[#1e1e1e]">
            <div className="w-12 h-12 rounded-2xl bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-[#c8ff00]">
              <Droplets className="w-6 h-6 text-[#c8ff00]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Step 3: Testnet Faucet (Optional)</h2>
              <p className="text-xs text-[#888888] mt-0.5">Distribute test tokens with anti-spam cooldown</p>
            </div>
          </div>

          <form onSubmit={handleCreateFaucet} className="space-y-5">
            <div className="p-4 bg-[#181818] rounded-2xl border border-[#242424] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c8ff00]" />
                <span className="text-[#888888]">Governor Deployed:</span>
              </div>
              <span className="font-mono text-[#c8ff00] font-bold">{deployedGovernorAddr}</span>
            </div>

            <div className="p-1 rounded-2xl bg-[#181818] border border-[#242424] flex">
              <button
                type="button"
                onClick={() => setFaucetMode(0)}
                className={`flex-1 py-3 text-xs font-semibold rounded-xl transition ${
                  faucetMode === 0 ? 'bg-[#242424] text-white border border-[#333333] shadow-sm' : 'text-[#777777] hover:text-[#cccccc]'
                }`}
              >
                Mint Mode (Direct on-demand minting)
              </button>
              <button
                type="button"
                onClick={() => setFaucetMode(1)}
                className={`flex-1 py-3 text-xs font-semibold rounded-xl transition ${
                  faucetMode === 1 ? 'bg-[#242424] text-white border border-[#333333] shadow-sm' : 'text-[#777777] hover:text-[#cccccc]'
                }`}
              >
                Pre-Funded Mode (Transfers from reserve)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Claim Amount per Request
                </label>
                <input
                  type="number"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a0a0a0] mb-2">
                  Cooldown Period (seconds)
                </label>
                <input
                  type="number"
                  value={cooldownPeriod}
                  onChange={(e) => setCooldownPeriod(e.target.value)}
                  required
                  className="w-full bg-[#181818] border border-[#242424] rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder-[#555555] focus:outline-none focus:border-[#444444] transition"
                />
              </div>
            </div>

            {currentError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 break-words">{currentError}</span>
              </div>
            )}

            {grantError && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-start gap-2 text-amber-300">
                  <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span className="flex-1">
                    Faucet was deployed successfully, but granting minter role was interrupted ({grantError.message.slice(0, 90)}).
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleManualGrantMinter}
                    disabled={isGrantPending || isGrantWaiting}
                    className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition"
                  >
                    Retry Granting Minter Role
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/dao/${deployedGovernorAddr}`)}
                    className="px-4 py-2 rounded-full bg-[#1e1e1e] hover:bg-[#262626] text-[#888888] hover:text-white text-xs transition border border-[#333333]"
                  >
                    Skip & Open DAO
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={() => (openConnectModal ? openConnectModal() : null)}
                  className="flex-1 py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet to Continue</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isFaucetPending || isFaucetWaiting || isGrantPending || isGrantWaiting || isGrantSuccess}
                  className="flex-1 py-4 rounded-2xl bg-[#c8ff00] hover:bg-[#b5e600] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#c8ff00]/10"
                >
                  {isFaucetPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirm Faucet in Wallet...</span>
                    </>
                  ) : isFaucetWaiting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deploying Faucet on LitVM...</span>
                    </>
                  ) : isGrantPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirm Minter Role in Wallet...</span>
                    </>
                  ) : isGrantWaiting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authorizing Faucet Minter Role...</span>
                    </>
                  ) : isGrantSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>DAO Ready! Opening Dashboard...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Faucet & Finalize DAO</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
