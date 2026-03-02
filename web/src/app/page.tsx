'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { fetchListings, MarketplaceListing, MARKETPLACE_CONTRACTS } from '@/lib/api/marketplace';
import { fetchNftInfo } from '@/lib/api/nft';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { MarketplaceFilters } from '@/components/marketplace/MarketplaceFilters';

const PAGE_SIZE = 12;

export default function MarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'heroes' | 'gear'>('all');
  const [sortBy, setSortBy] = useState('recent');

  const getContractFilter = useCallback((tab: 'all' | 'heroes' | 'gear') => {
    if (tab === 'heroes') return MARKETPLACE_CONTRACTS.heroNft;
    if (tab === 'gear') return MARKETPLACE_CONTRACTS.gearNft;
    return undefined;
  }, []);

  const loadListings = useCallback(async (tab: 'all' | 'heroes' | 'gear', startAfter?: string) => {
    try {
      const nftContract = getContractFilter(tab);
      const results = await fetchListings({
        nftContract,
        startAfter,
        limit: PAGE_SIZE,
      });

      // Enrich with NFT metadata
      const enriched = await Promise.all(
        results.map(async (listing) => {
          try {
            const info = await fetchNftInfo(listing.nftContract, listing.tokenId);
            return {
              ...listing,
              nftName: info.name,
              nftImage: info.image,
              nftAttributes: info.attributes,
              assetType: listing.nftContract === MARKETPLACE_CONTRACTS.heroNft ? 'hero' as const : 'gear' as const,
            };
          } catch {
            return listing;
          }
        })
      );

      setHasMore(results.length >= PAGE_SIZE);
      return enriched;
    } catch {
      throw new Error('Failed to load marketplace listings');
    }
  }, [getContractFilter]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setError('');
    loadListings(activeTab)
      .then(setListings)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeTab, loadListings]);

  const handleTabChange = (tab: 'all' | 'heroes' | 'gear') => {
    setActiveTab(tab);
    setListings([]);
    setHasMore(true);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const lastId = listings[listings.length - 1]?.listingId;
      const more = await loadListings(activeTab, lastId);
      setListings(prev => [...prev, ...more]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  // Client-side sorting
  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case 'price_asc': return Number(BigInt(a.price) - BigInt(b.price));
      case 'price_desc': return Number(BigInt(b.price) - BigInt(a.price));
      case 'ending': return (a.expiresAt || Infinity) - (b.expiresAt || Infinity);
      default: return 0; // 'recent' — already in order
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Marketplace</h1>
          <p className="text-text-secondary text-sm mt-1">Buy and sell Dungeon Heroes and Gear NFTs</p>
        </div>
        <Link
          href="/marketplace/sell"
          className="px-4 py-2 rounded-lg bg-accent-gold text-bg-primary font-semibold text-sm hover:bg-accent-gold/90 transition-colors"
        >
          Sell NFT
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <MarketplaceFilters
          activeTab={activeTab}
          onTabChange={handleTabChange}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
              <div className="aspect-square bg-bg-tertiary animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-bg-tertiary rounded animate-pulse w-2/3" />
                <div className="h-3 bg-bg-tertiary rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary">No listings found</p>
          <p className="text-text-secondary text-sm mt-1">
            {MARKETPLACE_CONTRACTS.marketplace
              ? 'Be the first to list an NFT!'
              : 'Marketplace contracts not yet deployed'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedListings.map(listing => (
              <ListingCard key={listing.listingId} listing={listing} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-lg bg-bg-tertiary border border-border text-text-primary hover:border-border-glow transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
