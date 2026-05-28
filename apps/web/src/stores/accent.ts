import { create } from 'zustand';
import { DEFAULT_ACCENT, isAccentName, type AccentName } from '@/lib/accents';
import { syncThemeColorMeta } from '@/lib/themeColorMeta';

interface AccentStore {
  accent: AccentName;
  setAccent: (accent: AccentName) => void;
}

const STORAGE_KEY = 'scrolled.accent';

function readInitial(): AccentName {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isAccentName(stored) ? stored : DEFAULT_ACCENT;
}

function apply(accent: AccentName): AccentName {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.accent = accent;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, accent);
  }
  syncThemeColorMeta();
  return accent;
}

const initialAccent = readInitial();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.accent = initialAccent;
  syncThemeColorMeta();
}

export const useAccent = create<AccentStore>((set) => ({
  accent: initialAccent,
  setAccent: (accent) => set({ accent: apply(accent) }),
}));
