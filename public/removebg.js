import { removeBackground } from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';

const $ = (id) => document.getElementById(id);
const uploadBox = $('rbgUpload');
const fileInput = $('rbgFile');
const loading = $('rbgLoading');
const loadingText = $('rbgLoadingText');
const progress = $('rbgProgress');
const result = $('rbgResult');
const preview = $('rbgPreview');
const errorBox = $('rbgError');
const viewer = $('rbgViewer');
const viewerImg = $('rbgViewerImg');
const toastEl = $('toast');

let lastBlobUrl = null;

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

function showLoading(text) {
  loading.classList.remove('hidden');
  result.classList.add('hidden');
  errorBox.classList.add('hidden');
  if (text) loadingText.textContent = text;
}

function hideLoading() {
  loading.classList.add('hidden');
}

function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
  hideLoading();
}

uploadBox.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return showError('Max 10MB');
  if (!file.type.startsWith('image/')) return showError('Hanya gambar');

  showLoading('Memuat AI model...');

  try {
    const blob = await removeBackground(file, {
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          progress.style.width = pct + '%';
          if (key.includes('fetch')) loadingText.textContent = 'Download model AI: ' + pct + '%';
          else if (key.includes('compute')) loadingText.textContent = 'Proses AI: ' + pct + '%';
        }
      }
    });

    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = URL.createObjectURL(blob);

    preview.src = lastBlobUrl;
    hideLoading();
    result.classList.remove('hidden');
    toast('✅ Berhasil!');
  } catch (err) {
    console.error(err);
    showError(err.message || 'Gagal proses gambar');
  }
};

$('rbgDownloadBtn').onclick = () => {
  if (!lastBlobUrl) return;
  const a = document.createElement('a');
  a.href = lastBlobUrl;
  a.download = 'no-bg-' + Date.now() + '.png';
  a.click();
};

$('rbgPreviewBtn').onclick = () => {
  if (!lastBlobUrl) return;
  viewerImg.src = lastBlobUrl;
  viewer.classList.remove('hidden');
};

$('rbgViewerClose').onclick = () => viewer.classList.add('hidden');
viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.add('hidden'); };

$('rbgResetBtn').onclick = () => {
  fileInput.value = '';
  result.classList.add('hidden');
  uploadBox.classList.remove('hidden');
  if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
};
