'use client';

import { useState, useCallback } from 'react';

const RESOLVERS = [
  (cidPath: string) => `/ipfs/${cidPath}`,
  (cidPath: string) => `https://gateway.pinata.cloud/ipfs/${cidPath}`,
  (cidPath: string) => `https://ipfs.io/ipfs/${cidPath}`,
  (cidPath: string) => `https://dweb.link/ipfs/${cidPath}`,
];

interface Props {
  src: string;
  alt: string;
  fallbackLetter?: string;
  className?: string;
}

export function IpfsImage({ src, alt, fallbackLetter, className = '' }: Props) {
  const [resolverIndex, setResolverIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    if (resolverIndex < RESOLVERS.length - 1) {
      setResolverIndex(prev => prev + 1);
    } else {
      setFailed(true);
    }
  }, [resolverIndex]);

  if (!src || failed) {
    const letter = fallbackLetter || alt?.charAt(0)?.toUpperCase() || '?';
    return (
      <div className={`w-full h-full flex items-center justify-center bg-bg-tertiary ${className}`}>
        <span className="text-4xl text-text-secondary/30">{letter}</span>
      </div>
    );
  }

  let resolvedSrc = src;
  if (src.startsWith('ipfs://')) {
    const cidPath = src.slice(7);
    resolvedSrc = RESOLVERS[resolverIndex](cidPath);
  }

  return (
    <img
      key={resolverIndex}
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
    />
  );
}
