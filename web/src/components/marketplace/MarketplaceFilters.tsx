'use client';

interface Props {
  activeTab: 'all' | 'heroes' | 'gear';
  onTabChange: (tab: 'all' | 'heroes' | 'gear') => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const TABS = [
  { value: 'all' as const, label: 'All' },
  { value: 'heroes' as const, label: 'Heroes' },
  { value: 'gear' as const, label: 'Gear' },
];

const SORT_OPTIONS = [
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'recent', label: 'Recently Listed' },
  { value: 'ending', label: 'Ending Soon' },
];

export function MarketplaceFilters({ activeTab, onTabChange, sortBy, onSortChange }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Type tabs */}
      <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
              activeTab === tab.value
                ? 'bg-accent-gold/20 text-accent-gold font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <select
        value={sortBy}
        onChange={e => onSortChange(e.target.value)}
        className="bg-bg-tertiary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-glow"
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
