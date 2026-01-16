const fs = require('fs-extra');
const { resolveStoragePaths } = require('../storage-paths');

const { dataDir, mediaDir, dbPath } = resolveStoragePaths();

async function freshInstall() {
  await fs.ensureDir(dataDir);
  await fs.ensureDir(mediaDir);

  // Only create an empty DB file if it doesn't exist. Do not delete data.
  if (!(await fs.pathExists(dbPath))) {
    await fs.ensureFile(dbPath);
  }

  console.log('Fresh install complete: directories ready.');
}

freshInstall().catch((err) => {
  console.error('Fresh install failed:', err);
  process.exit(1);
});
