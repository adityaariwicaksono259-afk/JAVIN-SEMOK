function showAdminPinMenu(msgId) {
  var a = document.createElement("div");
  a.className = "confirm-overlay";
  a.innerHTML = "<div class=\"confirm-card\"><div class=\"confirm-title\">PIN pesan ini?</div><div class=\"confirm-desc\">Semua user bakal liat di atas chat.</div><div class=\"confirm-actions\"><button class=\"confirm-cancel\">Batal</button><button class=\"confirm-ok\">Pin</button></div></div>";
  document.body.appendChild(a);
  a.querySelector(".confirm-cancel").onclick = function() { a.remove(); };
  a.querySelector(".confirm-ok").onclick = function() {
    a.remove();
    window.__socket.emit("pin-message", { msgId: msgId }, function(res) {
      if (res && res.error) { if (window.__toast) window.__toast("Error: " + res.error); return; }
      if (window.__toast) window.__toast("Pesan di-pin");
    });
  };
  a.onclick = function(e) { if (e.target === a) a.remove(); };
}

const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let pendingImg = null;
let mentionUnread = 0;
let lastDateKey = '';
let replyTarget = null;
let notifEnabled = localStorage.getItem('notif_enabled') === '1';
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
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function openModal(id) { const e = $(id); if (e) e.classList.remove('hidden'); }
function closeModal(id) { const e = $(id); if (e) e.classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => closeModal(b.dataset.close);
});
function renderBadge(el, badge) {
  if (!el) return;
  el.className = 'badge';
  el.textContent = '';
  if (badge === 'admin') { el.classList.add('admin'); el.textContent = '👑'; }
  else if (badge === 'vip') { el.classList.add('vip'); el.textContent = '💎'; }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============ NOTIF ============
function updateNotifBtn() { if (notifBtn) notifBtn.textContent = notifEnabled ? '🔔' : '🔕'; }
updateNotifBtn();
if (notifBtn) {
  notifBtn.onclick = async () => {
    if (!('Notification' in window)) return toast('❌ Browser gak support notif');
    if (notifEnabled) {
      notifEnabled = false;
      localStorage.setItem('notif_enabled', '0');
      updateNotifBtn();
      return toast('🔕 Notif dimatikan');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('❌ Izin ditolak');
    notifEnabled = true;
    localStorage.setItem('notif_enabled', '1');
    updateNotifBtn();
    toast('🔔 Notif aktif');
  };
}
function showNotif(title, body) {
  if (!notifEnabled || document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { const n = new Notification(title, { body, tag: 'javachat' }); setTimeout(() => n.close(), 5000); } catch(e) {}
}

// ============ EMOJI PICKER ============
const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','🥺','😴','👍','👎','👏','🙏','💪','🤝','✌️','🤙','👋','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','🔥','⭐','✨','💫','⚡','💥','💯','🎉','🎊','🎁','🏆','🥇','🍕','🍔','🍟','🍗','🍜','🍣','🍰','🍩','🍪','🍫','☕','🍺','🐶','🐱','🐼','🦁','🐯','🐸','🐵','🐧','🐝','🦋','🐢','🐬','⚽','🏀','🎮','🎯','🎲','🎰','🎨','🎭','🎤','🎧','📱','💻','✅','❌','⚠️','❓','❗','💤','💢','💬','💭','👀','🙈','🙉'];
if (emojiPicker) {
  emojiPicker.innerHTML = '';
  EMOJIS.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emoji-item';
    b.type = 'button';
    b.textContent = e;
    b.onclick = () => {
      if (!msgInput) return;
      const start = msgInput.selectionStart || msgInput.value.length;
      msgInput.value = msgInput.value.slice(0, start) + e + msgInput.value.slice(msgInput.selectionEnd || start);
      msgInput.focus();
    };
    emojiPicker.appendChild(b);
  });
}
if (emojiBtn) {
  emojiBtn.onclick = (e) => {
    e.stopPropagation();
    if (emojiPicker) emojiPicker.classList.toggle('hidden');
  };
}

// ============ SOCKET ============
socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  if (myName) myName.textContent = u.username;
  if (myAvatar) myAvatar.textContent = u.username.replace('Guest-', '').slice(0, 2).toUpperCase();
  renderBadge(myBadge, u.badge);
  document.body.classList.toggle('dark', u.theme === 'dark');
  if (msgInput) msgInput.focus();

  applyWallpaper(u.wallpaper || 'default');
});
socket.on('user-updated', ({ userId: uid, username, badge }) => {
  if (uid === userId && me) {
    me.username = username; me.badge = badge;
    if (myName) myName.textContent = username;
    if (myAvatar) myAvatar.textContent = username.replace('Guest-', '').slice(0, 2).toUpperCase();
    renderBadge(myBadge, badge);
  }
});
socket.on('online', (n) => { if (onlineCount) onlineCount.textContent = n + ' online'; });
socket.on('system', (t) => {
  if (!messagesEl) return;
  const el = document.createElement('div');
  el.className = 'system-msg';
  el.textContent = t;
  messagesEl.appendChild(el);
  scrollBottom();
});
socket.on('history', (msgs) => {
  if (!messagesEl) return;
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
      if (mentionBadge) { mentionBadge.textContent = '@' + mentionUnread; mentionBadge.classList.remove('hidden'); }
      toast('🔔 ' + m.user + ' mention lo!');
    }
  }
  if (m.userId !== userId) showNotif(m.user, m.type === 'image' ? '📎 Gambar' : m.text);
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
  var msg = (window.__allMsgs || []).find(m => m.id === msgId);
  if (msg) { msg.deleted = true; msg.type = 'deleted'; delete msg.text; delete msg.url; delete msg.reactions; }
  var w = document.querySelector('.msg-wrapper[data-msg-id="' + msgId + '"]');
  if (!w) return;
  var own = msg && msg.userId === userId;
  w.innerHTML = '';
  var el = document.createElement('div');
  el.className = 'msg ' + (own ? 'own' : 'other') + ' deleted-msg';
  if (msg && !own) { var u = document.createElement('div'); u.className='msg-user'; u.textContent = msg.user || ''; el.appendChild(u); }
  var t = document.createElement('div');
  t.className = 'msg-text deleted-text';
  t.textContent = '🚫 Pesan ini telah dihapus';
  el.appendChild(t);
  w.appendChild(el);
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
  if (!typingBar) return;
  const us = [...typingTimers.keys()];
  if (!us.length) { typingBar.classList.add('hidden'); typingBar.textContent = ''; return; }
  typingBar.classList.remove('hidden');
  if (us.length === 1) typingBar.textContent = us[0] + ' sedang mengetik...';
  else if (us.length === 2) typingBar.textContent = us[0] + ' dan ' + us[1] + ' sedang mengetik...';
  else typingBar.textContent = us.length + ' orang sedang mengetik...';
}
if (mentionBadge) mentionBadge.onclick = () => { mentionUnread = 0; mentionBadge.classList.add('hidden'); };

