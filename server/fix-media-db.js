const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { db, MEDIA_DIR, formatArtworkId } = require('./database');

// Get file type from extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.txt', '.pdf', '.doc', '.docx'].includes(ext)) return 'text';
  return 'unknown';
}

// Check if file should be registered (skip metadata files)
function shouldRegisterFile(filename) {
  const skipFiles = ['artwork_info.txt', 'change_history.txt'];
  return !skipFiles.includes(filename);
}

async function fixMediaDatabase() {
  return new Promise((resolve, reject) => {
    const fixes = [];

    // Step 1: Get all folders in media directory
    const folders = fs.readdirSync(MEDIA_DIR)
      .filter(item => {
        const fullPath = path.join(MEDIA_DIR, item);
        return fs.statSync(fullPath).isDirectory() && /^\d{6}$/.test(item);
      })
      .map(folder => ({
        folderName: folder,
        artworkId: parseInt(folder, 10),
        fullPath: path.join(MEDIA_DIR, folder)
      }));

    // Step 2: Get all media records from database
    db.all('SELECT artwork_id, filename FROM media', [], (err, mediaRecords) => {
      if (err) {
        return reject(err);
      }

      // Create set for quick lookup
      const mediaFiles = new Set();
      mediaRecords.forEach(record => {
        mediaFiles.add(`${record.artwork_id}/${record.filename}`);
      });

      // Step 3: Find missing files and add them
      folders.forEach(({ folderName, artworkId, fullPath }) => {
        try {
          const files = fs.readdirSync(fullPath)
            .filter(file => {
              const filePath = path.join(fullPath, file);
              return fs.statSync(filePath).isFile() && shouldRegisterFile(file);
            });

          files.forEach(file => {
            const mediaKey = `${artworkId}/${file}`;
            if (!mediaFiles.has(mediaKey)) {
              const fileType = getFileType(file);
              const isPrimary = file.match(/^\d{6}\.(jpg|jpeg|png|gif|webp|bmp|mp4|avi|mov|webm|mp3|wav|ogg|m4a)$/i);
              
              fixes.push({
                artworkId: artworkId,
                filename: file,
                fileType: fileType,
                isPrimary: isPrimary ? 1 : 0
              });
            }
          });
        } catch (error) {
          console.error(`Error reading folder ${folderName}:`, error.message);
        }
      });

      console.log(`Found ${fixes.length} files to add to database\n`);

      if (fixes.length === 0) {
        console.log('No fixes needed!');
        resolve([]);
        return;
      }

      // Step 4: Apply fixes
      let completed = 0;
      let errors = 0;

      fixes.forEach(fix => {
        // If this is primary, unset other primary media for this artwork
        if (fix.isPrimary) {
          db.run('UPDATE media SET is_primary = 0 WHERE artwork_id = ?', [fix.artworkId], (err) => {
            if (err) {
              console.error(`Error updating primary media for artwork ${fix.artworkId}:`, err);
            }
          });
        }

        // Insert media record
        db.run(
          'INSERT INTO media (artwork_id, filename, file_type, is_primary) VALUES (?, ?, ?, ?)',
          [fix.artworkId, fix.filename, fix.fileType, fix.isPrimary],
          function(err) {
            if (err) {
              console.error(`Error adding media record for ${fix.artworkId}/${fix.filename}:`, err);
              errors++;
            } else {
              console.log(`✓ Added: ${formatArtworkId(fix.artworkId)}/${fix.filename} (${fix.fileType}${fix.isPrimary ? ', primary' : ''})`);
              completed++;
            }

            // When all fixes are processed
            if (completed + errors === fixes.length) {
              console.log(`\nCompleted: ${completed} added, ${errors} errors\n`);
              resolve(fixes);
            }
          }
        );
      });
    });
  });
}

// Run the fix
console.log('Fixing media database...\n');
fixMediaDatabase()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    db.close();
    process.exit(1);
  });





