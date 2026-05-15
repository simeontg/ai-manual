import { getBrowserTimeZone } from "@/lib/datetime";

export type EventFormValues = {
  title: string;
  description: string;
  location: string;
  starts_at: string; // datetime-local
  ends_at: string; // datetime-local
  time_zone: string;
  capacity: number;
  visibility: "public" | "unlisted";
  status: "draft" | "published";
  cover_image_url: string;
};

export const emptyEventForm = (): EventFormValues => ({
  title: "",
  description: "",
  location: "",
  starts_at: "",
  ends_at: "",
  time_zone: getBrowserTimeZone(),
  capacity: 50,
  visibility: "public",
  status: "draft",
  cover_image_url: "",
});
