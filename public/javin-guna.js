const $ = (id) => document.getElementById(id);
let history = [];

try {
  const saved = localStorage.getItem('jg_history');
  if (saved) history = JSON.parse(saved);
} catch(e){}

function toast(m, ms) {
  const t = $('toast');
  t.textContent = m;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), ms || 2200);
}

// ============================================
// ⚙️ KONFIGURASI FUNGSI
// TAMBAH/EDIT FUNGSI DI SINI
// ============================================
const FUNCTIONS = {

  // ====== CONTOH 1: Default ======
  default: {
    name: 'Default',
    // URL API — GANTI DI SINI
    url: 'https://api.contoh.com/endpoint',
    method: 'GET',
    // Bangun URL dengan input user
    buildUrl: (input1, input2) => {
      return 'https://api.contoh.com/endpoint?q=' + encodeURIComponent(input1);
    },
    // Bangun header (opsional)
    buildHeaders: () => {
      return {};  // contoh: { 'Authorization': 'Bearer xxx' }
    },
    // Bangun body (khusus POST, opsional)
    buildBody: (input1, input2) => {
      return null;  // contoh: { q: input1 }
    },
    // Parse response
    parse: (data) => {
      return data;
    }
  },

  // ====== TAMBAH FUNGSI BARU DI SINI ======
  // Contoh:
  // fungsi2: {
  //   name: 'Nama Fungsi 2',
  //   buildUrl: (a, b) => 'https://api.lain.com/x=' + a,
  //   method: 'GET',
  //   buildHeaders: () => ({ 'X-Api-Key': 'xxxx' }),
  //   buildBody: () => null,
  //   parse: (d) => d.result || d
  // },

};

// ============================================
// RENDER DROPDOWN FUNGSI
// ============================================
function renderFuncDropdown() {
  const sel = $('jgFunc');
  sel.innerHTML = '';
  Object.keys(FUNCTIONS).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = FUNCTIONS[key].name;
    sel.appendChild(opt);
  });
}
renderFuncDropdown();

// ============================================
// TOMBOL CREATE
// ============================================
$('jgCreate').onclick = async () => {
  const funcKey = $('jgFunc').value;
  const input1 = $('jgInput').value.trim();
  const input2 = $('jgInput2').value.trim();

  const fn = FUNCTIONS[funcKey];
  if (!fn) return toast('Fungsi gak ada');

  if (!input1) return toast('Isi input dulu');

  const url = fn.buildUrl(input1, input2);
  const method = fn.method || 'GET';
  const headers = fn.buildHeaders ? fn.buildHeaders(input1, input2) : {};
  let body = fn.buildBody ? fn.buildBody(input1, input2) : null;

  $('jgCreate').disabled = true;
  $('jgCreate').textContent = '⏳ Memproses...';
  const t0 = performance.now();

  try {
    const opts = { method, headers: { ...headers } };
    if (body && method === 'POST') {
      if (typeof body === 'string') {
        opts.body = body;
      } else {
        opts.body = JSON.stringify(body);
        if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
      }
    }

    const r = await fetch(url, opts);
    const dur = Math.round(performance.now() - t0);
    const text = await r.text();

    let parsed = text;
    let isJson = false;
    try {
      const j = JSON.parse(text);
      parsed = fn.parse ? fn.parse(j) : j;
      isJson = true;
    } catch(e) {
      parsed = text;
    }

    $('jgStatus').textContent = r.status + ' ' + r.statusText;
    $('jgStatus').className = 'jg-resp-status ' + (r.ok ? 'ok' : 'err');
    $('jgTime').textContent = dur + ' ms';
    $('jgBody').textContent = isJson ? JSON.stringify(parsed, null, 2) : parsed;
    $('jgResponse').classList.remove('hidden');

    history.unshift({ func: fn.name, input: input1, status: r.status, time: Date.now(), dur });
    if (history.length > 15) history.pop();
    localStorage.setItem('jg_history', JSON.stringify(history));
    renderHistory();

    toast(r.ok ? '✅ Berhasil' : '⚠️ HTTP ' + r.status);

  } catch(err) {
    $('jgStatus').textContent = 'ERROR';
    $('jgStatus').className = 'jg-resp-status err';
    $('jgTime').textContent = '-';
    $('jgBody').textContent = '❌ ' + err.message;
    $('jgResponse').classList.remove('hidden');
    toast('❌ ' + err.message);
  } finally {
    $('jgCreate').disabled = false;
    $('jgCreate').textContent = '🚀 CREATE';
  }
};

$('jgReset').onclick = () => {
  $('jgInput').value = '';
  $('jgInput2').value = '';
  $('jgResponse').classList.add('hidden');
  toast('Form di-reset');
};

$('jgCopy').onclick = () => {
  const txt = $('jgBody').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => toast('📋 Copied')).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('📋 Copied');
  }
};

function renderHistory() {
  const box = $('jgHist');
  box.innerHTML = '';
  if (!history.length) { box.innerHTML = '<div class="jg-empty">Belum ada riwayat</div>'; return; }
  history.forEach(h => {
    const d = new Date(h.time);
    const el = document.createElement('div');
    el.className = 'jg-hist-item';
    el.innerHTML =
      '<div class="jg-hist-name">' + h.func + '</div>' +
      '<div class="jg-hist-meta">' + h.status + ' · ' + h.dur + 'ms · ' + d.toLocaleTimeString('id-ID') + '</div>' +
      '<div class="jg-hist-input">' + h.input.slice(0, 40) + '</div>';
    box.appendChild(el);
  });
}
renderHistory();
