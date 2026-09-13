const $ = (id) => document.getElementById(id);
const messagesEl = $('aiMessages');
const inputEl = $('aiInput');
const sendBtn = $('aiSend');
const typingEl = $('aiTyping');
const clearBtn = $('aiClearBtn');
const toastEl = $('toast');

let history = [];
const STORAGE_KEY = 'javin_ai_history_v1';

function loadHistory() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) history = JSON.parse(saved);
  } catch(e) {}
}
function saveHistory() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30))); } catch(e){}
}
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2000);
}
function addBubble(text, isUser) {
  var w = messagesEl.querySelector('.ai-welcome');
  if (w) w.remove();
  var el = document.createElement('div');
  el.className = 'ai-bubble ' + (isUser ? 'ai-bubble-user' : 'ai-bubble-ai');
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function renderHistory() {
  messagesEl.innerHTML = '';
  if (!history.length) {
    messagesEl.innerHTML = '<div class="ai-welcome"><div class="ai-welcome-icon">🤖</div><div class="ai-welcome-title">Halo! Gue Asisten Javin</div><div class="ai-welcome-sub">Tanya apa aja, gue siap bantu 🔥</div></div>';
    return;
  }
  history.forEach(function(m) { addBubble(m.text, m.role === 'user'); });
}
function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}
inputEl.addEventListener('input', autoResize);
inputEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  var text = inputEl.value.trim();
  if (!text) return;
  if (text.length > 2000) return toast('Maksimal 2000 karakter');

  inputEl.value = '';
  inputEl.style.height = 'auto';
  addBubble(text, true);
  history.push({ role: 'user', text: text, time: Date.now() });
  saveHistory();

  typingEl.classList.remove('hidden');
  sendBtn.disabled = true;
  inputEl.disabled = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    var apiMessages = history.slice(-15).map(function(m) {
      return { role: m.role === 'user' ? 'user' : 'assistant', content: m.text };
    });
    var res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages })
    });
    var data = await res.json();
    typingEl.classList.add('hidden');
    if (data.error) {
      var em = '⚠️ ' + data.error;
      addBubble(em, false);
      history.push({ role: 'ai', text: em, time: Date.now() });
    } else {
      var ans = data.answer || 'Maaf, gak ada jawaban.';
      addBubble(ans, false);
      history.push({ role: 'ai', text: ans, time: Date.now() });
    }
    saveHistory();
  } catch (err) {
    typingEl.classList.add('hidden');
    var errMsg = '⚠️ Gagal: ' + err.message;
    addBubble(errMsg, false);
    history.push({ role: 'ai', text: errMsg, time: Date.now() });
    saveHistory();
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

clearBtn.addEventListener('click', function() {
  if (!confirm('Hapus semua riwayat chat?')) return;
  history = [];
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  toast('Chat dihapus');
});

loadHistory();
renderHistory();
setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
