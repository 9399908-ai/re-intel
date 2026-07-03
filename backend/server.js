import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { suggestMatches } from './matching.js';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  signToken,
  sanitizeUser,
  makeAuthMiddleware,
} from './auth.js';

dotenv.config();

const ALLOWED_ORIGINS = [
  'https://re-intel.vercel.app',
  'http://localhost:3000',
];

// Bootstrap admin — override via env on Railway (Settings -> Variables)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@re-intel.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'reintel-admin-2026';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Re-Intel Admin';

// ---------------------------------------------------------------------------
// Database (optional) — when DATABASE_URL is missing or unreachable the server
// falls back to an in-memory store so chat keeps working without PostgreSQL.
// ---------------------------------------------------------------------------
let prisma = null;
if (process.env.DATABASE_URL) {
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('🗄️  Connected to PostgreSQL');
  } catch (err) {
    console.warn(`⚠️  Database unavailable (${err.message}) — using in-memory store`);
    prisma = null;
  }
}

// In-memory fallback store (sample members use password "password123")
const samplePassword = hashPasswordSync('password123');
const memory = {
  channels: [
    { id: 1, name: 'TRD NYC Management', description: null, type: 'group', dmParticipants: [] },
    { id: 2, name: 'TRD NJ Management', description: null, type: 'group', dmParticipants: [] },
    { id: 3, name: 'TRD Boston Deals', description: null, type: 'group', dmParticipants: [] },
    { id: 4, name: 'Multifamily Operators', description: null, type: 'group', dmParticipants: [] },
    { id: 5, name: 'Cap Stack & Financing', description: null, type: 'group', dmParticipants: [] },
  ],
  nextChannelId: 6,
  messages: new Map(), // channel name -> [{ id, sender, content, createdAt, replyTo, reactions }]
  nextMessageId: 1,
  users: [
    { id: 1, name: 'Marcus Lee', email: 'marcus@example.com', phone: '+1-555-0101', passwordHash: samplePassword, isAdmin: false, title: 'Broker', company: 'Lee & Associates', role: 'broker', markets: ['NYC', 'NJ'], assetTypes: ['multifamily', 'office'], verified: true },
    { id: 2, name: 'Sarah Chen', email: 'sarah@example.com', phone: '+1-555-0102', passwordHash: samplePassword, isAdmin: false, title: 'Owner', company: 'Chen Properties', role: 'owner', markets: ['NYC'], assetTypes: ['multifamily'], verified: true },
    { id: 3, name: 'Robert Martinez', email: 'robert@example.com', phone: '+1-555-0103', passwordHash: samplePassword, isAdmin: false, title: 'Vendor', company: 'Property Solutions', role: 'vendor', markets: ['NYC', 'Boston'], assetTypes: ['office', 'industrial'], verified: true },
  ],
  nextUserId: 4,
  events: [
    { id: 1, title: 'Re-Deal NYC Mixer', description: 'Networking mixer for NYC members', startDate: '2026-07-12T18:00:00.000Z', endDate: '2026-07-12T21:00:00.000Z', location: 'Marriott, Midtown', capacity: 100, price: 0, registered: 42 },
    { id: 2, title: 'Refinance Workshop', description: 'Cap stack strategies in the current rate environment', startDate: '2026-07-20T14:00:00.000Z', endDate: '2026-07-20T16:00:00.000Z', location: 'Virtual', capacity: 50, price: 0, registered: 28 },
    { id: 3, title: 'TRD NYC Management Monthly Standup', description: 'Monthly community standup', startDate: '2026-07-22T10:00:00.000Z', endDate: '2026-07-22T11:00:00.000Z', location: 'Zoom', capacity: 200, price: 0, registered: 15 },
  ],
  nextEventId: 4,
  matches: [],
  nextMatchId: 1,
};

