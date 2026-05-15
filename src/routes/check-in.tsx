import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { CheckCircle2, RotateCcw, Calendar, MapPin, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/check-in")({
  component: CheckInPage,
});

type PendingTicket = {
  id: string;
  qr_token: string;
  event_id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  host_name: string;
  attendee_name: string;
  attendee_email: string;
  already_at: string | null;
};

function CheckInPage() {
  const { user, isChecker, isHost, loading } = useAuth();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<PendingTicket | null>(null);
  const [last, setLast] = useState<{
    id: string;
    qr_token: string;
    event_id: string;
    title: string;
    at: string;
  } | null>(null);

  const { data: myEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["checkin-events", user?.id],
    enabled: !!user && (isChecker || isHost),
    queryFn: async () => {
      const { data: memberships, error: mErr } = await supabase
        .from("host_members")
        .select("host_id")
        .eq("user_id", user!.id);
      if (mErr) throw mErr;
      const hostIds = (memberships ?? []).map((m) => m.host_id);

      const filters: string[] = [];
      if (hostIds.length) filters.push(`host_org_id.in.(${hostIds.join(",")})`);
      // Hosts can also check in events they own directly
      if (isHost) filters.push(`host_id.eq.${user!.id}`);
      if (filters.length === 0) return [];

      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, location")
        .or(filters.join(","))
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const activeEventId =
    selectedEventId ?? (myEvents && myEvents.length > 0 ? myEvents[0].id : null);
  const activeEvent = myEvents?.find((e) => e.id === activeEventId) ?? null;

  const { data: counts } = useQuery({
    queryKey: ["checkin-counts", activeEventId],
    enabled: !!activeEventId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [{ count: total }, { count: done }] = await Promise.all([
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("event_id", activeEventId!),
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("event_id", activeEventId!)
          .not("checked_in_at", "is", null),
      ]);
      return { total: total ?? 0, done: done ?? 0 };
    },
  });

  const lookup = useMutation({
    mutationFn: async (tok: string): Promise<PendingTicket> => {
      const { data: ticket, error } = await supabase
        .from("tickets")
        .select(
          "id, qr_token, event_id, user_id, checked_in_at, event:events(title, starts_at, ends_at, location, host_id)",
        )
        .eq("qr_token", tok)
        .maybeSingle();
      if (error) throw error;
      if (!ticket) throw new Error("Ticket not found or you don't have access.");

      const [hostRes, attendeeRes] = await Promise.all([
        ticket.event?.host_id
          ? supabase
              .from("profiles")
              .select("display_name")
              .eq("id", ticket.event.host_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
        supabase.from("profiles").select("display_name").eq("id", ticket.user_id).maybeSingle(),
      ]);

      return {
        id: ticket.id,
        qr_token: ticket.qr_token,
        event_id: ticket.event_id,
        title: ticket.event?.title ?? "Event",
        starts_at: ticket.event?.starts_at ?? null,
        ends_at: ticket.event?.ends_at ?? null,
        location: ticket.event?.location ?? null,
        host_name: hostRes.data?.display_name ?? "Unknown host",
        attendee_name: attendeeRes.data?.display_name ?? "Attendee",
        attendee_email: "",
        already_at: ticket.checked_in_at,
      };
    },
    onSuccess: (t) => setPending(t),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const checkIn = useMutation({
    mutationFn: async (t: PendingTicket) => {
      if (t.already_at) throw new Error("Already checked in.");
      const at = new Date().toISOString();
      const { data, error } = await supabase
        .from("tickets")
        .update({ checked_in_at: at, checked_in_by: user!.id })
        .eq("id", t.id)
        .is("checked_in_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Already checked in.");
      return { ...t, at };
    },
    onSuccess: (info) => {
      setLast({
        id: info.id,
        qr_token: info.qr_token,
        event_id: info.event_id,
        title: info.title,
        at: info.at,
      });
      setPending(null);
      setToken("");
      toast.success(`Checked in: ${info.attendee_name} → ${info.title}`);
      qc.invalidateQueries({ queryKey: ["checkin-counts"] });
      qc.invalidateQueries({ queryKey: ["event-stats", info.event_id] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const undo = useMutation({
    mutationFn: async () => {
      if (!last) return;
      const { error } = await supabase
        .from("tickets")
        .update({ checked_in_at: null, checked_in_by: null })
        .eq("id", last.id);
      if (error) throw error;
    },
    onSuccess: () => {
      const undone = last;
      setLast(null);
      toast.success("Check-in undone.");
      qc.invalidateQueries({ queryKey: ["checkin-counts"] });
      if (undone) qc.invalidateQueries({ queryKey: ["event-stats", undone.event_id] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to access check-in.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  if (!isChecker && !isHost)
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        You don't have access to check-in.
      </div>
    );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    lookup.mutate(t);
  };

  return (
    <div className="container mx-auto max-w-md px-4 py-10">
      <PageHeader
        title="Check-in"
        description="Scan or paste a ticket code, then confirm the event before check-in."
      />

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Events you can check in</h2>
        {eventsLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : !myEvents || myEvents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No events assigned to you yet. Ask a host to invite you.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {myEvents.map((ev) => {
              const isActive = ev.id === activeEventId;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{ev.title}</span>
                      {isActive && <Badge variant="outline">Active</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ev.starts_at ? new Date(ev.starts_at).toLocaleString() : "—"}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activeEvent && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label={`${activeEvent.title} — Tickets`} value={counts?.total ?? 0} />
            <Stat label="Checked in" value={counts?.done ?? 0} />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="token">Ticket code</Label>
          <Input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste qr token…"
            autoFocus
            required
            disabled={!!pending}
          />
        </div>
        {!pending && (
          <Button className="w-full" disabled={lookup.isPending}>
            {lookup.isPending ? "Looking up…" : "Look up ticket"}
          </Button>
        )}
      </form>

      {pending && (
        <div className="mt-6 rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-[var(--shadow-md)]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-primary">Confirm event</p>
              <h3 className="mt-1 text-lg font-semibold leading-tight">{pending.title}</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPending(null);
                setToken("");
              }}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {pending.starts_at ? new Date(pending.starts_at).toLocaleString() : "—"}
                {pending.ends_at ? ` → ${new Date(pending.ends_at).toLocaleString()}` : ""}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{pending.location ?? "No venue"}</span>
            </li>
            <li className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Hosted by {pending.host_name}</span>
            </li>
          </ul>

          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <p className="text-xs text-muted-foreground">Attendee</p>
            <p className="text-sm font-medium">{pending.attendee_name}</p>
            {pending.attendee_email && (
              <p className="text-xs text-muted-foreground">{pending.attendee_email}</p>
            )}
            <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
              {pending.qr_token}
            </p>
          </div>

          {pending.already_at ? (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              Already checked in at {new Date(pending.already_at).toLocaleString()}.
            </div>
          ) : (
            <Button
              className="mt-4 w-full"
              onClick={() => checkIn.mutate(pending)}
              disabled={checkIn.isPending}
            >
              {checkIn.isPending ? "Checking in…" : `Confirm check-in for ${pending.title}`}
            </Button>
          )}
        </div>
      )}

      {last && !pending && (
        <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{last.title}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {last.qr_token.slice(0, 16)}…
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(last.at).toLocaleTimeString()}
              </p>
            </div>
            <Badge>Checked in</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => undo.mutate()}
            disabled={undo.isPending}
          >
            <RotateCcw className="h-4 w-4" /> {undo.isPending ? "Undoing…" : "Undo"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
