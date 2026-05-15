import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { EventCard } from "@/features/events/EventCard";
import { listPublicEvents } from "@/features/events/eventsService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type When = "all" | "upcoming" | "past";

export const Route = createFileRoute("/explore")({
  component: ExplorePage,
  head: () => ({
    meta: [
      { title: "Explore events — Gather" },
      { name: "description", content: "Discover free community events near you." },
    ],
  }),
});

function ExplorePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "public"],
    queryFn: listPublicEvents,
  });

  const [q, setQ] = useState("");
  const [when, setWhen] = useState<When>("upcoming");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const ql = q.trim().toLowerCase();

    return data.filter((e) => {
      const start = new Date(e.starts_at).getTime();
      const end = new Date(e.ends_at).getTime();
      if (when === "upcoming" && end < now) return false;
      if (when === "past" && end >= now) return false;
      if (fromTs !== null && start < fromTs) return false;
      if (toTs !== null && start > toTs) return false;
      if (ql) {
        const hay = `${e.title} ${e.description ?? ""} ${e.location ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [data, q, when, from, to]);

  return (
    <div className="container mx-auto px-4 py-10">
      <PageHeader
        title="Explore events"
        description="Free events from hosts and communities around you."
      />

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q" className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              placeholder="Search events…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">When</Label>
          <Select value={when} onValueChange={(v) => setWhen(v as When)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      <div className="mt-8">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-5 w-5" />}
            title="No events match"
            description="Try clearing filters or searching with a different keyword."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
