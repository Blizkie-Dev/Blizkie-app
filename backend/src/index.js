require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { runMigrations } = require('./db/migrations');
const { initSocket } = require('./socket/socketServer');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/chats', chatsRoutes);
app.use('/chats', messagesRoutes);

app.use('/uploads', require('express').static(require('path').join(__dirname, '../uploads')));
app.use('/upload', uploadRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Error Handler ─────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.io ─────────────────────────────────────────────────────────────
const io = initSocket(server);
app.set('io', io);

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

runMigrations();

server.listen(PORT, () => {
  console.log(`[Server] Blizkie backend running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
