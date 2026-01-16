const path = require('path');

function resolveStoragePaths() {
  const resolveIfSet = (value) => (value ? path.resolve(value) : null);

  const storageRoot = resolveIfSet(process.env.ARTARC_STORAGE_DIR);
  const dataDir =
    resolveIfSet(process.env.ARTARC_DATA_DIR) ||
    (storageRoot ? path.join(storageRoot, 'data') : path.join(__dirname, 'data'));
  const mediaDir =
    resolveIfSet(process.env.ARTARC_MEDIA_DIR) ||
    (storageRoot ? path.join(storageRoot, 'media') : path.join(__dirname, 'media'));
  const dbPath =
    resolveIfSet(process.env.ARTARC_DB_PATH) || path.join(dataDir, 'artarc.db');

  return { storageRoot, dataDir, mediaDir, dbPath };
}

module.exports = {
  resolveStoragePaths
};
