use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Uint128;

#[cw_serde]
pub struct InstantiateMsg {
    /// Treasury address for royalty payments
    pub treasury: String,
    /// Royalty in basis points (500 = 5%)
    pub royalty_bps: u16,
    /// Accepted CW721 contract addresses
    pub accepted_nft_contracts: Vec<String>,
    /// Accepted payment denom (e.g. "udgn")
    pub denom: String,
}

#[cw_serde]
pub enum ListingType {
    FixedPrice,
    Auction,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// List an NFT for sale. Caller must have approved marketplace to transfer.
    ListNft {
        nft_contract: String,
        token_id: String,
        listing_type: ListingType,
        /// Price for fixed-price, or starting price for auction
        price: Uint128,
        /// Minimum bid increment (auction only)
        min_bid: Option<Uint128>,
        /// Duration in seconds (auction only, 0 = no expiry for fixed price)
        duration_secs: u64,
    },
    /// Buy a fixed-price listing. Send exact price in funds.
    Buy {
        listing_id: String,
    },
    /// Place a bid on an auction listing. Send bid amount in funds.
    Bid {
        listing_id: String,
    },
    /// Cancel a listing. Only the seller can cancel.
    CancelListing {
        listing_id: String,
    },
    /// Settle an expired auction. Anyone can call after expiry.
    SettleAuction {
        listing_id: String,
    },
    /// Admin: update accepted NFT contracts
    UpdateConfig {
        treasury: Option<String>,
        royalty_bps: Option<u16>,
        accepted_nft_contracts: Option<Vec<String>>,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    /// Get a single listing
    #[returns(ListingResponse)]
    Listing { listing_id: String },
    /// Browse listings by NFT contract
    #[returns(ListingsResponse)]
    ListingsByContract {
        nft_contract: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    /// Get listings by seller
    #[returns(ListingsResponse)]
    ListingsBySeller {
        seller: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    /// Get all active listings
    #[returns(ListingsResponse)]
    AllListings {
        start_after: Option<String>,
        limit: Option<u32>,
    },
    /// Get marketplace config
    #[returns(ConfigResponse)]
    Config {},
}

#[cw_serde]
pub struct ListingResponse {
    pub listing: Listing,
}

#[cw_serde]
pub struct ListingsResponse {
    pub listings: Vec<Listing>,
}

#[cw_serde]
pub struct ConfigResponse {
    pub treasury: String,
    pub royalty_bps: u16,
    pub accepted_nft_contracts: Vec<String>,
    pub denom: String,
    pub admin: String,
    pub listing_count: u64,
}

#[cw_serde]
pub struct Listing {
    pub listing_id: String,
    pub seller: String,
    pub nft_contract: String,
    pub token_id: String,
    pub listing_type: ListingType,
    pub price: Uint128,
    pub min_bid: Uint128,
    pub current_bid: Uint128,
    pub current_bidder: Option<String>,
    pub expires_at: u64,
    pub is_active: bool,
}
