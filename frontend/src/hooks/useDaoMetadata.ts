import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, ABIS } from '../config/contracts';
import { ipfsToGatewayUrl } from '../services/pinata';

export function useDaoMetadata(daoAddress?: `0x${string}` | string | null, fallbackImageUri?: string | null) {
  const formattedDao = daoAddress as `0x${string}` | undefined;

  const { data: onChainMetadata, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.daoMetadataRegistry,
    abi: ABIS.daoMetadataRegistry,
    functionName: 'getDAOMetadata',
    args: formattedDao ? [formattedDao] : undefined,
    query: {
      enabled: Boolean(formattedDao),
    },
  });

  const metadataTuple = onChainMetadata as {
    imageUri: string;
    description: string;
    updater: `0x${string}`;
    updatedAt: bigint;
  } | undefined;

  const rawImageUri = metadataTuple?.imageUri || fallbackImageUri;
  const imageUrl = ipfsToGatewayUrl(rawImageUri);
  const description = metadataTuple?.description || '';

  return {
    rawImageUri,
    imageUrl,
    description,
    updater: metadataTuple?.updater,
    updatedAt: metadataTuple?.updatedAt,
    refetch,
  };
}
