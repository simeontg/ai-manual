import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, Eye, EyeOff, Copy, ExternalLink, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import {
  duplicateEvent,
  getEventStats,
  listMyHostedEvents,
  setEventStatus,
  exportRsvpsCSV,
  exportAttendanceCSV,
  type EventRow,
} from "@/features/events/eventsService";
import { useAuth } from "@/features/auth/useAuth";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isHost, loading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["hosted-events", user?.id],
    queryFn: () => listMyHostedEvents(user!.id),
    enabled: !!user && isHost,
  });

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to access your dashboard.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  if (!isHost)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">You're not a host yet.</p>
        <Button asChild className="mt-4">
          <Link to="/host">Become a host</Link>
        </Button>
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader
        title="Host dashboard"
        description="Manage your events, RSVPs, and check-ins."
        actions={
          <Button asChild>
            <Link to="/events/new">
              <Plus className="h-4 w-4" /> Create event
            </Link>
          </Button>
        }
      />
      <div className="mt-8 space-y-4">
        {isLoading ? (
          <LoadingState />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-5 w-5" />}
            title="No events yet"
            description="Create your first event to get started."
            action={
              <Button asChild>
                <Link to="/events/new">Create event</Link>
              </Button>
            }
          />
        ) : (
          data.map((e) => <DashboardEventRow key={e.id} event={e} userId={user.id} />)
        )}
      </div>
    </div>
  );
}

function DashboardEventRow({ event, userId }: { event: EventRow; userId: string }) {
  const qc = useQueryClient();
  const ended = new Date(event.ends_at) < new Date();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["event-stats", event.id],
    queryFn: () => getEventStats(event.id),
    refetchInterval: 15_000,
  });

  const togglePublish = useMutation({
    mutationFn: () =>
      setEventStatus(event.id, event.status === "published" ? "draft" : "published"),
    onSuccess: () => {
      toast.success(event.status === "published" ? "Unpublished" : "Published");
      qc.invalidateQueries({ queryKey: ["hosted-events"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const dup = useMutation({
    mutationFn: () => duplicateEvent(event.id, userId),
    onSuccess: () => {
      toast.success("Event duplicated as draft");
      qc.invalidateQueries({ queryKey: ["hosted-events"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{event.title}</h3>
            {ended ? (
              <Badge variant="secondary">Ended</Badge>
            ) : event.status === "draft" ? (
              <Badge variant="outline">Draft</Badge>
            ) : (
              <Badge>Published</Badge>
            )}
            {event.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(event.starts_at).toLocaleString()} · capacity {event.capacity}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/events/$eventId" params={{ eventId: event.id }}>
              <ExternalLink className="h-4 w-4" /> View
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/events/$eventId/edit" params={{ eventId: event.id }}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => togglePublish.mutate()}
            disabled={togglePublish.isPending}
          >
            {event.status === "published" ? (
              <>
                <EyeOff className="h-4 w-4" /> Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Publish
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => dup.mutate()} disabled={dup.isPending}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const csv = await exportRsvpsCSV(event.id);
                downloadCSV(`${event.title}-rsvps.csv`, csv);
              } catch (e) {
                toast.error(toUserMessage(e));
              }
            }}
          >
            <Download className="h-4 w-4" /> RSVPs CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const csv = await exportAttendanceCSV(event.id);
                downloadCSV(`${event.title}-attendance.csv`, csv);
              } catch (e) {
                toast.error(toUserMessage(e));
              }
            }}
          >
            <Download className="h-4 w-4" /> Attendance CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Going" value={stats?.going} loading={isLoading} />
        <Stat label="Waitlist" value={stats?.waitlist} loading={isLoading} />
        <Stat label="Checked in" value={stats?.checkedIn} loading={isLoading} />
      </div>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : (value ?? 0)}</p>
    </div>
  );
}
