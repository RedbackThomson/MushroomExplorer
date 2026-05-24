import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { detectVersion } from '@mge/wz';
import { Button } from '@/components/ui/button';
import { WizardLayout, type WizardStep } from '@/components/wizard/WizardLayout';
import {
  StepFiles,
  type DetectionState,
  type WizardFile,
} from '@/components/wizard/StepFiles';
import { StepReview } from '@/components/wizard/StepReview';
import { StepRun } from '@/components/wizard/StepRun';
import { buildPlan } from '@/components/wizard/plan';
import { createLogger, describeError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { WzMapleVersionName } from '@/parser';

const log = createLogger('setup');

const STEPS: WizardStep[] = [
  { id: 'files', label: 'Files' },
  { id: 'review', label: 'Review' },
  { id: 'run', label: 'Run' },
];

/**
 * How many bytes from the front of a file we hand `detectVersion`. The WZ
 * root directory + companion strings live near the start, well within this
 * window; deeper sub-directories may reference offsets beyond it but
 * `readDirectory` swallows those failures and we score on root-level
 * names alone.
 */
const DETECT_CHUNK_BYTES = 8 * 1024 * 1024;

export default function Setup() {
  const [stepId, setStepId] = useState<(typeof STEPS)[number]['id']>('files');
  const [files, setFiles] = useState<WizardFile[]>([]);
  const [forceAll, setForceAll] = useState(false);

  // Auto-detected encryption from the first hashed file; advanced override
  // takes precedence. Falls back to 'GMS' if both are null (the most common
  // MapleRoyals-era client).
  const [detection, setDetection] = useState<DetectionState>({
    status: 'idle',
    version: null,
    mapleVersion: null,
    sourceFile: null,
    error: null,
  });
  const [versionOverride, setVersionOverride] = useState<WzMapleVersionName | null>(null);
  const [runComplete, setRunComplete] = useState(false);

  const effectiveVersion: WzMapleVersionName = versionOverride ?? detection.version ?? 'GMS';

  // In-flight guard. A ref (not state) so flipping `detection.status` to
  // 'running' doesn't cause this effect to re-run and cancel its own work
  // via the cleanup — the classic useEffect self-cancel pitfall.
  const detectionInflightRef = useRef(false);

  useEffect(() => {
    // If we have a settled result whose source file is still present, do
    // nothing. If the source file was removed, drop back to idle so the
    // next render picks a new candidate.
    if (
      (detection.status === 'done' || detection.status === 'failed') &&
      detection.sourceFile
    ) {
      const stillThere = files.some((f) => f.file.name === detection.sourceFile);
      if (stillThere) return;
      setDetection({
        status: 'idle',
        version: null,
        mapleVersion: null,
        sourceFile: null,
        error: null,
      });
      return;
    }
    if (detectionInflightRef.current) return;
    if (detection.status === 'running') return;

    const candidate = files.find((f) => f.hashPhase === 'done');
    if (!candidate) return;

    detectionInflightRef.current = true;
    setDetection({
      status: 'running',
      version: null,
      mapleVersion: null,
      sourceFile: candidate.file.name,
      error: null,
    });

    (async () => {
      try {
        const blob = candidate.file.slice(0, DETECT_CHUNK_BYTES);
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const result = await detectVersion(bytes);
        detectionInflightRef.current = false;
        if (!result) {
          setDetection({
            status: 'failed',
            version: null,
            mapleVersion: null,
            sourceFile: candidate.file.name,
            error: 'no IV produced a confidently-readable directory',
          });
          return;
        }
        setDetection({
          status: 'done',
          version: result.version as WzMapleVersionName,
          mapleVersion: result.mapleVersion,
          sourceFile: candidate.file.name,
          error: null,
        });
      } catch (e) {
        detectionInflightRef.current = false;
        log.warn('version detection threw', describeError(e));
        setDetection({
          status: 'failed',
          version: null,
          mapleVersion: null,
          sourceFile: candidate.file.name,
          error: (e as Error).message ?? 'detection failed',
        });
      }
    })();
  }, [files, detection.status, detection.sourceFile]);

  const filesReady = files.length > 0 && files.every((f) => f.hashPhase === 'done');
  const someIncluded = files.some((f) => f.include);
  // Detection couldn't pick a region and the user hasn't picked one — without
  // either, we'd silently fall back to GMS, which would decode garbage for
  // BMS/EMS files. Gate Continue until they set the version manually.
  const needsManualVersion = detection.status === 'failed' && versionOverride === null;
  const canProceedFromFiles = filesReady && someIncluded && !needsManualVersion;

  const plan = useMemo(() => buildPlan(files, { forceAll }), [files, forceAll]);
  const planIsRunnable = plan.willRun.length > 0 && plan.missingDeps.length === 0;

  function goPrev() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx > 0) setStepId(STEPS[idx - 1].id);
  }
  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx < STEPS.length - 1) setStepId(STEPS[idx + 1].id);
  }

  let body: React.ReactNode;
  if (stepId === 'files')
    body = (
      <StepFiles
        files={files}
        onChange={setFiles}
        forceAll={forceAll}
        onForceAllChange={setForceAll}
        detection={detection}
        versionOverride={versionOverride}
        onVersionOverrideChange={setVersionOverride}
      />
    );
  else if (stepId === 'review')
    body = <StepReview version={effectiveVersion} files={files} forceAll={forceAll} />;
  else
    body = (
      <StepRun
        version={effectiveVersion}
        files={files}
        forceAll={forceAll}
        onComplete={() => setRunComplete(true)}
      />
    );

  const footer =
    stepId === 'run' ? (
      runComplete ? (
        <>
          <span />
          <Link
            to="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium"
          >
            Go Explore! <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <div className="text-muted-foreground text-xs">
          <Link to="/" className="hover:underline">
            Cancel and return home
          </Link>
        </div>
      )
    ) : (
      <>
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={stepId === STEPS[0].id}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {stepId === 'files' && !canProceedFromFiles && (
            <span
              className={cn(
                'text-xs',
                needsManualVersion ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {files.length === 0
                ? 'Add at least one .wz file'
                : files.some((f) => f.hashPhase === 'queued' || f.hashPhase === 'hashing')
                  ? 'Hashing…'
                  : !someIncluded
                    ? 'Include at least one file'
                    : 'Auto-detect failed — pick a version under Advanced'}
            </span>
          )}
          {stepId === 'review' && !planIsRunnable && (
            <span className="text-muted-foreground text-xs">
              {plan.missingDeps.length > 0
                ? 'Add the missing required files'
                : 'Nothing to extract'}
            </span>
          )}
          <Button
            size="sm"
            onClick={goNext}
            disabled={
              (stepId === 'files' && !canProceedFromFiles) ||
              (stepId === 'review' && !planIsRunnable)
            }
          >
            {stepId === 'review' ? 'Start' : 'Continue'}
          </Button>
        </div>
      </>
    );

  return (
    <WizardLayout
      title="Set up your wiki"
      subtitle="Load your WZ files once. They stay on this device; nothing is uploaded."
      steps={STEPS}
      currentStepId={stepId}
      footer={footer}
    >
      {body}
    </WizardLayout>
  );
}