// ============ SEND ============
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (msgInput) {
  msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  let typingSent = false;
  msgInput.addEventListener('input', () => {
    if (!typingSent) { socket.emit('typing', true); typingSent = true; }
    clearTimeout(window.__tt);
    window.__tt = setTimeout(() => { socket.emit('typing', false); typingSent = false; }, 1200);
  });
}
function sendMessage() {
  if (!msgInput) return;
  const t = msgInput.value.trim();
  if (!t) return;
  const payload = { type: 'text', text: t };
  if (replyTarget) payload.replyTo = replyTarget.id;
  socket.emit('message', payload);
  msgInput.value = '';
  socket.emit('typing', false);
  clearReply();
}

// ============ REPLY ============
function setReply(msgId, user, text) {
  replyTarget = { id: msgId, user };
  const u = $('replyBarUser'); const t = $('replyBarText');
  if (u) u.textContent = '↩ Balas ke ' + user;
  if (t) t.textContent = String(text).slice(0, 100);
  if (replyBar) replyBar.classList.remove('hidden');
  if (msgInput) msgInput.focus();
}
function clearReply() { replyTarget = null; if (replyBar) replyBar.classList.add('hidden'); }
const rbClose = $('replyBarClose');
if (rbClose) rbClose.onclick = clearReply;

