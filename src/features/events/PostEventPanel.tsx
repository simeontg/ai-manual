import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Star, Upload, Check, X, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { fileToDataUrl } from "@/lib/image";

export function PostEventPanel({
  eventId,
  hostId,
  endedAt,
}: {
  eventId: string;
  hostId: string;
  endedAt: string;
}) {
  const { user } = useAuth();
  const ended = new Date(endedAt) < new Date();
  const isHost = user?.id === hostId;
  const qc = useQueryClient();

  // ----- Feedback -----
  const { data: feedback } = useQuery({
    queryKey: ["feedback", eventId],
    enabled: ended,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_feedback")
        .select("id, rating, comment, user_id, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const myFeedback = feedback?.find((f) => f.user_id === user?.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const submitFeedback = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (rating < 1) throw new Error("Pick a rating");
      const { error } = await supabase
        .from("event_feedback")
        .upsert(
          { event_id: eventId, user_id: user.id, rating, comment: comment || null },
          { onConflict: "event_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setRating(0);
      setComment("");
      qc.invalidateQueries({ queryKey: ["feedback", eventId] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  // ----- Photos -----
  const { data: photos } = useQuery({
    queryKey: ["photos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_photos")
        .select("id, storage_path, caption, approved, user_id, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sign in required");
      const dataUrl = await fileToDataUrl(file);
      const { error } = await supabase
        .from("event_photos")
        .insert({ event_id: eventId, user_id: user.id, storage_path: dataUrl });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Uploaded — pending host approval.");
      qc.invalidateQueries({ queryKey: ["photos", eventId] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const moderate = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("event_photos").update({ approved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", eventId] }),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const removePhoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", eventId] }),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const report = useMutation({
    mutationFn: async ({
      target_type,
      target_id,
    }: {
      target_type: "event" | "photo";
      target_id: string;
    }) => {
      if (!user) throw new Error("Sign in required");
      const reason = window.prompt("Reason for report?");
      if (!reason) return;
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type,
        target_id,
        reason,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Report submitted."),
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const publicUrl = (path: string) =>
    path.startsWith("data:") || path.startsWith("http") ? path : path;

  const visiblePhotos = (photos ?? []).filter(
    (p) => p.approved || isHost || p.user_id === user?.id,
  );

  return (
    <section className="mt-10 space-y-10 border-t border-border pt-8">
      {/* Feedback */}
      {ended && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Feedback</h2>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => report.mutate({ target_type: "event", target_id: eventId })}
              >
                <Flag className="h-4 w-4" /> Report event
              </Button>
            )}
          </div>
          {user && !myFeedback && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">How was it?</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        n <= rating ? "fill-warning text-warning" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                className="mt-3"
                placeholder="Optional comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                className="mt-3"
                onClick={() => submitFeedback.mutate()}
                disabled={submitFeedback.isPending || rating < 1}
              >
                Submit
              </Button>
            </div>
          )}
          {(feedback?.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {feedback!.map((f) => (
                <li key={f.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-4 w-4 ${
                          n <= f.rating ? "fill-warning text-warning" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  {f.comment && <p className="mt-1.5 text-sm">{f.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Photos */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Photos</h2>
          {user && (
            <label className="inline-flex">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent">
                <Upload className="h-4 w-4" /> Upload photo
              </span>
            </label>
          )}
        </div>
        {visiblePhotos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visiblePhotos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <img
                  src={publicUrl(p.storage_path)}
                  alt={p.caption ?? ""}
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-2 p-2">
                  {p.approved ? (
                    <Badge variant="secondary">Approved</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  <div className="flex gap-1">
                    {isHost && !p.approved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moderate.mutate({ id: p.id, approved: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {isHost && p.approved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moderate.mutate({ id: p.id, approved: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {(isHost || p.user_id === user?.id) && (
                      <Button size="sm" variant="ghost" onClick={() => removePhoto.mutate(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {user && p.user_id !== user.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => report.mutate({ target_type: "photo", target_id: p.id })}
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
