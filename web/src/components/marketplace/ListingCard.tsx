'use client';

import Link from 'next/link';
import { MarketplaceListing } from '@/lib/api/marketplace';
import { CHAIN } from '@/lib/chain';
import { formatDenom } from '@/lib/format';
import { IpfsImage } from '../ui/IpfsImage';

interface Props {
  listing: MarketplaceListing;
}

export function ListingCard({ listing }: Props) {
  const isAuction = listing.listingType === 'Auction';
  const displayPrice = isAuction && listing.currentBid !== '0'
    ? listing.currentBid
    : listing.price;
  const priceLabel = isAuction ? 'Current Bid' : 'Price';

  const isHero = listing.nftContract === process.env.NEXT_PUBLIC_HERO_NFT_CONTRACT;
  const typeLabel = isHero ? 'Hero' : 'Gear';
  const typeBadgeColor = isHero ? 'bg-accent-purple/20 text-accent-purple' : 'bg-accent-gold/20 text-accent-gold';

  const timeLeft = listing.expiresAt > 0
    ? getTimeRemaining(listing.expiresAt)
    : null;

  return (
    <Link
      href={`/marketplace/${listing.listingId}`}
      className="bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-border-glow hover:shadow-[0_0_20px_rgba(74,63,107,0.15)] transition-all group"
    >
      {/* Image */}
      <div className="aspect-square bg-bg-tertiary relative">
        <IpfsImage
          src={listing.nftImage || ''}
          alt={listing.nftName || `NFT #${listing.tokenId}`}
          fallbackLetter={listing.nftName?.charAt(0) || 'N'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        {/* Type badge */}
        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor}`}>
          {typeLabel}
        </span>
        {isAuction && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-red/20 text-accent-red">
            Auction
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-primary truncate">
          {listing.nftName || `NFT #${listing.tokenId.slice(0, 12)}`}
        </h3>

        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{priceLabel}</span>
          <span className="text-sm font-medium text-accent-gold">
            {formatDenom(displayPrice, CHAIN.denom)}
          </span>
        </div>

        {timeLeft && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Ends in</span>
            <span className="text-xs text-text-secondary">{timeLeft}</span>
          </div>
        )}

        <div className="text-xs text-text-secondary truncate">
          Seller: {listing.seller.slice(0, 12)}...{listing.seller.slice(-6)}
        </div>
      </div>
    </Link>
  );
}

function getTimeRemaining(expiresAt: number): string | null {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiresAt - now;
  if (diff <= 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
