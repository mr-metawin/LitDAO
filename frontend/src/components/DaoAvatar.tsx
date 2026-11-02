import React, { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { ipfsToGatewayUrl, getFallbackGatewayUrl } from '../services/pinata';

interface DaoAvatarProps {
  imageUri?: string | null;
  alt: string;
  className?: string;
  fallbackIconClassName?: string;
  loading?: 'eager' | 'lazy';
}

export const DaoAvatar: React.FC<DaoAvatarProps> = ({
  imageUri,
  alt,
  className = 'w-full h-full object-cover',
  fallbackIconClassName = 'w-5 h-5 text-brand-400',
  loading = 'eager',
}) => {
  const primaryUrl = ipfsToGatewayUrl(imageUri);
  const fallbackUrl = getFallbackGatewayUrl(imageUri);

  const [src, setSrc] = useState<string | null>(primaryUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSrc(primaryUrl);
    setHasError(false);
  }, [primaryUrl]);

  const handleError = () => {
    // If primary (dedicated Pinata gateway) fails, attempt fallback (e.g. ipfs.io)
    if (src === primaryUrl && fallbackUrl && fallbackUrl !== primaryUrl) {
      setSrc(fallbackUrl);
    } else {
      setHasError(true);
    }
  };

  if (!src || hasError) {
    return <Layers className={fallbackIconClassName} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={handleError}
    />
  );
};
