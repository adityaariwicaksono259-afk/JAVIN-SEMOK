// ============ DEBUG OVERLAY ============
window.__errs = [];
function showErr(msg) {
  window.__errs.push(msg);
  let box = document.getElementById('debugBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'debugBox';
    box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#b71c1c;color:#fff;font-family:monospace;font-size:11px;padding:8px 10px;z-index:99999;max-height:35vh;overflow-y:auto;line-height:1.4;white-space:pre-wrap;border-top:2px solid #ff5252';
    document.body.appendChild(box);
  }
  box.textContent = '⚠️ ' + window.__errs.length + ' ERROR:\n' + window.__errs.slice(-5).join('\n---\n');
  box.onclick = () => box.remove();
}
window.onerror = function(m, u, l, c) {
  showErr(m + ' @ ' + (u||'').split('/').pop() + ':' + l + ':' + c);
  return false;
};
window.addEventListener('unhandledrejection', (e) => {
  showErr('Promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// ============ MAIN ============
try {
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

  // Cek element wajib
  const required = { messagesEl, msgInput, sendBtn, toastEl };
  for (const k in required) {
    if (!required[k]) { showErr('❌ Element hilang: ' + k); }
  }
  if (!userId) { showErr('❌ userId kosong'); }

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
  function updateNotifBtn() {
    if (!notifBtn) return;
    notifBtn.textContent = notifEnabled ? '🔔' : '🔕';
  }
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

  // ============ EMOJI ============
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
      hideActionBar();
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
    const el = document.querySelector('.msg[data-msg-id="' + msgId + '"]');
    if (!el) return;
    const w = el.closest('.msg-wrapper');
    if (w) w.remove();
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
    if (u) u.textContent = 'Reply ke ' + user;
    if (t) t.textContent = text.slice(0, 100);
    if (replyBar) replyBar.classList.remove('hidden');
    if (msgInput) msgInput.focus();
  }
  function clearReply() { replyTarget = null; if (replyBar) replyBar.classList.add('hidden'); }
  const rbClose = $('replyBarClose');
  if (rbClose) rbClose.onclick = clearReply;

  // ============ ACTION BAR ============
  const QUICK_EMOJIS = ['❤️','😂','👍','🔥','😮','😢'];
  function showActionBar(msgId, bubbleEl) {
    hideActionBar();
    const msg = (window.__allMsgs || []).find(m => m.id === msgId);
    if (!msg) return;
    const bar = document.createElement('div');
    bar.className = 'action-bar';
    QUICK_EMOJIS.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e;
      b.onclick = (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        socket.emit('react-message', { msgId, emoji: e }, (res) => {
          if (res && res.error) toast('❌ ' + res.error);
        });
        hideActionBar();
      };
      bar.appendChild(b);
    });
    const sep = document.createElement('div'); sep.className = 'act-sep'; bar.appendChild(sep);
    const replyB = document.createElement('button');
    replyB.type = 'button'; replyB.className = 'act-reply'; replyB.textContent = '↩'; replyB.title = 'Reply';
    replyB.onclick = (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      const preview = msg.type === 'image' ? '📎 Gambar' : msg.text;
      setReply(msg.id, msg.user, preview);
      hideActionBar();
    };
    bar.appendChild(replyB);
    if (msg.userId === userId && Date.now() - msg.time < 24 * 60 * 60 * 1000) {
      const delB = document.createElement('button');
      delB.type = 'button'; delB.className = 'act-delete'; delB.textContent = '🗑️'; delB.title = 'Hapus';
      delB.onclick = (ev) => {
        ev.stopPropagation(); ev.preventDefault();
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
    const rect = bubbleEl.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const gap = 8;
    let top = rect.top - barRect.height - gap;
    let left = rect.left;
    if (top < 10) top = rect.bottom + gap;
    if (left + barRect.width > window.innerWidth - 10) left = window.innerWidth - barRect.width - 10;
    if (left < 10) left = 10;
    bar.style.top = top + 'px';
    bar.style.left = left + 'px';
  }
  function hideActionBar() {
    if (actionBarEl) { actionBarEl.remove(); actionBarEl = null; actionBarMsgId = null; }
  }

  if (messagesEl) {
    messagesEl.addEventListener('click', (e) => {
      if (actionBarEl && actionBarEl.contains(e.target)) return;
      if (e.target.closest('.reaction-btn')) return;
      if (e.target.closest('.msg-quote')) return;
      if (e.target.classList.contains('msg-img')) return;
      const msgEl = e.target.closest('.msg');
      if (!msgEl) { hideActionBar(); return; }
      const msgId = msgEl.dataset.msgId;
      if (actionBarMsgId === msgId) { hideActionBar(); return; }
      showActionBar(msgId, msgEl);
      e.stopPropagation();
    });
  }
  document.addEventListener('click', (e) => {
    if (actionBarEl && !actionBarEl.contains(e.target)) hideActionBar();
    if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn && !(emojiBtn && emojiBtn.contains(e.target))) emojiPicker.classList.add('hidden');
  });
  document.addEventListener('scroll', hideActionBar, true);

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
  window.__allMsgs = [];
  function renderMessage(msg) {
    if (!messagesEl) return;
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

  showErr('✅ chat_v4.js loaded OK'); // tanda sukses
  setTimeout(() => { const b = $('debugBox'); if (b && window.__errs.length <= 1) b.remove(); }, 3000);
} catch (e) {
  showErr('CATCH: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0,3).join('\n'));
}
