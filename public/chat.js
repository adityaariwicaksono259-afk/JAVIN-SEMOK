const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let pendingImg = null;
let mentionUnread = 0;
let lastDateKey = '';
let replyTarget = null;
let notifEnabled = localStorage.getItem('notif_enabled') === '1';
let actionBarEl = null;
let actionBarMsgId = null;
const typingTimers = new Map();

const messagesEl = $('messages');
const msgInput = $('msgInput');
const sendBtn = $('sendBtn');
const typingBar = $('typingBar');
const onlineCount = $('onlineCount');
const myName = $('myName');
const myAvatar = $('myAvatar');
const myBadge = $('myBadge');
const toastEl = $('toast');
const mentionBadge = $('mentionBadge');
const notifBtn = $('notifBtn');
const emojiBtn = $('emojiBtn');
const emojiPicker = $('emojiPicker');
const replyBar = $('replyBar');

function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => closeModal(b.dataset.close);
});
function renderBadge(el, badge) {
  el.className = 'badge';
  el.textContent = '';
  if (badge === 'admin') { el.classList.add('admin'); el.textContent = '👑'; }
  else if (badge === 'vip') { el.classList.add('vip'); el.textContent = '💎'; }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============ NOTIF ============
function updateNotifBtn() {
  notifBtn.textContent = notifEnabled ? '🔔' : '🔕';
  notifBtn.title = notifEnabled ? 'Notif aktif' : 'Notif nonaktif';
}
updateNotifBtn();
notifBtn.onclick = async () => {
  if (!('Notification' in window)) return toast('❌ Browser gak support notif');
  if (notifEnabled) {
    notifEnabled = false;
    localStorage.setItem('notif_enabled', '0');
    updateNotifBtn();
    return toast('🔕 Notif dimatikan');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return toast('❌ Izin notif ditolak');
  notifEnabled = true;
  localStorage.setItem('notif_enabled', '1');
  updateNotifBtn();
  toast('🔔 Notif aktif');
};
function showNotif(title, body) {
  if (!notifEnabled || document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'javachat' });
    setTimeout(() => n.close(), 5000);
  } catch(e) {}
}

// ============ EMOJI ============
const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','🥺','😴','🤤','😇',
  '👍','👎','👏','🙏','💪','🤝','✌️','🤙','👋','🖐️','💅','🤳',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞',
  '🔥','⭐','✨','💫','⚡','💥','💯','🎉','🎊','🎁','🏆','🥇',
  '🍕','🍔','🍟','🍗','🍜','🍣','🍰','🍩','🍪','🍫','☕','🍺',
  '🐶','🐱','🐼','🦁','🐯','🐸','🐵','🐧','🐝','🦋','🐢','🐬',
  '⚽','🏀','🎮','🎯','🎲','🎰','🎨','🎭','🎤','🎧','📱','💻',
  '✅','❌','⚠️','❓','❗','💤','💢','💬','💭','👀','🙈','🙉'
];
function buildEmojiPicker() {
  emojiPicker.innerHTML = '';
  EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emoji-item';
    b.textContent = e;
    b.onclick = () => {
      const inp = msgInput;
      const start = inp.selectionStart || inp.value.length;
      inp.value = inp.value.slice(0, start) + e + inp.value.slice(inp.selectionEnd || start);
      inp.focus();
      inp.selectionStart = inp.selectionEnd = start + e.length;
    };
    emojiPicker.appendChild(b);
  });
}
buildEmojiPicker();
emojiBtn.onclick = (e) => {
  e.stopPropagation();
  hideActionBar();
  emojiPicker.classList.toggle('hidden');
};

