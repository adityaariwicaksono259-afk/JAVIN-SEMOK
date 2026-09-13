const $ = (id) => document.getElementById(id);
const messagesEl = $('aiMessages');
const inputEl = $('aiInput');
const sendBtn = $('aiSend');
const typingEl = $('aiTyping');
const clearBtn = $('aiClearBtn');
const toastEl = $('toast');

let history = [];
const STORAGE_KEY = 'llama_history_v1';
const API_URL = 'https://api.nexadev.my.id/ai/llama?q=';

function loadHistory() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) history = JSON.parse(saved);
  } catch(e) {}
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30)));
  } catch(e) {}
}

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function addBubble(text, isUser) {
  var welcome = messagesEl.querySelector('.ai-welcome');
  if (welcome) welcome.remove();
  var el = document.createElement('div');
  el.className = 'ai-bubble ' + (isUser ? 'ai-bubble-user' : 'ai-bubble-ai');
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollBottom();
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderHistory() {
  messagesEl.innerHTML = '';
  if (!history.length) {
    messagesEl.innerHTML = '<div class="ai-welcome"><div class="ai-welcome-icon">🦙</div><div class="ai-welcome-title">Halo! Gue Meta Llama 7.1</div><div class="ai-welcome-sub">Tanya apa aja, gue siap bantu 🔥</div></div>';
    return;
  }
  history.forEach(function(m) {
    addBubble(m.text, m.role === 'user');
  });
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}

inputEl.addEventListener('input', autoResize);
inputEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
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
  scrollBottom();

  try {
    var url = API_URL + encodeURIComponent(text);
    var res = await fetch(url);
    var data = await res.json();
    // Extract jawaban — format bisa beda-beda, kita coba beberapa field
    var answer = '';
    if (typeof data === 'string') answer = data;
    else if (data.result) answer = data.result;
    else if (data.response) answer = data.response;
    else if (data.message) answer = data.message;
    else if (data.answer) answer = data.answer;
    else if (data.data) answer = typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
    else answer = JSON.stringify(data);

    typingEl.classList.add('hidden');
    addBubble(answer, false);
    history.push({ role: 'ai', text: answer, time: Date.now() });
    saveHistory();
  } catch (err) {
    typingEl.classList.add('hidden');
    var errMsg = '⚠️ Gagal dapet respon: ' + err.message;
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
setTimeout(scrollBottom, 100);