// ============ IMAGE ============
const imgBtn = $('imgBtn');
const fileInput = $('fileInput');
const imgSend = $('imgSend');
if (imgBtn) imgBtn.onclick = () => fileInput && fileInput.click();
if (fileInput) fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast('❌ Max 5MB');
  if (!file.type.startsWith('image/')) return toast('❌ Hanya gambar');
  pendingImg = file;
  const errEl = $('imgPreviewErr'); if (errEl) errEl.textContent = '';
  const reader = new FileReader();
  reader.onload = (ev) => { const box = $('imgPreviewBox'); if (box) box.innerHTML = '<img src="' + ev.target.result + '" alt="preview">'; };
  reader.readAsDataURL(file);
  openModal('imgPreviewModal');
  e.target.value = '';
};
if (imgSend) imgSend.onclick = async () => {
  if (!pendingImg) return;
  imgSend.disabled = true;
  imgSend.textContent = 'Uploading...';
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
    const e = $('imgPreviewErr'); if (e) e.textContent = err.message;
  } finally {
    imgSend.disabled = false;
    imgSend.textContent = 'Kirim';
  }
};

// ============ RENDER ============
function renderMessage(msg) {
  if (!messagesEl) return;
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
  wrapper.dataset.msgId = msg.id;

  // Swipe hint (icon ↩ di belakang bubble)
  const swipeHint = document.createElement('div');
  swipeHint.className = 'swipe-hint';
  swipeHint.textContent = '↩';
  wrapper.appendChild(swipeHint);

  const el = document.createElement('div');
  el.className = 'msg ' + (own ? 'own' : 'other');
  el.dataset.msgId = msg.id;
  var _bc = msg.bubbleColor || '#d9fdd3';
  if (own && me && me.bubbleColor) _bc = me.bubbleColor;
  if (_bc && _bc !== '#d9fdd3') { el.style.background = _bc; el.dataset.hasColor = '1'; }

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
    img.onclick = (e) => { e.stopPropagation(); const v = $('imgViewerImg'); if (v) v.src = msg.url; openModal('imgViewer'); };
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

  // Reactions
  const reactBox = document.createElement('div');
  reactBox.className = 'msg-reactions';
  renderReactionsInto(reactBox, msg.reactions || {});
  wrapper.appendChild(reactBox);

  messagesEl.appendChild(wrapper);
}

function renderReactionsInto(box, reactions) {
  if (!box) return;
  box.innerHTML = '';
  const keys = Object.keys(reactions || {});
  if (!keys.length) return;
  keys.forEach(emoji => {
    const users = reactions[emoji];
    if (!users || !users.length) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reaction-btn' + (users.includes(userId) ? ' mine' : '');
    btn.innerHTML = '';
    const e1 = document.createElement('span'); e1.className = 're-emoji'; e1.textContent = emoji;
    const c1 = document.createElement('span'); c1.className = 're-count'; c1.textContent = users.length;
    btn.appendChild(e1); btn.appendChild(c1);
    btn.onclick = (e) => {
      e.stopPropagation();
      const msgId = btn.closest('.msg-wrapper').querySelector('.msg').dataset.msgId;
      socket.emit('react-message', { msgId, emoji });
    };
    box.appendChild(btn);
  });
}

