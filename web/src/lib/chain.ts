export const CHAIN = {
  chainId: 'dungeon-1',
  chainName: 'Dungeon Chain',
  denom: 'udgn',
  displayDenom: 'DGN',
  decimals: 6,
  prefix: 'dungeon',
  rest: 'https://rest.cosmos.directory/dungeon',
  rpc: 'https://rpc.cosmos.directory/dungeon',
} as const;

export const ENDPOINTS = {
  contractSmartQuery: (addr: string, queryBase64: string) =>
    `/cosmwasm/wasm/v1/contract/${addr}/smart/${queryBase64}`,
};
