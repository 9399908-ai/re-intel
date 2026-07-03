# Re-Intel.ai — Build Guide

Phased plan to take the platform from working scaffold to real product.
Phases are ordered by dependency: auth unblocks everything else.

**Status legend:** ✅ done · 🔨 next · ⬜ planned

---

## Phase 0 — Prerequisite ✅

**Attach PostgreSQL on Railway.** Until then, all data (messages, approvals)
resets on every backend restart.

1. Railway project → **+ New → Database → PostgreSQL**
2. Railway injects `DATABASE_URL` into the backend service automatically
3. Next deploy: backend runs `prisma db push`, seeds channels/events, and
   `/api/health` reports `"database": "postgresql"`

---

## Phase 5 — Authentication & Accounts 🔨 NEXT

*The foundation. Admin controls and the WhatsApp feel both need real identity.*

### Schema changes (`backend/prisma/schema.prisma`)
- `User`: add `passwordHash String`, `isAdmin Boolean @default(false)`
- Wire `Message.senderId` for real once users log in (field already exists)

### Backend
- `POST /api/auth/signup` — name, email, password, title, company, role,
  markets, asset types → creates **unverified** user (feeds the existing
  admin approval queue)
- `POST /api/auth/login` — returns JWT (deps already installed)
- `GET /api/auth/me` — current user from token
- Auth middleware: protect all admin routes with `isAdmin`; reject
  unverified users at login with a "pending approval" message
- Socket.io handshake auth: token in `socket.handshake.auth`, so every
  message is attributed to a real user

### Frontend
- Login / signup screens (signup collects the matching-profile fields)
- Auth context + token in `localStorage`; axios/fetch interceptor
- "Pending approval" holding screen after signup
- Replace `Guest-XXXX` names with the logged-in user's name
- Hide the Admin nav button for non-admins
- Logout

### Bootstrap
- Seed script creates the first admin account (email + password from env
  vars) so you can log in and approve everyone else

---

## Phase 6 — Community Management (Admin Power Tools) ✅

*Admin can actually run the platform.*

### Channels (communities)
- `POST/PATCH/DELETE /api/channels` (admin only) — create, rename,
  describe, archive
- Channel membership: public channels (anyone joins) vs. private
  (admin assigns members) — the `User ↔ Channel` many-to-many already
  exists in the schema
- Sidebar shows **your** channels + a "Browse channels" view to join
  public ones
- Admin UI: channel list with member counts, add/remove members

### Events
- `POST/PATCH/DELETE /api/events` (admin only)
- Admin UI: create/edit event form (the "Edit Event" button currently
  does nothing)
- Member-facing "Register" button on CalendarView (endpoint already
  exists: `POST /api/events/:id/register`)

### Members & moderation
- Admin member directory: search, view profile, ban/remove, promote to
  admin, re-verify
- Delete message (admin) — removes from DB and broadcasts a
  `message-deleted` socket event so it disappears live
- Announcement channel type: only admins can post

---

## Phase 7 — WhatsApp-Feel Chat Upgrade ✅ (read receipts & infinite scroll deferred)

*The biggest UX gap. Roughly in order of impact:*

| Feature | How |
|---|---|
| **Unread badges** | Per-channel unread count in sidebar; `lastReadAt` per user/channel; bold channel name + count bubble |
| **Online presence** | Track connected user IDs server-side; green dot on avatars; "N online" in channel header |
| **Typing indicator** | `typing-start`/`typing-stop` socket events, debounced; "Marcus is typing…" under header |
| **Message grouping** | Consecutive messages from same sender within 5 min collapse under one avatar/name; WhatsApp-style bubbles with tail |
| **Day separators** | "Today", "Yesterday", "Jun 30" dividers between message groups |
| **Read receipts** | ✓ sent, ✓✓ delivered, blue ✓✓ read — `messageReads` join table, batch-reported when channel is visible |
| **Reply / quote** | Swipe/click to reply; quoted snippet above the bubble; `replyToId` on Message |
| **Reactions** | Long-press/hover emoji bar; `MessageReaction` table; live via socket |
| **Avatars** | Colored initial circles (deterministic color from name) everywhere |
| **Notifications** | Browser Notification API + subtle sound when a message arrives in an unfocused tab/channel |
| **Infinite scroll** | Paginate history (`?before=<id>&limit=50`) instead of one 100-message load |
| **Mobile layout** | Sidebar becomes a slide-in drawer; full-screen chat on small viewports (currently unusable on phones) |

New schema: `MessageRead`, `MessageReaction`, `Message.replyToId`,
`ChannelMember.lastReadAt`.

---

## Phase 8 — Direct Messages + Matching Loop ✅ (weekly cron & feedback loop deferred)

*Turn the matching engine from a demo into the core value prop.*

- **DM conversations**: `Channel.type = "dm"` (reuses all chat
  infrastructure — history, sockets, receipts come free from Phase 7)
- "Message" button on any member → opens/creates the DM
- **Match introductions**: admin clicks "Introduce" on a suggestion →
  creates a `Match` record + a DM with both users + an intro message
- **Weekly auto-matching**: cron (Railway cron or `node-cron`) runs the
  scoring engine Monday 9am, admin reviews & approves the batch
- **Feedback loop**: 48h after a match meeting, both users get an in-app
  prompt (valuable? follow up?) → writes to the `Feedback` table → feeds
  scoring weights (the `python/matching_engine.py` retraining path)

---

## Phase 9 — Polish & Monetization ⬜

- **Image/file attachments** in chat (Cloudinary or S3 presigned uploads)
- **Email (SendGrid)**: approval notification, match introduction, event
  reminders — env vars already stubbed in `.env.example`
- **Stripe** for paid events (`Event.price` field already exists)
- **Google Calendar** invites for match meetings
- **Hardening**: rate limiting, input validation (zod), helmet, message
  length limits, profanity filter

---

## Suggested order of attack

1. **Phase 0** — you do this (2 clicks in Railway)
2. **Phase 5** — one focused build session; everything else is blocked on it
3. **Phase 7 (top half)** — unread badges, presence, typing, grouping, day
   separators, avatars, mobile. This is the "feels like WhatsApp" moment
4. **Phase 6** — admin channel/event/member management
5. **Phase 7 (bottom half)** — receipts, replies, reactions, notifications
6. **Phase 8** — DMs + matching loop (the differentiator)
7. **Phase 9** — as needed for launch
