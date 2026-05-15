export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Gather. Free community events.</p>
        <p>Built for makers, organizers, and communities.</p>
      </div>
    </footer>
  );
}
