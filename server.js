require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./db');
const rl = require('./ratelimit');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ['https://javin-semok.onrender.com','https://javin-semok-*.onrender.com','http://localhost:3000','http://127.0.0.1:3000'], methods: ['GET','POST'], credentials: true } });
const PORT = process.env.PORT || 3000;

const RENAME_FREE = 1;
const RENAME_COST = 50;
const STARTER_COINS = 100;
const DAILY_REWARD = 10;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const VIP_PRICE = 1000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const NAME_MIN = 3, NAME_MAX = 20;
const NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const SLOT_MIN_BET = 10;

const DATA_FILE = path.join(__dirname, 'data.json');
let data = { users: {}, messages: [], topups: [] };

async function loadData() {
  const fromDB = await db.loadFromDB();
  if (fromDB) {
    data.users = fromDB.users || {};
    data.messages = fromDB.messages || [];
    data.topups = fromDB.topups || [];
    data.dms = fromDB.dms || {};
    data.quests = fromDB.quests || {};
    data.pinned = fromDB.pinned || null;
    console.log('✅ Data loaded from MongoDB');
  } else {
    console.error('⚠️ MongoDB kosong, mulai fresh');
  }
}

// Tunggu DB siap sebelum server listen
loadData().then(() => {
  console.log('📦 Data siap, server start...');
  
});

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
    const ext = extMap[file.mimetype] || '.bin';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg','image/png','image/gif','image/webp'];
    const allowedExts = ['.jpg','.jpeg','.png','.gif','.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname).toLowerCase();
    if (baseName.includes('..') || baseName.includes('/') || baseName.includes('\\')) {
      return cb(new Error('Nama file invalid'));
    }
    if (!allowedMimes.includes(file.mimetype)) return cb(new Error('MIME tidak diizinkan'));
    if (!allowedExts.includes(ext)) return cb(new Error('Ekstensi tidak diizinkan'));
    cb(null, true);
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// COOKIE-SEC — set cookie security flags
app.use((req, res, next) => {
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'set-cookie' && Array.isArray(value)) {
      value = value.map(c => c.replace(/;\s*$/g, '') + '; Secure; SameSite=Lax');
    } else if (name.toLowerCase() === 'set-cookie' && typeof value === 'string') {
      value = value.replace(/;\s*$/g, '') + '; Secure; SameSite=Lax';
    }
    return origSetHeader(name, value);
  };
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ada' });

// Upload error handler
app.use((err, req, res, next) => {
  if (req.path === '/upload' && err) {
    return res.status(400).json({ error: err.message || 'Upload gagal' });
  }
  next(err);
});
  res.json({ ok: true, url: '/uploads/' + req.file.filename });
});

const onlineUsers = new Map();
const adminSockets = new Set();

function generateGuestName(userId) {
  return 'Guest-' + userId.replace(/-/g, '').slice(0, 6).toLowerCase();
}
function isNameTaken(name, exceptUserId) {
  const l = name.toLowerCase();
  return Object.values(data.users).some(u => u.userId !== exceptUserId && u.username.toLowerCase() === l);
}
function publicUser(u) {
  return {
    userId: u.userId, username: u.username, coins: u.coins,
    renameCount: u.renameCount,
    freeRenameLeft: Math.max(0, RENAME_FREE - u.renameCount),
    badge: u.badge || 'member',
    lastDaily: u.lastDaily || 0,
    theme: u.theme || 'light',
    wallpaper: u.wallpaper || 'default',
    bubbleColor: u.bubbleColor || '#d9fdd3',
    customBadge: u.customBadge || null,
    ownedBadges: u.ownedBadges || [],
    ach: u.ach || { slotWins: 0, giftSent: 0, tebakWins: 0, daduWins: 0, unlocked: {} },
    messageCount: u.messageCount || 0,
    createdAt: u.createdAt
  };
}
function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return h + 'j ' + m + 'm';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}
const ACHIEVEMENTS = [
  { id: 'pemula',     icon: '🌱', name: 'Pemula',         desc: 'Kirim 10 pesan',        reward: 20,   check: function(u){ return (u.messageCount || 0) >= 10; } },
  { id: 'aktif',      icon: '💬', name: 'Aktif',          desc: 'Kirim 100 pesan',       reward: 35,   check: function(u){ return (u.messageCount || 0) >= 100; } },
  { id: 'addict',     icon: '🔥', name: 'Chat Addict',    desc: 'Kirim 500 pesan',       reward: 125,  check: function(u){ return (u.messageCount || 0) >= 500; } },
  { id: 'hoki',       icon: '🎰', name: 'Hoki',           desc: 'Menang slot 5x',        reward: 60,   check: function(u){ return ((u.ach && u.ach.slotWins) || 0) >= 5; } },
  { id: 'sultanslot', icon: '💎', name: 'Sultan Slot',    desc: 'Menang slot 50x',       reward: 75,   check: function(u){ return ((u.ach && u.ach.slotWins) || 0) >= 50; } },
  { id: 'dermawan',   icon: '🎁', name: 'Dermawan',       desc: 'Kirim gift coin 5x',    reward: 20,   check: function(u){ return ((u.ach && u.ach.giftSent) || 0) >= 5; } },
  { id: 'penebak',    icon: '🎯', name: 'Penebak Jitu',   desc: 'Menang Tebak Angka 1x', reward: 20,   check: function(u){ return ((u.ach && u.ach.tebakWins) || 0) >= 1; } },
  { id: 'pelempar',   icon: '🎲', name: 'Pelempar Dadu',  desc: 'Menang Dadu 3x',        reward: 30,   check: function(u){ return ((u.ach && u.ach.daduWins) || 0) >= 3; } },
  { id: 'juragan',    icon: '💰', name: 'Juragan',        desc: 'Punya 10.000 coin',     reward: 500,  check: function(u){ return u.coins >= 10000; } },
  { id: 'sultan',     icon: '👑', name: 'Sultan',         desc: 'Punya 100.000 coin',    reward: 1000, check: function(u){ return u.coins >= 100000; } }
];

