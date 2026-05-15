# Gather — Usage Guide

Gather is an event hosting platform: publish events, collect RSVPs (with capacity-aware waitlists), issue QR tickets, and check guests in at the door.

This README walks you through the four core flows end-to-end:

**Publish → RSVP → Ticket → Check-in**

---

## Before you start

1. Open the app and click **Sign up** (top-right).
2. Confirm your email, then sign in.
3. You now have an attendee account. To publish events you'll upgrade to a host in Flow 1.

---

## Flow 1 — Publish an event (Host)

**Goal:** Get a published event live so people can find and RSVP to it.

1. Go to **/host** from the top nav and click **Become a host** (one click, no approval).
2. Fill out your host profile: display name, logo/avatar URL, short bio, contact email. This is what attendees see on `/hosts/:id`.
3. Click **New event** (or go to **/events/new**) and fill in:
   - **Title, description, location**
   - **Starts at / Ends at** — local time, stored in UTC
   - **Cover image URL** (optional)
   - **Capacity** — leave blank for unlimited
   - **Visibility** — `public` (appears in Explore) or `unlisted` (only reachable via direct link)
4. Click **Save**. The event is created as a **draft** — not visible to anyone but you.
5. Open the event from **/dashboard** and click **Publish**.
6. Need to change something? Click **Edit** on the event card (in `/dashboard` or `/my/events`) to open `/events/:id/edit` and update any field, including the cover image.
7. Share the event URL (`/events/:id`). Public events also appear automatically in **/explore**.

> Tip: From the dashboard you can **Duplicate** any event to reuse it as a draft template, or **Unpublish** to hide it again.

---

## Flow 2 — RSVP to an event (Attendee)

**Goal:** Reserve a spot. If the event is full, join the waitlist and get auto-promoted when a seat opens.

1. Browse **/explore**, use search and date filters, and open an event.
2. Click **RSVP**.
3. One of two things happens — automatically, on the server:
   - **Seats available** → status `confirmed`. A ticket is issued immediately (Flow 3).
   - **Event full** → status `waitlisted`. You hold a FIFO position based on RSVP time.
4. To cancel, click **Cancel RSVP** on the event page. If you were `confirmed`, the oldest waitlisted person is **auto-promoted** and instantly receives a ticket.

> Capacity, waitlist order, and promotion are handled by database triggers, so the rules hold even under concurrent RSVPs.

---

## Flow 3 — Get your ticket (Attendee)

**Goal:** Have a scannable QR code ready to show at the door.

1. As soon as your RSVP is `confirmed`, a ticket is created for you.
2. Go to **/my/tickets**. Each ticket card shows the event details, a **QR code**, the short ticket code, and an **Add to calendar** (`.ics`) action.
3. At the venue, open this page on your phone and show the QR code to a checker.

> Waitlisted? No ticket yet — it appears here automatically the moment you're promoted.

---

## Flow 4 — Check guests in (Host or Checker)

**Goal:** Validate tickets at the door, fast and idempotently.

1. The host can check in directly. To delegate, the host invites a trusted user as a `checker` from **/team**.
2. Go to **/check-in**.
3. Scan the attendee's QR code (or paste the token).
4. The page tells you immediately:
   - **Checked in** — name + event + timestamp recorded
   - **Already checked in** — shows the previous check-in time (no double-counting)
   - **Invalid token** — ticket doesn't exist or isn't for an event you can check in for
5. Live counters at the top show **total tickets** and **checked-in count**.
6. Made a mistake? Click **Undo** on the most recent check-in to revert it.

---

## Bonus: After the event (Host)

From **/dashboard**, on each event you can export:

- **RSVPs CSV** — name, email, RSVP status, RSVP timestamp
- **Attendance CSV** — name, email, RSVP status, check-in time

Both exports are RFC 4180-quoted with a UTF-8 BOM, so they open cleanly in Excel and Google Sheets.

---

## Roles at a glance

| Role         | What they can do                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Attendee** | Browse events, RSVP, view their own tickets                                                      |
| **Host**     | All of the above + create/publish/edit their own events, see RSVPs, export CSVs, check guests in |
| **Checker**  | Check guests in for events they've been authorized for                                           |

Roles live in a dedicated `user_roles` table and are enforced at the database layer — the UI cannot bypass them.

---

## Image uploads

The managed Storage service is unavailable on this backend (see <https://status.supabase.com/>), so we don't upload to a bucket. Instead, the cover image / host avatar fields accept either:

- **A file upload** — picked from your device. The client resizes it (max 1600px, JPEG ~82% quality) and stores it inline as a base64 data URL on the row.
- **A direct image URL** — from any host that allows hotlinking. Hotlink-protected hosts (e.g. `wikia.nocookie.net`) won't render.

Events without a cover image display a neutral "No image" placeholder.
