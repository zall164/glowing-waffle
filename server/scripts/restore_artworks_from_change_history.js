/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { db, MEDIA_DIR, DB_PATH } = require('../database');

function isArtworkDirName(name) {
  return /^[0-9]{6}$/.test(name);
}

function readFileIfExists(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_) {
    return null;
  }
}

function parseLatestChangeBlock(historyText) {
  // Split by "CHANGE RECORDED:" and take the last block (most recent)
  const marker = 'CHANGE RECORDED:';
  const idx = historyText.lastIndexOf(marker);
  if (idx === -1) return null;
  return historyText.slice(idx);
}

function parseChangesFromBlock(blockText) {
  // Extract lines like:
  //   field: "old" → "new"
  const changes = {};
  const lines = blockText.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s{2}([a-z_]+): "(.*)" → "(.*)"$/);
    if (!m) continue;
    const field = m[1];
    const oldVal = m[2];
    const newVal = m[3];
    changes[field] = { oldVal, newVal };
  }
  return changes;
}

function normalizeFromHistory(val) {
  if (val === '(empty)') return '';
  return val;
}

async function run() {
  const root = MEDIA_DIR;
  const backupDir = path.dirname(DB_PATH);
  const backupPath = path.join(backupDir, `artarc.db.backup_${new Date().toISOString().replace(/[:.]/g, '-')}`);
  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`DB backup created: ${backupPath}`);
  } catch (e) {
    console.error('Failed to create DB backup copy; aborting.', e);
    process.exit(1);
  }

  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && isArtworkDirName(d.name))
    .map(d => d.name);

  let restoredCount = 0;
  let inspectedCount = 0;

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
        if (beginErr) return reject(beginErr);

        const next = (i) => {
          if (i >= dirs.length) {
            return db.run('COMMIT', (commitErr) => {
              if (commitErr) return reject(commitErr);
              resolve();
            });
          }

          const dirName = dirs[i];
          const artworkId = parseInt(dirName, 10);
          const historyPath = path.join(root, dirName, 'change_history.txt');
          const historyText = readFileIfExists(historyPath);
          inspectedCount += 1;

          if (!historyText) return next(i + 1);
          const block = parseLatestChangeBlock(historyText);
          if (!block) return next(i + 1);

          const changes = parseChangesFromBlock(block);
          // We only want to restore fields that were changed TO (empty) by the bulk edit.
          const fieldsToRestore = {};
          for (const [field, { oldVal, newVal }] of Object.entries(changes)) {
            if (newVal === '(empty)' && oldVal !== '(empty)') {
              fieldsToRestore[field] = normalizeFromHistory(oldVal);
            }
          }

          const keys = Object.keys(fieldsToRestore);
          if (keys.length === 0) return next(i + 1);

          // Only restore if the DB currently has empties for those fields (avoid undoing legit edits)
          db.get('SELECT * FROM artworks WHERE id = ?', [artworkId], (getErr, row) => {
            if (getErr || !row) return next(i + 1);

            const apply = {};
            keys.forEach((k) => {
              const current = row[k];
              if (current === null || current === '') {
                apply[k] = fieldsToRestore[k];
              }
            });

            const applyKeys = Object.keys(apply);
            if (applyKeys.length === 0) return next(i + 1);

            const setClause = applyKeys.map(k => `${k} = ?`).join(', ');
            const params = applyKeys.map(k => apply[k]);
            params.push(artworkId);

            db.run(
              `UPDATE artworks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              params,
              (updErr) => {
                if (!updErr) restoredCount += 1;
                next(i + 1);
              }
            );
          });
        };

        next(0);
      });
    });
  });

  console.log(`Inspected artwork folders: ${inspectedCount}`);
  console.log(`Restored records (at least 1 field): ${restoredCount}`);

  db.get(
    "SELECT count(*) AS total, sum(case when ifnull(title,'')='' then 1 else 0 end) AS empty_title, sum(case when ifnull(year,'')='' then 1 else 0 end) AS empty_year, sum(case when ifnull(medium,'')='' then 1 else 0 end) AS empty_medium FROM artworks",
    (e, r) => {
      if (e) {
        console.error('Post-check failed:', e);
        process.exit(1);
      }
      console.log('Post-check:', r);
      process.exit(0);
    }
  );
}

run().catch((e) => {
  console.error('Restore failed:', e);
  process.exit(1);
});