function initAch(u) {
  if (!u.ach) u.ach = { slotWins: 0, giftSent: 0, tebakWins: 0, daduWins: 0, unlocked: {} };
  if (!u.ach.unlocked) u.ach.unlocked = {};
  return u.ach;
}

function checkAchievements(uid) {
  const u = data.users[uid];
  if (!u) return;
  const ach = initAch(u);
  if (!ach.claimed) ach.claimed = {};
  let changed = false;
  ACHIEVEMENTS.forEach(function(a){
    if (ach.unlocked[a.id]) return;
    var ok = false;
    try { ok = a.check(u); } catch(e) {}
    if (!ok) return;
    ach.unlocked[a.id] = Date.now();
    changed = true;
    // Notif ke user — "buka achievement, ada yang bisa diklaim"
    onlineUsers.forEach(function(ouid, sid){
      if (ouid === uid) {
        var s2 = io.sockets.sockets.get(sid);
        if (s2) s2.emit('achievement-ready', { id: a.id, icon: a.icon, name: a.name, reward: a.reward });
      }
    });
  });
  if (changed) saveData();
}

const CUSTOM_BADGES = {
  dragon:  { icon: '🐉', name: 'Naga',    price: 5000 },
  alien:   { icon: '👽', name: 'Alien',   price: 10000 },
  sultan:  { icon: '🔥', name: 'Sultan',  price: 25000 },
  legend:  { icon: '🌟', name: 'Legend',  price: 50000 },
  death:   { icon: '💀', name: 'Death',   price: 100000 },
  emperor: { icon: '👑', name: 'Emperor', price: 250000 }
};

function broadcastUserUpdate(userId) {
  const u = data.users[userId];
  if (!u) return;
  io.emit('user-updated', { userId, username: u.username, badge: u.badge });
  onlineUsers.forEach((uid, sid) => {
    if (uid === userId) {
      const s = io.sockets.sockets.get(sid);
      if (s) s.emit('me', publicUser(u));
    }
  });
  try { checkAchievements(userId); } catch(e) {}
}

function dmKey(a, b) { return [a, b].sort().join('|'); }

function saveData() {
  db.saveToDB(data);
}

// ===== SOCKET AUTH MIDDLEWARE =====

