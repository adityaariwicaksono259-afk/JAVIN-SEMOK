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
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "blob:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net", "https://staticimgly.com", "https://cdnjs.cloudflare.com", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
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



// ===== AI PROXY (Groq) =====
app.post('/api/ai/chat', express.json({ limit: '100kb' }), async (req, res) => {
  const messages = req.body && req.body.messages;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Messages kosong' });
  }
  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'GROQ_API_KEY belum diset di Environment' });
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'Kamu adalah Asisten Javin, AI assistant ramah buatan Javin Semok. PENTING: Selalu jawab pakai bahasa yang sama dengan yang dipakai user. Kalau user chat pakai Bahasa Indonesia, jawab pakai Bahasa Indonesia. Kalau user pakai English, jawab English. Kalau user pakai bahasa daerah (Jawa, Sunda, dll), jawab pakai bahasa itu. Selalu sesuaiin bahasa user. Jawab dengan jelas, singkat, dan helpful. Jangan pernah pakai bahasa Vietnam atau bahasa lain yang bukan bahasa user.' },
          ...messages.slice(-20)
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });
    const j = await r.json();
    if (j.error) return res.status(500).json({ error: j.error.message || 'Groq error' });
    const answer = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    res.json({ ok: true, answer: answer || 'Maaf, gak ada jawaban.' });
  } catch (e) {
    res.status(500).json({ error: 'AI error: ' + e.message });
  }
});