// ============ SOCKET ============
socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  myName.textContent = u.username;
  myAvatar.textContent = u.username.replace('Guest-', '').slice(0, 2).toUpperCase();
  renderBadge(myBadge, u.badge);
  document.body.classList.toggle('dark', u.theme === 'dark');
  msgInput.focus();
});
socket.on('user-updated', ({ userId: uid, username, badge }) => {
  if (uid === userId && me) {
    me.username = username;
    me.badge = badge;
    myName.textContent = username;
    myAvatar.textContent = username.replace('Guest-', '').slice(0, 2).toUpperCase();
    renderBadge(myBadge, badge);
  }
});
socket.on('online', (n) => { onlineCount.textContent = n + ' online'; });
socket.on('system', (t) => {
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = t;
  messagesEl.appendChild(el);
  scrollBottom();
});
socket.on('history', (msgs) => {
  messagesEl.innerHTML = '';
  lastDateKey = '';
  msgs.forEach(renderMessage);
  scrollBottom(true);
});
socket.on('message', (m) => {
  renderMessage(m);
  scrollBottom();
  if (me && m.userId !== userId && m.type === 'text' && m.text) {
    const re = new RegExp('@' + me.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(m.text)) {
      mentionUnread++;
      mentionBadge.textContent = '@' + mentionUnread;
      mentionBadge.classList.remove('hidden');
      toast('🔔 ' + m.user + ' mention lo!');
    }
  }
  if (m.userId !== userId) {
    showNotif(m.user, m.type === 'image' ? '📎 Gambar' : m.text);
  }
});
socket.on('message-reacted', ({ msgId, reactions }) => {
  const el = document.querySelector('.msg[data-msg-id="' + msgId + '"]');
  if (!el) return;
  const wrapper = el.closest('.msg-wrapper');
  if (!wrapper) return;
  const box = wrapper.querySelector('.msg-reactions');
  if (box) renderReactionsInto(box, reactions);
});
socket.on('message-deleted', ({ msgId }) => {
  const el = document.querySelector('.msg[data-msg-id="' + msgId + '"]');
  if (!el) return;
  const wrapper = el.closest('.msg-wrapper');
  if (wrapper) wrapper.remove();
});
socket.on('messages-purged', ({ ids }) => {
  ids.forEach(id => {
    const el = document.querySelector('.msg[data-msg-id="' + id + '"]');
    if (el) { const w = el.closest('.msg-wrapper'); if (w) w.remove(); }
  });
});
socket.on('typing', ({ user, isTyping }) => {
  if (user === (me && me.username)) return;
  if (isTyping) typingTimers.set(user, Date.now());
  else typingTimers.delete(user);
  renderTyping();
});
setInterval(() => {
  const now = Date.now();
  let ch = false;
  typingTimers.forEach((t, u) => { if (now - t > 3000) { typingTimers.delete(u); ch = true; } });
  if (ch) renderTyping();
}, 1000);
function renderTyping() {
  const us = [...typingTimers.keys()];
  if (!us.length) { typingBar.classList.add('hidden'); typingBar.textContent = ''; return; }
  typingBar.classList.remove('hidden');
  if (us.length === 1) typingBar.textContent = us[0] + ' sedang mengetik...';
  else if (us.length === 2) typingBar.textContent = us[0] + ' dan ' + us[1] + ' sedang mengetik...';
  else typingBar.textContent = us.length + ' orang sedang mengetik...';
}
mentionBadge.onclick = () => { mentionUnread = 0; mentionBadge.classList.add('hidden'); };

// ============ SEND ============
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
let typingSent = false;
msgInput.addEventListener('input', () => {
  if (!typingSent) { socket.emit('typing', true); typingSent = true; }
  clearTimeout(window.__tt);
  window.__tt = setTimeout(() => { socket.emit('typing', false); typingSent = false; }, 1200);
});
function sendMessage() {
  const t = msgInput.value.trim();
  if (!t) return;
  const payload = { type: 'text', text: t };
  if (replyTarget) payload.replyTo = replyTarget.id;
  socket.emit('message', payload);
  msgInput.value = '';
  socket.emit('typing', false);
  typingSent = false;
  clearReply();
}

// ============ REPLY ============
function setReply(msgId, user, text) {
  replyTarget = { id: msgId, user };
  $('replyBarUser').textContent = 'Reply ke ' + user;
  $('replyBarText').textContent = text.slice(0, 100);
  replyBar.classList.remove('hidden');
  msgInput.focus();
}
function clearReply() {
  replyTarget = null;
  replyBar.classList.add('hidden');
}
$('replyBarClose').onclick = clearReply;

// ============ ACTION BAR (reaction inline) ============
const QUICK_EMOJIS = ['❤️','😂','👍','🔥','😮','😢'];

