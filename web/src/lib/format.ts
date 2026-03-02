import { CHAIN } from './chain';

export function formatDenom(amount: string | number, denom?: string): string {
  const d = denom || CHAIN.denom;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (d === CHAIN.denom || d === `u${CHAIN.displayDenom.toLowerCase()}`) {
    const display = num / Math.pow(10, CHAIN.decimals);
    return `${formatNumber(display)} ${CHAIN.displayDenom}`;
  }
  return `${formatNumber(num)} ${d}`;
}

export function formatNumber(n: number, maxDecimals = 6): string {
  if (n === 0) return '0';
  const fixed = n.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, '');
  const parts = trimmed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function truncate(str: string, start = 8, end = 6): string {
  if (!str || str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}
