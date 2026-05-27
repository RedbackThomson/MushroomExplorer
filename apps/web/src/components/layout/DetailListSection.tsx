import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface DetailListSectionProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  children?: ReactNode;
}

export function DetailListSection({
  icon: Icon,
  title,
  count,
  action,
  isLoading,
  isEmpty,
  emptyLabel = 'None.',
  loadingLabel,
  children,
}: DetailListSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <Icon className="h-4 w-4" /> {title}
          {count !== undefined && (
            <span className="text-muted-foreground text-xs normal-case">({count})</span>
          )}
        </h2>
        {action}
      </div>
      {isLoading && (
        <p className="text-muted-foreground text-xs">
          {loadingLabel ?? `Loading ${title.toLowerCase()}…`}
        </p>
      )}
      {!isLoading && isEmpty && (
        <p className="text-muted-foreground text-xs italic">{emptyLabel}</p>
      )}
      {!isLoading && !isEmpty && children !== undefined && children !== null && (
        <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
          {children}
        </ul>
      )}
    </section>
  );
}
