interface Props {
  title: string;
  description: string;
}

export function PlaceholderRoute({ title, description }: Props) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      <div className="border-border bg-card text-card-foreground mt-6 rounded-lg border p-6 text-sm">
        <p className="text-muted-foreground">
          This page is a placeholder. Real content arrives once the parser and database layers are
          in place — see <code className="font-mono text-xs">docs/technical_requirements.md</code>{' '}
          for the phase plan.
        </p>
      </div>
    </div>
  );
}
