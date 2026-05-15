import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Users, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingState } from "@/components/common/LoadingState";
import { getEvent } from "@/features/events/eventsService";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { buildICS, downloadICS } from "@/lib/ics";
import { formatInTimeZone } from "@/lib/datetime";
import { PostEventPanel } from "@/features/events/PostEventPanel";

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ params }) => {
    const event = await getEvent(params.eventId);
    return { event };
  },
  head: ({ loaderData }) => {
    const e = loaderData?.event;
    if (!e) return { meta: [{ title: "Event — Gather" }] };
    const desc = (e.description ?? "Free community event on Gather.").slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title: `${e.title} — Gather` },
      { name: "description", content: desc },
      { property: "og:title", content: e.title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "event" },
    ];
    if (e.cover_image_url) {
      meta.push({ property: "og:image", content: e.cover_image_url });
      meta.push({ name: "twitter:image", content: e.cover_image_url });
    }
    return { meta };
  },
  component: EventDetailsPage,
});

function EventDetailsPage() {
  const { eventId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId),
  });

  const { data: counts } = useQuery({
    queryKey: ["event-counts", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ["confirmed", "going"]);
      return { confirmed: count ?? 0 };
    },
  });

  const { data: myRsvp } = useQuery({
    queryKey: ["rsvp", eventId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: host } = useQuery({
    queryKey: ["host-profile", event?.host_id],
    enabled: !!event?.host_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio")
        .eq("id", event!.host_id)
        .maybeSingle();
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rsvp", eventId] });
    qc.invalidateQueries({ queryKey: ["event-counts", eventId] });
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
    qc.invalidateQueries({ queryKey: ["my-events"] });
  };

  const rsvp = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      const { data, error } = await supabase
        .from("rsvps")
        .insert({ event_id: eventId, user_id: user.id, status: "going" })
        .select("status")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === "waitlisted") {
        toast.success("Event is full — you've been added to the waitlist.");
      } else {
        toast.success("You're going! Ticket added to My Tickets.");
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!myRsvp) return;
      const { error } = await supabase.from("rsvps").delete().eq("id", myRsvp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("RSVP cancelled.");
      invalidate();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (isLoading) return <LoadingState />;
  if (!event)
    return (
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
        Event not found.
      </div>
    );

  const ended = new Date(event.ends_at) < new Date();
  const confirmed = counts?.confirmed ?? 0;
  const isFull = confirmed >= event.capacity;
  const status = myRsvp?.status;
  const isConfirmed = status === "confirmed" || status === "going";
  const isWaitlisted = status === "waitlisted" || status === "waitlist";

  const handleAddToCalendar = () => {
    downloadICS(
      `${event.title}.ics`,
      buildICS({
        uid: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
      }),
    );
  };

  return (
    <article className="container mx-auto max-w-4xl px-4 py-10">
      {event.cover_image_url ? (
        <div
          className="aspect-[16/7] w-full overflow-hidden rounded-2xl bg-muted"
          style={{
            backgroundImage: `url(${event.cover_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : (
        <div className="flex aspect-[16/7] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted text-sm uppercase tracking-wide text-muted-foreground">
          No image
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {ended ? <Badge variant="secondary">Ended</Badge> : <Badge>Upcoming</Badge>}
        {event.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
        {event.status === "draft" && <Badge variant="outline">Draft</Badge>}
        {!ended && isFull && (
          <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10">
            Sold out — waitlist open
          </Badge>
        )}
      </div>
      <div className="mt-3">
        <h1 className="text-4xl font-semibold tracking-tight">{event.title}</h1>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>
            {formatInTimeZone(
              event.starts_at,
              (event as { time_zone?: string }).time_zone ?? "UTC",
            )}{" "}
            →{" "}
            {formatInTimeZone(event.ends_at, (event as { time_zone?: string }).time_zone ?? "UTC")}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {event.location}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" /> {confirmed} / {event.capacity} going
        </div>
      </div>

      {event.description && (
        <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">{event.description}</p>
      )}

      <Link
        to="/hosts/$hostId"
        params={{ hostId: event.host_id }}
        className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
      >
        <Avatar className="h-12 w-12">
          {host?.avatar_url && (
            <AvatarImage src={host.avatar_url} alt={host.display_name ?? "Host"} />
          )}
          <AvatarFallback>{(host?.display_name ?? "H").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hosted by</p>
          <p className="truncate text-sm font-semibold">{host?.display_name ?? "Host"}</p>
          {host?.bio && <p className="line-clamp-1 text-xs text-muted-foreground">{host.bio}</p>}
        </div>
        <span className="text-sm text-primary">View profile →</span>
      </Link>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {!user ? (
          <Button asChild>
            <Link to="/auth/sign-in" search={{ redirect: `/events/${event.id}` }}>
              Sign in to RSVP
            </Link>
          </Button>
        ) : ended ? (
          <Button disabled>Event ended</Button>
        ) : isConfirmed ? (
          <>
            <Badge className="px-3 py-1.5 text-sm">You're going ✓</Badge>
            <Button variant="outline" onClick={handleAddToCalendar}>
              <CalendarPlus className="h-4 w-4" /> Add to calendar
            </Button>
            <Button variant="ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel RSVP"}
            </Button>
          </>
        ) : isWaitlisted ? (
          <>
            <Badge variant="secondary" className="px-3 py-1.5 text-sm">
              On waitlist
            </Badge>
            <Button variant="ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending ? "Leaving…" : "Leave waitlist"}
            </Button>
          </>
        ) : (
          <Button onClick={() => rsvp.mutate()} disabled={rsvp.isPending}>
            {rsvp.isPending ? "Reserving…" : isFull ? "Join waitlist — Free" : "RSVP — Free"}
          </Button>
        )}
        {event.is_paid && (
          <Badge variant="outline" className="text-xs">
            Paid tickets — coming soon
          </Badge>
        )}
      </div>

      <PostEventPanel eventId={event.id} hostId={event.host_id} endedAt={event.ends_at} />
    </article>
  );
}
