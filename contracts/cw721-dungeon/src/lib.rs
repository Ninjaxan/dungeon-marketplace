pub mod execute;
pub mod msg;
pub mod query;
pub mod state;

use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
};

use msg::{CustomExecuteMsg, Cw721DungeonContract, DungeonNftExtension, InstantiateMsg, QueryMsg};

const CONTRACT_NAME: &str = "crates.io:cw721-dungeon";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, cw721_base::ContractError> {
    cw2::set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    let contract = Cw721DungeonContract::default();
    contract.instantiate(deps, env, info, msg)
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: CustomExecuteMsg,
) -> Result<Response, cw721_base::ContractError> {
    match msg {
        CustomExecuteMsg::Base(base_msg) => {
            let contract = Cw721DungeonContract::default();
            contract.execute(deps, env, info, base_msg)
        }
        CustomExecuteMsg::UpdateMetadata {
            token_id,
            extension,
        } => execute::execute_update_metadata(deps, env, info, token_id, extension),
    }
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    let contract = Cw721DungeonContract::default();
    contract.query(deps, env, msg)
}
