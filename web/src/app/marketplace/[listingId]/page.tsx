'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { fetchListingDetail, MarketplaceListing, MARKETPLACE_CONTRACTS } from '@/lib/api/marketplace';
import { fetchNftInfo } from '@/lib/api/nft';
import { ListingDetail } from '@/components/marketplace/ListingDetail';

export default function ListingDetailPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = use(params);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchListingDetail(listingId);
        if (!result) {
          setError('Listing not found');
          return;
        }

        // Enrich with NFT metadata
        try {
          const info = await fetchNftInfo(result.nftContract, result.tokenId);
          result.nftName = info.name;
          result.nftImage = info.image;
          result.nftAttributes = info.attributes;
          result.assetType = result.nftContract === MARKETPLACE_CONTRACTS.heroNft ? 'hero' : 'gear';
        } catch {
          // Continue without enrichment
        }

        setListing(result);
      } catch {
        setError('Failed to load listing');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [listingId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-bg-tertiary rounded-xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-bg-tertiary rounded animate-pulse w-2/3" />
            <div className="h-32 bg-bg-tertiary rounded-xl animate-pulse" />
            <div className="h-16 bg-bg-tertiary rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p className="text-accent-red text-lg">{error || 'Listing not found'}</p>
          <Link href="/marketplace" className="text-accent-purple hover:underline mt-4 inline-block">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6">
        <Link href="/marketplace" className="hover:text-text-primary transition-colors">
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-text-primary">
          {listing.nftName || `Listing #${listingId}`}
        </span>
      </nav>

      <ListingDetail listing={listing} />
    </div>
  );
}
