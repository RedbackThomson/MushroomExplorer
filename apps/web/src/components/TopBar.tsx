import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';
import { Button } from '@/components/ui/button';
import { useSidebarLayout } from '@/stores/sidebarState';

export function TopBar() {
  const setMobileOpen = useSidebarLayout((s) => s.setMobileOpen);
  return (
    <header className="border-border bg-background sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-2 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation menu"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="max-w-xl flex-1">
        <PaletteTrigger />
      </div>
      <div className="hidden flex-1 md:block" />
      <ThemeToggle />
    </header>
  );
}
