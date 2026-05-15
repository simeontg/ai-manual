import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, MapPin, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my/events")({
  component: MyEventsPage,
});

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  cover_image_url: string | null;
  host_id: string;
  host_org_id: string | null;
};

type Item = {
  event: EventRow;
  roles: Set<"owner" | "manager" | "checker" | "attendee">;
  rsvpStatus?: string;
};

type RoleFilter = "all" | "hosting" | "attending";
type WhenFilter = "all" | "upcoming" | "past";

function MyEventsPage() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-events-all", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Item[]> => {
      const map = new Map<string, Item>();

      // 1) Events I own directly (events.host_id)
      const { data: owned, error: e1 } = await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, location, cover_image_url, host_id, host_org_id")
        .eq("host_id", user!.id);
      if (e1) throw e1;
      for (const ev of owned ?? []) {
        const item: Item = map.get(ev.id) ?? { event: ev, roles: new Set() };
        item.roles.add("owner");
        map.set(ev.id, item);
      }

      // 2) Events from organizations I'm a member of
      const { data: memberships, error: e2 } = await supabase
        .from("host_members")
        .select("host_id, role")
        .eq("user_id", user!.id);
      if (e2) throw e2;
      const orgIds = (memberships ?? []).map((m) => m.host_id);
      const roleByOrg = new Map((memberships ?? []).map((m) => [m.host_id, m.role]));
      if (orgIds.length > 0) {
        const { data: orgEvents, error: e3 } = await supabase
          .from("events")
          .select("id, title, starts_at, ends_at, location, cover_image_url, host_id, host_org_id")
          .in("host_org_id", orgIds);
        if (e3) throw e3;
        for (const ev of orgEvents ?? []) {
          const item: Item = map.get(ev.id) ?? { event: ev, roles: new Set() };
          const r = ev.host_org_id ? roleByOrg.get(ev.host_org_id) : undefined;
          if (r === "owner" || r === "manager" || r === "checker") item.roles.add(r);
          map.set(ev.id, item);
        }
      }

      // 3) Events I've RSVP'd to
      const { data: rsvps, error: e4 } = await supabase
        .from("rsvps")
        .select(
          "status, event:events(id, title, starts_at, ends_at, location, cover_image_url, host_id, host_org_id)",
        )
        .eq("user_id", user!.id);
      if (e4) throw e4;
      for (const r of rsvps ?? []) {
        if (!r.event) continue;
        const ev = r.event as EventRow;
        const item: Item = map.get(ev.id) ?? { event: ev, roles: new Set() };
        item.roles.add("attendee");
        item.rsvpStatus = r.status;
        map.set(ev.id, item);
      }

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.event.starts_at).getTime() - new Date(a.event.starts_at).getTime(),
      );
    },
  });

  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [when, setWhen] = useState<WhenFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86400000 - 1 : null;
    const ql = q.trim().toLowerCase();
    return data.filter((it) => {
      const start = new Date(it.event.starts_at).getTime();
      const end = new Date(it.event.ends_at).getTime();
      if (when === "upcoming" && end < now) return false;
      if (when === "past" && end >= now) return false;
      if (fromTs !== null && start < fromTs) return false;
      if (toTs !== null && start > toTs) return false;
      if (
        role === "hosting" &&
        !["owner", "manager", "checker"].some((r) => it.roles.has(r as never))
      )
        return false;
      if (role === "attending" && !it.roles.has("attendee")) return false;
      if (ql && !`${it.event.title} ${it.event.location ?? ""}`.toLowerCase().includes(ql))
        return false;
      return true;
    });
  }, [data, q, role, when, from, to]);

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to see your events.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader title="My events" description="Everything you're hosting or attending." />

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="hosting">Hosting</SelectItem>
              <SelectItem value="attending">Attending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">When</Label>
          <Select value={when} onValueChange={(v) => setWhen(v as WhenFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:col-span-5 lg:grid-cols-2">
          <div>
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-5 w-5" />}
            title="Nothing here yet"
            description="RSVP to an event or create your own."
            action={
              <Button asChild>
                <Link to="/explore">Explore</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it) => {
              const ev = it.event;
              const ended = new Date(ev.ends_at) < new Date();
              const canEdit = ev.host_id === user.id;
              return (
                <div
                  key={ev.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                >
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: ev.id }}
                    className="flex flex-1 flex-col"
                  >
                    {ev.cover_image_url ? (
                      <div
                        className="aspect-[16/9] w-full bg-muted"
                        style={{
                          backgroundImage: `url(${ev.cover_image_url})`,
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ended && <Badge variant="secondary">Ended</Badge>}
                        {it.roles.has("owner") && <Badge>Host</Badge>}
                        {it.roles.has("manager") && <Badge variant="outline">Manager</Badge>}
                        {it.roles.has("checker") && <Badge variant="outline">Checker</Badge>}
                        {it.roles.has("attendee") && (
                          <Badge variant="outline">
                            {it.rsvpStatus === "waitlisted" || it.rsvpStatus === "waitlist"
                              ? "Waitlist"
                              : it.rsvpStatus === "cancelled"
                                ? "Cancelled"
                                : "Going"}
                          </Badge>
                        )}
                      </div>
                      <h3 className="line-clamp-2 text-lg font-semibold leading-snug group-hover:text-primary">
                        {ev.title}
                      </h3>
                      <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(ev.starts_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" /> {ev.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {canEdit && (
                    <Link
                      to="/events/$eventId/edit"
                      params={{ eventId: ev.id }}
                      aria-label="Edit event"
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