function renderTextWithMentions(container, text) {
  const parts = String(text).split(/(@[a-zA-Z0-9_]+)/g);
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
  if (!messagesEl) return;
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
const ivc = $('imgViewerClose'); if (ivc) ivc.onclick = () => closeModal('imgViewer');
const iv = $('imgViewer'); if (iv) iv.onclick = (e) => { if (e.target.id === 'imgViewer') closeModal('imgViewer'); };

// ================================================================
// ============ GESTURE ENGINE — TAP / LONG PRESS / SWIPE ==========
// ================================================================

// ---- Mini reaction picker ----
let reactMiniEl = null;
let reactMiniShownAt = 0;
function showReactMini(msgId, bubbleEl) {
  hideReactMini();
  const picker = document.createElement('div');
  picker.className = 'react-mini';
  ['❤️','😂','👍','🔥','😮','😢'].forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = e;
    b.onclick = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      socket.emit('react-message', { msgId, emoji: e }, (res) => {
        if (res && res.error) toast('❌ ' + res.error);
      });
      hideReactMini();
    };
    picker.appendChild(b);
  });
  document.body.appendChild(picker);
  reactMiniEl = picker;
  reactMiniShownAt = Date.now();
  // FIXED: selalu di tengah bawah layar, di atas input bar
  requestAnimationFrame(() => {
    const pr = picker.getBoundingClientRect();
    picker.style.left = ((window.innerWidth - pr.width) / 2) + 'px';
    picker.style.bottom = '70px';
    picker.style.top = 'auto';
  });
}

function hideReactMini() { if (reactMiniEl) { reactMiniEl.remove(); reactMiniEl = null; } }

// ---- Confirm delete modal ----
function showDeleteConfirm(msgId) {
  const box = document.createElement('div');
  box.className = 'confirm-overlay';
  box.innerHTML = '<div class="confirm-card">' +
    '<div class="confirm-title">🗑️ Hapus pesan?</div>' +
    '<div class="confirm-desc">Pesan ini bakal hilang buat semua orang.</div>' +
    '<div class="confirm-actions">' +
      '<button class="confirm-cancel">Batal</button>' +
      '<button class="confirm-ok">Hapus</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(box);
  box.querySelector('.confirm-cancel').onclick = () => box.remove();
  box.querySelector('.confirm-ok').onclick = () => {
    box.remove();
    socket.emit('delete-message', { msgId }, (res) => {
      if (res && res.error) toast('❌ ' + res.error);
    });
  };
  box.onclick = (e) => { if (e.target === box) box.remove(); };
}

// ---- Gesture state ----
let gTouchStart = null;

function getBubbleFromTarget(t) {
  const msgEl = t.closest('.msg');
  if (!msgEl) return null;
  if (t.closest('.reaction-btn')) return null;
  if (t.closest('.msg-quote')) return null;
  if (t.classList.contains('msg-img')) return null;
  return msgEl;
}

