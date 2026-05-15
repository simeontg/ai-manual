import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/features/auth/useAuth";
import { getEventSummaries, getRsvpTrends, exportToCsv, type EventSummary, type RsvpTrend } from "@/lib/analytics";

export const Route = createFileRoute("/host/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user } = useAuth();

  const { data: eventSummaries, isLoading: summariesLoading } = useQuery({
    queryKey: ["event-summaries", user?.id],
    queryFn: () => getEventSummaries(user!.id),
    enabled: !!user,
  });

  const { data: rsvpTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ["rsvp-trends", user?.id],
    queryFn: async () => {
      if (!eventSummaries?.length) return [];
      // Get trends for the most recent event
      const latestEvent = eventSummaries[0];
      return getRsvpTrends(latestEvent.id);
    },
    enabled: !!eventSummaries?.length,
  });

  const handleExport = () => {
    if (!eventSummaries) return;
    exportToCsv(eventSummaries, "event-analytics.csv");
  };

  if (summariesLoading) {
    return <LoadingState />;
  }

  if (!eventSummaries?.length) {
    return (
      <EmptyState
        title="No events yet"
        description="Create your first event to start seeing analytics."
        action={
          <Button asChild>
            <Link to="/events/new">Create event</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Event Analytics"
          description="Track attendance, RSVPs, and event performance across your hosted events."
        />
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventSummaries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total RSVPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {eventSummaries.reduce((sum, event) => sum + event.totalRsvps, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {eventSummaries.length > 0
                ? Math.round(eventSummaries.reduce((sum, event) => sum + event.attendanceRate, 0) / eventSummaries.length)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Performance</CardTitle>
            <CardDescription>RSVP and attendance rates for your events</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventSummaries.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="title"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalRsvps" fill="#8884d8" name="RSVPs" />
                <Bar dataKey="totalCheckIns" fill="#82ca9d" name="Check-ins" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RSVP Trends</CardTitle>
            <CardDescription>RSVP activity over time for your latest event</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <LoadingState />
              </div>
            ) : rsvpTrends?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={rsvpTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No RSVP data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Detailed breakdown of your events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Event</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">RSVPs</th>
                  <th className="text-right py-2">Check-ins</th>
                  <th className="text-right py-2">Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {eventSummaries.map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="py-2 font-medium">{event.title}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(event.startsAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">{event.totalRsvps}</td>
                    <td className="py-2 text-right">{event.totalCheckIns}</td>
                    <td className="py-2 text-right">{event.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}