import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, QrCode, Sparkles, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Gather — Free community events" },
      {
        name: "description",
        content: "Host or join free community events. RSVP and get a digital ticket with QR code.",
      },
    ],
  }),
});

function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{ backgroundImage: "var(--gradient-subtle)" }}
        />
        <div className="container mx-auto px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Built for communities, makers & meetups
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
              Bring people together.{" "}
              <span className="bg-[var(--gradient-hero)] bg-clip-text text-transparent">
                Free, beautiful events.
              </span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Publish events in minutes, collect RSVPs, and check guests in with QR codes — all
              without setup fees or hidden costs.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/explore">
                  Explore events <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/host">Become a host</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-16 sm:grid-cols-3">
        {[
          {
            icon: Calendar,
            title: "Publish in minutes",
            body: "Draft, schedule, and publish events with capacity and visibility controls.",
          },
          {
            icon: Ticket,
            title: "RSVP & digital tickets",
            body: "Attendees get an instant ticket with QR code, ready in their account.",
          },
          {
            icon: QrCode,
            title: "Painless check-in",
            body: "Scan tickets at the door. Hosts and dedicated checkers can both check guests in.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]"
          >
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="overflow-hidden rounded-2xl bg-[var(--gradient-hero)] p-10 text-sm shadow-[var(--shadow-glow)] sm:p-16">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Users className="mb-3 h-7 w-7 text-primary" />
              <h2 className="text-2xl font-semibold sm:text-3xl">Hosting a free event?</h2>
              <p className="mt-2 max-w-lg text-sm opacity-90">
                Set up your host profile and publish your first event. Paid events are coming soon.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/host">Get started</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
