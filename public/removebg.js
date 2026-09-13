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


function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxSize && height <= maxSize) return resolve(file);
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

uploadBox.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return showError('Max 10MB');
  if (!file.type.startsWith('image/')) return showError('Hanya gambar');

  showLoading('Memuat AI model...');

  try {
    // Resize gambar dulu biar HP gak berat
    const resized = await resizeImage(file, 800);
    const blob = await removeBackground(resized, {
      model: 'isnet_quint8',
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100);
          progress.style.width = pct + '%';
          if (key.includes('fetch')) loadingText.textContent = 'Download model: ' + pct + '%';
          else if (key.includes('compute')) loadingText.textContent = 'Proses AI: ' + pct + '% (sabar ya, tergantung HP)';
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
