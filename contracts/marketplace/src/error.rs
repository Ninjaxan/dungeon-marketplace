use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Listing not found: {listing_id}")]
    ListingNotFound { listing_id: String },

    #[error("Listing expired")]
    ListingExpired {},

    #[error("Listing not expired yet")]
    ListingNotExpired {},

    #[error("Listing already sold or cancelled")]
    ListingInactive {},

    #[error("Insufficient funds: sent {sent}, required {required}")]
    InsufficientFunds { sent: u128, required: u128 },

    #[error("Bid must exceed current bid of {current}")]
    BidTooLow { current: u128 },

    #[error("Cannot buy auction listing, use bid instead")]
    CannotBuyAuction {},

    #[error("Cannot bid on fixed-price listing")]
    CannotBidFixedPrice {},

    #[error("NFT contract not accepted: {contract}")]
    NftContractNotAccepted { contract: String },

    #[error("Invalid royalty basis points: {bps}")]
    InvalidRoyaltyBps { bps: u16 },

    #[error("Cannot bid on own listing")]
    CannotBidOnOwnListing {},
}
