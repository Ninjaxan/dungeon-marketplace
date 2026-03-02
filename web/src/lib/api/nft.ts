import { rest } from './client';
import { ENDPOINTS } from '../chain';

export interface NftAttribute {
  trait_type: string;
  value: string;
}

export interface NftInfo {
  name: string;
  description: string;
  image: string;
  attributes: NftAttribute[];
}

async function smartQuery<T>(contract: string, query: object): Promise<T> {
  const queryJson = JSON.stringify(query);
  const queryBase64 = btoa(queryJson);
  const path = ENDPOINTS.contractSmartQuery(contract, queryBase64);
  const res = await rest.get<{ data: T }>(path, { revalidate: 30 });
  return res.data;
}

export async function fetchNftInfo(contract: string, tokenId: string): Promise<NftInfo> {
  const result = await smartQuery<{ extension: NftInfo }>(contract, {
    nft_info: { token_id: tokenId },
  });
  return result.extension;
}

export async function fetchTokensByOwner(
  contract: string,
  owner: string,
  limit = 30,
  startAfter?: string
): Promise<{ tokens: string[] }> {
  const query: Record<string, unknown> = { tokens: { owner, limit } };
  if (startAfter) {
    (query.tokens as Record<string, unknown>).start_after = startAfter;
  }
  return smartQuery<{ tokens: string[] }>(contract, query);
}

export function resolveIpfsUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  return url;
}