async function seedIfEmpty() {
  if (prisma) {
    const channelCount = await prisma.channel.count();
    if (channelCount === 0) {
      await prisma.channel.createMany({
        data: memory.channels.map(({ name }) => ({ name })),
      });
      console.log(`🌱 Seeded ${memory.channels.length} channels`);
    }
    const eventCount = await prisma.event.count();
    if (eventCount === 0) {
      await prisma.event.createMany({
        data: memory.events.map(({ id, registered, ...event }) => event),
      });
      console.log(`🌱 Seeded ${memory.events.length} events`);
    }
    // Bootstrap admin account
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { isAdmin: true, verified: true },
      create: {
        email: ADMIN_EMAIL,
        phone: '+1-555-0100',
        name: ADMIN_NAME,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        isAdmin: true,
        verified: true,
        title: 'Administrator',
        company: 'Re-Intel.ai',
        role: 'owner',
        markets: [],
        assetTypes: [],
      },
    });
  } else {
    memory.users.push({
      id: memory.nextUserId++,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: '+1-555-0100',
      passwordHash: hashPasswordSync(ADMIN_PASSWORD),
      isAdmin: true,
      verified: true,
      title: 'Administrator',
      company: 'Re-Intel.ai',
      role: 'owner',
      markets: [],
      assetTypes: [],
    });
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(`⚠️  Admin bootstrap: ${ADMIN_EMAIL} with the DEFAULT password — set ADMIN_EMAIL/ADMIN_PASSWORD env vars!`);
  } else {
    console.log(`👑 Admin account ready: ${ADMIN_EMAIL}`);
  }
}

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------
const nameToSockets = new Map(); // user name -> Set<socketId>
const socketToName = new Map(); // socketId -> user name

function broadcastPresence() {
  io.emit('presence', { online: [...nameToSockets.keys()] });
}

function emitToUser(name, event, payload) {
  const sockets = nameToSockets.get(name);
  if (!sockets) return;
  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
}

const serializeMessage = (m) => ({
  id: m.id,
  sender: m.senderName ?? m.sender,
  content: m.content,
  createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  replyTo: m.replyTo || null,
  reactions: m.reactions || {},
});

const dmKeyFor = (a, b) => `dm:${[a, b].sort().join('|')}`;

async function findOrCreateDm(a, b) {
  const name = dmKeyFor(a, b);
  const participants = [a, b].sort();
  if (prisma) {
    return prisma.channel.upsert({
      where: { name },
      update: {},
      create: { name, type: 'dm', dmParticipants: participants },
    });
  }
  let channel = memory.channels.find((c) => c.name === name);
  if (!channel) {
    channel = { id: memory.nextChannelId++, name, description: null, type: 'dm', dmParticipants: participants };
    memory.channels.push(channel);
  }
  return channel;
}

async function persistMessage(channelName, payload, senderId = null) {
  if (prisma) {
    const saved = await prisma.message.create({
      data: {
        content: payload.content,
        senderName: payload.sender,
        senderId,
        replyTo: payload.replyTo || undefined,
        reactions: {},
        channel: {
          connectOrCreate: { where: { name: channelName }, create: { name: channelName } },
        },
      },
    });
    return saved.id;
  }
  if (!memory.messages.has(channelName)) memory.messages.set(channelName, []);
  const channelMessages = memory.messages.get(channelName);
  const stored = { ...payload, id: memory.nextMessageId++ };
  channelMessages.push(stored);
  if (channelMessages.length > 500) channelMessages.shift();
  return stored.id;
}

async function findUserByEmail(email) {
  if (prisma) return prisma.user.findUnique({ where: { email } });
  return memory.users.find((u) => u.email === email) || null;
}

async function findUserById(id) {
  if (prisma) return prisma.user.findUnique({ where: { id } });
  return memory.users.find((u) => u.id === id) || null;
}

const { requireAuth, requireAdmin, authenticateSocket } = makeAuthMiddleware(findUserByEmail);

