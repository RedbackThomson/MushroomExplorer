import { create } from 'zustand';

export type DataTableMobileLayout = 'cards' | 'table';

interface Store {
  /**
   * Layout used by data tables on viewports below the `md` breakpoint. Cards
   * are the default — tables don't fit phones comfortably. Power users can
   * flip this back to a horizontally-scrollable table.
   */
  layout: DataTableMobileLayout;
  setLayout: (next: DataTableMobileLayout) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'scrolled.dataTable.mobileLayout';

function read(): DataTableMobileLayout {
  if (typeof window === 'undefined') return 'cards';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'table' ? 'table' : 'cards';
}

function persist(v: DataTableMobileLayout) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, v);
}

export const useDataTableMobileLayout = create<Store>((set, get) => ({
  layout: read(),
  setLayout: (next) => {
    persist(next);
    set({ layout: next });
  },
  toggle: () => {
    const next: DataTableMobileLayout = get().layout === 'cards' ? 'table' : 'cards';
    persist(next);
    set({ layout: next });
  },
}));
