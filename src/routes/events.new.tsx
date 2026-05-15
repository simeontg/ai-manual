import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { createEvent } from "@/features/events/eventsService";
import { EventForm } from "@/features/events/EventForm";
import { localInputToISO } from "@/lib/datetime";

export const Route = createFileRoute("/events/new")({
  component: CreateEventPage,
});

function CreateEventPage() {
  const { user, isHost, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <LoadingState />;
  if (!user || !isHost)
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Only hosts can create events.
      </div>
    );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Create event" description="Publish a free community event." />
      <EventForm
        mode="create"
        submitLabel="Create event"
        onSubmit={async (form) => {
          const event = await createEvent({
            host_id: user.id,
            title: form.title,
            description: form.description,
            location: form.location,
            starts_at: localInputToISO(form.starts_at, form.time_zone),
            ends_at: localInputToISO(form.ends_at, form.time_zone),
            time_zone: form.time_zone,
            capacity: form.capacity,
            visibility: form.visibility,
            status: form.status,
            cover_image_url: form.cover_image_url || null,
          });
          toast.success("Event created");
          navigate({ to: "/events/$eventId", params: { eventId: event.id } });
        }}
      />
    </div>
  );
}
