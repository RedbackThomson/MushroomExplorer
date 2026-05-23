import type { Diagnostics } from '@/parser';
import { getLogEntries, type LogEntry } from '@/lib/logger';

/**
 * Build a single human-readable report suitable for pasting into a GitHub
 * issue. Merges main-thread + worker log buffers by timestamp.
 */
export function buildReport(workerDiagnostics: Diagnostics): string {
  const mainLog = getLogEntries().map(taggedEntry('main'));
  const workerLog = workerDiagnostics.log.map(taggedEntry('worker'));
  const merged = [...mainLog, ...workerLog].sort((a, b) => a.t - b.t);

  const lines: string[] = [];
  lines.push('## Mushroom Game Explorer — diagnostics');
  lines.push('');
  lines.push('### Environment');
  for (const [k, v] of Object.entries(env())) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('### AES smoke test');
  if (workerDiagnostics.aesSmokeTest.ok) {
    lines.push('- ok: true');
  } else {
    lines.push('- ok: false');
    lines.push(`- error: ${workerDiagnostics.aesSmokeTest.error}`);
  }
  lines.push('');
  lines.push('### Loaded files');
  if (workerDiagnostics.loadedFiles.length === 0) {
    lines.push('(none)');
  } else {
    for (const f of workerDiagnostics.loadedFiles) lines.push(`- ${f.name}`);
  }
  lines.push('');
  lines.push('### Log');
  for (const e of merged) {
    const time = new Date(e.t).toISOString().slice(11, 23);
    const data = e.data !== undefined ? ' ' + safeStringify(e.data) : '';
    lines.push(`${time} ${e.source}/${e.scope} ${e.level.toUpperCase()}: ${e.msg}${data}`);
  }
  return lines.join('\n');
}

function env(): Record<string, string> {
  return {
    userAgent: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '?',
    url: (globalThis as { location?: { href?: string } }).location?.href ?? '?',
    timestamp: new Date().toISOString(),
  };
}

function taggedEntry(source: 'main' | 'worker') {
  return (e: LogEntry) => ({ ...e, source });
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
