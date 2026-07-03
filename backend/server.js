import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { suggestMatches } from './matching.js';

dotenv.config();

const ALLOWED_ORIGINS = [
  'https://re-intel.vercel.app',
  'http://localhost:3000',
];

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

// In-memory fallback store
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
    { id: 1, name: 'Marcus Lee', email: 'marcus@example.com', title: 'Broker', company: 'Lee & Associates', role: 'broker', markets: ['NYC', 'NJ'], assetTypes: ['multifamily', 'office'], verified: true },
    { id: 2, name: 'Sarah Chen', email: 'sarah@example.com', title: 'Owner', company: 'Chen Properties', role: 'owner', markets: ['NYC'], assetTypes: ['multifamily'], verified: true },
    { id: 3, name: 'Robert Martinez', email: 'robert@example.com', title: 'Vendor', company: 'Property Solutions', role: 'vendor', markets: ['NYC', 'Boston'], assetTypes: ['office', 'industrial'], verified: true },
    { id: 4, name: 'John Smith', email: 'john@example.com', title: 'Broker', company: 'Smith Realty', role: 'broker', markets: ['NJ'], assetTypes: ['multifamily'], verified: false },
    { id: 5, name: 'Alice Johnson', email: 'alice@example.com', title: 'Vendor', company: 'Property Solutions', role: 'vendor', markets: ['Boston'], assetTypes: ['office'], verified: false },
  ],
  events: [
    { id: 1, title: 'Re-Deal NYC Mixer', description: 'Networking mixer for NYC members', startDate: '2026-07-12T18:00:00.000Z', endDate: '2026-07-12T21:00:00.000Z', location: 'Marriott, Midtown', capacity: 100, price: 0, registered: 42 },
    { id: 2, title: 'Refinance Workshop', description: 'Cap stack strategies in the current rate environment', startDate: '2026-07-20T14:00:00.000Z', endDate: '2026-07-20T16:00:00.000Z', location: 'Virtual', capacity: 50, price: 0, registered: 28 },
    { id: 3, title: 'TRD NYC Management Monthly Standup', description: 'Monthly community standup', startDate: '2026-07-22T10:00:00.000Z', endDate: '2026-07-22T11:00:00.000Z', location: 'Zoom', capacity: 200, price: 0, registered: 15 },
  ],
  nextEventId: 4,
  matches: [], // { id, user1Id, user2Id, status }
  nextMatchId: 1,
};

