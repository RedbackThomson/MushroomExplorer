import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function TopBar() {
  return (
    <header className="border-border bg-background sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
      <div className="relative max-w-xl flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Search items, mobs, NPCs, maps…"
          className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
          aria-label="Global search"
        />
      </div>
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