// Kick every socket a user has open (used when they're removed or demoted)
function disconnectUser(name, reason) {
  const sockets = nameToSockets.get(name);
  if (!sockets) return;
  for (const socketId of [...sockets]) {
    io.to(socketId).emit('force-logout', { reason });
    io.sockets.sockets.get(socketId)?.disconnect(true);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { name, email, phone, password, title, company, role, markets, assetTypes } = req.body;
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !password || !role) {
      return res.status(400).json({ error: 'name, email, phone, password, and role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    if (await findUserByEmail(email.trim().toLowerCase())) {
      return res.status(409).json({ error: 'an account with this email already exists' });
    }

    const data = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      passwordHash: await hashPassword(password),
      isAdmin: false,
      title: title?.trim() || role,
      company: company?.trim() || '',
      role,
      markets: Array.isArray(markets) ? markets : [],
      assetTypes: Array.isArray(assetTypes) ? assetTypes : [],
      verified: false,
    };

    let user;
    if (prisma) {
      user = await prisma.user.create({ data });
    } else {
      user = { ...data, id: memory.nextUserId++ };
      memory.users.push(user);
    }
    res.status(201).json({
      user: sanitizeUser(user),
      message: 'Account created — an admin will review your application shortly.',
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'email or phone already registered' });
    }
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'invalid email or password' });
    }
    if (!user.verified) {
      return res.status(403).json({ error: 'pending', message: 'Your membership is pending admin approval.' });
    }
    res.json({ token: signToken(user), user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user || !user.verified) return res.status(401).json({ error: 'account no longer active' });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Backend is running!',
    database: prisma ? 'postgresql' : 'in-memory',
    online: nameToSockets.size,
    timestamp: new Date().toISOString(),
  });
});

// Channels: groups for everyone + the requesting member's DMs
app.get('/api/channels', requireAuth, async (req, res, next) => {
  try {
    const all = prisma
      ? await prisma.channel.findMany({ orderBy: { id: 'asc' } })
      : memory.channels;
    const channels = all.filter(
      (c) => c.type !== 'dm' || c.dmParticipants.includes(req.user.name)
    );
    res.json({ channels });
  } catch (err) {
    next(err);
  }
});

app.post('/api/channels', requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    let channel;
    if (prisma) {
      channel = await prisma.channel.create({
        data: { name: name.trim(), description: description || null },
      });
    } else {
      if (memory.channels.some((c) => c.name === name.trim())) {
        return res.status(409).json({ error: 'channel already exists' });
      }
      channel = { id: memory.nextChannelId++, name: name.trim(), description: description || null, type: 'group', dmParticipants: [] };
      memory.channels.push(channel);
    }
    io.emit('channels-updated');
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/channels/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;
    let channel;
    if (prisma) {
      const existing = await prisma.channel.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'channel not found' });
      channel = await prisma.channel.update({
        where: { id },
        data: {
          ...(name?.trim() ? { name: name.trim() } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });
      if (name?.trim() && existing.name !== channel.name) {
        io.socketsLeave(existing.name);
      }
    } else {
      channel = memory.channels.find((c) => c.id === id);
      if (!channel) return res.status(404).json({ error: 'channel not found' });
      if (name?.trim() && name.trim() !== channel.name) {
        if (memory.messages.has(channel.name)) {
          memory.messages.set(name.trim(), memory.messages.get(channel.name));
          memory.messages.delete(channel.name);
        }
        channel.name = name.trim();
      }
      if (description !== undefined) channel.description = description;
    }
    io.emit('channels-updated');
    res.json({ channel });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/channels/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      const existing = await prisma.channel.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'channel not found' });
      await prisma.channel.delete({ where: { id } });
    } else {
      const index = memory.channels.findIndex((c) => c.id === id);
      if (index === -1) return res.status(404).json({ error: 'channel not found' });
      memory.messages.delete(memory.channels[index].name);
      memory.channels.splice(index, 1);
    }
    io.emit('channels-updated');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Direct messages: open the 1:1 channel between me and another member
app.post('/api/dms', requireAuth, async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to?.trim() || to.trim() === req.user.name) {
      return res.status(400).json({ error: 'a different member name is required' });
    }
    const channel = await findOrCreateDm(req.user.name, to.trim());
    for (const name of channel.dmParticipants) emitToUser(name, 'dm-started', { channel });
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
});

// Message history
app.get('/api/messages', requireAuth, async (req, res, next) => {
  try {
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'channel query param required' });
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = Number(req.query.before) || null;

    if (prisma) {
      const rows = await prisma.message.findMany({
        where: { channel: { name: channel }, ...(before ? { id: { lt: before } } : {}) },
        orderBy: { id: 'desc' },
        take: limit,
      });
      return res.json({ messages: rows.reverse().map(serializeMessage) });
    }
    let msgs = memory.messages.get(channel) || [];
    if (before) msgs = msgs.filter((m) => m.id < before);
    res.json({ messages: msgs.slice(-limit).map(serializeMessage) });
  } catch (err) {
    next(err);
  }
});