// ============ TOUCH (HP) ============
if (messagesEl) {
  messagesEl.addEventListener('touchstart', (e) => {
    const msgEl = getBubbleFromTarget(e.target);
    if (!msgEl) return;
    hideReactMini();
    const t = e.touches[0];
    gTouchStart = {
      x: t.clientX, y: t.clientY, time: Date.now(),
      msgEl, msgId: msgEl.dataset.msgId,
      swiping: false, longPressed: false, moved: false
    };
    // Mulai timer long press
    gTouchStart.longTimer = setTimeout(() => {
      if (!gTouchStart || gTouchStart.moved) return;
      gTouchStart.longPressed = true;
      const msg = (window.__allMsgs || []).find(m => m.id === gTouchStart.msgId);
      if (!msg) return;
      if (msg.userId !== userId) { toast('ℹ️ Cuma bisa hapus pesan sendiri'); return; }
      if (Date.now() - msg.time > 24 * 60 * 60 * 1000) { toast('ℹ️ Pesan udah lewat 24 jam'); return; }
      if (navigator.vibrate) navigator.vibrate(30);
      showDeleteConfirm(msg.id);
      gTouchStart = null;
    }, 500);
  }, { passive: true });

  messagesEl.addEventListener('touchmove', (e) => {
    if (!gTouchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - gTouchStart.x;
    const dy = t.clientY - gTouchStart.y;
    // Batal long press kalau gerak
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      gTouchStart.moved = true;
      clearTimeout(gTouchStart.longTimer);
    }
    // Swipe kanan (dx positif, dy kecil)
    if (dx > 12 && Math.abs(dy) < 40) {
      gTouchStart.swiping = true;
      const offset = Math.min(dx, 90);
      gTouchStart.msgEl.style.transition = 'none';
      gTouchStart.msgEl.style.transform = 'translateX(' + offset + 'px)';
      const wrapper = gTouchStart.msgEl.closest('.msg-wrapper');
      if (wrapper) {
        wrapper.classList.add('swiping');
        wrapper.style.setProperty('--swipe-progress', Math.min(1, offset / 70));
      }
    }
  }, { passive: true });

  messagesEl.addEventListener('touchend', (e) => {
    if (!gTouchStart) return;
    clearTimeout(gTouchStart.longTimer);
    const t = e.changedTouches[0];
    const dx = t.clientX - gTouchStart.x;
    const dy = t.clientY - gTouchStart.y;
    const dt = Date.now() - gTouchStart.time;
    const { msgEl, msgId } = gTouchStart;

    msgEl.style.transition = 'transform .2s';
    msgEl.style.transform = '';
    const wrapper = msgEl.closest('.msg-wrapper');
    if (wrapper) {
      wrapper.classList.remove('swiping');
      wrapper.style.removeProperty('--swipe-progress');
    }
    setTimeout(() => { msgEl.style.transition = ''; }, 220);

    if (gTouchStart.longPressed) { gTouchStart = null; return; }

    // SWIPE RIGHT → reply
    if (dx > 60 && Math.abs(dy) < 50 && dt < 800) {
      const msg = (window.__allMsgs || []).find(m => m.id === msgId);
      if (msg) {
        if (navigator.vibrate) navigator.vibrate(15);
        const preview = msg.type === 'image' ? '📎 Gambar' : msg.text;
        setReply(msg.id, msg.user, preview);
      }
      gTouchStart = null;
      return;
    }

    // TAP → reaction picker
    if (Math.abs(dx) < 50 && Math.abs(dy) < 50 && dt < 500) {
      showReactMini(msgId, msgEl);
    }

    gTouchStart = null;
  }, { passive: true });

  messagesEl.addEventListener('touchcancel', () => {
    if (gTouchStart) {
      clearTimeout(gTouchStart.longTimer);
      if (gTouchStart.msgEl) {
        gTouchStart.msgEl.style.transform = '';
        const w = gTouchStart.msgEl.closest('.msg-wrapper');
        if (w) w.classList.remove('swiping');
      }
    }
    gTouchStart = null;
  }, { passive: true });
}

// ============ DESKTOP (mouse fallback) ============
if (messagesEl && !('ontouchstart' in window)) {
  messagesEl.addEventListener('click', (e) => {
    const msgEl = getBubbleFromTarget(e.target);
    if (!msgEl) { hideReactMini(); return; }
    showReactMini(msgEl.dataset.msgId, msgEl);
  });
  messagesEl.addEventListener('contextmenu', (e) => {
    const msgEl = getBubbleFromTarget(e.target);
    if (!msgEl) return;
    e.preventDefault();
    const msg = (window.__allMsgs || []).find(m => m.id === msgEl.dataset.msgId);
    if (!msg) return;
    if (msg.userId !== userId) return toast('ℹ️ Cuma bisa hapus pesan sendiri');
    if (Date.now() - msg.time > 24 * 60 * 60 * 1000) return toast('ℹ️ Pesan udah lewat 24 jam');
    showDeleteConfirm(msg.id);
  });
}

// ============ CLOSE ON OUTSIDE TAP ============
document.addEventListener('click', (e) => {
  if (Date.now() - reactMiniShownAt < 400) return;
  if (reactMiniEl && !reactMiniEl.contains(e.target)) hideReactMini();
  if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn && !(emojiBtn && emojiBtn.contains(e.target))) emojiPicker.classList.add('hidden');
});
document.addEventListener('scroll', () => hideReactMini(), true);

