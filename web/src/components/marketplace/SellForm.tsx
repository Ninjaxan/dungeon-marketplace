'use client';

import { useState } from 'react';
import { getSavedAddress, connectWallet, executeMarketplaceList } from '@/lib/wallet';
import { MARKETPLACE_CONTRACTS } from '@/lib/api/marketplace';
import { NftInfo } from '@/lib/api/nft';
import { IpfsImage } from '../ui/IpfsImage';

interface OwnedNft {
  contract: string;
  tokenId: string;
  info: NftInfo;
}

interface Props {
  ownedNfts: OwnedNft[];
  loading: boolean;
}

export function SellForm({ ownedNfts, loading }: Props) {
  const [selected, setSelected] = useState<OwnedNft | null>(null);
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState<'FixedPrice' | 'Auction'>('FixedPrice');
  const [duration, setDuration] = useState('7'); // days
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const walletAddress = getSavedAddress();

  const handleConnect = async () => {
    try {
      await connectWallet();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const handleSubmit = async () => {
    if (!selected || !price) return;
    setSubmitting(true);
    setError('');

    try {
      const priceMicro = String(Math.floor(parseFloat(price) * 1e6));
      const durationSecs = listingType === 'Auction' ? parseInt(duration) * 86400 : 0;

      const hash = await executeMarketplaceList(
        MARKETPLACE_CONTRACTS.marketplace,
        selected.contract,
        selected.tokenId,
        priceMicro,
        listingType,
        durationSecs
      );
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary mb-4">Connect your wallet to list NFTs for sale</p>
        <button
          onClick={handleConnect}
          className="px-6 py-3 rounded-xl bg-accent-gold text-bg-primary font-semibold hover:bg-accent-gold/90 transition-colors cursor-pointer"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-accent-green text-xl font-semibold">Listing Created!</div>
        <p className="text-text-secondary text-sm">
          Transaction: <span className="text-text-primary font-mono">{txHash.slice(0, 16)}...{txHash.slice(-8)}</span>
        </p>
        <button
          onClick={() => { setTxHash(''); setSelected(null); setPrice(''); }}
          className="px-4 py-2 rounded-lg bg-bg-tertiary text-text-primary hover:bg-border transition-colors cursor-pointer"
        >
          List Another NFT
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Select NFT */}
      <div className="bg-bg-secondary border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
          Select NFT to List
        </h3>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-bg-tertiary rounded-lg animate-pulse" />
            ))}
          </div>
        ) : ownedNfts.length === 0 ? (
          <p className="text-text-secondary text-sm">No NFTs found in your wallet</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ownedNfts.map(nft => (
              <button
                key={`${nft.contract}_${nft.tokenId}`}
                onClick={() => setSelected(nft)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  selected?.tokenId === nft.tokenId
                    ? 'border-accent-gold shadow-[0_0_10px_rgba(255,215,0,0.3)]'
                    : 'border-transparent hover:border-border-glow'
                }`}
              >
                <IpfsImage
                  src={nft.info.image || ''}
                  alt={nft.info.name}
                  fallbackLetter={nft.info.name?.charAt(0) || 'N'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-2">
                  <div className="text-xs text-white truncate">{nft.info.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Listing details */}
      {selected && (
        <div className="bg-bg-secondary border border-border rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Listing Details
          </h3>

          {/* Listing type */}
          <div className="flex gap-2">
            <button
              onClick={() => setListingType('FixedPrice')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                listingType === 'FixedPrice'
                  ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                  : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-glow'
              }`}
            >
              Fixed Price
            </button>
            <button
              onClick={() => setListingType('Auction')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                listingType === 'Auction'
                  ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                  : 'bg-bg-tertiary text-text-secondary border border-border hover:border-border-glow'
              }`}
            >
              Auction
            </button>
          </div>

          {/* Price */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              {listingType === 'Auction' ? 'Starting Price (DGN)' : 'Price (DGN)'}
            </label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:border-border-glow"
            />
          </div>

          {/* Duration (auction only) */}
          {listingType === 'Auction' && (
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Duration (days)</label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-border-glow"
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !price}
            className="w-full py-3 rounded-xl bg-accent-gold text-bg-primary font-semibold hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? 'Creating Listing...' : 'List for Sale'}
          </button>

          {error && (
            <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
