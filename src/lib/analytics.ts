import { supabase } from '@/integrations/supabase/client';

export interface AttendanceStats {
  totalRsvps: number;
  totalCheckIns: number;
  attendanceRate: number;
}

export interface RsvpTrend {
  date: string;
  count: number;
}

export interface EventSummary {
  id: string;
  title: string;
  startsAt: string;
  totalRsvps: number;
  totalCheckIns: number;
  attendanceRate: number;
}

export async function getHostEvents(hostId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, starts_at, capacity')
    .eq('host_id', hostId)
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAttendanceStats(eventId: string): Promise<AttendanceStats> {
  // Get total RSVPs with status 'going'
  const { data: rsvps, error: rsvpError } = await supabase
    .from('rsvps')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'going');

  if (rsvpError) throw rsvpError;

  // Get total check-ins
  const { data: checkIns, error: checkInError } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', eventId)
    .not('checked_in_at', 'is', null);

  if (checkInError) throw checkInError;

  const totalRsvps = rsvps?.length || 0;
  const totalCheckIns = checkIns?.length || 0;
  const attendanceRate = totalRsvps > 0 ? (totalCheckIns / totalRsvps) * 100 : 0;

  return {
    totalRsvps,
    totalCheckIns,
    attendanceRate: Math.round(attendanceRate * 100) / 100, // Round to 2 decimals
  };
}

export async function getRsvpTrends(eventId: string): Promise<RsvpTrend[]> {
  const { data, error } = await supabase
    .from('rsvps')
    .select('created_at')
    .eq('event_id', eventId)
    .eq('status', 'going')
    .order('created_at');

  if (error) throw error;

  // Group by date
  const trends: { [date: string]: number } = {};
  data?.forEach(rsvp => {
    const date = new Date(rsvp.created_at).toISOString().split('T')[0];
    trends[date] = (trends[date] || 0) + 1;
  });

  return Object.entries(trends)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEventSummaries(hostId: string): Promise<EventSummary[]> {
  const events = await getHostEvents(hostId);

  const summaries = await Promise.all(
    events.map(async (event) => {
      const stats = await getAttendanceStats(event.id);
      return {
        id: event.id,
        title: event.title,
        startsAt: event.starts_at,
        totalRsvps: stats.totalRsvps,
        totalCheckIns: stats.totalCheckIns,
        attendanceRate: stats.attendanceRate,
      };
    })
  );

  return summaries;
}

export function exportToCsv(data: any[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}