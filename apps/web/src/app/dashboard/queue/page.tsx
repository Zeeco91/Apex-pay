export default function DashboardQueuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Get help</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s where you&apos;ll track help you&apos;re receiving.</p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-10 text-center">
        <p className="text-base font-semibold text-foreground">Nothing to show yet</p>
        <p className="mt-2 text-sm text-muted">This section is coming soon.</p>
      </div>
    </div>
  );
}
