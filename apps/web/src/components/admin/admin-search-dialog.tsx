'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@sailent/ui';

import { adminNav } from './admin-sidebar';

export function AdminSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');

  const allItems = React.useMemo(() => {
    return adminNav.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupLabel: group.label,
      })),
    );
  }, []);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupLabel.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    setQuery('');
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-border border-b px-4 py-3">
          <DialogTitle className="sr-only">Quick Jump</DialogTitle>
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a section name or command..."
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No destinations found.</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.href)}
                      className="hover:bg-muted flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-foreground font-medium">{item.label}</span>
                      </div>
                      <span className="text-muted-foreground text-[0.6875rem]">
                        {item.groupLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
