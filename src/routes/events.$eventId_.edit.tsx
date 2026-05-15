import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { getEvent, updateEvent } from "@/features/events/eventsService";
import { EventForm } from "@/features/events/EventForm";
import { isoToLocalInput, localInputToISO } from "@/lib/datetime";

export const Route = createFileRoute("/events/$eventId_/edit")({
  component: EditEventPage,
});

function EditEventPage() {
  const { eventId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId),
    enabled: !!user && !loading,
  });

  if (loading) return <LoadingState />;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Sign in to edit events.
      </div>
    );
  }

  if (isLoading) return <LoadingState />;

  if (error || !event) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (event.host_id !== user.id) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        You can only edit events you host.
      </div>
    );
  }

  const tz = event.time_zone || "UTC";

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Edit event" description="Update the details of your event." />
      <EventForm
        mode="edit"
        submitLabel="Save changes"
        initialValues={{
          title: event.title,
          description: event.description ?? "",
          location: event.location ?? "",
          starts_at: isoToLocalInput(event.starts_at, tz),
          ends_at: isoToLocalInput(event.ends_at, tz),
          time_zone: tz,
          capacity: event.capacity,
          visibility: event.visibility,
          status: event.status as "draft" | "published",
          cover_image_url: event.cover_image_url ?? "",
        }}
        onSubmit={async (form) => {
          await updateEvent(event.id, {
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
          toast.success("Event updated");
          navigate({ to: "/events/$eventId", params: { eventId: event.id } });
        }}
      />
    </div>
  );
}
