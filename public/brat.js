const $ = (id) => document.getElementById(id);
const textInput = $('bratText');
const countEl = $('bratCount');
const generateBtn = $('bratGenerate');
const loading = $('bratLoading');
const result = $('bratResult');
const player = $('bratPlayer');
const errorBox = $('bratError');
const toastEl = $('toast');

let lastVideoUrl = null;

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}
function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
  loading.classList.add('hidden');
}
function hideError() { errorBox.classList.add('hidden'); }

textInput.addEventListener('input', () => {
  countEl.textContent = textInput.value.length;
});

generateBtn.onclick = async () => {
  const text = textInput.value.trim();
  hideError();
  if (!text) return showError('Isi teks dulu');
  if (text.length > 200) return showError('Max 200 karakter');

  generateBtn.disabled = true;
  result.classList.add('hidden');
  loading.classList.remove('hidden');

  // Hapus video lama
  if (lastVideoUrl) { URL.revokeObjectURL(lastVideoUrl); lastVideoUrl = null; }

  try {
    const res = await fetch('/api/brat?text=' + encodeURIComponent(text));
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'HTTP ' + res.status }));
      throw new Error(err.error || 'Gagal generate');
    }
    const blob = await res.blob();
    if (blob.size < 1000) throw new Error('Video terlalu kecil, coba lagi');

    lastVideoUrl = URL.createObjectURL(blob);
    player.src = lastVideoUrl;
    loading.classList.add('hidden');
    result.classList.remove('hidden');
    toast('✅ Video berhasil dibuat!');
  } catch (err) {
    console.error(err);
    showError(err.message || 'Gagal generate video');
  } finally {
    generateBtn.disabled = false;
  }
};

$('bratDownloadBtn').onclick = () => {
  if (!lastVideoUrl) return showError('Generate dulu');
  const a = document.createElement('a');
  a.href = lastVideoUrl;
  a.download = 'brat-' + Date.now() + '.mp4';
  a.click();
  toast('⬇️ Download dimulai');
};

$('bratPreviewBtn').onclick = () => {
  if (!lastVideoUrl) return showError('Generate dulu');
  const v = player;
  if (v.requestFullscreen) v.requestFullscreen();
  else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  v.play().catch(() => {});
};

$('bratResetBtn').onclick = () => {
  result.classList.add('hidden');
  hideError();
  textInput.value = '';
  countEl.textContent = '0';
  textInput.focus();
  if (lastVideoUrl) { URL.revokeObjectURL(lastVideoUrl); lastVideoUrl = null; }
};
