'use client';

import { MarketplaceListing } from '@/lib/api/marketplace';
import { CHAIN } from '@/lib/chain';
import { formatDenom } from '@/lib/format';
import { IpfsImage } from '../ui/IpfsImage';
import { BuyButton } from './BuyButton';
import Link from 'next/link';

interface Props {
  listing: MarketplaceListing;
}

export function ListingDetail({ listing }: Props) {
  const isAuction = listing.listingType === 'Auction';
  const isHero = listing.assetType === 'hero';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Image */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="aspect-square bg-bg-tertiary">
          <IpfsImage
            src={listing.nftImage || ''}
            alt={listing.nftName || 'NFT'}
            fallbackLetter={listing.nftName?.charAt(0) || 'N'}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Right: Details */}
      <div className="space-y-6">
        {/* Title + type badge */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isHero ? 'bg-accent-purple/20 text-accent-purple' : 'bg-accent-gold/20 text-accent-gold'
            }`}>
              {isHero ? 'Hero' : 'Gear'}
            </span>
            {isAuction && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-red/20 text-accent-red">
                Auction
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {listing.nftName || `NFT #${listing.tokenId}`}
          </h1>
        </div>

        {/* Price */}
        <div className="bg-bg-secondary border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">
              {isAuction ? 'Starting Price' : 'Price'}
            </span>
            <span className="text-xl font-bold text-accent-gold">
              {formatDenom(listing.price, CHAIN.denom)}
            </span>
          </div>

          {isAuction && listing.currentBid !== '0' && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">Current Bid</span>
              <span className="text-lg font-semibold text-accent-green">
                {formatDenom(listing.currentBid, CHAIN.denom)}
              </span>
            </div>
          )}

          {isAuction && listing.currentBidder && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">Top Bidder</span>
              <Link href={`/account/${listing.currentBidder}`} className="text-sm text-accent-purple hover:underline">
                {listing.currentBidder.slice(0, 12)}...{listing.currentBidder.slice(-6)}
              </Link>
            </div>
          )}

          {listing.expiresAt > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">Expires</span>
              <span className="text-sm text-text-primary">
                {new Date(listing.expiresAt * 1000).toLocaleString()}
              </span>
            </div>
          )}

          <BuyButton listing={listing} onSuccess={(txHash) => {
            alert(`Transaction successful! Hash: ${txHash}`);
          }} />
        </div>

        {/* Seller */}
        <div className="bg-bg-secondary border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">Seller</span>
            <Link href={`/account/${listing.seller}`} className="text-sm text-accent-purple hover:underline">
              {listing.seller.slice(0, 12)}...{listing.seller.slice(-6)}
            </Link>
          </div>
        </div>

        {/* Attributes */}
        {listing.nftAttributes && listing.nftAttributes.length > 0 && (
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                Attributes
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              {listing.nftAttributes.map((attr, i) => (
                <div key={i} className="bg-bg-secondary p-3">
                  <div className="text-xs text-text-secondary">{attr.trait_type}</div>
                  <div className="text-sm font-medium text-text-primary mt-0.5">{attr.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
