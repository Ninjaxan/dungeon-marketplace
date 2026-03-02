use cosmwasm_std::{Deps, Order, StdResult};
use cw_storage_plus::Bound;

use crate::msg::{ConfigResponse, Listing, ListingResponse, ListingsResponse};
use crate::state::{ListingState, CONFIG, LISTINGS};

const DEFAULT_LIMIT: u32 = 20;
const MAX_LIMIT: u32 = 100;

pub fn query_listing(deps: Deps, listing_id: String) -> StdResult<ListingResponse> {
    let state = LISTINGS.load(deps.storage, &listing_id)?;
    Ok(ListingResponse {
        listing: to_listing(&listing_id, &state),
    })
}

pub fn query_listings_by_contract(
    deps: Deps,
    nft_contract: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListingsResponse> {
    let nft_addr = deps.api.addr_validate(&nft_contract)?;
    let limit = limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT) as usize;
    let start = start_after.as_deref().map(Bound::exclusive);

    let listings: Vec<Listing> = LISTINGS
        .range(deps.storage, start, None, Order::Ascending)
        .filter_map(|item| {
            let (id, state) = item.ok()?;
            if state.nft_contract == nft_addr && state.is_active {
                Some(to_listing(&id, &state))
            } else {
                None
            }
        })
        .take(limit)
        .collect();

    Ok(ListingsResponse { listings })
}

pub fn query_listings_by_seller(
    deps: Deps,
    seller: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListingsResponse> {
    let seller_addr = deps.api.addr_validate(&seller)?;
    let limit = limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT) as usize;
    let start = start_after.as_deref().map(Bound::exclusive);

    let listings: Vec<Listing> = LISTINGS
        .range(deps.storage, start, None, Order::Ascending)
        .filter_map(|item| {
            let (id, state) = item.ok()?;
            if state.seller == seller_addr && state.is_active {
                Some(to_listing(&id, &state))
            } else {
                None
            }
        })
        .take(limit)
        .collect();

    Ok(ListingsResponse { listings })
}

pub fn query_all_listings(
    deps: Deps,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<ListingsResponse> {
    let limit = limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT) as usize;
    let start = start_after.as_deref().map(Bound::exclusive);

    let listings: Vec<Listing> = LISTINGS
        .range(deps.storage, start, None, Order::Ascending)
        .filter_map(|item| {
            let (id, state) = item.ok()?;
            if state.is_active {
                Some(to_listing(&id, &state))
            } else {
                None
            }
        })
        .take(limit)
        .collect();

    Ok(ListingsResponse { listings })
}

pub fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        treasury: config.treasury.to_string(),
        royalty_bps: config.royalty_bps,
        accepted_nft_contracts: config
            .accepted_nft_contracts
            .iter()
            .map(|a| a.to_string())
            .collect(),
        denom: config.denom,
        admin: config.admin.to_string(),
        listing_count: config.next_listing_id,
    })
}

fn to_listing(id: &str, state: &ListingState) -> Listing {
    Listing {
        listing_id: id.to_string(),
        seller: state.seller.to_string(),
        nft_contract: state.nft_contract.to_string(),
        token_id: state.token_id.clone(),
        listing_type: state.listing_type.clone(),
        price: state.price,
        min_bid: state.min_bid,
        current_bid: state.current_bid,
        current_bidder: state.current_bidder.as_ref().map(|a| a.to_string()),
        expires_at: state.expires_at,
        is_active: state.is_active,
    }
}
