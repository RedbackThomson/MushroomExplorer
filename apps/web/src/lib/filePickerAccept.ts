// iOS Safari maps `accept` tokens to UTIs and greys out anything that doesn't
// match. SQLite files have no registered UTI on iOS/macOS (only a `dyn.*`),
// so any non-empty accept list filters them out entirely. Drop accept on iOS
// so the user can actually pick the file; desktop keeps the strict filter.

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel; touch points disambiguate from real Macs.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function acceptForDesktop(desktopAccept: string): string | undefined {
  return isIOS() ? undefined : desktopAccept;
}
