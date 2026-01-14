const path = require('path');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, '..', 'data', 'artarc.db');
const MEDIA_DIR = path.join(__dirname, '..', 'media');

async function freshInstall() {
  const dataDir = path.dirname(DB_PATH);

  await fs.ensureDir(dataDir);
  await fs.ensureDir(MEDIA_DIR);

  // Only create an empty DB file if it doesn't exist. Do not delete data.
  if (!(await fs.pathExists(DB_PATH))) {
    await fs.ensureFile(DB_PATH);
  }

  console.log('Fresh install complete: directories ready.');
}

freshInstall().catch((err) => {
  console.error('Fresh install failed:', err);
  process.exit(1);
});
