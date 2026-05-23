import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ScrollText, Search } from 'lucide-react';
import { getDbClient } from '@/db';

export default function Quests() {
  const client = useMemo(() => getDbClient(), []);
  const [search, setSearch] = useState('');
  const [parent, setParent] = useState<string>('');

  const parentsQ = useQuery({
    queryKey: ['db', 'quest-parents'],
    queryFn: () => client.listQuestParents(),
  });

  const questsQ = useQuery({
    queryKey: ['db', 'quests', { search, parent }],
    queryFn: () =>
      client.listQuests({
        search: search || undefined,
        parent: parent || undefined,
        limit: 1000,
      }),
  });

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Quests</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Quest metadata, requirements, and rewards extracted from{' '}
          <code className="font-mono text-xs">Quest.wz</code>, names joined from{' '}
          <code className="font-mono text-xs">String.wz/Quest.img</code>.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quests by name"
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>
          <select
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            aria-label="Filter by area"
          >
            <option value="">All areas</option>
            {parentsQ.data?.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {questsQ.isLoading && (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {questsQ.data && questsQ.data.length === 0 && (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              {search || parent ? 'No quests match.' : 'No quests yet.'} Load{' '}
              <code className="font-mono">Quest.wz</code> via{' '}
              <Link to="/setup" className="text-primary hover:underline">
                setup
              </Link>{' '}
              to populate this list.
            </p>
          </div>
        )}
        {questsQ.data && questsQ.data.length > 0 && (
          <ul className="divide-border border-border bg-card text-card-foreground divide-y rounded-md border">
            {questsQ.data.map((q) => (
              <li key={q.id}>
                <Link
                  to={`/quests/${q.id}`}
                  className="hover:bg-accent flex items-center gap-3 px-4 py-2 transition-colors"
                >
                  <ScrollText className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{q.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {q.parent ?? '—'}
                      {q.requiredLevel !== null && <> · Lv {q.requiredLevel}+</>}
                    </div>
                  </div>
                  <div className="text-muted-foreground shrink-0 font-mono text-xs">{q.id}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
