import { Package } from 'lucide-react';
import { useIcon } from '@/lib/useIcon';
import { cn } from '@/lib/utils';

interface Props {
  path: string | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders a WZ-decoded icon, falling back to a neutral placeholder while
 * loading or when the path is missing/undecodable.
 */
export function ItemIcon({ path, size = 32, className, alt }: Props) {
  const url = useIcon(path);
  const dim = `${size}px`;
  if (!url) {
    return (
      <span
        className={cn(
          'bg-muted text-muted-foreground inline-flex items-center justify-center rounded',
          className,
        )}
        style={{ width: dim, height: dim }}
        aria-hidden={!alt}
        aria-label={alt}
      >
        <Package className="h-1/2 w-1/2 opacity-60" />
      </span>
    );
  }
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt={alt ?? ''}
      className={cn('inline-block rounded', className)}
      style={{ width: dim, height: dim }}
    />
  );
}