io.on('connection', (socket) => {

  socket.on('peek-online', () => {
    socket.emit('online', onlineUsers.size);
  });

  socket.on('join', (userId) => {
    if (typeof userId !== 'string' || userId.length < 8) {
      return socket.emit('auth-fail', 'ID tidak valid');
    }
    // Verify — userId harus sama dengan yang dikirim di handshake
    if (userId !== socket._authUserId) {
      return socket.emit('auth-fail', 'User ID mismatch');
    }
    if (!data.users[userId]) {
      const newToken = crypto.randomBytes(16).toString('hex');
      data.users[userId] = {
        userId, username: generateGuestName(userId),
        coins: STARTER_COINS, renameCount: 0, ownedBadges: [], customBadge: null,
        badge: 'member', lastDaily: 0, theme: 'light',
        messageCount: 0, banned: false, createdAt: Date.now(),
        authToken: newToken
      };
      saveData();
      socket.emit('auth-token', newToken);
    } else if (!data.users[userId].authToken) {
      // Migrasi user lama — generate token
      const newToken = crypto.randomBytes(16).toString('hex');
      data.users[userId].authToken = newToken;
      saveData();
      socket.emit('auth-token', newToken);
    }
    const user = data.users[userId];
    if (user.banned) return socket.emit('auth-fail', 'Akun lo di-ban oleh admin.');

    onlineUsers.forEach((u, sid) => {
      if (u === userId && sid !== socket.id) {
        const old = io.sockets.sockets.get(sid);
        if (old) { old.emit('kicked'); old.disconnect(true); }
      }
    });

    onlineUsers.set(socket.id, userId);
    socket.emit('me', publicUser(user));
    socket.emit('history', data.messages);
    io.emit('system', user.username + ' bergabung');
    io.emit('online', onlineUsers.size);
  });

  socket.on('rename', ({ newName } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const user = data.users[uid];
    if (typeof newName !== 'string') return cb({ error: 'Nama tidak valid' });
    newName = newName.trim();
    if (newName.length < NAME_MIN) return cb({ error: 'Minimal ' + NAME_MIN + ' karakter' });
    if (newName.length > NAME_MAX) return cb({ error: 'Maksimal ' + NAME_MAX + ' karakter' });
    if (!NAME_REGEX.test(newName)) return cb({ error: 'Hanya huruf, angka, underscore' });
    if (newName.toLowerCase() === user.username.toLowerCase()) return cb({ error: 'Sama dengan nama sekarang' });
    if (isNameTaken(newName, user.userId)) return cb({ error: 'Nama sudah dipakai' });
    const isFree = user.renameCount < RENAME_FREE;
    const cost = isFree ? 0 : RENAME_COST;
    if (!isFree && user.coins < cost) return cb({ error: 'Butuh ' + cost + ' coin. Saldo: ' + user.coins });
    const oldName = user.username;
    user.username = newName;
    user.renameCount++;
    if (!isFree) user.coins -= cost;
    saveData();
    io.emit('system', oldName + ' ganti nama jadi ' + newName);
    io.emit('user-updated', { userId: uid, username: newName, badge: user.badge });
    cb({ ok: true, user: publicUser(user), cost });
  });

  socket.on('theme-set', ({ theme } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const u = data.users[uid];
    u.theme = theme === 'dark' ? 'dark' : 'light';
    saveData();
    cb({ ok: true, theme: u.theme });
  });

  socket.on('daily-claim', (cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const u = data.users[uid];
    const now = Date.now();
    if (now - (u.lastDaily || 0) < DAILY_COOLDOWN) {
      const left = DAILY_COOLDOWN - (now - (u.lastDaily || 0));
      return cb({ error: 'Tunggu ' + formatDuration(left) + ' lagi' });
    }
    u.coins += DAILY_REWARD;
    u.lastDaily = now;
    saveData();
    cb({ ok: true, amount: DAILY_REWARD, user: publicUser(u) });
  });

  socket.on('buy-vip', (cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const u = data.users[uid];
    if (u.badge === 'vip' || u.badge === 'admin') return cb({ error: 'Lo udah VIP/Admin' });
    if (u.coins < VIP_PRICE) return cb({ error: 'Butuh ' + VIP_PRICE + ' coin. Saldo: ' + u.coins });
    u.coins -= VIP_PRICE;
    u.badge = 'vip';
    saveData();
    io.emit('system', u.username + ' jadi VIP 💎');
    broadcastUserUpdate(uid);
    cb({ ok: true, user: publicUser(u) });
  });

  socket.on('leaderboard-get', (cb) => {
    if (typeof cb !== 'function') return;
    const users = Object.values(data.users).filter(u => !u.banned);
    const topCoin = [...users].sort((a,b) => b.coins - a.coins).slice(0, 10)
      .map(u => ({ username: u.username, coins: u.coins, badge: u.badge }));
    const topChat = [...users].sort((a,b) => (b.messageCount||0) - (a.messageCount||0)).slice(0, 10)
      .map(u => ({ username: u.username, messages: u.messageCount||0, badge: u.badge }));
    cb({ ok: true, topCoin, topChat });
  });

  socket.on('slot-spin', ({ bet } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const u = data.users[uid];
    bet = parseInt(bet);
    if (!bet || bet < SLOT_MIN_BET) return cb({ error: 'Minimal bet ' + SLOT_MIN_BET + ' coin' });
    if (u.coins < bet) return cb({ error: 'Coin gak cukup. Saldo: ' + u.coins });

    const REELS = 5, ROWS = 2;
    const POOL = [
      { s: 'A', w: 22 }, { s: 'B', w: 18 }, { s: 'C', w: 14 },
      { s: 'D', w: 10 }, { s: 'E', w: 7 }, { s: 'F', w: 4 }, { s: 'G', w: 5 }
    ];
    const SYM = { A: '🍒', B: '🍋', C: '🍇', D: '⭐', E: '💎', F: '7️⃣', G: '🎰' };
    const totalW = POOL.reduce((a,b) => a + b.w, 0);
    const pick = () => {
      let r = Math.random() * totalW;
      for (const p of POOL) { r -= p.w; if (r <= 0) return SYM[p.s]; }
      return SYM.A;
    };

    const grid = [];
    for (let r = 0; r < REELS; r++) grid[r] = [pick(), pick()];

    const PAY = {
      '🍒': { 3: 1, 4: 3, 5: 10 },
      '🍋': { 3: 1, 4: 4, 5: 12 },
      '🍇': { 3: 2, 4: 6, 5: 18 },
      '⭐': { 3: 3, 4: 10, 5: 30 },
      '💎': { 3: 5, 4: 18, 5: 60 },
      '7️⃣': { 3: 10, 4: 40, 5: 200 }
    };

    let totalMult = 0;
    const wins = [];

    for (let row = 0; row < ROWS; row++) {
      const first = grid[0][row];
      if (first === '🎰') continue;
      let count = 1;
      for (let r = 1; r < REELS; r++) {
        if (grid[r][row] === first) count++;
        else break;
      }
      if (count >= 3 && PAY[first] && PAY[first][count]) {
        const m = PAY[first][count];
        totalMult += m;
        wins.push({ row, symbol: first, count, mult: m, cells: Array.from({length: count}, (_, i) => ({ r: i, row })) });
      }
    }

    let scatters = 0;
    const scatterPositions = [];
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        if (grid[r][row] === '🎰') { scatters++; scatterPositions.push({ r, row }); }
      }
    }
    if (scatters >= 3) {
      const scatterMult = scatters === 3 ? 5 : scatters === 4 ? 20 : 100;
      totalMult += scatterMult;
      wins.push({ scatter: true, count: scatters, mult: scatterMult, cells: scatterPositions });
    }

    const win = totalMult > 0 ? bet * totalMult : 0;
    u.coins -= bet;
    u.coins += win;
    saveData();
    broadcastUserUpdate(uid);

    let tier = 'none';
    if (totalMult >= 100) tier = 'jackpot';
    else if (totalMult >= 30) tier = 'mega';
    else if (totalMult >= 10) tier = 'big';
    else if (totalMult >= 3) tier = 'win';

    if (totalMult >= 10) {
      io.emit('system', '🎰 ' + u.username + ' menang ' + win + ' coin! (x' + totalMult + ' ' + tier.toUpperCase() + ')');
    }

    cb({ ok: true, grid, bet, multiplier: totalMult, win, coins: u.coins, wins, scatters, tier });
  });

  socket.on('admin-login', ({ password } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const ip = socket.handshake.address || 'unknown';
    const lc = rl.checkLoginLimit(ip);
    if (!lc.ok) return cb({ error: 'Terlalu banyak percobaan. Tunggu ' + lc.waitSec + ' detik.' });
    if (password !== ADMIN_PASSWORD) {
      rl.recordLoginFail(ip);
      return cb({ error: 'Password salah' });
    }
    rl.resetLoginLimit(ip);
    adminSockets.add(socket.id);
    // Generate admin token
    const adminTok = crypto.randomBytes(24).toString('hex');
    if (!data.adminTokens) data.adminTokens = {};
    data.adminTokens[adminTok] = { time: Date.now() };
    socket._adminToken = adminTok;
    const uid = onlineUsers.get(socket.id);
    if (uid && data.users[uid]) {
      data.users[uid].badge = 'admin';
      saveData();
      broadcastUserUpdate(uid);
    }
    cb({ ok: true, adminToken: socket._adminToken });
  });

  socket.on('admin-list', (cb) => {
    if (typeof cb !== 'function') return;
    if (!adminSockets.has(socket.id)) return cb({ error: 'Bukan admin' });
    const list = Object.values(data.users).map(u => ({
      userId: u.userId, username: u.username, coins: u.coins,
      badge: u.badge || 'member', banned: !!u.banned,
      online: [...onlineUsers.values()].includes(u.userId)
    }));
    cb({ ok: true, users: list, topups: data.topups.slice(-30).reverse() });
  });

  socket.on('admin-action', ({ action, targetUserId, amount } = {}, cb) => {
    if (typeof cb !== 'function') return;
    if (!adminSockets.has(socket.id)) return cb({ error: 'Bukan admin' });
    const t = data.users[targetUserId];
    if (!t) return cb({ error: 'User tidak ditemukan' });
    if (action === 'kick') {
      onlineUsers.forEach((uid, sid) => {
        if (uid === targetUserId) {
          const s = io.sockets.sockets.get(sid);
          if (s) { s.emit('kicked'); s.disconnect(true); }
        }
      });
      return cb({ ok: true, msg: t.username + ' di-kick' });
    }
    if (action === 'give-coin') {
      amount = parseInt(amount) || 0;
      if (amount <= 0) return cb({ error: 'Jumlah invalid' });
      t.coins += amount;
      saveData();
      broadcastUserUpdate(targetUserId);
      return cb({ ok: true, msg: '+' + amount + ' coin ke ' + t.username });
    }
    if (action === 'ban') {
      t.banned = true;
      saveData();
      onlineUsers.forEach((uid, sid) => {
        if (uid === targetUserId) {
          const s = io.sockets.sockets.get(sid);
          if (s) { s.emit('kicked'); s.disconnect(true); }
        }
      });
      return cb({ ok: true, msg: t.username + ' di-ban' });
    }
    if (action === 'unban') {
      t.banned = false;
      saveData();
      return cb({ ok: true, msg: t.username + ' di-unban' });
    }
    cb({ error: 'Aksi tidak dikenal' });
  });

  socket.on('topup-request', ({ amount, method, note } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    amount = parseInt(amount);
    if (!amount || amount < 1000) return cb({ error: 'Minimal top-up 1000 coin' });
    const req = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      userId: uid, username: data.users[uid].username,
      amount, method: String(method || 'qris').slice(0, 30),
      note: String(note || '').slice(0, 200),
      status: 'pending', time: Date.now()
    };
    data.topups.push(req);
    saveData();
    adminSockets.forEach(sid => {
      const s = io.sockets.sockets.get(sid);
      if (s) s.emit('topup-new', req);
    });
    cb({ ok: true, id: req.id });
  });

  socket.on('admin-topup-action', ({ id, action } = {}, cb) => {
    if (typeof cb !== 'function') return;
    if (!adminSockets.has(socket.id)) return cb({ error: 'Bukan admin' });
    const req = data.topups.find(t => t.id === id);
    if (!req) return cb({ error: 'Request tidak ada' });
    if (req.status !== 'pending') return cb({ error: 'Sudah diproses' });
    if (action === 'approve') {
      const t = data.users[req.userId];
      if (t) {
        t.coins += req.amount;
        req.status = 'approved';
        saveData();
        broadcastUserUpdate(req.userId);
      }
    } else {
      req.status = 'rejected';
      saveData();
    }
    cb({ ok: true });
  });

  socket.on('message', (payload) => {
    const uid = onlineUsers.get(socket.id);
    if (!uid) return;
    if (!rl.checkMessageLimit(uid)) {
      console.log('RATE-LIMIT-HIT user=' + uid);
      return socket.emit('rate-limited', { msg: 'Pelan dong, jangan spam!' });
    }
    const u = data.users[uid];
    if (!u || u.banned) return;

    let msg = null;
    let replyToId = null;

    if (typeof payload === 'string') {
      const text = payload.trim().slice(0, 2000);
      if (!text) return;
      msg = { type: 'text', text };
    } else if (payload && typeof payload === 'object') {
      if (payload.type === 'image' && typeof payload.url === 'string') {
        if (!payload.url.startsWith('/uploads/')) return;
        msg = { type: 'image', url: payload.url.slice(0, 200) };
      } else if (payload.type === 'text' && typeof payload.text === 'string') {
        const text = payload.text.trim().slice(0, 2000);
        if (!text) return;
        msg = { type: 'text', text };
      } else return;
      if (payload.replyTo) replyToId = payload.replyTo;
    } else return;

    Object.assign(msg, {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      userId: uid, user: u.username, badge: u.badge || 'member',
      time: Date.now(), reactions: {}
    });

    if (replyToId) {
      const parent = data.messages.find(m => m.id === replyToId);
      if (parent) {
        msg.replyTo = parent.id;
        msg.replyPreview = {
          user: parent.user,
          text: parent.type === 'image' ? '📎 Gambar' : (parent.text || '').slice(0, 80)
        };
      }
    }

    u.messageCount = (u.messageCount || 0) + 1; try { checkAchievements(uid); } catch(e) {} // msg
    data.messages.push(msg);
    if (data.messages.length > 500) data.messages.shift();
    saveData();
    io.emit('message', msg);
  });

  socket.on('typing', (isTyping) => {
    const uid = onlineUsers.get(socket.id);
    if (!uid) return;
    const u = data.users[uid];
    if (!u) return;
    socket.broadcast.emit('typing', { user: u.username, isTyping: !!isTyping });
  });

  // ============ DM HANDLERS ============
  socket.on('user-list', (cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const onlineIds = new Set(onlineUsers.values());
    const list = Object.values(data.users)
      .filter(u => u.userId !== uid && !u.banned)
      .map(u => {
        const key = dmKey(uid, u.userId);
        const dms = data.dms[key] || [];
        const last = dms[dms.length - 1];
        return {
          userId: u.userId,
          username: u.username,
          badge: u.badge || 'member',
          online: onlineIds.has(u.userId),
          lastMsg: last ? {
            mine: last.from === uid,
            text: last.type === 'image' ? '📎 Gambar' : last.text,
            time: last.time
          } : null
        };
      });
    list.sort((a, b) => {
      const ta = a.lastMsg ? a.lastMsg.time : 0;
      const tb = b.lastMsg ? b.lastMsg.time : 0;
      if (tb !== ta) return tb - ta;
      return (b.online ? 1 : 0) - (a.online ? 1 : 0);
    });
    cb({ ok: true, users: list });
  });

  socket.on('dm-open', ({ otherUserId } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const other = data.users[otherUserId];
    if (!other) return cb({ error: 'User tidak ada' });
    const key = dmKey(uid, otherUserId);
    const msgs = data.dms[key] || [];
    cb({
      ok: true,
      messages: msgs,
      other: { userId: otherUserId, username: other.username, badge: other.badge || 'member' }
    });
  });

  socket.on('dm-send', ({ otherUserId, payload } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const u = data.users[uid];
    const other = data.users[otherUserId];
    if (!other) return cb({ error: 'User tidak ada' });
    if (!u || u.banned) return cb({ error: 'Akun di-ban' });

    let msg;
    if (typeof payload === 'string') {
      const text = payload.trim().slice(0, 2000);
      if (!text) return cb({ error: 'Pesan kosong' });
      msg = { type: 'text', text };
    } else if (payload && payload.type === 'image' && typeof payload.url === 'string' && payload.url.startsWith('/uploads/')) {
      msg = { type: 'image', url: payload.url.slice(0, 200) };
    } else return cb({ error: 'Pesan invalid' });

    msg.from = uid;
    msg.time = Date.now();
    const key = dmKey(uid, otherUserId);
    if (!data.dms[key]) data.dms[key] = [];
    data.dms[key].push(msg);
    if (data.dms[key].length > 500) data.dms[key].shift();
    saveData();

    socket.emit('dm-message', { key, msg, otherUserId });
    onlineUsers.forEach((ouid, sid) => {
      if (ouid === otherUserId) {
        const s2 = io.sockets.sockets.get(sid);
        if (s2) s2.emit('dm-message', { key, msg, otherUserId: uid });
      }
    });

    cb({ ok: true, msg });
  });

  socket.on('dm-typing', ({ otherUserId, isTyping } = {}) => {
    const uid = onlineUsers.get(socket.id);
    if (!uid) return;
    const u = data.users[uid];
    if (!u) return;
    onlineUsers.forEach((ouid, sid) => {
      if (ouid === otherUserId) {
        const s2 = io.sockets.sockets.get(sid);
        if (s2) s2.emit('dm-typing', { from: uid, username: u.username, isTyping: !!isTyping });
      }
    });
  });

  // ============ REACT/DELETE ============
  

  

  socket.on('react-message', ({ msgId, emoji } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const msg = data.messages.find(m => m.id === msgId);
    if (!msg) return cb({ error: 'Pesan tidak ada' });
    const allowed = ['❤️', '😂', '👍', '🔥', '😮', '😢'];
    if (!allowed.includes(emoji)) return cb({ error: 'Emoji tidak valid' });
    if (!msg.reactions) msg.reactions = {};

    // Cek dulu — apa user udah react emoji ini?
    const alreadySame = msg.reactions[emoji] && msg.reactions[emoji].includes(uid);

    // Hapus user dari SEMUA emoji di pesan ini (1 user = 1 reaction)
    Object.keys(msg.reactions).forEach(k => {
      msg.reactions[k] = msg.reactions[k].filter(u => u !== uid);
      if (msg.reactions[k].length === 0) delete msg.reactions[k];
    });

    // Kalau tadi react emoji yang sama → toggle off (gak nambah)
    // Kalau react emoji beda / baru → tambah
    if (!alreadySame) {
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      msg.reactions[emoji].push(uid);
    }

    saveData();
    io.emit('message-reacted', { msgId, reactions: msg.reactions });
    cb({ ok: true });
  });

  


  socket.on('delete-message', ({ msgId } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const msg = data.messages.find(m => m.id === msgId);
    if (!msg) return cb({ error: 'Pesan tidak ada' });
    const _me = data.users[uid];
    const _isAdmin = adminSockets.has(socket.id) || (_me && _me.badge === 'admin');
    if (msg.userId !== uid && !_isAdmin) return cb({ error: 'Bukan pesan lo' });
    msg.deleted = true;
    msg.type = 'deleted';
    delete msg.text; delete msg.url; delete msg.reactions;
    saveData();
    io.emit('message-deleted', { msgId });
    cb({ ok: true });
  });

  socket.on('gift-coin', ({ toUserId, amount } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const from = data.users[uid];
  const to = data.users[toUserId];
  if (!from || !to) return cb({ error: 'User tidak ditemukan' });
  if (toUserId === uid) return cb({ error: 'Gak bisa ke diri sendiri' });
  if (to.banned) return cb({ error: 'Penerima di-ban' });
  amount = parseInt(amount);
  if (!amount || amount < 1 || amount > 10000) return cb({ error: 'Jumlah 1-10000' });
  if (from.coins < amount) return cb({ error: 'Saldo kurang (' + from.coins + ')' });
  try { initAch(from).giftSent++; } catch(e){}
  from.coins -= amount;
  to.coins += amount;
  saveData();
  broadcastUserUpdate(uid);
  broadcastUserUpdate(toUserId);
  onlineUsers.forEach((ouid, sid) => {
    if (ouid === toUserId) {
      const s2 = io.sockets.sockets.get(sid);
      if (s2) s2.emit('gift-received', { from: from.username, amount });
    }
  });
  io.emit('system', '🎁 ' + from.username + ' kirim ' + amount + ' coin ke ' + to.username);
  cb({ ok: true, coins: from.coins });
});

