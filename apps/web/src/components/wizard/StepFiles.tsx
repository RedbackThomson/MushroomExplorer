import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getDbClient } from '@/db';
import { sha256OfFile, shortHash } from '@/lib/hashFile';
import { createLogger, describeError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { WzMapleVersionName } from '@/parser';

const log = createLogger('wizard-files');

const HEAVY_FILES = new Set(['Map.wz', 'Character.wz', 'Sound.wz', 'Effect.wz']);
const RECOMMENDED = ['String.wz', 'Item.wz'] as const;

export type HashPhase = 'queued' | 'hashing' | 'done' | 'error';

export interface WizardFile {
  /** The user-supplied File. Held only in memory; not persisted. */
  file: File;
  /** Lowercase SHA-256 hex digest, once computed. */
  hash: string | null;
  /** Where this file is in the hash pipeline. */
  hashPhase: HashPhase;
  hashError: string | null;
  /** User decision: include this file in extraction. */
  include: boolean;
  /** Existing dataset_files row this hash matches, if any. */
  matchedExisting: { name: string } | null;
  /** Force re-processing even if hash matches an existing row. */
  forceReprocess: boolean;
}

export interface DetectionState {
  status: 'idle' | 'running' | 'done' | 'failed';
  version: WzMapleVersionName | null;
  mapleVersion: number | null;
  sourceFile: string | null;
  error: string | null;
}

interface Props {
  files: WizardFile[];
  onChange: React.Dispatch<React.SetStateAction<WizardFile[]>>;
  /** Master "force re-process all" override. Locks per-file checkboxes on. */
  forceAll: boolean;
  onForceAllChange: (v: boolean) => void;
  /** Encryption-version auto-detection state from the parent wizard. */
  detection: DetectionState;
  /** Manual override; `null` means "trust the auto-detected version." */
  versionOverride: WzMapleVersionName | null;
  onVersionOverrideChange: (v: WzMapleVersionName | null) => void;
}

const VERSION_OPTIONS: { id: WzMapleVersionName; label: string }[] = [
  { id: 'GMS', label: 'GMS · old Global MapleStory' },
  { id: 'BMS', label: 'BMS · modern Global / MapleSEA / Japan' },
  { id: 'EMS', label: 'EMS · old MapleStory Europe / China' },
  { id: 'CLASSIC', label: 'Classic · uncommon, zero-IV variant' },
];

export function StepFiles({
  files,
  onChange,
  forceAll,
  onForceAllChange,
  detection,
  versionOverride,
  onVersionOverrideChange,
}: Props) {
  const db = useMemo(() => getDbClient(), []);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Files we've already kicked off a hash for. We track them by File
   *  identity rather than (name, size) so a Force-re-add can re-trigger
   *  hashing if the same name+size is intentionally replaced. */
  const startedHashing = useRef<WeakSet<File>>(new WeakSet());

  const existingNames = useQuery({
    queryKey: ['db', 'loaded-files'],
    queryFn: () => db.listLoadedFileNames(),
  });

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming: WizardFile[] = [];
      for (const f of Array.from(list)) {
        if (!/\.wz$/i.test(f.name)) {
          log.warn('ignoring non-.wz file', { name: f.name });
          continue;
        }
        // Dedup by (name, size) so a re-drop doesn't double the list.
        const dup = files.some((x) => x.file.name === f.name && x.file.size === f.size);
        if (dup) continue;
        incoming.push({
          file: f,
          hash: null,
          hashPhase: 'queued',
          hashError: null,
          include: true,
          matchedExisting: null,
          forceReprocess: false,
        });
      }
      if (incoming.length === 0) return;
      onChange((prev) => [...prev, ...incoming]);
    },
    [files, onChange],
  );

  // Kick off hashing for any newly added files. Each hash is started exactly
  // once per File instance, tracked in a ref. The hashClient itself queues
  // concurrent calls so we never run two digests at the same time.
  useEffect(() => {
    const toStart = files.filter(
      (f) => f.hashPhase === 'queued' && !startedHashing.current.has(f.file),
    );
    if (toStart.length === 0) return;

    for (const wf of toStart) {
      startedHashing.current.add(wf.file);
      const targetFile = wf.file;
      const patch = (updates: Partial<WizardFile>) => {
        onChange((prev) => prev.map((f) => (f.file === targetFile ? { ...f, ...updates } : f)));
      };

      sha256OfFile(targetFile, {
        onStarted: () => patch({ hashPhase: 'hashing' }),
      })
        .then(async (hash) => {
          let matched: WizardFile['matchedExisting'] = null;
          try {
            const found = await db.findFileByHash(hash);
            if (found) matched = { name: found.name };
          } catch (e) {
            log.warn('findFileByHash failed', describeError(e));
          }
          patch({
            hashPhase: 'done',
            hash,
            matchedExisting: matched,
            forceReprocess: false,
          });
        })
        .catch((e) => {
          log.error('hashing failed', describeError(e));
          patch({
            hashPhase: 'error',
            hashError: (e as Error).message ?? 'hash failed',
          });
        });
    }
  }, [files, db, onChange]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function remove(file: WizardFile) {
    onChange(files.filter((f) => f !== file));
  }

  function toggle(file: WizardFile, field: 'include' | 'forceReprocess', value: boolean) {
    onChange(files.map((f) => (f === file ? { ...f, [field]: value } : f)));
  }

  const knownNames = useMemo(() => new Set(files.map((f) => f.file.name)), [files]);
  const missingRecommended = RECOMMENDED.filter((r) => !knownNames.has(r));
  const hasAnyMatched = useMemo(() => files.some((f) => f.matchedExisting !== null), [files]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Drop your WZ files</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Files stay in your browser; nothing is uploaded anywhere. We compute a SHA-256 of each
          file so we can skip re-processing on subsequent runs.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'border-border bg-card flex flex-col items-center justify-center rounded-md border-2 border-dashed py-10 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <Upload className="text-muted-foreground mb-3 h-8 w-8" />
        <p className="text-sm font-medium">Drag and drop .wz files here</p>
        <p className="text-muted-foreground mt-1 text-xs">or</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".wz"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {missingRecommended.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Recommended minimum: {RECOMMENDED.join(' + ')}. Missing: {missingRecommended.join(', ')}.
        </p>
      )}

      {files.length > 0 && (
        <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
          {files.map((f) => (
            <li key={f.file.name} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={f.include}
                    onChange={(e) => toggle(f, 'include', e.target.checked)}
                    className="accent-primary h-3.5 w-3.5"
                    disabled={f.hashPhase === 'queued' || f.hashPhase === 'hashing'}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">{f.file.name}</span>
                    {HEAVY_FILES.has(f.file.name) && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        <FileWarning className="h-3 w-3" /> heavy
                      </span>
                    )}
                    {existingNames.data?.includes(f.file.name) && !f.matchedExisting && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        updating
                      </span>
                    )}
                    {f.matchedExisting && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                        <CheckCircle2 className="h-3 w-3" /> already loaded
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {(f.file.size / 1_000_000).toFixed(1)} MB
                    {f.hash && (
                      <>
                        {' · '}
                        <span className="font-mono" title={f.hash}>
                          sha256:{shortHash(f.hash)}…
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {f.matchedExisting && f.hashPhase === 'done' && (
                  <button
                    type="button"
                    onClick={() => toggle(f, 'forceReprocess', !f.forceReprocess)}
                    disabled={forceAll}
                    aria-pressed={forceAll || f.forceReprocess}
                    aria-label="Force re-process (extractors will run again for this file)"
                    title="Force re-process (extractors will run again for this file)"
                    className={cn(
                      'shrink-0 transition-colors',
                      forceAll || f.forceReprocess
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                      forceAll && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Remove ${f.file.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {(f.hashPhase === 'queued' || f.hashPhase === 'hashing') && (
                <p className="text-muted-foreground inline-flex items-center gap-1.5 pl-7 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {f.hashPhase === 'queued' ? 'Queued…' : 'Hashing…'}
                </p>
              )}
              {f.hashPhase === 'error' && f.hashError && (
                <p className="text-destructive inline-flex items-center gap-1.5 pl-7 text-xs">
                  <AlertTriangle className="h-3 w-3" /> {f.hashError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasAnyMatched && (
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={forceAll}
            onChange={(e) => onForceAllChange(e.target.checked)}
            className="accent-primary h-3.5 w-3.5"
          />
          Force re-process all (re-run extractors for every hash-matched file)
        </label>
      )}

      {files.length > 0 && (
        <DetectionPanel
          detection={detection}
          versionOverride={versionOverride}
          onVersionOverrideChange={onVersionOverrideChange}
        />
      )}
    </section>
  );
}

function DetectionPanel({
  detection,
  versionOverride,
  onVersionOverrideChange,
}: {
  detection: DetectionState;
  versionOverride: WzMapleVersionName | null;
  onVersionOverrideChange: (v: WzMapleVersionName | null) => void;
}) {
  const detected = detection.version;
  const summary =
    detection.status === 'running'
      ? 'Detecting encryption…'
      : detection.status === 'done' && detected
        ? `Detected ${detected}${detection.mapleVersion ? ` · MapleStory v${detection.mapleVersion}` : ''}`
        : detection.status === 'failed'
          ? 'Could not auto-detect encryption — defaulting to GMS'
          : 'Encryption will be auto-detected from the first hashed file';

  const Icon =
    detection.status === 'running'
      ? Loader2
      : detection.status === 'done'
        ? CheckCircle2
        : detection.status === 'failed'
          ? AlertTriangle
          : Loader2;

  return (
    <details className="border-border bg-card group rounded-md border text-xs">
      <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 px-3 py-2">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            detection.status === 'running' && 'animate-spin',
            detection.status === 'done' && 'text-green-600 dark:text-green-400',
            detection.status === 'failed' && 'text-amber-600 dark:text-amber-400',
          )}
        />
        <span className="flex-1">{summary}</span>
        {versionOverride && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            override: {versionOverride}
          </span>
        )}
        <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide group-open:hidden">
          advanced
        </span>
      </summary>
      <div className="border-border border-t px-3 py-2.5">
        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
          We try each known WZ initialization vector against your file's root directory and pick the
          one that decodes to readable ASCII. Override this only if the detected value comes out
          wrong — e.g. names render as garbage in the wiki.
        </p>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">Force version:</span>
          <select
            value={versionOverride ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onVersionOverrideChange(v === '' ? null : (v as WzMapleVersionName));
            }}
            className="border-border bg-background rounded border px-2 py-1 text-xs"
          >
            <option value="">Auto ({detected ?? 'GMS fallback'})</option>
            {VERSION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}
