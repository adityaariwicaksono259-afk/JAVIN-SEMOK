const $ = (id) => document.getElementById(id);
let method = 'GET';
let history = [];

try {
  const saved = localStorage.getItem('apitool_history');
  if (saved) history = JSON.parse(saved);
} catch(e){}

function toast(m, ms) {
  const t = $('toast');
  t.textContent = m;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), ms || 2200);
}

function parseKv(str) {
  const out = {};
  (str || '').split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

document.querySelectorAll('.apitool-method-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.apitool-method-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    method = b.dataset.method;
    $('apiBody').style.display = method === 'POST' ? '' : 'none';
  };
});
$('apiBody').style.display = 'none';

$('apiClear').onclick = () => {
  $('apiUrl').value = '';
  $('apiParams').value = '';
  $('apiBody').value = '';
  $('apiHeaders').value = '';
  $('apiResponse').classList.add('hidden');
  toast('Form di-reset');
};

$('apiSend').onclick = async () => {
  const baseUrl = $('apiUrl').value.trim();
  if (!baseUrl) return toast('Isi URL dulu');

  const params = parseKv($('apiParams').value);
  const headers = parseKv($('apiHeaders').value);
  const bodyRaw = $('apiBody').value.trim();

  let finalUrl = baseUrl;
  if (method === 'GET' && Object.keys(params).length) {
    const qs = new URLSearchParams(params).toString();
    finalUrl += (baseUrl.includes('?') ? '&' : '?') + qs;
  }

  const opts = { method, headers: { ...headers } };
  if (method === 'POST' && bodyRaw) {
    try {
      JSON.parse(bodyRaw);
      opts.body = bodyRaw;
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    } catch(e) {
      opts.body = new URLSearchParams(params).toString();
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  $('apiSend').disabled = true;
  $('apiSend').textContent = '⏳ Mengirim...';
  const t0 = performance.now();

  try {
    const r = await fetch(finalUrl, opts);
    const t1 = performance.now();
    const dur = Math.round(t1 - t0);

    const text = await r.text();
    let display = text;
    try {
      const j = JSON.parse(text);
      display = JSON.stringify(j, null, 2);
    } catch(e) {}

    $('apiStatus').textContent = r.status + ' ' + r.statusText;
    $('apiStatus').className = 'apitool-resp-status ' + (r.ok ? 'ok' : 'err');
    $('apiTime').textContent = dur + ' ms';
    $('apiBody2').textContent = display;
    $('apiResponse').classList.remove('hidden');

    history.unshift({ url: baseUrl, method, time: Date.now(), status: r.status, dur });
    if (history.length > 15) history.pop();
    localStorage.setItem('apitool_history', JSON.stringify(history));
    renderHist();
    toast(r.ok ? '✅ Berhasil' : '⚠️ HTTP ' + r.status);
  } catch(err) {
    $('apiStatus').textContent = 'ERROR';
    $('apiStatus').className = 'apitool-resp-status err';
    $('apiTime').textContent = '-';
    $('apiBody2').textContent = '❌ ' + err.message;
    $('apiResponse').classList.remove('hidden');
    toast('❌ ' + err.message);
  } finally {
    $('apiSend').disabled = false;
    $('apiSend').textContent = '🚀 KIRIM REQUEST';
  }
};

$('apiCopy').onclick = () => {
  const txt = $('apiBody2').textContent;
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

function renderHist() {
  const box = $('apiHist');
  box.innerHTML = '';
  if (!history.length) { box.innerHTML = '<div class="apitool-empty">Belum ada request</div>'; return; }
  history.forEach(h => {
    const d = new Date(h.time);
    const el = document.createElement('div');
    el.className = 'apitool-hist-item';
    el.innerHTML = '<div class="apitool-hist-url">' + h.method + ' · ' + h.url.slice(0, 60) + '</div>' +
                   '<div class="apitool-hist-meta">' + h.status + ' · ' + h.dur + 'ms · ' + d.toLocaleTimeString('id-ID') + '</div>';
    el.onclick = () => { $('apiUrl').value = h.url; toast('URL loaded'); };
    box.appendChild(el);
  });
}

renderHist();
