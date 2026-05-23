import { NavLink } from 'react-router-dom';
import {
  Package,
  Shield,
  Skull,
  Users,
  Map as MapIcon,
  ScrollText,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSection {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: { label: string; to: string }[];
}

const sections: SidebarSection[] = [
  { label: 'Home', to: '/', icon: Home },
  {
    label: 'Items',
    to: '/items',
    icon: Package,
    children: [
      { label: 'Use', to: '/items?category=use' },
      { label: 'Setup', to: '/items?category=setup' },
      { label: 'Etc', to: '/items?category=etc' },
      { label: 'Cash', to: '/items?category=cash' },
    ],
  },
  {
    label: 'Equips',
    to: '/equips',
    icon: Shield,
    children: [
      { label: 'Weapons', to: '/equips?slot=weapon' },
      { label: 'Armor', to: '/equips?slot=armor' },
      { label: 'Accessories', to: '/equips?slot=accessory' },
    ],
  },
  { label: 'Mobs', to: '/mobs', icon: Skull },
  { label: 'NPCs', to: '/npcs', icon: Users },
  { label: 'Maps', to: '/maps', icon: MapIcon },
  { label: 'Quests', to: '/quests', icon: ScrollText },
];

export function Sidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-border hidden w-60 shrink-0 border-r md:flex md:flex-col">
      <div className="border-border flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded font-bold">
          M
        </div>
        <span className="font-semibold tracking-tight">Mushroom</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </NavLink>
              {section.children && (
                <ul className="border-border ml-6 mt-1 space-y-0.5 border-l pl-3">
                  {section.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          cn(
                            'block rounded px-2 py-1 text-xs transition-colors',
                            isActive
                              ? 'text-foreground'
                              : 'text-sidebar-muted hover:text-foreground',
                          )
                        }
                      >
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-border text-sidebar-muted border-t p-3 text-xs">
        Pre-alpha · Phase 0
      </div>
    </aside>
  );
}
