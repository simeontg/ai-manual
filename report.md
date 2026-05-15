# Development Report — Gather

A summary of how Gather was built: stack, techniques, what worked, what didn't, and the notable decisions.

---

## Tools & techniques

### Stack

- **Frontend:** React 19, TanStack Start v1 (file-based routing, SSR-capable), Vite 7, TypeScript (strict).
- **Styling:** Tailwind CSS v4 with semantic design tokens defined in `src/styles.css` (oklch color space), shadcn/ui primitives.
- **Data layer:** TanStack Query for server-state caching, optimistic updates, and invalidation.
- **Backend:** Lovable Cloud (managed Supabase) — Postgres, Row-Level Security, Auth (email + Google OAuth).
- **Deployment target:** Cloudflare Workers via TanStack Start's Worker adapter.

### Techniques

- **RLS-first authorization.** Every table has Row-Level Security enabled. A separate `user_roles` table + `has_role()` `SECURITY DEFINER` function avoids recursive policy evaluation and prevents privilege escalation.
- **Database-driven business rules.** Capacity enforcement, FIFO waitlist promotion, and ticket issuance are PL/pgSQL triggers — not app code — so the invariants hold under concurrent RSVPs.
- **Server functions (`createServerFn`)** for typed RPC between client and server, with Zod validation at the boundary.
- **QR tickets** rendered client-side from a server-issued opaque token; check-in is idempotent and supports undo.
- **CSV exports** are RFC 4180-quoted with a UTF-8 BOM for clean Excel/Sheets opening.
- **Calendar integration** via generated `.ics` files (no third-party API).

---

## What worked

- **Triggers for capacity & waitlist.** Pushing the rules into the database eliminated a whole class of race-condition bugs.
- **Semantic design tokens.** Defining colors, gradients, and shadows once in `src/styles.css` kept the UI consistent and made dark-mode trivial.
- **TanStack Query + server functions.** Optimistic UI for RSVP/check-in flows with very little boilerplate — invalidate on mutate, done.
- **File-based routing.** Adding `/explore`, `/dashboard`, `/check-in`, `/hosts/:id`, etc. was as simple as creating a file. Type-safe `<Link>` caught broken navigation at compile time.
- **Idempotent check-in with undo.** The "already checked in" state and the undo action made door operations forgiving.

---

## What did not work (or was painful)

- **Image upload / Storage.** The managed Storage service returned `503 DatabaseSchemaMismatch` because the `storage` schema wasn't provisioned on the backend, and the schema is reserved so we couldn't fix it from migrations — a known upstream issue (see <https://status.supabase.com/>). **Workaround:** instead of uploading to a bucket, the client resizes the picked file (max 1600px, JPEG ~82% via a canvas in `src/lib/image.ts`) and stores it inline as a base64 data URL on the row. Direct image URLs are also accepted as a fallback. Trade-off: row sizes grow, but it sidesteps Storage entirely and keeps the upload UX intact.
- **Ambiguous `host_id` in invite acceptance.** A SQL function joined two tables that both exposed `host_id`, causing `column reference "host_id" is ambiguous`. Fixed by qualifying every column reference.
- **Checker visibility tied to `host_org_id`.** The `is_event_checker` policy requires `events.host_org_id` to match the checker's org membership, but legacy events were created with only `host_id` set. Fixed with a backfill migration plus a `BEFORE INSERT/UPDATE` trigger that auto-links new events to their host's org.
- **CHECK constraints with `now()`.** Validating `expire_at > now()` via CHECK failed because CHECK expressions must be immutable. Replaced with a `BEFORE INSERT/UPDATE` validation trigger.
- **Edit route nesting.** The edit page first lived at `events.$eventId.edit.tsx`, which TanStack Router treated as a child of the event detail layout and rendered the wrong component. Renamed to `events.$eventId_.edit.tsx` (trailing underscore = non-nested) so `/events/:id/edit` mounts standalone.

---

## Notable decisions

1. **Roles in a dedicated table, never on `profiles`.** Storing roles on the user/profile row is a known privilege-escalation footgun. We use `user_roles` + a `SECURITY DEFINER` `has_role()` function, and all policies call that function.
2. **Self-serve host upgrade.** Becoming a host is one click (no admin approval). Lower friction for a demo-grade product.
3. **Waitlist auto-promotion at the database level.** When a `confirmed` RSVP is canceled, a trigger promotes the oldest waitlisted person and issues their ticket in the same transaction.
4. **Tickets issued only on `confirmed`.** Waitlisted users get no ticket until promoted — keeps `/my/tickets` honest and prevents "ghost" QR codes.
5. **Public vs. unlisted events** instead of full ACLs. `public` shows in `/explore`; `unlisted` is reachable only by direct link.
6. **CSV exports as a server function**, not a client-side generator. Keeps the source of truth on the server.
7. **Email confirmation required**, Google OAuth enabled by default. No custom auth UI beyond sign-in / sign-up.
8. **Host-only edit access** enforced by RLS plus an auth gate on `/events/:id/edit`. The Edit button is rendered on the event card only when `event.host_id === user.id`.
