import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, ClipboardCopy, FileWarning, Loader2 } from 'lucide-react';
import { FilePicker } from '@/components/FilePicker';
import { Button } from '@/components/ui/button';
import { getParserClient, type WzNodeInfo, type WzMapleVersionName } from '@/parser';
import { cn } from '@/lib/utils';
import { buildReport } from '@/lib/diagnosticsReport';

// MapleRoyals' v83-era client uses the "old GMS" encryption — listed first.
const VERSIONS: WzMapleVersionName[] = ['GMS', 'BMS', 'EMS', 'CLASSIC'];

interface LoadState {
  loaded: { name: string; rootDirectories: string[] }[];
  errors: { name: string; message: string }[];
}

export default function Debug() {
  const [version, setVersion] = useState<WzMapleVersionName>('GMS');
  const [busy, setBusy] = useState(false);
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lookupPath, setLookupPath] = useState('');
  const [lookupResult, setLookupResult] = useState<WzNodeInfo | null | 'pending'>(null);

  const client = useMemo(() => getParserClient(), []);

  useEffect(() => {
    client.init(version).catch((e: unknown) => setError(String(e)));
  }, [client, version]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setError(null);
      setLoadState(null);
      try {
        await client.init(version);
        const result = await client.load(files.map((file) => ({ name: file.name, source: file })));
        setLoadState(result);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [client, version],
  );

  const runLookup = useCallback(async () => {
    if (!lookupPath.trim()) return;
    setLookupResult('pending');
    try {
      const node = await client.getNode(lookupPath.trim());
      setLookupResult(node);
    } catch (e) {
      setError((e as Error).message);
      setLookupResult(null);
    }
  }, [client, lookupPath]);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Parser debug</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Phase 1 spike. Load your own WZ files, inspect the parsed tree, and look up a node by
          path. Files never leave your browser.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" htmlFor="wz-version">
            Encryption version
          </label>
          <select
            id="wz-version"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={version}
            onChange={(e) => setVersion(e.target.value as WzMapleVersionName)}
            disabled={busy}
          >
            {VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <FilePicker onFiles={handleFiles} disabled={busy} />
          {busy && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
        </div>
        {error && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {loadState && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Loaded files</h2>
          <ul className="space-y-2">
            {loadState.loaded.map((f) => (
              <li
                key={f.name}
                className="border-border bg-card text-card-foreground rounded-md border p-3 text-sm"
              >
                <div className="font-mono text-xs font-medium">{f.name}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {f.rootDirectories.length} top-level entries:{' '}
                  {f.rootDirectories.slice(0, 8).join(', ')}
                  {f.rootDirectories.length > 8 && ' …'}
                </div>
                <TreeRoot path={f.name} />
              </li>
            ))}
            {loadState.errors.map((e) => (
              <li
                key={e.name}
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
              >
                <div className="font-mono text-xs font-medium">{e.name}</div>
                <div className="mt-1 text-xs">{e.message}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DiagnosticsPanel />

      {loadState && loadState.loaded.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Lookup by path</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={lookupPath}
              onChange={(e) => setLookupPath(e.target.value)}
              placeholder="e.g. String.wz/Eqp.img/Eqp/Cap/1002000/name"
              className="border-input bg-background h-9 flex-1 rounded-md border px-3 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runLookup();
              }}
            />
            <Button onClick={runLookup} disabled={!lookupPath.trim()}>
              Look up
            </Button>
          </div>
          {lookupResult === 'pending' && (
            <p className="text-muted-foreground text-sm">Resolving…</p>
          )}
          {lookupResult === null && <p className="text-muted-foreground text-sm">No result yet.</p>}
          {lookupResult && typeof lookupResult === 'object' && (
            <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

function TreeRoot({ path }: { path: string }) {
  return (
    <div className="mt-3 border-l pl-3">
      <TreeChildren path={path} depth={0} />
    </div>
  );
}

const MAX_DEPTH = 6;

function TreeChildren({ path, depth }: { path: string; depth: number }) {
  const client = useMemo(() => getParserClient(), []);
  const [children, setChildren] = useState<WzNodeInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    client
      .listChildren(path)
      .then((c) => {
        if (!cancelled) setChildren(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, path]);

  if (loading) return <div className="text-muted-foreground text-xs">loading…</div>;
  if (error) return <div className="text-destructive text-xs">{error}</div>;
  if (!children || children.length === 0) {
    return <div className="text-muted-foreground text-xs">(empty)</div>;
  }

  return (
    <ul className="space-y-0.5">
      {children.slice(0, 50).map((c) => (
        <TreeNode key={c.fullPath} node={c} depth={depth} />
      ))}
      {children.length > 50 && (
        <li className="text-muted-foreground text-xs">…and {children.length - 50} more</li>
      )}
    </ul>
  );
}

function TreeNode({ node, depth }: { node: WzNodeInfo; depth: number }) {
  const [open, setOpen] = useState(false);
  const canExpand = node.hasChildren && depth < MAX_DEPTH;

  return (
    <li>
      <div className="flex items-center gap-1 font-mono text-xs">
        {canExpand ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span
          className={cn(
            node.kind === 'directory' && 'font-medium',
            node.kind === 'image' && 'text-primary',
            node.kind === 'property' && 'text-muted-foreground',
          )}
        >
          {node.name}
        </span>
        {node.propertyKind && (
          <span className="text-muted-foreground/60">: {node.propertyKind}</span>
        )}
        {node.scalar !== undefined && node.scalar !== null && (
          <span className="text-foreground/80 ml-2 truncate">
            = {String(node.scalar).slice(0, 80)}
          </span>
        )}
      </div>
      {open && (
        <div className="ml-3 border-l pl-3">
          <TreeChildren path={node.fullPath} depth={depth + 1} />
        </div>
      )}
    </li>
  );
}

function DiagnosticsPanel() {
  const client = useMemo(() => getParserClient(), []);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const buildAndCopy = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const diag = await client.diagnose();
      const report = buildReport(diag);
      setPreview(report);
      try {
        await navigator.clipboard.writeText(report);
        setStatus('Copied to clipboard.');
      } catch {
        setStatus('Clipboard write failed — copy the text below manually.');
      }
    } catch (e) {
      setStatus(`Failed to build report: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [client]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Diagnostics</h2>
        <Button variant="outline" size="sm" onClick={buildAndCopy} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          Copy log
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Captures the parser log buffer, AES smoke-test result, and environment. Paste into a GitHub
        issue if something's not working.
      </p>
      {status && <p className="text-muted-foreground text-xs">{status}</p>}
      {preview && (
        <details className="border-border bg-muted/40 rounded-md border p-3">
          <summary className="cursor-pointer text-xs font-medium">Preview</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{preview}</pre>
        </details>
      )}
    </section>
  );
}
