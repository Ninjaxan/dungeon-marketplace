'use client';

import { useState, useEffect } from 'react';
import { connectWallet, disconnectWallet, getSavedAddress } from '@/lib/wallet';
import { truncate } from '@/lib/format';

export function WalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setAddress(getSavedAddress());
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (err) {
      console.error('Wallet connect failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setAddress(null);
  };

  if (address) {
    return (
      <button
        onClick={handleDisconnect}
        className="px-3 py-1.5 rounded-lg text-sm bg-bg-tertiary border border-border text-text-primary hover:border-border-glow transition-colors cursor-pointer"
      >
        {truncate(address)}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="px-4 py-1.5 rounded-lg text-sm bg-accent-gold text-bg-primary font-medium hover:bg-accent-gold/90 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
