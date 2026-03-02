use cosmwasm_schema::{cw_serde, QueryResponses};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// OpenSea-compatible trait for NFT attributes
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Trait {
    pub trait_type: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_type: Option<String>,
}

/// Metadata extension for Dungeon NFTs (heroes and gear)
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct DungeonNftExtension {
    pub name: String,
    pub description: String,
    /// IPFS URI (ipfs://Qm...)
    pub image: String,
    /// "hero" or "gear"
    pub asset_type: String,
    /// OpenSea-compatible trait list
    pub attributes: Vec<Trait>,
}

impl Default for DungeonNftExtension {
    fn default() -> Self {
        Self {
            name: String::new(),
            description: String::new(),
            image: String::new(),
            asset_type: String::new(),
            attributes: vec![],
        }
    }
}

/// CW721 contract type alias with our custom extension
pub type Cw721DungeonContract<'a> =
    cw721_base::Cw721Contract<'a, DungeonNftExtension, cosmwasm_std::Empty, cosmwasm_std::Empty, cosmwasm_std::Empty>;

pub type ExecuteMsg = cw721_base::ExecuteMsg<DungeonNftExtension, cosmwasm_std::Empty>;
pub type QueryMsg = cw721_base::QueryMsg<cosmwasm_std::Empty>;
pub type InstantiateMsg = cw721_base::InstantiateMsg;

/// Custom execute messages beyond CW721 base
#[cw_serde]
pub enum CustomExecuteMsg {
    /// Standard CW721 execute
    Base(ExecuteMsg),
    /// Update metadata for an existing token (minter only)
    UpdateMetadata {
        token_id: String,
        extension: DungeonNftExtension,
    },
}

/// Custom query messages
#[cw_serde]
#[derive(QueryResponses)]
pub enum CustomQueryMsg {
    /// Standard CW721 query passthrough
    #[returns(cosmwasm_std::Empty)]
    Base(QueryMsg),
}
