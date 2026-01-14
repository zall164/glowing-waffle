const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { db, MEDIA_DIR, formatArtworkId } = require('./database');

// Helper to parse artwork ID from folder name
function parseArtworkIdFromFolder(folderName) {
  // Should be 6 digits like "000741"
  if (/^\d{6}$/.test(folderName)) {
    return parseInt(folderName, 10);
  }
  return null;
}

// Get file type from extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.txt', '.pdf', '.doc', '.docx'].includes(ext)) return 'text';
  return 'unknown';
}

async function checkMediaDatabase() {
  return new Promise((resolve, reject) => {
    const issues = {
      foldersWithoutArtwork: [],      // Folders that exist but artwork not in DB
      filesNotInMediaTable: [],       // Files in folders not registered in media table
      artworksWithoutFolders: [],      // Artworks in DB without folders
      mediaRecordsWithoutFiles: [],   // Media table entries without actual files
      artworksWithoutMedia: []         // Artworks in DB with no media records
    };

    // Step 1: Get all folders in media directory
    const folders = fs.readdirSync(MEDIA_DIR)
      .filter(item => {
        const fullPath = path.join(MEDIA_DIR, item);
        return fs.statSync(fullPath).isDirectory() && /^\d{6}$/.test(item);
      })
      .map(folder => ({
        folderName: folder,
        artworkId: parseArtworkIdFromFolder(folder),
        fullPath: path.join(MEDIA_DIR, folder)
      }));

    console.log(`\nFound ${folders.length} artwork folders in media directory\n`);

    // Step 2: Get all artworks from database
    db.all('SELECT id, title FROM artworks ORDER BY id', [], (err, artworks) => {
      if (err) {
        return reject(err);
      }

      const artworkIds = new Set(artworks.map(a => a.id));
      const artworkMap = new Map(artworks.map(a => [a.id, a]));

      console.log(`Found ${artworks.length} artworks in database\n`);

      // Step 3: Get all media records from database
      db.all('SELECT artwork_id, filename, file_type FROM media ORDER BY artwork_id, filename', [], (err, mediaRecords) => {
        if (err) {
          return reject(err);
        }

        console.log(`Found ${mediaRecords.length} media records in database\n`);

        // Create maps for quick lookup
        const mediaByArtwork = new Map();
        const mediaFiles = new Set();
        
        mediaRecords.forEach(record => {
          if (!mediaByArtwork.has(record.artwork_id)) {
            mediaByArtwork.set(record.artwork_id, []);
          }
          mediaByArtwork.get(record.artwork_id).push(record);
          mediaFiles.add(`${record.artwork_id}/${record.filename}`);
        });

        // Step 4: Check each folder
        folders.forEach(({ folderName, artworkId, fullPath }) => {
          // Check if artwork exists in DB
          if (!artworkIds.has(artworkId)) {
            issues.foldersWithoutArtwork.push({
              folder: folderName,
              artworkId: artworkId
            });
          }

          // Check files in folder
          try {
            const files = fs.readdirSync(fullPath)
              .filter(file => {
                const filePath = path.join(fullPath, file);
                return fs.statSync(filePath).isFile();
              });

            files.forEach(file => {
              const mediaKey = `${artworkId}/${file}`;
              if (!mediaFiles.has(mediaKey)) {
                issues.filesNotInMediaTable.push({
                  folder: folderName,
                  artworkId: artworkId,
                  filename: file,
                  fileType: getFileType(file)
                });
              }
            });
          } catch (error) {
            console.error(`Error reading folder ${folderName}:`, error.message);
          }
        });

        // Step 5: Check artworks without folders
        artworks.forEach(artwork => {
          const formattedId = formatArtworkId(artwork.id);
          const folderPath = path.join(MEDIA_DIR, formattedId);
          
          if (!fs.existsSync(folderPath)) {
            issues.artworksWithoutFolders.push({
              artworkId: artwork.id,
              title: artwork.title
            });
          }
        });

        // Step 6: Check media records without files
        mediaRecords.forEach(record => {
          const formattedId = formatArtworkId(record.artwork_id);
          const filePath = path.join(MEDIA_DIR, formattedId, record.filename);
          
          if (!fs.existsSync(filePath)) {
            issues.mediaRecordsWithoutFiles.push({
              artworkId: record.artwork_id,
              filename: record.filename,
              fileType: record.file_type
            });
          }
        });

        // Step 7: Check artworks without any media records
        artworks.forEach(artwork => {
          if (!mediaByArtwork.has(artwork.id)) {
            issues.artworksWithoutMedia.push({
              artworkId: artwork.id,
              title: artwork.title
            });
          }
        });

        // Report results
        console.log('='.repeat(80));
        console.log('MEDIA DATABASE CHECK RESULTS');
        console.log('='.repeat(80));

        if (issues.foldersWithoutArtwork.length > 0) {
          console.log(`\n⚠️  FOLDERS WITHOUT ARTWORK IN DATABASE (${issues.foldersWithoutArtwork.length}):`);
          issues.foldersWithoutArtwork.forEach(issue => {
            console.log(`   - Folder: ${issue.folder} (Artwork ID: ${issue.artworkId})`);
          });
        }

        if (issues.filesNotInMediaTable.length > 0) {
          console.log(`\n⚠️  FILES NOT IN MEDIA TABLE (${issues.filesNotInMediaTable.length}):`);
          issues.filesNotInMediaTable.forEach(issue => {
            console.log(`   - ${issue.folder}/${issue.filename} (Artwork ID: ${issue.artworkId}, Type: ${issue.fileType})`);
          });
        }

        if (issues.artworksWithoutFolders.length > 0) {
          console.log(`\n⚠️  ARTWORKS WITHOUT FOLDERS (${issues.artworksWithoutFolders.length}):`);
          issues.artworksWithoutFolders.forEach(issue => {
            console.log(`   - Artwork ID: ${issue.artworkId} - "${issue.title}"`);
          });
        }

        if (issues.mediaRecordsWithoutFiles.length > 0) {
          console.log(`\n⚠️  MEDIA RECORDS WITHOUT FILES (${issues.mediaRecordsWithoutFiles.length}):`);
          issues.mediaRecordsWithoutFiles.forEach(issue => {
            console.log(`   - Artwork ID: ${issue.artworkId}, File: ${issue.filename} (Type: ${issue.fileType})`);
          });
        }

        if (issues.artworksWithoutMedia.length > 0) {
          console.log(`\n⚠️  ARTWORKS WITHOUT MEDIA RECORDS (${issues.artworksWithoutMedia.length}):`);
          issues.artworksWithoutMedia.forEach(issue => {
            console.log(`   - Artwork ID: ${issue.artworkId} - "${issue.title}"`);
          });
        }

        // Summary
        const totalIssues = 
          issues.foldersWithoutArtwork.length +
          issues.filesNotInMediaTable.length +
          issues.artworksWithoutFolders.length +
          issues.mediaRecordsWithoutFiles.length +
          issues.artworksWithoutMedia.length;

        console.log('\n' + '='.repeat(80));
        if (totalIssues === 0) {
          console.log('✅ ALL CHECKS PASSED - No discrepancies found!');
        } else {
          console.log(`❌ FOUND ${totalIssues} TOTAL ISSUES`);
        }
        console.log('='.repeat(80) + '\n');

        // Special check for artwork 741
        if (artworkIds.has(741)) {
          console.log('📋 Artwork 741 Status:');
          const artwork741 = artworkMap.get(741);
          console.log(`   - In database: YES - "${artwork741.title}"`);
          
          const folder741 = folders.find(f => f.artworkId === 741);
          if (folder741) {
            console.log(`   - Folder exists: YES (${folder741.folderName})`);
            try {
              const files741 = fs.readdirSync(folder741.fullPath)
                .filter(file => {
                  const filePath = path.join(folder741.fullPath, file);
                  return fs.statSync(filePath).isFile();
                });
              console.log(`   - Files in folder: ${files741.length} (${files741.join(', ')})`);
            } catch (error) {
              console.log(`   - Error reading folder: ${error.message}`);
            }
          } else {
            console.log(`   - Folder exists: NO`);
          }
          
          const media741 = mediaByArtwork.get(741) || [];
          console.log(`   - Media records: ${media741.length}`);
          if (media741.length > 0) {
            media741.forEach(m => {
              console.log(`     - ${m.filename} (${m.file_type})`);
            });
          }
          console.log('');
        } else {
          console.log('📋 Artwork 741 Status:');
          console.log('   - In database: NO ❌');
          const folder741 = folders.find(f => f.artworkId === 741);
          if (folder741) {
            console.log(`   - Folder exists: YES (${folder741.folderName})`);
            console.log('   ⚠️  This is the issue - folder exists but artwork not in database!');
          }
          console.log('');
        }

        resolve(issues);
      });
    });
  });
}

// Run the check
checkMediaDatabase()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    db.close();
    process.exit(1);
  });