// ===== BRAT VIDEO PROXY =====
app.get('/api/brat', async (req, res) => {
  const text = req.query.text;
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Text kosong' });
  if (text.length > 200) return res.status(400).json({ error: 'Max 200 karakter' });
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);
    const r = await fetch('https://apii.nexadev.my.id/bratvid2?text=' + encodeURIComponent(text), { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log('[BRAT] API status:', r.status);
    if (!r.ok) return res.status(r.status).json({ error: 'API error ' + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Brat error: ' + e.message });
  }
});

app.get('/api/sholat', async (req, res) => {
  const city = String(req.query.city || 'Jakarta').slice(0, 40);
  try {
    const url = 'https://api.aladhan.com/v1/timingsByCity?city=' + encodeURIComponent(city) + '&country=Indonesia&method=20';
    const r = await fetch(url);
    const j = await r.json();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(j));
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ===== ANONIM PRETTY URL =====
// ===== ANONIM PRETTY URL + OG TAGS =====
app.get('/u/:username', (req, res) => {
  const username = String(req.params.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  const host = req.get('host') || 'javin-semok.onrender.com';
  const proto = req.get('x-forwarded-proto') || 'https';
  const siteUrl = proto + '://' + host;
  const ogImage = siteUrl + '/og-anonim.png';
  const shareUrl = siteUrl + '/u/' + username;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send('<!DOCTYPE html>' +
'<html lang="id">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>Kirim pesan anonim ke @' + username + ' - JAVIN SEMOK</title>' +
'<meta property="og:type" content="website">' +
'<meta property="og:site_name" content="JAVIN SEMOK">' +
'<meta property="og:url" content="' + shareUrl + '">' +
'<meta property="og:title" content="Kirimi aku pesan anonim!">' +
'<meta property="og:description" content="Klik linknya 👇 Kirim apa aja, aku gak bakal tau siapa lo 🕶️">' +
'<meta property="og:image" content="' + ogImage + '">' +
'<meta property="og:image:width" content="1200">' +
'<meta property="og:image:height" content="630">' +
'<meta property="og:locale" content="id_ID">' +
'<meta name="twitter:card" content="summary_large_image">' +
'<meta name="twitter:title" content="Kirimi aku pesan anonim!">' +
'<meta name="twitter:description" content="Klik linknya 👇">' +
'<meta name="twitter:image" content="' + ogImage + '">' +
'<meta name="theme-color" content="#128c7e">' +
'<style>html,body{margin:0;padding:0;height:100%;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#128c7e,#25d366);display:flex;align-items:center;justify-content:center;color:#fff}</style>' +
'</head>' +
'<body>' +
'<div style="text-align:center;padding:20px">' +
'<div style="font-size:60px">🕶️</div>' +
'<div style="font-size:18px;font-weight:800;margin-top:12px">Membuka form anonim...</div>' +
'<div style="margin-top:20px"><a href="/sosial.html?u=' + username + '" style="color:#fff;text-decoration:underline">Klik di sini kalo gak otomatis</a></div>' +
'</div>' +
'<script>setTimeout(function(){ location.replace("/sosial.html?u=' + username + '"); }, 80);</script>' +
'</body></html>');
});

// ===== OG IMAGE (SVG → PNG via placeholder) =====
app.get('/og-anonim.png', (req, res) => {
  // Redirect ke SVG biar WhatsApp bisa render
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<defs>' +
    '<linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#ff6b9d"/>' +
      '<stop offset="50%" stop-color="#ff8c42"/>' +
      '<stop offset="100%" stop-color="#ffb84d"/>' +
    '</linearGradient>' +
    '<linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#128c7e"/>' +
      '<stop offset="100%" stop-color="#25d366"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect width="1200" height="630" rx="40" fill="url(#g2)"/>' +
    '<circle cx="180" cy="180" r="90" fill="#fff" opacity="0.15"/>' +
    '<circle cx="1020" cy="480" r="120" fill="#fff" opacity="0.1"/>' +
    '<circle cx="1000" cy="120" r="50" fill="#fff" opacity="0.12"/>' +
    '<text x="600" y="260" font-family="system-ui,-apple-system,Arial,sans-serif" font-size="60" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">KIRIM PESAN ANONIM</text>' +
    '<text x="600" y="360" font-family="system-ui,-apple-system,Arial,sans-serif" font-size="32" font-weight="600" fill="#ffffff" text-anchor="middle" opacity="0.9">Klik linknya, kirim rahasia lo 🕶️</text>' +
    '<text x="600" y="500" font-family="system-ui,-apple-system,Arial,sans-serif" font-size="28" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="4">JAVIN SEMOK</text>' +
    '<text x="600" y="545" font-family="system-ui,-apple-system,Arial,sans-serif" font-size="16" fill="#ffffff" text-anchor="middle" opacity="0.7">javin-semok.onrender.com</text>' +
  '</svg>');
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
// ===== CONNECTION LIMITER PER IP =====
const connCount = new Map();
io.use((socket, next) => {
  const xff = socket.handshake.headers['x-forwarded-for'];
  const ip = xff ? xff.split(',')[0].trim() : (socket.handshake.address || 'unknown');
  const count = connCount.get(ip) || 0;
  if (count >= 999999) return next(new Error('TOO_MANY_CONNECTIONS')); // disabled (Render proxy)
  connCount.set(ip, count + 1);
socket.on('disconnect', () => {
    const c = connCount.get(ip) || 1;
    if (c <= 1) connCount.delete(ip);
    else connCount.set(ip, c - 1);
  });
  // CONN-LIMIT
  next();
});

// AUTH MIDDLEWARE DISABLED — bikin loop reconnect
// Aktifkan lagi nanti kalo udah stabil
io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  socket._authUserId = auth.userId || '';
  next();
});

// ===== GLOBAL EVENT LIMIT =====
const globalEvents = new Map();
const RATE_WINDOW = 10000;
const RATE_MAX = 30;
const SKIP_EVENTS = ['join', 'typing', 'peek-online', 'disconnect'];
io.use((socket, next) => {
  const origOnevent = socket.onevent;
  socket.onevent = function(packet) {
    try {
      const evName = packet.data && packet.data[0];
      if (evName && !SKIP_EVENTS.includes(evName)) {
        const now = Date.now();
        const uid = socket._authUserId || socket.id;
        let arr = globalEvents.get(uid) || [];
        arr = arr.filter(t => now - t < RATE_WINDOW);
        if (arr.length >= RATE_MAX) {
          socket.emit('rate-limited', { msg: 'Kebanyakan aksi, tunggu bentar' });
          return;
        }
        arr.push(now);
        globalEvents.set(uid, arr);
      }
    } catch(e) {}
    return origOnevent.apply(this, arguments);
  };
  // GLOBAL-EVENT-LIMIT
  next();
});

io.on('connection', (socket) => {
  // ===== ANONIM (NGL-style by username) =====
  socket.on('anonim-create', ({ username } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    username = String(username || '').trim().toLowerCase().slice(0, 20);
    if (!username) return cb({ error: 'Username kosong' });
    if (username.length < 3) return cb({ error: 'Minimal 3 karakter' });
    if (!/^[a-z0-9_]+$/.test(username)) return cb({ error: 'Hanya huruf kecil, angka, underscore' });
    if (!data.anonimProfiles) data.anonimProfiles = {};
    const taken = Object.values(data.anonimProfiles).find(p => p.username === username && p.userId !== uid);
    if (taken) return cb({ error: 'Username udah dipakai' });
    data.anonimProfiles[uid] = { userId: uid, username: username, createdAt: Date.now() };
    saveData();
    cb({ ok: true, profile: data.anonimProfiles[uid] });
  });

  socket.on('anonim-profile-get', (cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    if (!data.anonimProfiles) data.anonimProfiles = {};
    cb({ ok: true, profile: data.anonimProfiles[uid] || null });
  });

  socket.on('anonim-send-to', ({ username, text } = {}, cb) => {
    if (typeof cb !== 'function') return;
    username = String(username || '').toLowerCase().trim();
    text = String(text || '').trim().slice(0, 500);
    if (!username) return cb({ error: 'Username kosong' });
    if (!text) return cb({ error: 'Pesan kosong' });
    if (!data.anonimProfiles) return cb({ error: 'User gak ada' });
    const target = Object.values(data.anonimProfiles).find(p => p.username === username);
    if (!target) return cb({ error: 'Link gak valid / user gak ada' });
    const senderUid = onlineUsers.get(socket.id);
    if (senderUid === target.userId) return cb({ error: 'Gak bisa kirim ke diri sendiri' });

    // Rate limit per IP per target: 30/hari
    const ipRaw = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || socket.id;
    const ip = String(ipRaw).split(',')[0].trim();
    if (!data.anonimRate) data.anonimRate = {};
    const rk = 'ip:' + ip + '->' + target.userId;
    const now = Date.now();
    const rate = (data.anonimRate[rk] || []).filter(t => now - t < 24*3600*1000);
    if (rate.length >= 30) return cb({ error: 'Max 30 pesan/hari ke user ini' });
    rate.push(now);
    data.anonimRate[rk] = rate;

    const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2,8), text: text, time: now, read: false, reported: false };
    if (!data.anonim) data.anonim = {};
    if (!data.anonim[target.userId]) data.anonim[target.userId] = [];
    data.anonim[target.userId].push(msg);
    if (data.anonim[target.userId].length > 200) data.anonim[target.userId].shift();
    saveData();

    onlineUsers.forEach((ouid, sid) => {
      if (ouid === target.userId) {
        const s2 = io.sockets.sockets.get(sid);
        if (s2) s2.emit('anonim-new', { count: data.anonim[target.userId].filter(m => !m.read).length });
      }
    });
    cb({ ok: true });
  });

  socket.on('anonim-inbox', (cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    if (!data.anonim) data.anonim = {};
    const list = (data.anonim[uid] || []).slice().reverse();
    cb({ ok: true, messages: list });
  });

  socket.on('anonim-mark-read', ({ msgId } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const list = (data.anonim && data.anonim[uid]) || [];
    const m = list.find(x => x.id === msgId);
    if (m) { m.read = true; saveData(); }
    cb({ ok: true });
  });

  socket.on('anonim-delete', ({ msgId } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    if (!data.anonim || !data.anonim[uid]) return cb({ ok: true });
    data.anonim[uid] = data.anonim[uid].filter(m => m.id !== msgId);
    saveData();
    cb({ ok: true });
  });

  socket.on('anonim-report', ({ msgId } = {}, cb) => {
    if (typeof cb !== 'function') return;
    const uid = onlineUsers.get(socket.id);
    if (!uid) return cb({ error: 'Belum join' });
    const list = (data.anonim && data.anonim[uid]) || [];
    const m = list.find(x => x.id === msgId);
    if (m) { m.reported = true; saveData(); io.emit('system', '⚠️ 1 laporan pesan anonim toxic'); }
    cb({ ok: true });
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
