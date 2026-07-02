import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Store active connections
const activeSockets = new Map();

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Backend is running!',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/channels', (req, res) => {
  res.json({
    channels: [
      'TRD NYC Management',
      'TRD NJ Management',
      'TRD Boston Deals',
      'Multifamily Operators',
      'Cap Stack & Financing',
    ],
  });
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);
  activeSockets.set(socket.id, socket);

  // User joins a channel
  socket.on('join-channel', (channel) => {
    socket.join(channel);
    console.log(`📢 ${socket.id} joined channel: ${channel}`);
    
    io.to(channel).emit('user-joined', {
      message: `A user joined ${channel}`,
      timestamp: new Date(),
      totalInChannel: io.sockets.adapter.rooms.get(channel)?.size || 0,
    });
  });

  // User sends a message
  socket.on('send-message', (data) => {
    const { channel, message, sender } = data;
    
    io.to(channel).emit('receive-message', {
      id: Date.now(),
      sender,
      content: message,
      timestamp: new Date().toLocaleTimeString(),
      isOwn: false,
    });
    
    console.log(`💬 [${channel}] ${sender}: ${message}`);
  });

  // User leaves a channel
  socket.on('leave-channel', (channel) => {
    socket.leave(channel);
    console.log(`👋 ${socket.id} left channel: ${channel}`);
    
    io.to(channel).emit('user-left', {
      message: 'A user left the channel',
      timestamp: new Date(),
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    activeSockets.delete(socket.id);
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
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket ready for connections`);
});