socket.on('users-all', (cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const list = Object.values(data.users)
    .filter(u => u.userId !== uid && !u.banned)
    .map(u => ({ userId: u.userId, username: u.username, badge: u.badge || 'member' }));
  cb({ ok: true, users: list });
});

socket.on('pin-message', ({ msgId } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const _uid = onlineUsers.get(socket.id);
  const _u = _uid ? data.users[_uid] : null;
  const _isAdminPin = adminSockets.has(socket.id) || (_u && _u.badge === 'admin');
  if (!_isAdminPin) return cb({ error: 'Cuma admin' });
  const uid = _uid;
  if (!uid) return cb({ error: 'Belum join' });
  const msg = data.messages.find(m => m.id === msgId);
  if (!msg) return cb({ error: 'Pesan tidak ada' });
  if (msg.deleted) return cb({ error: 'Pesan udah dihapus' });
  data.pinned = {
    msgId: msg.id,
    user: msg.user,
    text: msg.type === 'image' ? 'Gambar' : (msg.text || '').slice(0, 80),
    by: data.users[uid].username,
    time: Date.now()
  };
  saveData();
  io.emit('pinned-updated', data.pinned);
  cb({ ok: true });
});

socket.on('unpin-message', (cb) => {
  if (typeof cb !== 'function') return;
  const _uid2 = onlineUsers.get(socket.id);
  const _u2 = _uid2 ? data.users[_uid2] : null;
  if (!adminSockets.has(socket.id) && (!_u2 || _u2.badge !== 'admin')) return cb({ error: 'Cuma admin' });
  data.pinned = null;
  saveData();
  io.emit('pinned-updated', null);
  cb({ ok: true });
});