function showActionBar(msgId, bubbleEl) {
  hideActionBar();
  const msg = (window.__allMsgs || []).find(m => m.id === msgId);
  if (!msg) { console.warn('msg not found', msgId); return; }

  const bar = document.createElement('div');
  bar.className = 'action-bar';

  QUICK_EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.dataset.emoji = e;
    b.onclick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      socket.emit('react-message', { msgId, emoji: e }, (res) => {
        if (res && res.error) toast('❌ ' + res.error);
      });
      hideActionBar();
    };
    bar.appendChild(b);
  });

  const sep = document.createElement('div');
  sep.className = 'act-sep';
  bar.appendChild(sep);

  const replyB = document.createElement('button');
  replyB.type = 'button';
  replyB.className = 'act-reply';
  replyB.textContent = '↩';
  replyB.title = 'Reply';
  replyB.onclick = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const preview = msg.type === 'image' ? '📎 Gambar' : msg.text;
    setReply(msg.id, msg.user, preview);
    hideActionBar();
  };
  bar.appendChild(replyB);

  if (msg.userId === userId && Date.now() - msg.time < 24 * 60 * 60 * 1000) {
    const delB = document.createElement('button');
    delB.type = 'button';
    delB.className = 'act-delete';
    delB.textContent = '🗑️';
    delB.title = 'Hapus';
    delB.onclick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (!confirm('Hapus pesan ini?')) return;
      socket.emit('delete-message', { msgId: msg.id }, (res) => {
        if (res && res.error) toast('❌ ' + res.error);
      });
      hideActionBar();
    };
    bar.appendChild(delB);
  }

  document.body.appendChild(bar);
  actionBarEl = bar;
  actionBarMsgId = msgId;

  // Posisi: coba di atas bubble, kalau gak cukup di bawah
  const rect = bubbleEl.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const gap = 8;
  let top = rect.top - barRect.height - gap;
  let left = rect.left;
  if (top < 10) top = rect.bottom + gap;
  if (left + barRect.width > window.innerWidth - 10) {
    left = window.innerWidth - barRect.width - 10;
  }
  if (left < 10) left = 10;
  bar.style.top = top + 'px';
  bar.style.left = left + 'px';
}

function hideActionBar() {
  if (actionBarEl) {
    actionBarEl.remove();
    actionBarEl = null;
    actionBarMsgId = null;
  }
}

// ============ TAP BUBBLE → ACTION BAR ============
messagesEl.addEventListener('click', (e) => {
  // Kalau lagi klik action bar, skip
  if (actionBarEl && actionBarEl.contains(e.target)) return;
  // Kalau klik reaction button, biar ditangani oleh button sendiri
  if (e.target.closest('.reaction-btn')) return;
  // Kalau klik quote reply, biar navigasi
  if (e.target.closest('.msg-quote')) return;
  // Kalau klik gambar, buka viewer
  if (e.target.classList.contains('msg-img')) return;

  const msgEl = e.target.closest('.msg');
  if (!msgEl) { hideActionBar(); return; }

  const msgId = msgEl.dataset.msgId;
  if (actionBarMsgId === msgId) { hideActionBar(); return; }
  showActionBar(msgId, msgEl);
  e.stopPropagation();
});

// Tap di luar → tutup
document.addEventListener('click', (e) => {
  if (actionBarEl && !actionBarEl.contains(e.target)) hideActionBar();
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn && !emojiBtn.contains(e.target)) emojiPicker.classList.add('hidden');
});
document.addEventListener('scroll', hideActionBar, true);

// ============ IMAGE ============
$('imgBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast('❌ Max 5MB');
  if (!file.type.startsWith('image/')) return toast('❌ Hanya gambar');
  pendingImg = file;
  $('imgPreviewErr').textContent = '';
  const reader = new FileReader();
  reader.onload = (ev) => { $('imgPreviewBox').innerHTML = '<img src="' + ev.target.result + '" alt="preview">'; };
  reader.readAsDataURL(file);
  openModal('imgPreviewModal');
  e.target.value = '';
};
$('imgSend').onclick = async () => {
  if (!pendingImg) return;
  $('imgSend').disabled = true;
  $('imgSend').textContent = 'Uploading...';
  try {
    const fd = new FormData();
    fd.append('file', pendingImg);
    const r = await fetch('/upload', { method: 'POST', body: fd });
    const res = await r.json();
    if (!res.ok) throw new Error(res.error || 'Upload gagal');
    const payload = { type: 'image', url: res.url };
    if (replyTarget) payload.replyTo = replyTarget.id;
    socket.emit('message', payload);
    pendingImg = null;
    clearReply();
    closeModal('imgPreviewModal');
  } catch (err) {
    $('imgPreviewErr').textContent = err.message;
  } finally {
    $('imgSend').disabled = false;
    $('imgSend').textContent = 'Kirim';
  }
};

// ============ RENDER ============
window.__allMsgs = [];

