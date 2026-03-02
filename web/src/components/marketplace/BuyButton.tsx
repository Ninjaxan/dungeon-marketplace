'use client';

import { useState } from 'react';
import { getSavedAddress, connectWallet, executeMarketplaceBuy, executeMarketplaceBid } from '@/lib/wallet';
import { MARKETPLACE_CONTRACTS, MarketplaceListing } from '@/lib/api/marketplace';
import { CHAIN } from '@/lib/chain';

interface Props {
  listing: MarketplaceListing;
  onSuccess?: (txHash: string) => void;
}

export function BuyButton({ listing, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');

  const isAuction = listing.listingType === 'Auction';
  const walletAddress = getSavedAddress();

  const handleConnect = async () => {
    try {
      await connectWallet();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const handleBuy = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError('');

    try {
      const txHash = await executeMarketplaceBuy(
        MARKETPLACE_CONTRACTS.marketplace,
        listing.listingId,
        listing.price,
        CHAIN.denom
      );
      onSuccess?.(txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async () => {
    if (!walletAddress || !bidAmount) return;
    setLoading(true);
    setError('');

    try {
      const amountMicro = String(Math.floor(parseFloat(bidAmount) * 1e6));
      const txHash = await executeMarketplaceBid(
        MARKETPLACE_CONTRACTS.marketplace,
        listing.listingId,
        amountMicro,
        CHAIN.denom
      );
      onSuccess?.(txHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bid failed');
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <button
        onClick={handleConnect}
        className="w-full py-3 rounded-xl bg-accent-gold text-bg-primary font-semibold hover:bg-accent-gold/90 transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }

  if (listing.seller === walletAddress) {
    return (
      <div className="w-full py-3 rounded-xl bg-bg-tertiary text-text-secondary text-center text-sm">
        This is your listing
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isAuction ? (
        <>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Bid amount (DGN)"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:border-border-glow"
            />
            <button
              onClick={handleBid}
              disabled={loading || !bidAmount}
              className="px-6 py-3 rounded-xl bg-accent-purple text-white font-semibold hover:bg-accent-purple/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Bidding...' : 'Place Bid'}
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent-gold text-bg-primary font-semibold hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Processing...' : 'Buy Now'}
        </button>
      )}

      {error && (
        <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
