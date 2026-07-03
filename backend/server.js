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

const DEFAULT_CHANNELS = [
  'TRD NYC Management',
  'TRD NJ Management',
  'TRD Boston Deals',
  'Multifamily Operators',
  'Cap Stack & Financing',
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
  messages: new Map(), // channel name -> [{ id, sender, content, timestamp }]
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
};

// Seed the database with channels and sample events on first boot
async function seedIfEmpty() {
  if (!prisma) return;
  const channelCount = await prisma.channel.count();
  if (channelCount === 0) {
    await prisma.channel.createMany({
      data: DEFAULT_CHANNELS.map((name) => ({ name })),
    });
    console.log(`🌱 Seeded ${DEFAULT_CHANNELS.length} channels`);
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
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const formatTime = (date) =>
  new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Backend is running!',
    database: prisma ? 'postgresql' : 'in-memory',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/channels', async (req, res, next) => {
  try {
    if (prisma) {
      const channels = await prisma.channel.findMany({ orderBy: { id: 'asc' } });
      return res.json({ channels: channels.map((c) => c.name) });
    }
    res.json({ channels: DEFAULT_CHANNELS });
  } catch (err) {
    next(err);
  }
});

// Message history for a channel: GET /api/messages?channel=TRD%20NYC%20Management
app.get('/api/messages', async (req, res, next) => {
  try {
    const channel = req.query.channel;
    if (!channel) return res.status(400).json({ error: 'channel query param required' });

    if (prisma) {
      const messages = await prisma.message.findMany({
        where: { channel: { name: channel } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      return res.json({
        messages: messages.map((m) => ({
          id: m.id,
          sender: m.senderName,
          content: m.content,
          timestamp: formatTime(m.createdAt),
        })),
      });
    }
    res.json({ messages: memory.messages.get(channel) || [] });
  } catch (err) {
    next(err);
  }
});

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
        matches: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Weekly match suggestions from the compatibility engine
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

// ---------------------------------------------------------------------------
// Socket.io — real-time chat
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on('join-channel', (channel) => {
    socket.join(channel);
    console.log(`📢 ${socket.id} joined channel: ${channel}`);

    io.to(channel).emit('user-joined', {
      message: `A user joined ${channel}`,
      timestamp: new Date(),
      totalInChannel: io.sockets.adapter.rooms.get(channel)?.size || 0,
    });
  });

  socket.on('send-message', async (data) => {
    const { channel, message, sender } = data;
    if (!channel || !message) return;

    const payload = {
      id: Date.now(),
      sender: sender || 'Member',
      content: message,
      timestamp: formatTime(new Date()),
    };

    // Broadcast to everyone in the channel except the sender (the sender
    // already rendered it via optimistic update)
    socket.to(channel).emit('receive-message', { ...payload, isOwn: false });
    console.log(`💬 [${channel}] ${payload.sender}: ${message}`);

    // Persist
    try {
      if (prisma) {
        await prisma.message.create({
          data: {
            content: message,
            senderName: payload.sender,
            channel: {
              connectOrCreate: { where: { name: channel }, create: { name: channel } },
            },
          },
        });
      } else {
        if (!memory.messages.has(channel)) memory.messages.set(channel, []);
        const channelMessages = memory.messages.get(channel);
        channelMessages.push(payload);
        if (channelMessages.length > 200) channelMessages.shift();
      }
    } catch (err) {
      console.error('Failed to persist message:', err.message);
    }
  });

  socket.on('leave-channel', (channel) => {
    socket.leave(channel);
    console.log(`👋 ${socket.id} left channel: ${channel}`);

    io.to(channel).emit('user-left', {
      message: 'A user left the channel',
      timestamp: new Date(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
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
  console.log(`📊 WebSocket ready for connections (store: ${prisma ? 'postgresql' : 'in-memory'})`);
});
