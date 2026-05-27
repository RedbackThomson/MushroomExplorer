import type { ColumnDef } from '@tanstack/react-table';
import { ItemIcon } from '@/components/ItemIcon';
import { EquipLink } from '@/components/entity-links';
import type { EquipRecord } from '@/db';
import { ABILITY_STAT_FIELDS } from '@/lib/abilityStats';
import { labelForEquipType } from '@/lib/equipTypes';
import { isAnyClass, parseReqJob } from '@/lib/equipJobs';

const num = (v: number | null) => (v === null ? '—' : v.toLocaleString());

/** Keys of `EquipRecord` whose value is a nullable number. */
type NumericEquipKey = {
  [K in keyof EquipRecord]: EquipRecord[K] extends number | null ? K : never;
}[keyof EquipRecord];

/** A right-aligned, number-filterable column for one numeric equip stat. */
const statColumn = (id: NumericEquipKey, header: string): ColumnDef<EquipRecord> => ({
  id,
  accessorFn: (e) => e[id],
  header,
  meta: { filter: 'number' },
  cell: ({ row }) => num(row.original[id]),
});

export const columns: ColumnDef<EquipRecord>[] = [
  {
    id: 'icon',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <ItemIcon entity="equip" id={row.original.id} size={28} alt={row.original.name} />
    ),
  },
  {
    id: 'name',
    accessorFn: (e) => e.name,
    header: 'Name',
    meta: { filter: 'string' },
    cell: ({ row }) => (
      <EquipLink id={row.original.id} className="font-medium">
        {row.original.name}
      </EquipLink>
    ),
  },
  {
    id: 'equipType',
    accessorFn: (e) => e.equipType,
    header: 'Type',
    meta: { filter: 'enum' },
    cell: ({ row }) => (row.original.equipType ? labelForEquipType(row.original.equipType) : '—'),
  },
  {
    id: 'cash',
    accessorFn: (e) => e.cash,
    header: 'Cash',
    meta: { filter: 'boolean', booleanLabels: { trueLabel: 'Cash', falseLabel: 'Regular' } },
    cell: ({ row }) =>
      row.original.cash ? (
        <span className="inline-flex items-center rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-300">
          Cash
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">Regular</span>
      ),
  },
  {
    id: 'requiredLevel',
    accessorFn: (e) => e.requiredLevel,
    header: 'Req Lv',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.requiredLevel ?? '—',
  },
  ...ABILITY_STAT_FIELDS.map((s) => statColumn(s.required, `Req ${s.label}`)),
  {
    id: 'requiredJob',
    accessorFn: (e) => e.requiredJob,
    header: 'Class',
    enableSorting: false,
    meta: { filter: 'enum' },
    cell: ({ row }) => {
      const jobs = parseReqJob(row.original.requiredJob);
      if (isAnyClass(jobs)) {
        return <span className="text-muted-foreground text-xs">Any</span>;
      }
      return <span className="text-xs">{jobs.join(', ')}</span>;
    },
  },
  statColumn('attack', 'Atk'),
  statColumn('magicAttack', 'M.Atk'),
  ...ABILITY_STAT_FIELDS.map((s) => statColumn(s.inc, s.label)),
  statColumn('incHp', 'HP'),
  statColumn('incMp', 'MP'),
  statColumn('defense', 'Def'),
  statColumn('magicDefense', 'M.Def'),
  statColumn('accuracy', 'Acc'),
  statColumn('avoidability', 'Avoid'),
  statColumn('incSpeed', 'Speed'),
  statColumn('incJump', 'Jump'),
  {
    id: 'upgradeSlots',
    accessorFn: (e) => e.upgradeSlots,
    header: 'Slots',
    meta: { filter: 'number' },
    cell: ({ row }) => row.original.upgradeSlots ?? '—',
  },
  {
    id: 'id',
    accessorFn: (e) => e.id,
    header: 'ID',
    meta: { filter: 'number' },
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
  },
];

export const pinnedColumns = ['icon'] as const;
export const defaultSort = { id: 'requiredLevel', dir: 'asc' } as const satisfies {
  id: string;
  dir: 'asc' | 'desc';
};

/**
 * Magic-attack weapons used by INT classes — defaults should surface
 * `magicAttack` instead of `attack`. Listed by equip-type slug so the
 * route can pick the column set without case-by-case branches.
 */
const MAGIC_WEAPON_TYPES = new Set(['wand', 'staff']);

const PHYSICAL_DEFAULT = [
  'icon',
  'name',
  'equipType',
  'cash',
  'requiredLevel',
  'requiredJob',
  'attack',
  'requiredDex',
  'upgradeSlots',
] as const;

const MAGIC_DEFAULT = [
  'icon',
  'name',
  'equipType',
  'cash',
  'requiredLevel',
  'requiredJob',
  'magicAttack',
  'upgradeSlots',
] as const;

// Cash-shop weapons are cosmetic overlays with no stats, so the default
// columns drop attack/accuracy/slots and just surface the cash badge.
const CASH_DEFAULT = ['icon', 'name', 'equipType', 'cash'] as const;

/**
 * Pick the default visible-column set based on the active weapon-type
 * filter. When no single type is pinned (or it's an unknown slug), the
 * physical default is fine — it still surfaces M.Atk via column toggle.
 */
export function defaultVisibleForType(type: string | null): readonly string[] {
  if (type === 'cash-weapon') return CASH_DEFAULT;
  if (type && MAGIC_WEAPON_TYPES.has(type)) return MAGIC_DEFAULT;
  return PHYSICAL_DEFAULT;
}