socket.on('pinned-get', (cb) => {
  if (typeof cb !== 'function') return;
  cb({ ok: true, pinned: data.pinned || null });
});

socket.on('admin-add-admin', ({ username } = {}, cb) => {
  if (typeof cb !== 'function') return;
  if (!adminSockets.has(socket.id)) return cb({ error: 'Bukan admin panel' });
  if (!username) return cb({ error: 'Username kosong' });
  const t = Object.values(data.users).find(u => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!t) return cb({ error: 'User tidak ditemukan' });
  if (t.badge === 'admin') return cb({ error: 'User sudah admin' });
  t.badge = 'admin';
  saveData();
  broadcastUserUpdate(t.userId);
  io.emit('system', t.username + ' jadi ADMIN');
  cb({ ok: true, username: t.username });
});

socket.on('admin-remove-admin', ({ userId } = {}, cb) => {
  if (typeof cb !== 'function') return;
  if (!adminSockets.has(socket.id)) return cb({ error: 'Bukan admin panel' });
  const t = data.users[userId];
  if (!t) return cb({ error: 'User tidak ada' });
  if (t.badge !== 'admin') return cb({ error: 'User bukan admin' });
  t.badge = 'member';
  saveData();
  broadcastUserUpdate(userId);
  io.emit('system', t.username + ' bukan admin lagi');
  cb({ ok: true });
});
socket.on('dice-roll', ({ bet, pick } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  bet = parseInt(bet);
  if (!bet || bet < 10) return cb({ error: 'Minimal 10 coin' });
  if (bet > 10000) return cb({ error: 'Max 10000 coin' });
  if (u.coins < bet) return cb({ error: 'Saldo kurang (' + u.coins + ')' });

  const valid = ['kecil', 'besar', '1', '2', '3', '4', '5', '6'];
  if (!valid.includes(String(pick))) return cb({ error: 'Pilihan tidak valid' });

  const result = Math.floor(Math.random() * 6) + 1;
  let mult = 0;
  const p = String(pick);
  if (p === 'kecil' && result <= 3) mult = 1.9;
  else if (p === 'besar' && result >= 4) mult = 1.9;
  else if (p === String(result)) mult = 5;

  const win = mult > 0 ? Math.floor(bet * mult) : 0;
  if (win > 0) { try { initAch(u).daduWins++; } catch(e){} }
  u.coins -= bet;
  u.coins += win;
  saveData();
  broadcastUserUpdate(uid);

  if (win > 0) {
    io.emit('system', '🎲 ' + u.username + ' menang ' + win + ' coin di dadu! (' + result + ' x' + mult + ')');
  }
  cb({ ok: true, result, bet, pick: p, multiplier: mult, win, coins: u.coins });
});

