use cosmwasm_std::{
    to_json_binary, Addr, BankMsg, Coin, CosmosMsg, DepsMut, Env, MessageInfo, Response, Uint128,
    WasmMsg,
};

use crate::error::ContractError;
use crate::msg::ListingType;
use crate::state::{Config, ListingState, CONFIG, LISTINGS};

pub fn execute_list_nft(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    nft_contract: String,
    token_id: String,
    listing_type: ListingType,
    price: Uint128,
    min_bid: Option<Uint128>,
    duration_secs: u64,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    let nft_addr = deps.api.addr_validate(&nft_contract)?;
    if !config.accepted_nft_contracts.contains(&nft_addr) {
        return Err(ContractError::NftContractNotAccepted {
            contract: nft_contract,
        });
    }

    let listing_id = config.next_listing_id.to_string();
    config.next_listing_id += 1;
    CONFIG.save(deps.storage, &config)?;

    let expires_at = if duration_secs > 0 {
        env.block.time.seconds() + duration_secs
    } else {
        0 // no expiry for fixed price
    };

    let listing = ListingState {
        seller: info.sender.clone(),
        nft_contract: nft_addr.clone(),
        token_id: token_id.clone(),
        listing_type,
        price,
        min_bid: min_bid.unwrap_or(Uint128::one()),
        current_bid: Uint128::zero(),
        current_bidder: None,
        expires_at,
        is_active: true,
    };

    LISTINGS.save(deps.storage, &listing_id, &listing)?;

    // Transfer NFT from seller to marketplace (escrow)
    let transfer_msg = CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: nft_addr.to_string(),
        msg: to_json_binary(&cw721::Cw721ExecuteMsg::TransferNft {
            recipient: env.contract.address.to_string(),
            token_id: token_id.clone(),
        })?,
        funds: vec![],
    });

    Ok(Response::new()
        .add_message(transfer_msg)
        .add_attribute("action", "list_nft")
        .add_attribute("listing_id", listing_id)
        .add_attribute("seller", info.sender)
        .add_attribute("token_id", token_id))
}

pub fn execute_buy(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    listing_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let listing = LISTINGS
        .load(deps.storage, &listing_id)
        .map_err(|_| ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;

    if !listing.is_active {
        return Err(ContractError::ListingInactive {});
    }

    if listing.listing_type == ListingType::Auction {
        return Err(ContractError::CannotBuyAuction {});
    }

    if listing.expires_at > 0 && env.block.time.seconds() > listing.expires_at {
        return Err(ContractError::ListingExpired {});
    }

    // Check payment
    let sent = info
        .funds
        .iter()
        .find(|c| c.denom == config.denom)
        .map(|c| c.amount)
        .unwrap_or_default();

    if sent < listing.price {
        return Err(ContractError::InsufficientFunds {
            sent: sent.u128(),
            required: listing.price.u128(),
        });
    }

    // Mark inactive
    LISTINGS.update(deps.storage, &listing_id, |l| -> Result<_, ContractError> {
        let mut l = l.ok_or(ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;
        l.is_active = false;
        Ok(l)
    })?;

    // Calculate royalty split
    let (treasury_msgs, seller_msgs) =
        split_payment(&config, &listing.seller, listing.price, &config.denom);

    // Transfer NFT to buyer
    let transfer_nft = CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: listing.nft_contract.to_string(),
        msg: to_json_binary(&cw721::Cw721ExecuteMsg::TransferNft {
            recipient: info.sender.to_string(),
            token_id: listing.token_id.clone(),
        })?,
        funds: vec![],
    });

    Ok(Response::new()
        .add_message(transfer_nft)
        .add_messages(treasury_msgs)
        .add_messages(seller_msgs)
        .add_attribute("action", "buy")
        .add_attribute("listing_id", listing_id)
        .add_attribute("buyer", info.sender)
        .add_attribute("price", listing.price))
}

pub fn execute_bid(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    listing_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let listing = LISTINGS
        .load(deps.storage, &listing_id)
        .map_err(|_| ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;

    if !listing.is_active {
        return Err(ContractError::ListingInactive {});
    }

    if listing.listing_type == ListingType::FixedPrice {
        return Err(ContractError::CannotBidFixedPrice {});
    }

    if listing.expires_at > 0 && env.block.time.seconds() > listing.expires_at {
        return Err(ContractError::ListingExpired {});
    }

    if info.sender == listing.seller {
        return Err(ContractError::CannotBidOnOwnListing {});
    }

    let sent = info
        .funds
        .iter()
        .find(|c| c.denom == config.denom)
        .map(|c| c.amount)
        .unwrap_or_default();

    // Bid must exceed current bid + min_bid increment
    let min_required = if listing.current_bid.is_zero() {
        listing.price
    } else {
        listing.current_bid + listing.min_bid
    };

    if sent < min_required {
        return Err(ContractError::BidTooLow {
            current: listing.current_bid.u128(),
        });
    }

    // Refund previous bidder
    let mut msgs: Vec<CosmosMsg> = vec![];
    if let Some(prev_bidder) = &listing.current_bidder {
        if !listing.current_bid.is_zero() {
            msgs.push(CosmosMsg::Bank(BankMsg::Send {
                to_address: prev_bidder.to_string(),
                amount: vec![Coin {
                    denom: config.denom.clone(),
                    amount: listing.current_bid,
                }],
            }));
        }
    }

    // Update listing with new bid
    LISTINGS.update(deps.storage, &listing_id, |l| -> Result<_, ContractError> {
        let mut l = l.ok_or(ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;
        l.current_bid = sent;
        l.current_bidder = Some(info.sender.clone());
        Ok(l)
    })?;

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "bid")
        .add_attribute("listing_id", listing_id)
        .add_attribute("bidder", info.sender)
        .add_attribute("amount", sent))
}

