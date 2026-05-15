import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Ticket, Calendar, MapPin, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { buildICS, downloadICS } from "@/lib/ics";

export const Route = createFileRoute("/my/tickets")({
  component: MyTicketsPage,
});

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function MyTicketsPage() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, event:events(id, title, starts_at, ends_at, location, description, host_id)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const tickets = data ?? [];
      const hostIds = Array.from(
        new Set(tickets.map((t) => t.event?.host_id).filter(Boolean) as string[]),
      );
      const hostMap = new Map<string, string>();
      if (hostIds.length) {
        const { data: hosts } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", hostIds);
        (hosts ?? []).forEach((h) => hostMap.set(h.id, h.display_name ?? "Host"));
      }
      return tickets.map((t) => ({
        ...t,
        host_name: t.event?.host_id ? (hostMap.get(t.event.host_id) ?? "Host") : "Host",
      }));
    },
  });

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to view your tickets.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader title="My tickets" description="Show these at the door for check-in." />
      <div className="mt-8">
        {isLoading ? (
          <LoadingState />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Ticket className="h-5 w-5" />}
            title="No tickets yet"
            description="Tickets appear here once your RSVP is confirmed."
            action={
              <Button asChild>
                <Link to="/explore">Explore events</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {data.map((t) => (
              <div
                key={t.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-md)]"
              >
                <div
                  className="p-5 text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-hero)" }}
                >
                  <p className="text-xs uppercase tracking-wide opacity-80">Ticket</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {t.event ? (
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: t.event.id }}
                        className="text-xl font-semibold hover:underline"
                      >
                        {t.event.title}
                      </Link>
                    ) : (
                      <h3 className="text-xl font-semibold">Untitled</h3>
                    )}
                    {t.event?.ends_at && new Date(t.event.ends_at) < new Date() && (
                      <Badge className="border-transparent bg-destructive text-destructive-foreground uppercase tracking-wide">
                        Ended
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm opacity-90">
                    {t.event?.starts_at ? new Date(t.event.starts_at).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="space-y-2 border-t border-border p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      {t.event?.starts_at ? new Date(t.event.starts_at).toLocaleString() : "—"}
                      {t.event?.ends_at ? ` → ${new Date(t.event.ends_at).toLocaleString()}` : ""}
                      {t.event?.starts_at && t.event?.ends_at && (
                        <span className="ml-1 text-muted-foreground">
                          ({formatDuration(t.event.starts_at, t.event.ends_at)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{t.event?.location ?? "No venue"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    {t.event?.host_id ? (
                      <span>
                        Hosted by{" "}
                        <Link
                          to="/hosts/$hostId"
                          params={{ hostId: t.event.host_id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {t.host_name}
                        </Link>
                      </span>
                    ) : (
                      <span>Hosted by {t.host_name}</span>
                    )}
                  </div>
                </div>
                <div className="grid place-items-center bg-muted p-6">
                  <div className="rounded-lg bg-background p-3">
                    <QRCodeSVG value={t.qr_token} size={140} level="M" />
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3 border-t border-border p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Code</p>
                    <p className="break-all font-mono text-xs">{t.qr_token}</p>
                  </div>
                  {t.checked_in_at ? (
                    <Badge className="shrink-0">Checked in</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Not checked in
                    </Badge>
                  )}
                </div>
                {t.event && (
                  <div className="border-t border-border p-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        downloadICS(
                          `${t.event!.title}.ics`,
                          buildICS({
                            uid: t.event!.id,
                            title: t.event!.title,
                            description: t.event!.description,
                            location: t.event!.location,
                            starts_at: t.event!.starts_at,
                            ends_at: t.event!.ends_at,
                          }),
                        )
                      }
                    >
                      <CalendarPlus className="h-4 w-4" /> Add to calendar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