window.__allMsgs = window.__allMsgs || [];
const _renderMessage = renderMessage;
renderMessage = function(msg) {
  const idx = window.__allMsgs.findIndex(m => m.id === msg.id);
  if (idx >= 0) window.__allMsgs[idx] = msg;
  else window.__allMsgs.push(msg);
  _renderMessage(msg);
};
// ===== PINNED MESSAGE =====
(function(){
  var bar = document.getElementById('pinnedBar');
  var content = document.getElementById('pinContent');
  var unpinBtn = document.getElementById('unpinBtn');
  if (!bar) return;

  var currentPinned = null;

  function render(p) {
    currentPinned = p;
    if (!p) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    content.innerHTML = '';
    const u1 = document.createElement('div'); u1.className = 'pin-user'; u1.textContent = 'PIN - ' + (p.user || '');
    const t1 = document.createElement('div'); t1.className = 'pin-text'; t1.textContent = p.text || '';
    content.appendChild(u1); content.appendChild(t1);
    var adminLink = document.getElementById('adminBtn');
    var isAdmin = adminLink && !adminLink.classList.contains('hidden');
    unpinBtn.classList.toggle('hidden', !isAdmin);
  }

  bar.onclick = function(e) {
    if (e.target === unpinBtn) return;
    if (!currentPinned) return;
    var el = document.querySelector('.msg[data-msg-id="' + currentPinned.msgId + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('msg-flash');
      setTimeout(function(){ el.classList.remove('msg-flash'); }, 1400);
    }
  };

  unpinBtn.onclick = function(e) {
    e.stopPropagation();
    if (!confirm('Unpin pesan ini?')) return;
    window.__socket.emit('unpin-message', function(res) {
      if (res && res.error && window.__toast) window.__toast('Error: ' + res.error);
    });
  };

  window.__socket.on('pinned-updated', render);
  setTimeout(function(){
    window.__socket.emit('pinned-get', function(res) {
      if (res && res.ok) render(res.pinned);
    });
  }, 800);

  window.__renderPinned = render;
})();

// Admin double-tap to pin
(function(){
  var lastTap = 0;
  var lastMsgId = null;
  var msgEl = document.getElementById("messages");
  if (!msgEl) return;
  msgEl.addEventListener("click", function(e) {
    var _isAdmin3 = (typeof me !== "undefined" && me && me.badge === "admin");
    var _isPanelAdmin = (document.getElementById("adminBtn") && !document.getElementById("adminBtn").classList.contains("hidden"));
    if (!_isAdmin3 && !_isPanelAdmin) return;
    var bubble = e.target.closest(".msg");
    if (!bubble) return;
    var now = Date.now();
    var id = bubble.dataset.msgId;
    if (lastMsgId === id && now - lastTap < 400) {
      showAdminPinMenu(id);
      lastTap = 0;
      lastMsgId = null;
    } else {
      lastTap = now;
      lastMsgId = id;
    }
  });
})();

window.__socket.on('user-color-changed', function(d) {
  document.querySelectorAll('.msg[data-msg-id]').forEach(function(el){
    var id = el.dataset.msgId;
    var m = (window.__allMsgs || []).find(function(x){ return x.id === id; });
    if (!m || m.userId !== d.userId) return;
    m.bubbleColor = d.color;
    if (d.color === '#d9fdd3') { el.style.background = ''; } else { el.style.background = d.color; }
  });
});

function applyWallpaper(w) {
  document.body.className = document.body.className.replace(/wp-\S+/g, '').trim();
  document.body.classList.add('wp-' + (w || 'default'));
}
window.__socket.on('user-wallpaper-changed', function(d){
  if (d.userId === userId) applyWallpaper(d.wallpaper);
});

socket.on('rate-limited', function(d) {
  if (window.__toast) window.__toast('⚠️ ' + (d.msg || 'Pelan dong!'));
  else alert(d.msg || 'Pelan dong!');
});