// Delete a message — sender or admin only
app.delete('/api/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    let channelName = req.query.channel;
    let senderName;
    if (prisma) {
      const message = await prisma.message.findUnique({ where: { id }, include: { channel: true } });
      if (!message) return res.status(404).json({ error: 'message not found' });
      channelName = message.channel.name;
      senderName = message.senderName;
      if (senderName !== req.user.name && !req.user.isAdmin) {
        return res.status(403).json({ error: 'you can only delete your own messages' });
      }
      await prisma.message.delete({ where: { id } });
    } else {
      if (!channelName) return res.status(400).json({ error: 'channel query param required' });
      const msgs = memory.messages.get(channelName) || [];
      const index = msgs.findIndex((m) => m.id === id);
      if (index === -1) return res.status(404).json({ error: 'message not found' });
      senderName = msgs[index].sender;
      if (senderName !== req.user.name && !req.user.isAdmin) {
        return res.status(403).json({ error: 'you can only delete your own messages' });
      }
      msgs.splice(index, 1);
    }
    io.to(channelName).emit('message-deleted', { channel: channelName, id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Events
app.get('/api/events', requireAuth, async (req, res, next) => {
  try {
    if (prisma) {
      const events = await prisma.event.findMany({
        orderBy: { startDate: 'asc' },
        include: { _count: { select: { registrations: true } } },
      });
      return res.json({
        events: events.map(({ _count, ...e }) => ({ ...e, registered: _count.registrations })),
      });
    }
    res.json({ events: memory.events });
  } catch (err) {
    next(err);
  }
});

app.post('/api/events', requireAdmin, async (req, res, next) => {
  try {
    const { title, description, startDate, endDate, location, capacity, price } = req.body;
    if (!title?.trim() || !startDate) {
      return res.status(400).json({ error: 'title and startDate required' });
    }
    const data = {
      title: title.trim(),
      description: description || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate || startDate),
      location: location || null,
      capacity: capacity ? Number(capacity) : null,
      price: price ? Number(price) : 0,
    };
    let event;
    if (prisma) {
      event = await prisma.event.create({ data });
      event = { ...event, registered: 0 };
    } else {
      event = { ...data, startDate: data.startDate.toISOString(), endDate: data.endDate.toISOString(), id: memory.nextEventId++, registered: 0 };
      memory.events.push(event);
    }
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/events/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { title, description, startDate, endDate, location, capacity, price } = req.body;
    const patch = {
      ...(title?.trim() ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(capacity !== undefined ? { capacity: capacity ? Number(capacity) : null } : {}),
      ...(price !== undefined ? { price: Number(price) || 0 } : {}),
    };
    if (prisma) {
      const event = await prisma.event.update({ where: { id }, data: patch });
      return res.json({ event });
    }
    const event = memory.events.find((e) => e.id === id);
    if (!event) return res.status(404).json({ error: 'event not found' });
    Object.assign(event, patch, {
      ...(patch.startDate ? { startDate: patch.startDate.toISOString() } : {}),
      ...(patch.endDate ? { endDate: patch.endDate.toISOString() } : {}),
    });
    res.json({ event });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/events/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      await prisma.event.delete({ where: { id } });
    } else {
      const index = memory.events.findIndex((e) => e.id === id);
      if (index === -1) return res.status(404).json({ error: 'event not found' });
      memory.events.splice(index, 1);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/events/:id/register', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const email = req.user.email;

    if (prisma) {
      const registration = await prisma.eventRegistration.upsert({
        where: { eventId_userEmail: { eventId, userEmail: email } },
        update: { status: 'registered' },
        create: { eventId, userEmail: email, status: 'registered' },
      });
      return res.json({ registration });
    }
    const event = memory.events.find((e) => e.id === eventId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    event.registered += 1;
    res.json({ registration: { eventId, userEmail: email, status: 'registered' } });
  } catch (err) {
    next(err);
  }
});

// Members (admin)

// Full directory of approved members
app.get('/api/members', requireAdmin, async (req, res, next) => {
  try {
    const members = prisma
      ? await prisma.user.findMany({ where: { verified: true }, orderBy: { name: 'asc' } })
      : [...memory.users.filter((u) => u.verified)].sort((a, b) => a.name.localeCompare(b.name));
    res.json({ members: members.map(sanitizeUser) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/promote', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const target = await findUserById(id);
    if (!target) return res.status(404).json({ error: 'member not found' });
    if (target.isAdmin) return res.json({ member: sanitizeUser(target) });

    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: { isAdmin: true } });
      emitToUser(user.name, 'role-changed', { isAdmin: true });
      return res.json({ member: sanitizeUser(user) });
    }
    target.isAdmin = true;
    emitToUser(target.name, 'role-changed', { isAdmin: true });
    res.json({ member: sanitizeUser(target) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/demote', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'you cannot demote yourself' });
    }
    const target = await findUserById(id);
    if (!target) return res.status(404).json({ error: 'member not found' });

    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: { isAdmin: false } });
      emitToUser(user.name, 'role-changed', { isAdmin: false });
      return res.json({ member: sanitizeUser(user) });
    }
    target.isAdmin = false;
    emitToUser(target.name, 'role-changed', { isAdmin: false });
    res.json({ member: sanitizeUser(target) });
  } catch (err) {
    next(err);
  }
});

// Remove an approved member: account deleted, sockets kicked, token dead
// on the next request (auth middleware re-checks the account every time)
app.post('/api/members/:id/remove', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: 'you cannot remove yourself' });
    }
    const target = await findUserById(id);
    if (!target) return res.status(404).json({ error: 'member not found' });

    if (prisma) {
      await prisma.user.delete({ where: { id } }); // matches/feedback cascade, messages keep senderName
    } else {
      const index = memory.users.findIndex((u) => u.id === id);
      memory.users.splice(index, 1);
    }
    disconnectUser(target.name, 'Your membership has been removed by an admin.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/members/pending', requireAdmin, async (req, res, next) => {
  try {
    const pending = prisma
      ? await prisma.user.findMany({ where: { verified: false } })
      : memory.users.filter((u) => !u.verified);
    res.json({ members: pending.map(sanitizeUser) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: { verified: true } });
      return res.json({ member: sanitizeUser(user) });
    }
    const user = memory.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: 'member not found' });
    user.verified = true;
    res.json({ member: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/deny', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      await prisma.user.delete({ where: { id } });
      return res.json({ ok: true });
    }
    const index = memory.users.findIndex((u) => u.id === id);
    if (index === -1) return res.status(404).json({ error: 'member not found' });
    memory.users.splice(index, 1);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/stats', requireAdmin, async (req, res, next) => {
  try {
    if (prisma) {
      const [members, messages, matches] = await Promise.all([
        prisma.user.count({ where: { verified: true } }),
        prisma.message.count(),
        prisma.match.count(),
      ]);
      return res.json({ stats: { members, messages, matches } });
    }
    let messageCount = 0;
    memory.messages.forEach((msgs) => (messageCount += msgs.length));
    res.json({
      stats: {
        members: memory.users.filter((u) => u.verified).length,
        messages: messageCount,
        matches: memory.matches.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Matching (admin)
app.get('/api/matches/suggestions', requireAdmin, async (req, res, next) => {
  try {
    const users = prisma
      ? await prisma.user.findMany({ where: { verified: true, isAdmin: false } })
      : memory.users.filter((u) => u.verified && !u.isAdmin);
    res.json({ suggestions: suggestMatches(users) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/matches/introduce', requireAdmin, async (req, res, next) => {
  try {
    const user1Id = Number(req.body.user1Id);
    const user2Id = Number(req.body.user2Id);
    const users = prisma
      ? await prisma.user.findMany({ where: { id: { in: [user1Id, user2Id] } } })
      : memory.users.filter((u) => [user1Id, user2Id].includes(u.id));
    const user1 = users.find((u) => u.id === user1Id);
    const user2 = users.find((u) => u.id === user2Id);
    if (!user1 || !user2) return res.status(404).json({ error: 'user not found' });

    let match;
    if (prisma) {
      match = await prisma.match.upsert({
        where: { user1Id_user2Id: { user1Id, user2Id } },
        update: {},
        create: { user1Id, user2Id, status: 'pending' },
      });
    } else {
      match = memory.matches.find((m) => m.user1Id === user1Id && m.user2Id === user2Id);
      if (!match) {
        match = { id: memory.nextMatchId++, user1Id, user2Id, status: 'pending' };
        memory.matches.push(match);
      }
    }

    const channel = await findOrCreateDm(user1.name, user2.name);
    const intro = {
      sender: 'Re-Intel Concierge',
      content: `👋 ${user1.name} (${user1.title}, ${user1.company}) ↔ ${user2.name} (${user2.title}, ${user2.company}) — you've been matched this week! Say hello and find a time to connect.`,
      createdAt: new Date().toISOString(),
      replyTo: null,
      reactions: {},
    };
    intro.id = await persistMessage(channel.name, intro);
    io.to(channel.name).emit('receive-message', { ...intro, channel: channel.name, isOwn: false });
    for (const name of [user1.name, user2.name]) emitToUser(name, 'dm-started', { channel });

    res.status(201).json({ match, channel });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Socket.io — JWT-authenticated real-time chat
// ---------------------------------------------------------------------------

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    const user = await authenticateSocket(token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`✅ ${user.name} connected (${socket.id})`);

  socketToName.set(socket.id, user.name);
  if (!nameToSockets.has(user.name)) nameToSockets.set(user.name, new Set());
  nameToSockets.get(user.name).add(socket.id);
  broadcastPresence();

  socket.on('join-channels', (channelNames) => {
    if (!Array.isArray(channelNames)) return;
    for (const name of channelNames) socket.join(name);
  });

  socket.on('join-channel', (channel) => {
    socket.join(channel);
  });

  socket.on('leave-channel', (channel) => {
    socket.leave(channel);
  });

  socket.on('typing', ({ channel, isTyping }) => {
    if (!channel) return;
    socket.to(channel).emit('typing', { channel, sender: user.name, isTyping: !!isTyping });
  });

  socket.on('send-message', async (data) => {
    const { channel, message, replyTo } = data;
    if (!channel || !message) return;

    const payload = {
      sender: user.name,
      content: message,
      createdAt: new Date().toISOString(),
      replyTo: replyTo || null,
      reactions: {},
    };

    try {
      payload.id = await persistMessage(channel, payload, user.id);
    } catch (err) {
      console.error('Failed to persist message:', err.message);
      payload.id = Date.now();
    }

    socket.to(channel).emit('receive-message', { ...payload, channel, isOwn: false });
    socket.emit('message-saved', { channel, id: payload.id, tempId: data.tempId || null });
  });

  socket.on('react-message', async ({ channel, messageId, emoji }) => {
    if (!channel || !messageId || !emoji) return;
    const reactor = user.name;
    try {
      let reactions;
      if (prisma) {
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message) return;
        reactions = { ...(message.reactions || {}) };
        const names = new Set(reactions[emoji] || []);
        names.has(reactor) ? names.delete(reactor) : names.add(reactor);
        if (names.size === 0) delete reactions[emoji];
        else reactions[emoji] = [...names];
        await prisma.message.update({ where: { id: messageId }, data: { reactions } });
      } else {
        const message = (memory.messages.get(channel) || []).find((m) => m.id === messageId);
        if (!message) return;
        reactions = { ...(message.reactions || {}) };
        const names = new Set(reactions[emoji] || []);
        names.has(reactor) ? names.delete(reactor) : names.add(reactor);
        if (names.size === 0) delete reactions[emoji];
        else reactions[emoji] = [...names];
        message.reactions = reactions;
      }
      io.to(channel).emit('message-reaction', { channel, messageId, reactions });
    } catch (err) {
      console.error('Failed to react:', err.message);
    }
  });

  socket.on('disconnect', () => {
    socketToName.delete(socket.id);
    if (nameToSockets.has(user.name)) {
      const sockets = nameToSockets.get(user.name);
      sockets.delete(socket.id);
      if (sockets.size === 0) nameToSockets.delete(user.name);
      broadcastPresence();
    }
    console.log(`❌ ${user.name} disconnected (${socket.id})`);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
await seedIfEmpty().catch((err) => console.warn('Seed skipped:', err.message));
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`📊 WebSocket ready (store: ${prisma ? 'postgresql' : 'in-memory'})`);
});
