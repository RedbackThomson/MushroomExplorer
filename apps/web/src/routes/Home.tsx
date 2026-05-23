export default function Home() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Mushroom Game Explorer</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        A local-first wiki for MapleStory/MapleRoyals-style game data. Provide your own files to get
        started.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border-border bg-card text-card-foreground rounded-lg border p-5">
          <h2 className="font-semibold">Local-first</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Files you load stay in your browser. Nothing is uploaded.
          </p>
        </div>
        <div className="border-border bg-card text-card-foreground rounded-lg border p-5">
          <h2 className="font-semibold">Code only</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            No proprietary game data ships with this app. You supply the files.
          </p>
        </div>
      </div>

      <div className="border-border bg-muted/40 mt-8 rounded-lg border p-5 text-sm">
        <p className="font-medium">Status: Phase 0 — scaffold</p>
        <p className="text-muted-foreground mt-1">
          The UI shell is in place. Parser and database layers arrive in Phases 1–2.
        </p>
      </div>
    </div>
  );
}
