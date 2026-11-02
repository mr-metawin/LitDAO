import React, { useState, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  X,
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { CONTRACT_ADDRESSES, ABIS } from '../config/contracts';
import { uploadImageToPinata, ipfsToGatewayUrl } from '../services/pinata';
import { getSafeGasFees } from '../config/chain';


interface UpdateDaoImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  governorAddress: `0x${string}`;
  daoName: string;
  currentImageUri?: string | null;
  currentDescription?: string;
  isAuthorized?: boolean;
  registrantAddress?: string | null;
  onSuccess?: () => void;
}

export const UpdateDaoImageModal: React.FC<UpdateDaoImageModalProps> = ({
  isOpen,
  onClose,
  governorAddress,
  daoName,
  currentImageUri,
  currentDescription = '',
  isAuthorized = true,
  registrantAddress,
  onSuccess,
}) => {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    ipfsToGatewayUrl(currentImageUri) || null
  );
  const [description, setDescription] = useState(currentDescription);

  const [isUploadingPinata, setIsUploadingPinata] = useState(false);
  const [pinataError, setPinataError] = useState<string | null>(null);
  const [uploadedIpfsUri, setUploadedIpfsUri] = useState<string | null>(currentImageUri || null);

  const {
    data: txHash,
    writeContract,
    isPending: isTxPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isTxWaiting,
    isSuccess: isTxSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPinataError('Please select a valid image file (PNG, JPG, SVG, WebP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPinataError('Image size exceeds 10MB limit');
      return;
    }

    setSelectedFile(file);
    setPinataError(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinataError(null);

    if (!isConnected || !address) {
      if (openConnectModal) openConnectModal();
      return;
    }

    if (!isAuthorized) {
      setPinataError("You are not authorized to update this DAO's metadata. Only the original creator or governance proposals can update it.");
      return;
    }

    let finalIpfsUri = uploadedIpfsUri;

    // If new file chosen, upload to Pinata first
    if (selectedFile) {
      try {
        setIsUploadingPinata(true);
        const res = await uploadImageToPinata(selectedFile, {
          daoName,
          daoAddress: governorAddress,
        });
        finalIpfsUri = res.ipfsUri;
        setUploadedIpfsUri(res.ipfsUri);
      } catch (err: any) {
        setPinataError(err?.message || 'Failed to pin image to Pinata IPFS');
        setIsUploadingPinata(false);
        return;
      } finally {
        setIsUploadingPinata(false);
      }
    }

    if (!finalIpfsUri) {
      setPinataError('Please select an image file to upload.');
      return;
    }

    try {
      const feeOverrides = await getSafeGasFees(publicClient);
      (writeContract as any)({
        address: CONTRACT_ADDRESSES.daoMetadataRegistry,
        abi: ABIS.daoMetadataRegistry,
        functionName: 'setDAOMetadata',
        args: [governorAddress, finalIpfsUri, description.trim()],
        ...feeOverrides,
      });
    } catch (err: any) {
      setPinataError(err?.message || 'Failed to submit transaction');
    }
  };


  const isWorking = isUploadingPinata || isTxPending || isTxWaiting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#101726] border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Camera className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">DAO Avatar & Metadata</h2>
              <p className="text-xs text-slate-400 font-mono">
                {daoName} ({governorAddress.slice(0, 6)}...{governorAddress.slice(-4)})
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetWrite();
              onClose();
            }}
            disabled={isWorking}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isTxSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">DAO Avatar Updated!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Your DAO image has been pinned to Pinata IPFS and recorded on the LitVM Metadata Registry.
              </p>
            </div>
            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                resetWrite();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold text-xs transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleUploadAndSave} className="space-y-5">
            {!isAuthorized && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-200">Restricted: Creator Only</p>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    Only the DAO creator{registrantAddress ? ` (${registrantAddress.slice(0, 6)}...${registrantAddress.slice(-4)})` : ''} or an approved governance proposal can update this DAO's logo and description.
                  </p>
                </div>
              </div>
            )}

            {/* Image Preview & Picker */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80">
              <div className="relative group w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="DAO Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-500" />
                )}
                {isAuthorized && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={!isAuthorized}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isAuthorized || isWorking}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-brand-400" />
                  <span>Choose Image File</span>
                </button>
                <p className="text-[11px] text-slate-500">
                  Recommended: Square JPG, PNG, WebP or SVG up to 10MB. Automatically pinned to IPFS.
                </p>
              </div>
            </div>

            {/* Description / Mission */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                DAO Description / Mission (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief summary of the DAO's purpose, vision, or community guidelines..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            {/* Error banner */}
            {(pinataError || writeError || receiptError) && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="flex-1 break-words">
                  {pinataError || (writeError as any)?.shortMessage || (writeError as any)?.message || 'Transaction failed'}
                </span>
              </div>
            )}

            {/* Submit CTA */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isWorking}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isWorking || !isAuthorized}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10"
              >
                {!isAuthorized ? (
                  <span>Unauthorized (Creator Only)</span>
                ) : isUploadingPinata ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Pinning to IPFS via Pinata...</span>
                  </>
                ) : isTxPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirm in Wallet...</span>
                  </>
                ) : isTxWaiting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Metadata on LitVM...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Save DAO Avatar</span>
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
