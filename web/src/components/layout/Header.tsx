'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './WalletButton';

const NAV = [
  { href: '/', label: 'Browse' },
  { href: '/marketplace/sell', label: 'Sell' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="text-xl font-bold text-accent-gold">
                Dungeon Marketplace
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-0.5">
              {NAV.map(({ href, label }) => {
                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'text-accent-gold bg-accent-gold/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              <a
                href="https://explorer.dungeongames.io"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              >
                Explorer
              </a>
            </nav>
          </div>

          <WalletButton />
        </div>
      </div>
    </header>
  );
}
