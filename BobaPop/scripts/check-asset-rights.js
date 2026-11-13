const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/licenses.json');
const missing = [];
for (const item of manifest) {
  const bytes = fs.readFileSync(path.join(root, item.path));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== item.sha256 || !item.ownerConfirmed || !item.license || !item.source) missing.push(item.path);
}
if (missing.length) throw new Error(`${missing.length} assets need source and usage-rights confirmation in assets/licenses.json. Existing records have not been guessed.`);
console.log('Asset usage rights confirmed for all recorded assets.');
