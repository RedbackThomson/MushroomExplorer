import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getParserClient } from '@/parser';
import { getDbClient } from '@/db';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('extract-ui');

interface ExtractStats {
  items: number;
  equips: number;
  skipped: number;
  ms: number;
}

/**
 * Phase 3 bulk extraction: walks Item.wz + String.wz in the parser worker and
 * mass-upserts items + equips into the local DB. The Items / Equips routes
 * then show the result.
 */
export function ExtractAllPanel() {
  const parser = useMemo(() => getParserClient(), []);
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<ExtractStats | null>(null);

  const runM = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      const [itemsResult, equipsResult] = await Promise.all([
        parser.extractItems(),
        parser.extractEquips(),
      ]);
      log.info('extract complete in worker', {
        items: itemsResult.items.length,
        equips: equipsResult.equips.length,
      });
      const [itemCount, equipCount] = await Promise.all([
        itemsResult.items.length > 0 ? db.upsertItems(itemsResult.items) : Promise.resolve(0),
        equipsResult.equips.length > 0 ? db.upsertEquips(equipsResult.equips) : Promise.resolve(0),
      ]);
      const ms = Math.round(performance.now() - started);
      const result: ExtractStats = {
        items: itemCount,
        equips: equipCount,
        skipped: itemsResult.skipped.length + equipsResult.skipped.length,
        ms,
      };
      log.info('extract+persist complete', result);
      return result;
    },
    onSuccess: (r) => {
      setStats(r);
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
    onError: (e) => {
      log.error('extract failed', describeError(e));
    },
  });

  const onRun = useCallback(() => runM.mutate(), [runM]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Bulk extract to database</h2>
      <p className="text-muted-foreground text-sm">
        Walks <code className="font-mono text-xs">Item.wz</code> and joins names from{' '}
        <code className="font-mono text-xs">String.wz</code> for items, plus equipment names from{' '}
        <code className="font-mono text-xs">String.wz/Eqp.img</code>. Records are saved to the local
        SQLite database.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={onRun} disabled={runM.isPending}>
          {runM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {runM.isPending ? 'Extracting…' : 'Extract items + equips'}
        </Button>
        {stats && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span>
              {stats.items} items, {stats.equips} equips
              {stats.skipped > 0 ? `, ${stats.skipped} skipped` : ''} in {stats.ms} ms
            </span>
            <Link to="/items" className="text-primary text-xs hover:underline">
              View items →
            </Link>
          </div>
        )}
      </div>
      {runM.isError && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {(runM.error as Error).message}
        </div>
      )}
    </section>
  );
}
