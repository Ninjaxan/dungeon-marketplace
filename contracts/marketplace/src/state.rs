use cosmwasm_std::{Addr, Uint128};
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::msg::ListingType;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub admin: Addr,
    pub treasury: Addr,
    pub royalty_bps: u16,
    pub accepted_nft_contracts: Vec<Addr>,
    pub denom: String,
    pub next_listing_id: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ListingState {
    pub seller: Addr,
    pub nft_contract: Addr,
    pub token_id: String,
    pub listing_type: ListingType,
    pub price: Uint128,
    pub min_bid: Uint128,
    pub current_bid: Uint128,
    pub current_bidder: Option<Addr>,
    pub expires_at: u64,
    pub is_active: bool,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const LISTINGS: Map<&str, ListingState> = Map::new("listings");
