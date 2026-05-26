import type { ColumnDef } from '@tanstack/react-table';
import { Crown, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { ExpValue } from '@/components/ExpValue';
import { MobLink } from '@/components/entity-links';
import type { MobRecord } from '@/db';
import {
  ELEMENT_GROUP_LABELS,
  ELEMENT_ORDER,
  ELEMENT_STATUS_CLASSES,
  elementsByStatus,
  type ElementStatus,
} from '@/lib/mobElements';

export const ELEMENT_ENUM_OPTIONS: readonly string[] = ELEMENT_ORDER;

/** Statuses that get their own column in the listing. Maps each to the
 *  public column id used in URL state and filter keys. */
const COLUMN_STATUSES: readonly { id: string; status: ElementStatus }[] = [
  { id: 'weakAgainst', status: 'weak' },
  { id: 'strongAgainst', status: 'resistant' },
  { id: 'immuneTo', status: 'immune' },
];

function ElementCell({ values, status }: { values: string[]; status: ElementStatus }) {
  if (values.length === 0) return <span className="text-muted-foreground">—</span>;
  return <span className={ELEMENT_STATUS_CLASSES[status]}>{values.join(', ')}</span>;
}

const elementColumns: ColumnDef<MobRecord>[] = COLUMN_STATUSES.map(({ id, status }) => ({
  id,
  header: ELEMENT_GROUP_LABELS[status],
  enableSorting: false,
  meta: { filter: 'enum' },
  cell: ({ row }) => (
    <ElementCell values={elementsByStatus(row.original.elementAttack, status)} status={status} />
  ),
}));

export const columns: ColumnDef<MobRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <EntityIcon
        entity="mob"
        id={row.original.id}
        size={28}
        placeholder={Skull}
        alt={row.original.name}
      />
    ),
  },
  {
    id: 'name',
    accessorFn: (m) => m.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <MobLink id={row.original.id} className="inline-flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.isBoss && (
          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <Crown className="h-3 w-3" />
            Boss
          </span>
        )}
      </MobLink>
    ),
  },
  {
    id: 'level',
    accessorFn: (m) => m.level,
    header: 'Level',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.level ?? '—',
  },
  {
    id: 'hp',
    accessorFn: (m) => m.hp,
    header: 'HP',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.hp?.toLocaleString() ?? '—',
  },
  {
    id: 'mp',
    accessorFn: (m) => m.mp,
    header: 'MP',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.mp?.toLocaleString() ?? '—',
  },
  {
    id: 'exp',
    accessorFn: (m) => m.exp,
    header: 'EXP',
    meta: { filter: 'number' },
    cell: ({ row }) => <ExpValue exp={row.original.exp} />,
  },
  ...elementColumns,
  {
    id: 'boss',
    accessorFn: (m) => m.isBoss,
    header: 'Boss',
    meta: { filter: 'boolean', booleanLabels: { trueLabel: 'Boss', falseLabel: 'Non-boss' } },
    cell: ({ row }) =>
      row.original.isBoss ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Crown className="h-3 w-3" />
          Boss
        </span>
      ) : (
        '—'
      ),
  },
  {
    id: 'id',
    accessorFn: (m) => m.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const defaultVisible = ['icon', 'name', 'level', 'hp', 'exp'] as const;
export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'level', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};