function renderMessage(msg) {
  const idx = window.__allMsgs.findIndex(m => m.id === msg.id);
  if (idx >= 0) window.__allMsgs[idx] = msg;
  else window.__allMsgs.push(msg);

  const d = new Date(msg.time);
  const dk = d.toDateString();
  if (dk !== lastDateKey) {
    lastDateKey = dk;
    const s = document.createElement('div');
    s.className = 'date-sep';
    s.textContent = fmtDate(d);
    messagesEl.appendChild(s);
  }
  const own = msg.userId === userId;
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-wrapper ' + (own ? 'own' : 'other');
  const el = document.createElement('div');
  el.className = 'msg ' + (own ? 'own' : 'other');
  el.dataset.msgId = msg.id;

  let isMentioned = false;
  if (me && !own && msg.type === 'text' && msg.text) {
    const re = new RegExp('@' + me.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    isMentioned = re.test(msg.text);
  }
  if (isMentioned) el.classList.add('mention');

  if (!own) {
    const u = document.createElement('div');
    u.className = 'msg-user';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = msg.user;
    u.appendChild(nameSpan);
    if (msg.badge === 'vip' || msg.badge === 'admin') {
      const b = document.createElement('span');
      renderBadge(b, msg.badge);
      b.style.fontSize = '10px';
      u.appendChild(b);
    }
    el.appendChild(u);
  }

  if (msg.replyPreview) {
    const quote = document.createElement('div');
    quote.className = 'msg-quote';
    quote.innerHTML = '<div class="quote-user">' + escapeHtml(msg.replyPreview.user) + '</div><div class="quote-text">' + escapeHtml(msg.replyPreview.text) + '</div>';
    quote.onclick = (e) => {
      e.stopPropagation();
      const target = document.querySelector('.msg[data-msg-id="' + msg.replyTo + '"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('msg-flash');
        setTimeout(() => target.classList.remove('msg-flash'), 1200);
      }
    };
    el.appendChild(quote);
  }

  if (msg.type === 'image') {
    const img = document.createElement('img');
    img.className = 'msg-img';
    img.src = msg.url;
    img.loading = 'lazy';
    img.onclick = (e) => { e.stopPropagation(); $('imgViewerImg').src = msg.url; openModal('imgViewer'); };
    el.appendChild(img);
  } else {
    const t = document.createElement('div');
    t.className = 'msg-text';
    renderTextWithMentions(t, msg.text);
    el.appendChild(t);
  }
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const tm = document.createElement('span');
  tm.textContent = fmtTime(d);
  meta.appendChild(tm);
  if (own) {
    const c = document.createElement('span');
    c.className = 'check';
    c.textContent = '✓✓';
    meta.appendChild(c);
  }
  el.appendChild(meta);

  wrapper.appendChild(el);

  const reactBox = document.createElement('div');
  reactBox.className = 'msg-reactions';
  renderReactionsInto(reactBox, msg.reactions || {});
  wrapper.appendChild(reactBox);

  messagesEl.appendChild(wrapper);
}

function renderReactionsInto(box, reactions) {
  box.innerHTML = '';
  const keys = Object.keys(reactions || {});
  if (!keys.length) return;
  keys.forEach(emoji => {
    const users = reactions[emoji];
    if (!users || !users.length) return;
    const btn = document.createElement('button');
    btn.className = 'reaction-btn' + (users.includes(userId) ? ' mine' : '');
    btn.innerHTML = '<span class="re-emoji">' + emoji + '</span><span class="re-count">' + users.length + '</span>';
    btn.onclick = (e) => {
      e.stopPropagation();
      const msgId = btn.closest('.msg-wrapper').querySelector('.msg').dataset.msgId;
      socket.emit('react-message', { msgId, emoji });
    };
    box.appendChild(btn);
  });
}

function renderTextWithMentions(container, text) {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  parts.forEach(p => {
    if (/^@[a-zA-Z0-9_]+$/.test(p)) {
      const span = document.createElement('span');
      span.className = 'mention-tag';
      span.textContent = p;
      container.appendChild(span);
    } else {
      container.appendChild(document.createTextNode(p));
    }
  });
}
function scrollBottom(i) {
  if (i) messagesEl.scrollTop = messagesEl.scrollHeight;
  else messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
}
function fmtTime(d) { return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }
function fmtDate(d) {
  const td = new Date(); const ys = new Date(); ys.setDate(td.getDate() - 1);
  if (d.toDateString() === td.toDateString()) return 'Hari Ini';
  if (d.toDateString() === ys.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}
$('imgViewerClose').onclick = () => closeModal('imgViewer');
$('imgViewer').onclick = (e) => { if (e.target.id === 'imgViewer') closeModal('imgViewer'); };
