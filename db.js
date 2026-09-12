const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
let isConnected = false;
let DataModel = null;

// Schema tunggal — semua data disimpan di 1 dokumen
const dataSchema = new mongoose.Schema({
  _id: { type: String, default: 'main' },
  users: { type: Object, default: {} },
  messages: { type: Array, default: [] },
  topups: { type: Array, default: [] },
  dms: { type: Object, default: {} },
  quests: { type: Object, default: {} },
  pinned: { type: Object, default: null }
}, { minimize: false, timestamps: true });

async function connectDB() {
  if (!URI) {
    console.error('❌ MONGODB_URI tidak diset');
    return false;
  }
  if (isConnected) return true;
  try {
    await mongoose.connect(URI);
    DataModel = mongoose.model('Data', dataSchema);
    isConnected = true;
    console.log('✅ MongoDB connected');
    return true;
  } catch (e) {
    console.error('❌ MongoDB connect error:', e.message);
    return false;
  }
}

async function loadFromDB() {
  if (!isConnected) await connectDB();
  if (!isConnected) return null;
  try {
    let doc = await DataModel.findById('main');
    if (!doc) {
      doc = await DataModel.create({ _id: 'main' });
      console.log('📦 Dokumen baru dibuat di MongoDB');
    }
    return {
      users: doc.users || {},
      messages: doc.messages || [],
      topups: doc.topups || [],
      dms: doc.dms || {},
      quests: doc.quests || {},
      pinned: doc.pinned || null
    };
  } catch (e) {
    console.error('❌ Load error:', e.message);
    return null;
  }
}

let saveTimer = null;
function saveToDB(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!isConnected) return;
    try {
      await DataModel.findByIdAndUpdate('main', {
        users: data.users,
        messages: data.messages,
        topups: data.topups,
        dms: data.dms,
        quests: data.quests,
        pinned: data.pinned
      });
    } catch (e) {
      console.error('❌ Save error:', e.message);
    }
  }, 500);
}

module.exports = { connectDB, loadFromDB, saveToDB };