async function seedIfEmpty() {
  if (!prisma) return;
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
// Presence — display name <-> socket tracking (real user ids arrive in Phase 5)
// ---------------------------------------------------------------------------
const nameToSockets = new Map(); // display name -> Set<socketId>
const socketToName = new Map(); // socketId -> display name

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

async function persistMessage(channelName, payload) {
  if (prisma) {
    const saved = await prisma.message.create({
      data: {
        content: payload.content,
        senderName: payload.sender,
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

// Channels: groups for everyone + DMs the requesting member participates in.
// GET /api/channels?member=<displayName>
app.get('/api/channels', async (req, res, next) => {
  try {
    const member = req.query.member;
    const all = prisma
      ? await prisma.channel.findMany({ orderBy: { id: 'asc' } })
      : memory.channels;
    const channels = all.filter(
      (c) => c.type !== 'dm' || (member && c.dmParticipants.includes(member))
    );
    res.json({ channels });
  } catch (err) {
    next(err);
  }
});

app.post('/api/channels', async (req, res, next) => {
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

app.patch('/api/channels/:id', async (req, res, next) => {
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
        io.socketsLeave(existing.name); // room name changed; clients rejoin on refresh
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

app.delete('/api/channels/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      const existing = await prisma.channel.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'channel not found' });
      await prisma.channel.delete({ where: { id } }); // messages cascade
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

// Direct messages: find or create the 1:1 channel between two display names
app.post('/api/dms', async (req, res, next) => {
  try {
    const { participants } = req.body;
    if (!Array.isArray(participants) || participants.length !== 2 || participants[0] === participants[1]) {
      return res.status(400).json({ error: 'participants must be two distinct names' });
    }
    const channel = await findOrCreateDm(participants[0], participants[1]);
    for (const name of participants) emitToUser(name, 'dm-started', { channel });
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
});

// Message history: GET /api/messages?channel=<name>&before=<id>&limit=50
app.get('/api/messages', async (req, res, next) => {
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

// Delete a message ("delete for everyone")
app.delete('/api/messages/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    let channelName = req.query.channel;
    if (prisma) {
      const message = await prisma.message.findUnique({ where: { id }, include: { channel: true } });
      if (!message) return res.status(404).json({ error: 'message not found' });
      channelName = message.channel.name;
      await prisma.message.delete({ where: { id } });
    } else {
      if (!channelName) return res.status(400).json({ error: 'channel query param required' });
      const msgs = memory.messages.get(channelName) || [];
      const index = msgs.findIndex((m) => m.id === id);
      if (index === -1) return res.status(404).json({ error: 'message not found' });
      msgs.splice(index, 1);
    }
    io.to(channelName).emit('message-deleted', { channel: channelName, id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Events CRUD
app.get('/api/events', async (req, res, next) => {
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

app.post('/api/events', async (req, res, next) => {
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

app.patch('/api/events/:id', async (req, res, next) => {
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

app.delete('/api/events/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      await prisma.event.delete({ where: { id } }); // registrations cascade
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

app.post('/api/events/:id/register', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

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

// Members
app.get('/api/members/pending', async (req, res, next) => {
  try {
    if (prisma) {
      const pending = await prisma.user.findMany({ where: { verified: false } });
      return res.json({ members: pending });
    }
    res.json({ members: memory.users.filter((u) => !u.verified) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (prisma) {
      const user = await prisma.user.update({ where: { id }, data: { verified: true } });
      return res.json({ member: user });
    }
    const user = memory.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: 'member not found' });
    user.verified = true;
    res.json({ member: user });
  } catch (err) {
    next(err);
  }
});

app.post('/api/members/:id/deny', async (req, res, next) => {
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

app.get('/api/stats', async (req, res, next) => {
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

// Matching
app.get('/api/matches/suggestions', async (req, res, next) => {
  try {
    const users = prisma
      ? await prisma.user.findMany({ where: { verified: true } })
      : memory.users.filter((u) => u.verified);
    res.json({ suggestions: suggestMatches(users) });
  } catch (err) {
    next(err);
  }
});

// Introduce two members: record the match and open a DM with an intro message
app.post('/api/matches/introduce', async (req, res, next) => {
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
// Socket.io — real-time chat, presence, typing, reactions
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`✅ Socket connected: ${socket.id}`);

  socket.on('identify', (name) => {
    if (!name) return;
    socketToName.set(socket.id, name);
    if (!nameToSockets.has(name)) nameToSockets.set(name, new Set());
    nameToSockets.get(name).add(socket.id);
    broadcastPresence();
  });

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

  socket.on('typing', ({ channel, sender, isTyping }) => {
    if (!channel || !sender) return;
    socket.to(channel).emit('typing', { channel, sender, isTyping: !!isTyping });
  });

  socket.on('send-message', async (data) => {
    const { channel, message, sender, replyTo } = data;
    if (!channel || !message) return;

    const payload = {
      sender: sender || 'Member',
      content: message,
      createdAt: new Date().toISOString(),
      replyTo: replyTo || null,
      reactions: {},
    };

    try {
      payload.id = await persistMessage(channel, payload);
    } catch (err) {
      console.error('Failed to persist message:', err.message);
      payload.id = Date.now();
    }

    // Sender already rendered it optimistically; confirm the real id to them
    socket.to(channel).emit('receive-message', { ...payload, channel, isOwn: false });
    socket.emit('message-saved', { channel, id: payload.id, tempId: data.tempId || null });
  });

  socket.on('react-message', async ({ channel, messageId, emoji, reactor }) => {
    if (!channel || !messageId || !emoji || !reactor) return;
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
    const name = socketToName.get(socket.id);
    socketToName.delete(socket.id);
    if (name && nameToSockets.has(name)) {
      const sockets = nameToSockets.get(name);
      sockets.delete(socket.id);
      if (sockets.size === 0) nameToSockets.delete(name);
      broadcastPresence();
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
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
