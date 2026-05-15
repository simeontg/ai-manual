import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventCard } from "@/features/events/EventCard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/hosts/$hostId")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url, contact_email")
      .eq("id", params.hostId)
      .maybeSingle();
    return { profile: data };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.profile;
    const name = p?.display_name ?? "Host";
    const desc = (p?.bio ?? `Events hosted by ${name} on Gather.`).slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title: `${name} — Gather` },
      { name: "description", content: desc },
      { property: "og:title", content: name },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
    ];
    if (p?.avatar_url) {
      meta.push({ property: "og:image", content: p.avatar_url });
      meta.push({ name: "twitter:image", content: p.avatar_url });
    }
    return { meta };
  },
  component: HostProfilePage,
});

function HostProfilePage() {
  const { hostId } = Route.useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", hostId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", hostId).maybeSingle();
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["host-events", hostId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("host_id", hostId)
        .eq("status", "published");
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingState />;
  if (!profile)
    return (
      <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
        Host not found.
      </div>
    );

  const contact = (profile as { contact_email?: string | null }).contact_email;

  const initials = (profile.display_name ?? "H")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 ring-2 ring-border">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? "Host"} />
          )}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile.display_name ?? "Host"}
          </h1>
          {profile.bio ? (
            <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">No bio yet.</p>
          )}
          {contact && (
            <a
              href={`mailto:${contact}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="h-4 w-4" /> {contact}
            </a>
          )}
        </div>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Events by this host</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(events ?? []).map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
        {(events ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No published events yet.</p>
        )}
      </div>
    </div>
  );
}
