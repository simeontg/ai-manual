import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Users, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/useAuth";
import type { Database } from "@/integrations/supabase/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export function EventCard({ event }: { event: EventRow }) {
  const { user } = useAuth();
  const ended = new Date(event.ends_at) < new Date();
  const canEdit = user?.id === event.host_id;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <Link to="/events/$eventId" params={{ eventId: event.id }} className="flex flex-1 flex-col">
        {event.cover_image_url ? (
          <div
            className="aspect-[16/9] w-full bg-muted"
            style={{
              backgroundImage: `url(${event.cover_image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            {ended ? (
              <Badge variant="secondary">Ended</Badge>
            ) : event.status === "draft" ? (
              <Badge variant="outline">Draft</Badge>
            ) : (
              <Badge>Upcoming</Badge>
            )}
            {event.visibility === "unlisted" && <Badge variant="outline">Unlisted</Badge>}
            {event.is_paid && <Badge variant="outline">Paid · soon</Badge>}
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">
            {event.title}
          </h3>
          <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(event.starts_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {event.location}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Capacity {event.capacity}
            </div>
          </div>
        </div>
      </Link>
      {canEdit && (
        <Link
          to="/events/$eventId/edit"
          params={{ eventId: event.id }}
          aria-label="Edit event"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      )}
    </div>
  );
}