pub fn execute_cancel_listing(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    listing_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let listing = LISTINGS
        .load(deps.storage, &listing_id)
        .map_err(|_| ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;

    if !listing.is_active {
        return Err(ContractError::ListingInactive {});
    }

    if info.sender != listing.seller {
        return Err(ContractError::Unauthorized {});
    }

    // Mark inactive
    LISTINGS.update(deps.storage, &listing_id, |l| -> Result<_, ContractError> {
        let mut l = l.ok_or(ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;
        l.is_active = false;
        Ok(l)
    })?;

    let mut msgs: Vec<CosmosMsg> = vec![];

    // Return NFT to seller
    msgs.push(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: listing.nft_contract.to_string(),
        msg: to_json_binary(&cw721::Cw721ExecuteMsg::TransferNft {
            recipient: listing.seller.to_string(),
            token_id: listing.token_id.clone(),
        })?,
        funds: vec![],
    }));

    // Refund current bidder if auction
    if let Some(bidder) = &listing.current_bidder {
        if !listing.current_bid.is_zero() {
            msgs.push(CosmosMsg::Bank(BankMsg::Send {
                to_address: bidder.to_string(),
                amount: vec![Coin {
                    denom: config.denom,
                    amount: listing.current_bid,
                }],
            }));
        }
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "cancel_listing")
        .add_attribute("listing_id", listing_id))
}

pub fn execute_settle_auction(
    deps: DepsMut,
    env: Env,
    _info: MessageInfo,
    listing_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let listing = LISTINGS
        .load(deps.storage, &listing_id)
        .map_err(|_| ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;

    if !listing.is_active {
        return Err(ContractError::ListingInactive {});
    }

    if listing.expires_at == 0 || env.block.time.seconds() < listing.expires_at {
        return Err(ContractError::ListingNotExpired {});
    }

    // Mark inactive
    LISTINGS.update(deps.storage, &listing_id, |l| -> Result<_, ContractError> {
        let mut l = l.ok_or(ContractError::ListingNotFound {
            listing_id: listing_id.clone(),
        })?;
        l.is_active = false;
        Ok(l)
    })?;

    let mut msgs: Vec<CosmosMsg> = vec![];

    if let Some(winner) = &listing.current_bidder {
        // Transfer NFT to winner
        msgs.push(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: listing.nft_contract.to_string(),
            msg: to_json_binary(&cw721::Cw721ExecuteMsg::TransferNft {
                recipient: winner.to_string(),
                token_id: listing.token_id.clone(),
            })?,
            funds: vec![],
        }));

        // Pay seller (minus royalty)
        let (treasury_msgs, seller_msgs) =
            split_payment(&config, &listing.seller, listing.current_bid, &config.denom);
        msgs.extend(treasury_msgs);
        msgs.extend(seller_msgs);
    } else {
        // No bids — return NFT to seller
        msgs.push(CosmosMsg::Wasm(WasmMsg::Execute {
            contract_addr: listing.nft_contract.to_string(),
            msg: to_json_binary(&cw721::Cw721ExecuteMsg::TransferNft {
                recipient: listing.seller.to_string(),
                token_id: listing.token_id.clone(),
            })?,
            funds: vec![],
        }));
    }

    Ok(Response::new()
        .add_messages(msgs)
        .add_attribute("action", "settle_auction")
        .add_attribute("listing_id", listing_id))
}

pub fn execute_update_config(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    treasury: Option<String>,
    royalty_bps: Option<u16>,
    accepted_nft_contracts: Option<Vec<String>>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(t) = treasury {
        config.treasury = deps.api.addr_validate(&t)?;
    }

    if let Some(bps) = royalty_bps {
        if bps > 5000 {
            return Err(ContractError::InvalidRoyaltyBps { bps });
        }
        config.royalty_bps = bps;
    }

    if let Some(contracts) = accepted_nft_contracts {
        config.accepted_nft_contracts = contracts
            .iter()
            .map(|c| deps.api.addr_validate(c))
            .collect::<Result<Vec<_>, _>>()?;
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new().add_attribute("action", "update_config"))
}

/// Split a payment into treasury royalty and seller proceeds.
fn split_payment(
    config: &Config,
    seller: &Addr,
    total: Uint128,
    denom: &str,
) -> (Vec<CosmosMsg>, Vec<CosmosMsg>) {
    let royalty = total.multiply_ratio(config.royalty_bps as u128, 10_000u128);
    let seller_amount = total - royalty;

    let mut treasury_msgs = vec![];
    let mut seller_msgs = vec![];

    if !royalty.is_zero() {
        treasury_msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: config.treasury.to_string(),
            amount: vec![Coin {
                denom: denom.to_string(),
                amount: royalty,
            }],
        }));
    }

    if !seller_amount.is_zero() {
        seller_msgs.push(CosmosMsg::Bank(BankMsg::Send {
            to_address: seller.to_string(),
            amount: vec![Coin {
                denom: denom.to_string(),
                amount: seller_amount,
            }],
        }));
    }

    (treasury_msgs, seller_msgs)
}
