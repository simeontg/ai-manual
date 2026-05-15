import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listTimeZones } from "@/lib/datetime";
import { fileToDataUrl } from "@/lib/image";
import { emptyEventForm, type EventFormValues } from "./eventFormModel";

function friendlyError(msg: string, mode: "create" | "edit"): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return mode === "create"
      ? "You don't have permission to create this event. Make sure you're signed in as a host and try again."
      : "You don't have permission to edit this event.";
  }
  if (m.includes("payload") || m.includes("too large") || m.includes("413")) {
    return "The cover image is too large. Try a smaller image and submit again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Network error. Check your connection and retry.";
  }
  return (
    msg ||
    (mode === "create"
      ? "Something went wrong while creating the event. Please try again."
      : "Something went wrong while saving the event. Please try again.")
  );
}

export function EventForm({
  initialValues,
  mode,
  submitLabel,
  onSubmit,
}: {
  initialValues?: Partial<EventFormValues>;
  mode: "create" | "edit";
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<void>;
}) {
  const tzList = listTimeZones();
  const [form, setForm] = useState<EventFormValues>({
    ...emptyEventForm(),
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [confirmRemoveCover, setConfirmRemoveCover] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      const msg = friendlyError((err as Error).message, mode);
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="cover">Cover image</Label>
        <Input
          id="cover"
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setImageError(null);
            try {
              const dataUrl = await fileToDataUrl(f);
              setForm((p) => ({ ...p, cover_image_url: dataUrl }));
            } catch (err) {
              const msg =
                (err as Error).message || "Couldn't read that image. Try a different file.";
              setImageError(msg);
              toast.error(msg);
            }
          }}
        />
        {imageError && (
          <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{imageError}</span>
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                setImageError(null);
                document.getElementById("cover")?.click();
              }}
            >
              Retry
            </button>
          </div>
        )}
        {form.cover_image_url && (
          <div className="mt-2 flex items-start gap-3">
            <img
              src={form.cover_image_url}
              alt="Cover preview"
              className="h-24 w-40 rounded-md border border-border object-cover"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemoveCover(true)}
            >
              Remove
            </Button>
            <AlertDialog open={confirmRemoveCover} onOpenChange={setConfirmRemoveCover}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove cover image?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear the selected cover image. You'll need to upload it again before
                    saving if you change your mind.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep image</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setForm((p) => ({ ...p, cover_image_url: "" }));
                      setImageError(null);
                      const input = document.getElementById("cover") as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="starts_at">Starts at</Label>
          <Input
            id="starts_at"
            type="datetime-local"
            required
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="ends_at">Ends at</Label>
          <Input
            id="ends_at"
            type="datetime-local"
            required
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="time_zone">Time zone</Label>
        <Select value={form.time_zone} onValueChange={(v) => setForm({ ...form, time_zone: v })}>
          <SelectTrigger id="time_zone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {tzList.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Times above are entered in this zone. Attendees see times in their own zone.
        </p>
      </div>
      <div>
        <Label>Pricing</Label>
        <TooltipProvider>
          <RadioGroup value="free" className="mt-2 grid grid-cols-2 gap-3">
            <Label
              htmlFor="price-free"
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-3 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
            >
              <RadioGroupItem id="price-free" value="free" />
              <span className="font-medium">Free</span>
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Label
                  htmlFor="price-paid"
                  className="flex cursor-not-allowed items-center gap-2 rounded-md border border-border bg-muted/40 p-3 opacity-60"
                >
                  <RadioGroupItem id="price-paid" value="paid" disabled />
                  <span className="font-medium">Paid</span>
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                Paid tickets are coming soon. For now, all events on Gather are free.
              </TooltipContent>
            </Tooltip>
          </RadioGroup>
        </TooltipProvider>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Visibility</Label>
          <Select
            value={form.visibility}
            onValueChange={(v) =>
              setForm({ ...form, visibility: v as EventFormValues["visibility"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as EventFormValues["status"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {submitError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{submitError}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submit()}
          >
            {submitting ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
      <Button type="submit" disabled={submitting} size="lg">
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
