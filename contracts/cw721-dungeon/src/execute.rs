use cosmwasm_std::{DepsMut, Env, MessageInfo, Response, StdError};
use cw721_base::state::TokenInfo;

use crate::msg::{Cw721DungeonContract, DungeonNftExtension};

/// Update metadata for an existing token. Only the minter can call this.
pub fn execute_update_metadata(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    token_id: String,
    extension: DungeonNftExtension,
) -> Result<Response, cw721_base::ContractError> {
    let contract = Cw721DungeonContract::default();

    // Only minter can update metadata
    let minter = contract.minter(deps.as_ref())?;
    if minter.minter.as_deref() != Some(info.sender.as_str()) {
        return Err(cw721_base::ContractError::Ownership(
            cw721_base::OwnershipError::NotOwner,
        ));
    }

    // Load existing token, update extension
    contract.tokens.update(
        deps.storage,
        &token_id,
        |tok| -> Result<TokenInfo<DungeonNftExtension>, StdError> {
            let mut token = tok.ok_or_else(|| StdError::not_found("token"))?;
            token.extension = extension;
            Ok(token)
        },
    )?;

    Ok(Response::new()
        .add_attribute("action", "update_metadata")
        .add_attribute("token_id", token_id))
}
