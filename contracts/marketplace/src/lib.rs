pub mod error;
pub mod execute;
pub mod msg;
pub mod query;
pub mod state;

use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
};

use error::ContractError;
use msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use state::{Config, CONFIG};

const CONTRACT_NAME: &str = "crates.io:dungeon-marketplace";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    cw2::set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    if msg.royalty_bps > 5000 {
        return Err(ContractError::InvalidRoyaltyBps {
            bps: msg.royalty_bps,
        });
    }

    let accepted = msg
        .accepted_nft_contracts
        .iter()
        .map(|c| deps.api.addr_validate(c))
        .collect::<StdResult<Vec<_>>>()?;

    let config = Config {
        admin: info.sender,
        treasury: deps.api.addr_validate(&msg.treasury)?,
        royalty_bps: msg.royalty_bps,
        accepted_nft_contracts: accepted,
        denom: msg.denom,
        next_listing_id: 1,
    };

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::ListNft {
            nft_contract,
            token_id,
            listing_type,
            price,
            min_bid,
            duration_secs,
        } => execute::execute_list_nft(
            deps,
            env,
            info,
            nft_contract,
            token_id,
            listing_type,
            price,
            min_bid,
            duration_secs,
        ),
        ExecuteMsg::Buy { listing_id } => execute::execute_buy(deps, env, info, listing_id),
        ExecuteMsg::Bid { listing_id } => execute::execute_bid(deps, env, info, listing_id),
        ExecuteMsg::CancelListing { listing_id } => {
            execute::execute_cancel_listing(deps, env, info, listing_id)
        }
        ExecuteMsg::SettleAuction { listing_id } => {
            execute::execute_settle_auction(deps, env, info, listing_id)
        }
        ExecuteMsg::UpdateConfig {
            treasury,
            royalty_bps,
            accepted_nft_contracts,
        } => execute::execute_update_config(
            deps,
            env,
            info,
            treasury,
            royalty_bps,
            accepted_nft_contracts,
        ),
    }
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Listing { listing_id } => {
            to_json_binary(&query::query_listing(deps, listing_id)?)
        }
        QueryMsg::ListingsByContract {
            nft_contract,
            start_after,
            limit,
        } => to_json_binary(&query::query_listings_by_contract(
            deps,
            nft_contract,
            start_after,
            limit,
        )?),
        QueryMsg::ListingsBySeller {
            seller,
            start_after,
            limit,
        } => to_json_binary(&query::query_listings_by_seller(
            deps,
            seller,
            start_after,
            limit,
        )?),
        QueryMsg::AllListings {
            start_after,
            limit,
        } => to_json_binary(&query::query_all_listings(deps, start_after, limit)?),
        QueryMsg::Config {} => to_json_binary(&query::query_config(deps)?),
    }
}