socket.on('bubble-set', ({ color } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  const valid = ['#d9fdd3','#bbdefb','#e1bee7','#fff9c4','#ffcdd2','#ffe0b2','#f8bbd0','#cfd8dc','#b2dfdb','#d7ccc8','#c5cae9','#ffcc80'];
  if (!valid.includes(color)) return cb({ error: 'Warna invalid' });
  u.bubbleColor = color;
  saveData();
  io.emit('user-color-changed', { userId: uid, color });
  cb({ ok: true, color });
});

socket.on('tebak-play', ({ bet, pick } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  bet = parseInt(bet);
  pick = parseInt(pick);
  if (!bet || bet < 10) return cb({ error: 'Minimal 10 coin' });
  if (bet > 10000) return cb({ error: 'Max 10000 coin' });
  if (u.coins < bet) return cb({ error: 'Saldo kurang (' + u.coins + ')' });
  if (!pick || pick < 1 || pick > 10) return cb({ error: 'Pilih angka 1-10' });
  const secret = Math.floor(Math.random() * 10) + 1;
  const win = pick === secret;
  if (win) { try { initAch(u).tebakWins++; } catch(e){} }
  const reward = win ? bet * 5 : 0;
  u.coins -= bet;
  u.coins += reward;
  saveData();
  broadcastUserUpdate(uid);
  if (win) io.emit('system', '🎯 ' + u.username + ' menang ' + reward + ' coin di Tebak Angka!');
  cb({ ok: true, secret, pick, bet, win, reward, coins: u.coins });
});

