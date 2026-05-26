import { useServerProfile } from '@/lib/useServerProfile';

/**
 * Renders an EXP value adjusted by the active server profile's EXP rate. Pass
 * the canonical (base) EXP from the WZ data; this applies the multiplier at
 * render time so every EXP display stays in sync with the selected profile.
 */
export function ExpValue({
  exp,
  showRate = false,
}: {
  exp: number | null;
  /** Append a muted `N×` badge when the effective rate isn't 1. */
  showRate?: boolean;
}) {
  const { applyExp, expRate } = useServerProfile();
  const adjusted = applyExp(exp);
  if (adjusted === null) return <>—</>;
  return (
    <span>
      {adjusted.toLocaleString()}
      {showRate && expRate !== 1 && (
        <span className="text-muted-foreground ml-1.5 text-xs">{expRate}×</span>
      )}
    </span>
  );
}
