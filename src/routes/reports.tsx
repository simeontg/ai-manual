import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, EyeOff, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

type ReportItem = {
  id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  target_type: "event" | "photo";
  target_id: string;
  reporter_name: string;
  event_id: string;
  event_title: string;
  photo_path: string | null;
  photo_approved: boolean | null;
};

function ReportsPage() {
  const { user, isHost, loading } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", user?.id],
    enabled: !!user && isHost,
    queryFn: async (): Promise<ReportItem[]> => {
      // 1) Hosts can only see reports about content from their events.
      const { data: myEvents, error: e1 } = await supabase
        .from("events")
        .select("id, title")
        .eq("host_id", user!.id);
      if (e1) throw e1;
      const eventMap = new Map((myEvents ?? []).map((e) => [e.id, e.title]));
      const eventIds = Array.from(eventMap.keys());
      if (eventIds.length === 0) return [];

      // 2) Photos that belong to my events (so we can match photo reports).
      const { data: photos, error: e2 } = await supabase
        .from("event_photos")
        .select("id, event_id, storage_path, approved")
        .in("event_id", eventIds);
      if (e2) throw e2;
      const photoMap = new Map(
        (photos ?? []).map((p) => [
          p.id,
          { event_id: p.event_id, storage_path: p.storage_path, approved: p.approved },
        ]),
      );
      const photoIds = Array.from(photoMap.keys());

      // 3) Pull reports targeting either my events or photos in my events.
      const targetIds = [...eventIds, ...photoIds];
      const { data: reports, error: e3 } = await supabase
        .from("reports")
        .select("*")
        .in("target_id", targetIds)
        .order("created_at", { ascending: false });
      if (e3) throw e3;

      const reporterIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id)));
      const reporterMap = new Map<string, string>();
      if (reporterIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", reporterIds);
        (profs ?? []).forEach((p) => reporterMap.set(p.id, p.display_name ?? "Anonymous"));
      }

      return (reports ?? [])
        .map((r): ReportItem | null => {
          if (r.target_type === "event") {
            const title = eventMap.get(r.target_id);
            if (!title) return null;
            return {
              id: r.id,
              reason: r.reason,
              status: r.status,
              created_at: r.created_at,
              target_type: "event",
              target_id: r.target_id,
              reporter_name: reporterMap.get(r.reporter_id) ?? "Anonymous",
              event_id: r.target_id,
              event_title: title,
              photo_path: null,
              photo_approved: null,
            };
          }
          const photo = photoMap.get(r.target_id);
          if (!photo) return null;
          return {
            id: r.id,
            reason: r.reason,
            status: r.status,
            created_at: r.created_at,
            target_type: "photo",
            target_id: r.target_id,
            reporter_name: reporterMap.get(r.reporter_id) ?? "Anonymous",
            event_id: photo.event_id,
            event_title: eventMap.get(photo.event_id) ?? "Event",
            photo_path: photo.storage_path,
            photo_approved: photo.approved,
          };
        })
        .filter((x): x is ReportItem => x !== null);
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "reviewed" | "dismissed" }) => {
      const { error } = await supabase
        .from("reports")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const hide = useMutation({
    mutationFn: async (r: ReportItem) => {
      if (r.target_type === "photo") {
        const { error } = await supabase
          .from("event_photos")
          .update({ approved: false })
          .eq("id", r.target_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("events")
          .update({ status: "draft" })
          .eq("id", r.target_id);
        if (error) throw error;
      }
      const { error: e2 } = await supabase
        .from("reports")
        .update({
          status: "reviewed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", r.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Hidden from public view.");
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["hosted-events"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to review reports.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  if (!isHost)
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Only hosts can review reports.
      </div>
    );

  const open = (data ?? []).filter((r) => r.status === "open");
  const resolved = (data ?? []).filter((r) => r.status !== "open");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="Reports"
        description="Review reports submitted against your events and photos."
      />
      {isLoading ? (
        <LoadingState />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-5 w-5" />}
          title="No reports"
          description="You'll see reported events and photos here."
        />
      ) : (
        <div className="mt-8 space-y-8">
          <Section title={`Open (${open.length})`}>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              open.map((r) => (
                <ReportRow
                  key={r.id}
                  r={r}
                  onDismiss={() => setStatus.mutate({ id: r.id, status: "dismissed" })}
                  onHide={() => hide.mutate(r)}
                  busy={setStatus.isPending || hide.isPending}
                />
              ))
            )}
          </Section>
          {resolved.length > 0 && (
            <Section title={`Resolved (${resolved.length})`}>
              {resolved.map((r) => (
                <ReportRow key={r.id} r={r} readOnly />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function ReportRow({
  r,
  onDismiss,
  onHide,
  busy,
  readOnly,
}: {
  r: ReportItem;
  onDismiss?: () => void;
  onHide?: () => void;
  busy?: boolean;
  readOnly?: boolean;
}) {
  const photoUrl = r.photo_path ?? null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={r.target_type === "photo" ? "outline" : "secondary"}>
              {r.target_type === "photo" ? "Photo" : "Event"}
            </Badge>
            {r.status === "open" && <Badge>Open</Badge>}
            {r.status === "reviewed" && <Badge variant="secondary">Reviewed</Badge>}
            {r.status === "dismissed" && <Badge variant="outline">Dismissed</Badge>}
            {r.target_type === "photo" && r.photo_approved === false && (
              <Badge variant="outline">Hidden</Badge>
            )}
          </div>
          <Link
            to="/events/$eventId"
            params={{ eventId: r.event_id }}
            className="mt-2 inline-flex items-center gap-1 text-base font-medium hover:underline"
          >
            {r.event_title} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Reported by {r.reporter_name} · {new Date(r.created_at).toLocaleString()}
          </p>
        </div>
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
          />
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{r.reason}</p>
      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onHide} disabled={busy}>
            <EyeOff className="h-4 w-4" /> Hide from public
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
            <Check className="h-4 w-4" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
