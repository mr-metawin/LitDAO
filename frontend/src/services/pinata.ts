const DEFAULT_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2OWY0YjNlMi01YzllLTQ5MmUtYjAyNC0yYjJjMTk3OWE4ODkiLCJlbWFpbCI6Im1sMzY0Njc0bGlmZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiMTEzZWEzNTViY2M2YmU4YjczYjciLCJzY29wZWRLZXlTZWNyZXQiOiI4MjQwZGY5YTc5NjQ5MDFhNGUxYzVlY2NmOGYxMDFkMDkzMjMxNDUxNDhmYWM5MmI3OTA4YjVkNmEwYmVhYzkxIiwiZXhwIjoxODI1MTQ2NzY0fQ.NeZ_BjwAhYyY0nXapTStjLVHRTFYjukIoVQpBATEXXE';

export const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || DEFAULT_JWT;
export const PINATA_GATEWAY =
  import.meta.env.VITE_PINATA_GATEWAY || 'https://azure-bitter-wildebeest-736.mypinata.cloud';

export interface PinataUploadResult {
  ipfsHash: string;
  ipfsUri: string;
  gatewayUrl: string;
}

/**
 * Upload an image file to Pinata IPFS
 */
export async function uploadImageToPinata(
  file: File,
  metadata?: { daoName?: string; daoAddress?: string }
): Promise<PinataUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const pinataMetadata = {
    name: metadata?.daoName ? `dao-avatar-${metadata.daoName}` : file.name,
    keyvalues: {
      type: 'dao_avatar',
      ...(metadata?.daoAddress ? { dao: metadata.daoAddress.toLowerCase() } : {}),
      ...(metadata?.daoName ? { daoName: metadata.daoName } : {}),
      uploadedAt: new Date().toISOString(),
    },
  };
  formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

  const pinataOptions = {
    cidVersion: 1,
  };
  formData.append('pinataOptions', JSON.stringify(pinataOptions));

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const ipfsHash = data.IpfsHash;

  return {
    ipfsHash,
    ipfsUri: `ipfs://${ipfsHash}`,
    gatewayUrl: `${PINATA_GATEWAY}/ipfs/${ipfsHash}`,
  };
}

/**
 * Convert an IPFS URI (ipfs://...), plain CID, or legacy gateway URL
 * to the ultra-fast dedicated Cloudflare-backed Pinata gateway URL.
 */
export function ipfsToGatewayUrl(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;

  // Base64 or local blob
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // If it's already an IPFS gateway URL (e.g. gateway.pinata.cloud, ipfs.io, etc.),
  // rewrite it to use our dedicated fast gateway
  const ipfsMatch = trimmed.match(/\/ipfs\/(.+)$/);
  if (ipfsMatch) {
    const path = ipfsMatch[1];
    return `${PINATA_GATEWAY}/ipfs/${path}`;
  }

  // Plain IPFS URI (ipfs://...)
  if (trimmed.startsWith('ipfs://') || trimmed.startsWith('ipfs/')) {
    const cleanHash = trimmed.replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '');
    return `${PINATA_GATEWAY}/ipfs/${cleanHash}`;
  }

  // If it's a regular HTTP URL that isn't IPFS, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Otherwise assume it's a raw CID (e.g. Qm... or baf...)
  return `${PINATA_GATEWAY}/ipfs/${trimmed}`;
}

/**
 * Fallback gateway URL (e.g. ipfs.io) if dedicated gateway is unreachable or unpinned
 */
export function getFallbackGatewayUrl(uri?: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;

  const ipfsMatch = trimmed.match(/\/ipfs\/(.+)$/);
  if (ipfsMatch) {
    return `https://ipfs.io/ipfs/${ipfsMatch[1]}`;
  }

  if (trimmed.startsWith('ipfs://') || trimmed.startsWith('ipfs/')) {
    const cleanHash = trimmed.replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${cleanHash}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return null;
  }

  return `https://ipfs.io/ipfs/${trimmed}`;
}
