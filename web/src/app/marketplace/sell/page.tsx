'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSavedAddress } from '@/lib/wallet';
import { MARKETPLACE_CONTRACTS } from '@/lib/api/marketplace';
import { fetchTokensByOwner, fetchNftInfo, NftInfo } from '@/lib/api/nft';
import { SellForm } from '@/components/marketplace/SellForm';

interface OwnedNft {
  contract: string;
  tokenId: string;
  info: NftInfo;
}

export default function SellPage() {
  const [ownedNfts, setOwnedNfts] = useState<OwnedNft[]>([]);
  const [loading, setLoading] = useState(true);
  const walletAddress = getSavedAddress();

  const loadOwnedNfts = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    const contracts = [
      { addr: MARKETPLACE_CONTRACTS.heroNft, label: 'hero' },
      { addr: MARKETPLACE_CONTRACTS.gearNft, label: 'gear' },
    ].filter(c => c.addr);

    const results: OwnedNft[] = [];

    await Promise.all(
      contracts.map(async ({ addr }) => {
        try {
          const { tokens } = await fetchTokensByOwner(addr, walletAddress);
          const infos = await Promise.all(
            tokens.map(async (tokenId) => {
              try {
                const info = await fetchNftInfo(addr, tokenId);
                return { contract: addr, tokenId, info };
              } catch {
                return {
                  contract: addr,
                  tokenId,
                  info: { name: `NFT ${tokenId.slice(0, 12)}`, description: '', image: '', attributes: [] },
                };
              }
            })
          );
          results.push(...infos);
        } catch {
          // Skip failed queries
        }
      })
    );

    setOwnedNfts(results);
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    loadOwnedNfts();
  }, [loadOwnedNfts]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6">
        <Link href="/marketplace" className="hover:text-text-primary transition-colors">
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-text-primary">Sell</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary mb-6">List NFT for Sale</h1>

      <SellForm ownedNfts={ownedNfts} loading={loading} />
    </div>
  );
}