socket.on('kartu-play', ({ bet, guess } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  bet = parseInt(bet);
  if (!bet || bet < 10) return cb({ error: 'Minimal 10 coin' });
  if (bet > 10000) return cb({ error: 'Max 10000 coin' });
  if (u.coins < bet) return cb({ error: 'Saldo kurang (' + u.coins + ')' });
  if (guess !== 'high' && guess !== 'low') return cb({ error: 'Pilih LEBIH TINGGI atau LEBIH RENDAH' });

  const SUITS = ['S', 'H', 'D', 'C'];
  const SYM = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function pickCard(exclude) {
    for (let i = 0; i < 50; i++) {
      const v = Math.floor(Math.random() * 13) + 1;
      const s = SUITS[Math.floor(Math.random() * 4)];
      if (!exclude || v !== exclude.value) return { value: v, suit: s, label: SYM[v-1] };
    }
    return { value: 1, suit: 'S', label: 'A' };
  }

  const current = pickCard(null);
  const next = pickCard(current);

  let correct = false;
  if (guess === 'high' && next.value > current.value) correct = true;
  if (guess === 'low' && next.value < current.value) correct = true;
  if (next.value === current.value) correct = false;

  const win = correct ? bet * 2 : 0;
  u.coins -= bet;
  u.coins += win;
  saveData();
  broadcastUserUpdate(uid);

  if (win > 0) {
    io.emit('system', 'Kartu ' + u.username + ' menang ' + win + ' coin! (' + current.label + ' → ' + next.label + ')');
  }
  cb({ ok: true, current, next, guess, correct, bet, win, coins: u.coins });
});

