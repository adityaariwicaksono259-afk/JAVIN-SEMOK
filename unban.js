require('dotenv').config();
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;
if (!URI) {
  console.log('❌ MONGODB_URI gak ada di .env');
  process.exit(1);
}

console.log('⏳ Connecting ke MongoDB...');
console.log('   Host: ' + (URI.match(/@([^/]+)/) || ['', 'unknown'])[1]);

const dataSchema = new mongoose.Schema({
  _id: { type: String, default: 'main' },
  users: { type: Object, default: {} }
}, { minimize: false, strict: false });

(async () => {
  try {
    await mongoose.connect(URI);
    console.log('✅ Connected');
    const Model = mongoose.model('Data', dataSchema);
    const doc = await Model.findById('main');
    if (!doc) { console.log('❌ Dokumen main gak ada'); process.exit(1); }

    const users = doc.users || {};
    let unbanCount = 0, arrayFixCount = 0, total = Object.keys(users).length;

    Object.keys(users).forEach(uid => {
      const u = users[uid];
      const b = u.banned;
      const uname = u.username || uid.slice(0, 8);
      if (b === true) {
        u.banned = false;
        unbanCount++;
        console.log('  ✅ Unban: ' + uname);
      } else if (Array.isArray(b)) {
        u.banned = false;
        arrayFixCount++;
        console.log('  🔧 Fix array: ' + uname + ' (was: ' + JSON.stringify(b) + ')');
      }
    });

    doc.markModified('users');
    await doc.save();
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('✅ SELESAI');
    console.log('  Unbanned   : ' + unbanCount + ' user');
    console.log('  Fixed array: ' + arrayFixCount + ' user');
    console.log('  Total users: ' + total);
    console.log('═══════════════════════════════════');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
