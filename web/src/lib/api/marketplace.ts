import { rest } from './client';
import { ENDPOINTS } from '../chain';

// ── Contract addresses ──────────────────────────────────────────────────────

// These will be populated after deployment
export const MARKETPLACE_CONTRACTS = {
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT || '',
  heroNft: process.env.NEXT_PUBLIC_HERO_NFT_CONTRACT || '',
  gearNft: process.env.NEXT_PUBLIC_GEAR_NFT_CONTRACT || '',
};

// ── Types ───────────────────────────────────────────────────────────────────

export type ListingType = 'FixedPrice' | 'Auction';

export interface MarketplaceListing {
  listingId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  listingType: ListingType;
  price: string;
  minBid: string;
  currentBid: string;
  currentBidder: string | null;
  expiresAt: number;
  isActive: boolean;
  // Enriched fields (populated after fetch)
  nftName?: string;
  nftImage?: string;
  nftAttributes?: { trait_type: string; value: string }[];
  assetType?: 'hero' | 'gear';
}

export interface ListingFilters {
  nftContract?: string;
  seller?: string;
  assetType?: 'hero' | 'gear' | 'all';
  startAfter?: string;
  limit?: number;
}

export interface MarketplaceConfig {
  treasury: string;
  royaltyBps: number;
  acceptedNftContracts: string[];
  denom: string;
  admin: string;
  listingCount: number;
}

// ── Smart query helper ──────────────────────────────────────────────────────

async function smartQuery<T>(contract: string, query: object): Promise<T> {
  const queryJson = JSON.stringify(query);
  const queryBase64 = btoa(queryJson);
  const path = ENDPOINTS.contractSmartQuery(contract, queryBase64);
  const res = await rest.get<{ data: T }>(path, { revalidate: 10 });
  return res.data;
}

// ── Marketplace queries ─────────────────────────────────────────────────────

export async function fetchListings(filters?: ListingFilters): Promise<MarketplaceListing[]> {
  const contract = MARKETPLACE_CONTRACTS.marketplace;
  if (!contract) return [];

  const limit = filters?.limit || 20;

  let query: object;
  if (filters?.nftContract) {
    query = {
      listings_by_contract: {
        nft_contract: filters.nftContract,
        start_after: filters.startAfter || null,
        limit,
      },
    };
  } else if (filters?.seller) {
    query = {
      listings_by_seller: {
        seller: filters.seller,
        start_after: filters.startAfter || null,
        limit,
      },
    };
  } else {
    query = {
      all_listings: {
        start_after: filters?.startAfter || null,
        limit,
      },
    };
  }

  try {
    const result = await smartQuery<{ listings: RawListing[] }>(contract, query);
    return (result.listings || []).map(toListing);
  } catch {
    return [];
  }
}

export async function fetchListingDetail(listingId: string): Promise<MarketplaceListing | null> {
  const contract = MARKETPLACE_CONTRACTS.marketplace;
  if (!contract) return null;

  try {
    const result = await smartQuery<{ listing: RawListing }>(contract, {
      listing: { listing_id: listingId },
    });
    return toListing(result.listing);
  } catch {
    return null;
  }
}

export async function fetchMyListings(seller: string): Promise<MarketplaceListing[]> {
  return fetchListings({ seller });
}

export async function fetchFloorPrice(nftContract: string): Promise<string | null> {
  const listings = await fetchListings({ nftContract, limit: 1 });
  if (listings.length === 0) return null;
  return listings[0].price;
}

export async function fetchMarketplaceConfig(): Promise<MarketplaceConfig | null> {
  const contract = MARKETPLACE_CONTRACTS.marketplace;
  if (!contract) return null;

  try {
    const result = await smartQuery<RawConfig>(contract, { config: {} });
    return {
      treasury: result.treasury,
      royaltyBps: result.royalty_bps,
      acceptedNftContracts: result.accepted_nft_contracts,
      denom: result.denom,
      admin: result.admin,
      listingCount: result.listing_count,
    };
  } catch {
    return null;
  }
}

// ── Raw types (snake_case from chain) ───────────────────────────────────────

interface RawListing {
  listing_id: string;
  seller: string;
  nft_contract: string;
  token_id: string;
  listing_type: string;
  price: string;
  min_bid: string;
  current_bid: string;
  current_bidder: string | null;
  expires_at: number;
  is_active: boolean;
}

interface RawConfig {
  treasury: string;
  royalty_bps: number;
  accepted_nft_contracts: string[];
  denom: string;
  admin: string;
  listing_count: number;
}

function toListing(raw: RawListing): MarketplaceListing {
  return {
    listingId: raw.listing_id,
    seller: raw.seller,
    nftContract: raw.nft_contract,
    tokenId: raw.token_id,
    listingType: raw.listing_type === 'Auction' ? 'Auction' : 'FixedPrice',
    price: raw.price,
    minBid: raw.min_bid,
    currentBid: raw.current_bid,
    currentBidder: raw.current_bidder,
    expiresAt: raw.expires_at,
    isActive: raw.is_active,
  };
}