socket.on('wallpaper-set', ({ wallpaper } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  const valid = ['default','dark','sunset','ocean','forest','purple','candy','night','fire','mint','peach','space'];
  if (!valid.includes(wallpaper)) return cb({ error: 'Wallpaper invalid' });
  u.wallpaper = wallpaper;
  saveData();
  io.emit('user-wallpaper-changed', { userId: uid, wallpaper });
  cb({ ok: true, wallpaper });
});
socket.on('achievement-claim', ({ id } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  if (!u) return cb({ error: 'User tidak ada' });
  const ach = initAch(u);
  if (!ach.claimed) ach.claimed = {};
  if (!ach.unlocked[id]) return cb({ error: 'Belum memenuhi syarat' });
  if (ach.claimed[id]) return cb({ error: 'Udah diklaim' });
  const def = ACHIEVEMENTS.find(function(a){ return a.id === id; });
  if (!def) return cb({ error: 'Achievement tidak ada' });
  ach.claimed[id] = Date.now();
  u.coins += def.reward;
  saveData();
  broadcastUserUpdate(uid);
  cb({ ok: true, reward: def.reward, coins: u.coins });
});

socket.on('chess-finish', ({ result, difficulty } = {}, cb) => {
  if (typeof cb !== 'function') return;
  const uid = onlineUsers.get(socket.id);
  if (!uid) return cb({ error: 'Belum join' });
  const u = data.users[uid];
  if (!u) return cb({ error: 'User tidak ada' });
  const nowC = Date.now();
  if (u.lastChessAt && nowC - u.lastChessAt < 60000) {
    const wait = Math.ceil((60000 - (nowC - u.lastChessAt)) / 1000);
    return cb({ error: 'Tunggu ' + wait + 's lagi' });
  }
  if (!u.chessDay) { u.chessDay = new Date().toDateString(); u.chessCount = 0; }
  if (u.chessDay !== new Date().toDateString()) {
    u.chessDay = new Date().toDateString();
    u.chessCount = 0;
  }
  if (u.chessCount >= 10) return cb({ error: 'Max 10 game catur/hari' });
  u.lastChessAt = nowC;
  u.chessCount = (u.chessCount || 0) + 1;
  const rewards = {
    win: { easy: 8, medium: 17, hard: 35 },
    lose: { easy: 2, medium: 4, hard: 7 },
    draw: { easy: 0, medium: 0, hard: 0 }
  };
  if (!rewards[result] || !rewards[result][difficulty]) return cb({ error: 'Invalid' });
  const reward = rewards[result][difficulty];
  u.coins += reward;
  saveData();
  broadcastUserUpdate(uid);
  if (result === 'win') {
    io.emit('system', '♟️ ' + u.username + ' menang catur vs AI (' + difficulty + ') +' + reward + ' coin');
  }
  cb({ ok: true, reward, coins: u.coins });
});

socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
    const uid = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (uid) {
      const u = data.users[uid];
      const name = u ? u.username : 'User';
      /* leave message hidden */
      io.emit('online', onlineUsers.size);
    }
  });
});

// Auto-delete pesan > 24 jam
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const deletedIds = [];
  data.messages = data.messages.filter(m => {
    if (m.time < cutoff) { deletedIds.push(m.id); return false; }
    return true;
  });
  if (deletedIds.length) {
    saveData();
    io.emit('messages-purged', { ids: deletedIds });
    console.log('🧹 Auto-delete: ' + deletedIds.length + ' pesan');
  }
}, 60 * 1000);

server.listen(PORT, () => console.log('JAVACHAT running on port ' + PORT));
