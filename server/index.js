const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const archiver = require('archiver');
const os = require('os');
const bcrypt = require('bcrypt');
const { db, MEDIA_DIR, DB_PATH, formatArtworkId, displayArtworkId } = require('./database');
const { authenticateToken, optionalAuthenticateToken, login, verifyToken, changePassword, getAllUsers, createUser, updateUserPassword, deleteUser } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Track server start time for uptime calculation
const serverStartTime = Date.now();
const serverLogs = [];
const MAX_LOGS = 100;

// Helper function to add log entry
function addLog(level, message) {
  const logEntry = {
    time: new Date().toISOString(),
    level,
    message
  };
  serverLogs.push(logEntry);
  if (serverLogs.length > MAX_LOGS) {
    serverLogs.shift();
  }
  console.log(`[${logEntry.time}] [${level.toUpperCase()}] ${message}`);
}

// Log server startup
addLog('info', `Server starting on port ${PORT}`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve media files
app.use('/media', express.static(MEDIA_DIR));

// Helper function to get artwork subfolder path
function getArtworkMediaDir(artworkId) {
  const formattedId = formatArtworkId(artworkId);
  return path.join(MEDIA_DIR, formattedId);
}

// Helper function to get next available media suffix (synchronous)
function getNextMediaSuffixSync(artworkId) {
  const formattedId = formatArtworkId(artworkId);
  const artworkDir = getArtworkMediaDir(artworkId);
  
  // Ensure directory exists
  if (!fs.existsSync(artworkDir)) {
    return 'a';
  }
  
  const files = fs.readdirSync(artworkDir);
  const pattern = new RegExp(`^${formattedId}([a-z])\\.`);
  const existingSuffixes = files
    .filter(f => pattern.test(f))
    .map(f => f.match(pattern)[1])
    .sort();
  
  if (existingSuffixes.length === 0) {
    return 'a';
  } else {
    const lastSuffix = existingSuffixes[existingSuffixes.length - 1];
    const nextChar = String.fromCharCode(lastSuffix.charCodeAt(0) + 1);
    if (nextChar > 'z') {
      throw new Error('Maximum number of additional media files reached');
    }
    return nextChar;
  }
}

// Helper function to generate artwork info text
function generateArtworkInfoText(artwork) {
  const lines = [
    '='.repeat(60),
    `ARTWORK INFORMATION - ID: ${artwork.id} (${displayArtworkId(artwork.id)})`,
    '='.repeat(60),
    '',
    `Title: ${artwork.title || '(not set)'}`,
    `Year: ${artwork.year || '(not set)'}`,
    `Dimensions: ${artwork.dimensions || '(not set)'}`,
    `Medium: ${artwork.medium || '(not set)'}`,
    `Value: ${artwork.value || '(not set)'}`,
    `Availability: ${artwork.availability || '(not set)'}`,
    `For Sale Price: ${artwork.for_sale_price || '(not set)'}`,
    '',
    'Description:',
    artwork.description ? artwork.description : '(not set)',
    '',
    'Owner Information:',
    `  Name: ${artwork.owner_name || '(not set)'}`,
    `  Address: ${artwork.owner_address || '(not set)'}`,
    `  Phone: ${artwork.owner_phone || '(not set)'}`,
    '',
    `Storage Location: ${artwork.storage_location || '(not set)'}`,
    `Past Exhibitions: ${artwork.past_exhibitions || '(not set)'}`,
    `More Info: ${artwork.more_info || '(not set)'}`,
    '',
    `Created: ${artwork.created_at || '(not set)'}`,
    `Last Updated: ${artwork.updated_at || '(not set)'}`,
    '',
    '='.repeat(60),
    ''
  ];
  
  return lines.join('\n');
}

// Helper function to get changed fields
function getChangedFields(oldData, newData) {
  const changes = [];
  const fields = [
    'year', 'title', 'dimensions', 'medium', 'value', 'availability',
    'for_sale_price', 'description', 'owner_name', 'owner_address',
    'owner_phone', 'more_info', 'storage_location', 'past_exhibitions'
  ];
  
  fields.forEach(field => {
    const oldVal = oldData[field] || '';
    const newVal = newData[field] || '';
    if (oldVal !== newVal) {
      changes.push({
        field,
        old: oldVal,
        new: newVal
      });
    }
  });
  
  return changes;
}

// Helper function to save artwork backup and history
function saveArtworkBackup(artworkId, artwork, oldData = null) {
  try {
    const artworkDir = getArtworkMediaDir(artworkId);
    fs.ensureDirSync(artworkDir);
    
    // Save current info
    const infoText = generateArtworkInfoText(artwork);
    const infoFile = path.join(artworkDir, 'artwork_info.txt');
    fs.writeFileSync(infoFile, infoText, 'utf8');
    
    // Append to history if there were changes
    if (oldData) {
      const changes = getChangedFields(oldData, artwork);
      if (changes.length > 0) {
        const historyFile = path.join(artworkDir, 'change_history.txt');
        const timestamp = new Date().toISOString();
        const historyEntry = [
          '',
          '-'.repeat(60),
          `CHANGE RECORDED: ${timestamp}`,
          '-'.repeat(60),
          '',
          'Changes:',
          ...changes.map(c => `  ${c.field}: "${c.old || '(empty)'}" → "${c.new || '(empty)'}"`),
          '',
          'Full artwork data at time of change:',
          infoText,
          ''
        ].join('\n');
        
        // Append to history file
        if (fs.existsSync(historyFile)) {
          fs.appendFileSync(historyFile, historyEntry, 'utf8');
        } else {
          fs.writeFileSync(historyFile, `ARTWORK CHANGE HISTORY - ID: ${artwork.id} (${displayArtworkId(artwork.id)})\n${'='.repeat(60)}\n${historyEntry}`, 'utf8');
        }
      }
    }
  } catch (error) {
    console.error(`Error saving backup for artwork ${artworkId}:`, error);
    // Don't throw - backup failure shouldn't break the update
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const artworkId = req.body.artwork_id || req.params.id;
    
    if (artworkId) {
      // Create subfolder for artwork: media/000001/
      const artworkDir = getArtworkMediaDir(artworkId);
      fs.ensureDirSync(artworkDir);
      cb(null, artworkDir);
    } else {
      // Temporary files go in root media directory
      cb(null, MEDIA_DIR);
    }
  },
  filename: (req, file, cb) => {
    const artworkId = req.body.artwork_id || req.params.id;
    const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === true;
    
    if (artworkId) {
      const formattedId = formatArtworkId(artworkId);
      const ext = path.extname(file.originalname);
      let filename;
      
      if (isPrimary) {
        // Primary media: 000001.jpg
        filename = `${formattedId}${ext}`;
      } else {
        // Additional media: 000001a.jpg, 000001b.jpg, etc.
        try {
          const suffix = getNextMediaSuffixSync(artworkId);
          filename = `${formattedId}${suffix}${ext}`;
        } catch (error) {
          return cb(error);
        }
      }
      cb(null, filename);
    } else {
      // Temporary filename for new artwork
      cb(null, `temp_${Date.now()}_${file.originalname}`);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Separate multer config for artist photo uploads
const artistPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const artistDir = path.join(MEDIA_DIR, 'artist');
    fs.ensureDirSync(artistDir);
    cb(null, artistDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `artist_photo_${Date.now()}${ext}`);
  }
});

const artistPhotoUpload = multer({ 
  storage: artistPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for photos
});

// Separate multer config for artist gallery images
const artistGalleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const artistGalleryDir = path.join(MEDIA_DIR, 'artist', 'gallery');
    fs.ensureDirSync(artistGalleryDir);
    cb(null, artistGalleryDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `gallery_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const artistGalleryUpload = multer({ 
  storage: artistGalleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for photos
});

// Separate multer config for misc videos
const miscVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to root media directory
    cb(null, MEDIA_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `misc_video_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const miscVideoUpload = multer({ 
  storage: miscVideoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for videos
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.flv', '.wmv'];
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Separate multer config for exhibition photo uploads
const exhibitionPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const exhibitionId = req.params.id;
    const exDir = path.join(MEDIA_DIR, 'exhibitions', String(exhibitionId));
    fs.ensureDirSync(exDir);
    cb(null, exDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ex_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`);
  }
});

const exhibitionPhotoUpload = multer({
  storage: exhibitionPhotoStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB per photo
});


// === Artist API ===

// GET artist information
app.get('/api/artist', (req, res) => {
  db.get('SELECT * FROM artist WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Error fetching artist info:', err);
      return res.status(500).json({ error: 'Failed to fetch artist information' });
    }
    
    // If no artist record exists, return empty object
    res.json(row || {});
  });
});

// PUT update artist information
app.put('/api/artist', (req, res) => {
  const {
    name,
    bio,
    statement,
    contact_bio,
    contact_statement,
    inquiry_email,
    photo_filename
  } = req.body;

  // Check if artist record exists
  db.get('SELECT id FROM artist WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Error checking artist:', err);
      return res.status(500).json({ error: 'Failed to check artist record' });
    }

    if (row) {
      // Update existing record
      db.run(
        `UPDATE artist SET
          name = ?, bio = ?, statement = ?, contact_bio = ?,
          contact_statement = ?, inquiry_email = ?, photo_filename = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
        [name || null, bio || null, statement || null, contact_bio || null,
         contact_statement || null, inquiry_email || null, photo_filename || null],
        function(updateErr) {
          if (updateErr) {
            console.error('Error updating artist:', updateErr);
            return res.status(500).json({ error: 'Failed to update artist information' });
          }
          res.json({ message: 'Artist information updated successfully' });
        }
      );
    } else {
      // Create new record
      db.run(
        `INSERT INTO artist (
          id, name, bio, statement, contact_bio,
          contact_statement, inquiry_email, photo_filename
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [name || null, bio || null, statement || null, contact_bio || null,
         contact_statement || null, inquiry_email || null, photo_filename || null],
        function(insertErr) {
          if (insertErr) {
            console.error('Error creating artist:', insertErr);
            return res.status(500).json({ error: 'Failed to create artist information' });
          }
          res.json({ message: 'Artist information created successfully' });
        }
      );
    }
  });
});

// POST upload artist photo
app.post('/api/artist/photo', artistPhotoUpload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Update artist record with photo filename
  db.run(
    'UPDATE artist SET photo_filename = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [req.file.filename],
    function(err) {
      if (err) {
        console.error('Error updating artist photo:', err);
        return res.status(500).json({ error: 'Failed to update artist photo' });
      }
      
      // If no artist record exists, create one
      if (this.changes === 0) {
        db.run(
          'INSERT INTO artist (id, photo_filename) VALUES (1, ?)',
          [req.file.filename],
          function(insertErr) {
            if (insertErr) {
              console.error('Error creating artist record:', insertErr);
              return res.status(500).json({ error: 'Failed to create artist record' });
            }
            res.json({
              filename: req.file.filename,
              message: 'Artist photo uploaded successfully'
            });
          }
        );
      } else {
        res.json({
          filename: req.file.filename,
          message: 'Artist photo updated successfully'
        });
      }
    }
  );
});

// === Artist Gallery Images API ===

// GET all artist gallery images
app.get('/api/artist/gallery', (req, res) => {
  db.all(
    'SELECT * FROM artist_gallery_images ORDER BY display_order ASC, created_at ASC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching artist gallery images:', err);
        return res.status(500).json({ error: 'Failed to fetch artist gallery images' });
      }
      res.json(rows || []);
    }
  );
});

// POST upload artist gallery image
app.post('/api/artist/gallery', artistGalleryUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Get the highest display_order
  db.get(
    'SELECT MAX(display_order) as max_order FROM artist_gallery_images',
    [],
    (err, row) => {
      if (err) {
        console.error('Error getting max display order:', err);
        return res.status(500).json({ error: 'Failed to get display order' });
      }

      const displayOrder = (row?.max_order || 0) + 1;

      // Insert into database
      db.run(
        'INSERT INTO artist_gallery_images (filename, display_order) VALUES (?, ?)',
        [req.file.filename, displayOrder],
        function(insertErr) {
          if (insertErr) {
            console.error('Error inserting gallery image:', insertErr);
            return res.status(500).json({ error: 'Failed to save gallery image' });
          }
          res.json({
            id: this.lastID,
            filename: req.file.filename,
            display_order: displayOrder,
            message: 'Gallery image uploaded successfully'
          });
        }
      );
    }
  );
});

// DELETE artist gallery image
app.delete('/api/artist/gallery/:id', (req, res) => {
  const imageId = req.params.id;

  // Get filename before deleting
  db.get(
    'SELECT filename FROM artist_gallery_images WHERE id = ?',
    [imageId],
    (err, row) => {
      if (err) {
        console.error('Error fetching gallery image:', err);
        return res.status(500).json({ error: 'Failed to fetch gallery image' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Gallery image not found' });
      }

      // Delete from database
      db.run(
        'DELETE FROM artist_gallery_images WHERE id = ?',
        [imageId],
        function(deleteErr) {
          if (deleteErr) {
            console.error('Error deleting gallery image:', deleteErr);
            return res.status(500).json({ error: 'Failed to delete gallery image' });
          }

          // Delete file from filesystem
          const filePath = path.join(MEDIA_DIR, 'artist', 'gallery', row.filename);
          fs.remove(filePath, (removeErr) => {
            if (removeErr) {
              console.error('Error deleting gallery image file:', removeErr);
              // Don't fail the request if file deletion fails
            }
            res.json({ message: 'Gallery image deleted successfully' });
          });
        }
      );
    }
  );
});

// === Exhibitions API ===

// Get all exhibitions, ordered by year (descending) then title
app.get('/api/exhibitions', (req, res) => {
  db.all(
    `WITH ordered AS (
       SELECT id, year, title, location, notes, description,
              ROW_NUMBER() OVER (ORDER BY year DESC, title ASC) AS rn,
              COUNT(*) OVER () AS total
       FROM exhibitions
     )
     SELECT id, year, title, location, notes, description,
            (total - rn + 1) AS display_id
     FROM ordered
     ORDER BY rn`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching exhibitions:', err);
        return res.status(500).json({ error: 'Failed to fetch exhibitions' });
      }
      res.json(rows || []);
    }
  );
});

// Get single exhibition by reverse "display id" (show number)
app.get('/api/exhibitions/display/:displayId', (req, res) => {
  const displayId = parseInt(req.params.displayId, 10);
  if (!displayId || isNaN(displayId) || displayId < 1) {
    return res.status(400).json({ error: 'Invalid exhibition display id' });
  }

  db.get(
    `WITH ordered AS (
       SELECT id, year, title, location, notes, description,
              ROW_NUMBER() OVER (ORDER BY year DESC, title ASC) AS rn,
              COUNT(*) OVER () AS total
       FROM exhibitions
     )
     SELECT id, year, title, location, notes, description,
            (total - rn + 1) AS display_id
     FROM ordered
     WHERE (total - rn + 1) = ?`,
    [displayId],
    (err, row) => {
      if (err) {
        console.error('Error fetching exhibition by display id:', err);
        return res.status(500).json({ error: 'Failed to fetch exhibition' });
      }
      if (!row) return res.status(404).json({ error: 'Exhibition not found' });
      res.json(row);
    }
  );
});

// Get single exhibition by id
app.get('/api/exhibitions/:id', (req, res) => {
  const id = req.params.id;
  db.get(
    `SELECT id, year, title, location, notes, description
     FROM exhibitions
     WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Error fetching exhibition:', err);
        return res.status(500).json({ error: 'Failed to fetch exhibition' });
      }
      if (!row) return res.status(404).json({ error: 'Exhibition not found' });
      res.json(row);
    }
  );
});

// Get exhibition photos
app.get('/api/exhibitions/:id/photos', (req, res) => {
  const exhibitionId = req.params.id;
  db.all(
    `SELECT id, exhibition_id, filename, display_order, created_at
     FROM exhibition_photos
     WHERE exhibition_id = ?
     ORDER BY display_order ASC, id ASC`,
    [exhibitionId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching exhibition photos:', err);
        return res.status(500).json({ error: 'Failed to fetch exhibition photos' });
      }
      res.json(rows || []);
    }
  );
});

// Upload exhibition photos (authenticated)
app.post('/api/exhibitions/:id/photos', authenticateToken, exhibitionPhotoUpload.array('photos', 20), (req, res) => {
  const exhibitionId = req.params.id;
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No photos uploaded' });
  }

  db.get(
    `SELECT COALESCE(MAX(display_order), 0) AS maxOrder
     FROM exhibition_photos
     WHERE exhibition_id = ?`,
    [exhibitionId],
    (err, row) => {
      if (err) {
        console.error('Error reading exhibition photo order:', err);
        try { files.forEach(f => fs.removeSync(f.path)); } catch (_) {}
        return res.status(500).json({ error: 'Failed to save exhibition photos' });
      }

      const startOrder = (row?.maxOrder || 0) + 1;
      const inserts = files.map((f, idx) => ({
        filename: path.join('exhibitions', String(exhibitionId), f.filename).replace(/\\/g, '/'),
        display_order: startOrder + idx
      }));

      db.serialize(() => {
        const stmt = db.prepare(
          `INSERT INTO exhibition_photos (exhibition_id, filename, display_order)
           VALUES (?, ?, ?)`
        );
        for (const ins of inserts) {
          stmt.run([exhibitionId, ins.filename, ins.display_order]);
        }
        stmt.finalize((finalErr) => {
          if (finalErr) {
            console.error('Error inserting exhibition photos:', finalErr);
            try { files.forEach(f => fs.removeSync(f.path)); } catch (_) {}
            return res.status(500).json({ error: 'Failed to save exhibition photos' });
          }

          db.all(
            `SELECT id, exhibition_id, filename, display_order, created_at
             FROM exhibition_photos
             WHERE exhibition_id = ?
             ORDER BY display_order ASC, id ASC`,
            [exhibitionId],
            (listErr, rows) => {
              if (listErr) {
                console.error('Error listing exhibition photos:', listErr);
                return res.status(500).json({ error: 'Photos uploaded but listing failed' });
              }
              res.status(201).json(rows || []);
            }
          );
        });
      });
    }
  );
});

// Delete exhibition photo (authenticated)
app.delete('/api/exhibitions/:id/photos/:photoId', authenticateToken, (req, res) => {
  const exhibitionId = req.params.id;
  const photoId = req.params.photoId;

  db.get(
    `SELECT id, filename
     FROM exhibition_photos
     WHERE id = ? AND exhibition_id = ?`,
    [photoId, exhibitionId],
    (err, row) => {
      if (err) {
        console.error('Error fetching exhibition photo:', err);
        return res.status(500).json({ error: 'Failed to delete photo' });
      }
      if (!row) return res.status(404).json({ error: 'Photo not found' });

      db.run(
        `DELETE FROM exhibition_photos
         WHERE id = ? AND exhibition_id = ?`,
        [photoId, exhibitionId],
        function (delErr) {
          if (delErr) {
            console.error('Error deleting exhibition photo record:', delErr);
            return res.status(500).json({ error: 'Failed to delete photo' });
          }

          const filePath = path.join(MEDIA_DIR, row.filename);
          try {
            if (fs.existsSync(filePath)) fs.removeSync(filePath);
          } catch (removeErr) {
            console.error('Error deleting exhibition photo file:', removeErr);
          }

          res.json({ message: 'Photo deleted' });
        }
      );
    }
  );
});

// Create a new exhibition (for future UI management)
app.post('/api/exhibitions', (req, res) => {
  const { year, title, location, notes, description } = req.body;

  if (!year || !title) {
    return res.status(400).json({ error: 'Year and title are required' });
  }

  db.run(
    `INSERT INTO exhibitions (year, title, location, notes, description)
     VALUES (?, ?, ?, ?, ?)`,
    [year, title, location || '', notes || '', description || ''],
    function(err) {
      if (err) {
        console.error('Error creating exhibition:', err);
        return res.status(500).json({ error: 'Failed to create exhibition' });
      }

      const createdId = this.lastID;
      // Return created exhibition with computed display_id
      db.get(
        `WITH ordered AS (
           SELECT id, year, title, location, notes, description,
                  ROW_NUMBER() OVER (ORDER BY year DESC, title ASC) AS rn,
                  COUNT(*) OVER () AS total
           FROM exhibitions
         )
         SELECT id, year, title, location, notes, description,
                (total - rn + 1) AS display_id
         FROM ordered
         WHERE id = ?`,
        [createdId],
        (fetchErr, row) => {
          if (fetchErr || !row) {
            return res.status(201).json({
              id: createdId,
              year,
              title,
              location: location || '',
              notes: notes || '',
              description: description || ''
            });
          }
          res.status(201).json(row);
        }
      );
    }
  );
});

// Update exhibition description (authenticated)
app.put('/api/exhibitions/:id/description', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { description } = req.body || {};

  db.run(
    'UPDATE exhibitions SET description = ? WHERE id = ?',
    [description || '', id],
    function(err) {
      if (err) {
        console.error('Error updating exhibition description:', err);
        return res.status(500).json({ error: 'Failed to update exhibition description' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Exhibition not found' });
      }
      res.json({ message: 'Description updated', description: description || '' });
    }
  );
});

// GET all artworks with optional search and sorting
app.get('/api/artworks', optionalAuthenticateToken, (req, res) => {
  console.log('=== API REQUEST RECEIVED ===');
  console.log('Full query object:', JSON.stringify(req.query, null, 2));
  console.log('req.query.search:', req.query.search);
  console.log('req.query.sortBy:', req.query.sortBy);
  console.log('req.query.sortOrder:', req.query.sortOrder);
  
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'year';
  const sortOrder = req.query.sortOrder || 'desc';
  const includeHidden = !!req.user; // only authenticated users can see hidden artworks
  
  console.log('Parsed values - search:', search, 'sortBy:', sortBy, 'sortOrder:', sortOrder);
  
  // Validate sortBy to prevent SQL injection
  const allowedSortFields = {
    'id': 'a.id',
    'year': 'a.year',
    'title': 'a.title',
    'medium': 'a.medium',
    'owner_name': 'a.owner_name',
    'created_at': 'a.created_at',
    'updated_at': 'a.updated_at'
  };
  
  const sortField = allowedSortFields[sortBy] || 'a.id';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  
  // Build ORDER BY clause - use the column name directly (without table alias after GROUP BY)
  const orderByColumn = sortField.replace(/^a\./, '');
  let orderByClause;
  
  // Simple ORDER BY - SQLite handles this correctly after GROUP BY
  if (['title', 'medium', 'owner_name'].includes(sortBy)) {
    // Text fields: NULL values last
    orderByClause = `ORDER BY ${orderByColumn} IS NULL, ${orderByColumn} ${order}`;
  } else if (sortBy === 'year') {
    // Year field: try numeric sort first, then text
    orderByClause = `ORDER BY CAST(${orderByColumn} AS INTEGER) ${order}, ${orderByColumn} ${order}`;
  } else {
    // Numeric/date fields
    orderByClause = `ORDER BY ${orderByColumn} ${order}`;
  }
  
  console.log('Sort params:', { sortBy, sortOrder, sortField, orderByColumn, order, orderByClause });
  
  let query;
  let params = [];
  const hiddenClause = includeHidden ? '' : ' AND (a.is_hidden IS NULL OR a.is_hidden = 0) ';
  
  if (search) {
    const searchTerm = `%${search}%`;
    query = `SELECT a.*, 
        (SELECT GROUP_CONCAT(filename, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_files,
        (SELECT GROUP_CONCAT(file_type, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_types,
        (SELECT GROUP_CONCAT(is_primary, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_primary,
        (SELECT GROUP_CONCAT(COALESCE(display_name, ''), '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_display_names,
        (SELECT GROUP_CONCAT(COALESCE(is_public, 1), '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_public
       FROM artworks a
       WHERE a.title LIKE ? OR a.description LIKE ? OR a.medium LIKE ? 
         OR a.owner_name LIKE ? OR a.storage_location LIKE ? 
         OR a.past_exhibitions LIKE ? OR a.year LIKE ?
       ${hiddenClause}
       ${orderByClause}`;
    params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
  } else {
    // Build query with ORDER BY after GROUP BY
    query = `SELECT a.*, 
        (SELECT GROUP_CONCAT(filename, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_files,
        (SELECT GROUP_CONCAT(file_type, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_types,
        (SELECT GROUP_CONCAT(is_primary, '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_primary,
        (SELECT GROUP_CONCAT(COALESCE(display_name, ''), '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_display_names,
        (SELECT GROUP_CONCAT(COALESCE(is_public, 1), '|') FROM media WHERE artwork_id = a.id ORDER BY id) as media_public
       FROM artworks a
       WHERE 1=1
       ${hiddenClause}
       ${orderByClause}`;
    params = [];
  }
  
  // Log the final query for debugging
  console.log('=== FINAL QUERY ===');
  console.log(query.replace(/\s+/g, ' ').trim());
  console.log('==================');
  
  // Log the final query for debugging
  console.log('=== FINAL QUERY ===');
  console.log(query.replace(/\s+/g, ' ').trim());
  console.log('Query params:', params);
  console.log('==================');

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching artworks:', err);
      console.error('Query was:', query);
      console.error('Params were:', params);
      return res.status(500).json({ error: 'Failed to fetch artworks', details: err.message });
    }
    
    console.log(`Fetched ${rows.length} artworks`);
    
    // ALWAYS sort in JavaScript - SQLite ORDER BY after GROUP BY is unreliable
    let sortedRows = [...rows];
    const orderByColumn = sortField.replace(/^a\./, '');
    
    console.log(`Sorting by: ${orderByColumn}, order: ${order}`);
    
    sortedRows.sort((a, b) => {
      let aVal = a[orderByColumn];
      let bVal = b[orderByColumn];
      
      // Handle NULL/empty values - put them last
      if ((!aVal || aVal === '') && (!bVal || bVal === '')) return 0;
      if (!aVal || aVal === '') return 1;
      if (!bVal || bVal === '') return -1;
      
      // Special handling for year (text field that might contain numbers)
      if (sortBy === 'year') {
        const aNum = parseInt(String(aVal).replace(/[^0-9]/g, ''));
        const bNum = parseInt(String(bVal).replace(/[^0-9]/g, ''));
        if (!isNaN(aNum) && !isNaN(bNum) && aNum > 0 && bNum > 0) {
          const result = order === 'ASC' ? aNum - bNum : bNum - aNum;
          console.log(`Year sort: ${aNum} vs ${bNum} = ${result}`);
          return result;
        }
      }
      
      // Numeric comparison for id
      if (sortBy === 'id') {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return order === 'ASC' ? aNum - bNum : bNum - aNum;
        }
      }
      
      // Date comparison for created_at, updated_at
      if (['created_at', 'updated_at'].includes(sortBy)) {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return order === 'ASC' ? aDate - bDate : bDate - aDate;
        }
      }
      
      // String comparison for text fields
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return order === 'ASC' ? comparison : -comparison;
    });
    
    console.log(`=== SORT VERIFICATION ===`);
    console.log(`Sort by: ${sortBy} (${orderByColumn}), order: ${order}`);
    if (sortedRows.length > 0) {
      console.log(`First: ID=${sortedRows[0].id}, Title="${sortedRows[0].title || 'N/A'}", Year="${sortedRows[0].year || 'N/A'}"`);
      console.log(`Last: ID=${sortedRows[sortedRows.length - 1].id}, Title="${sortedRows[sortedRows.length - 1].title || 'N/A'}", Year="${sortedRows[sortedRows.length - 1].year || 'N/A'}"`);
    }
    console.log(`========================`);
    
    const artworks = sortedRows.map(row => {
      const formattedId = formatArtworkId(row.id);
      const mediaFiles = row.media_files ? row.media_files.split('|') : [];
      // Construct full path with subfolder for each media file
      const mediaFilesWithPath = mediaFiles.map(filename => 
        `${formattedId}/${filename}`
      );
      
      return {
        ...row,
        id_display: displayArtworkId(row.id),
        media_files: mediaFilesWithPath,
        media_types: row.media_types ? row.media_types.split('|') : [],
        media_primary: row.media_primary ? row.media_primary.split('|') : [],
        media_display_names: row.media_display_names ? row.media_display_names.split('|') : [],
        media_public: row.media_public ? row.media_public.split('|') : [],
        series: [] // Will be populated below
      };
    });
    
    // Fetch all series relationships for these artworks
    if (artworks.length > 0) {
      const artworkIds = artworks.map(a => a.id);
      const placeholders = artworkIds.map(() => '?').join(',');
      
      db.all(
        `SELECT as_rel.artwork_id, s.id, s.name, s.description
         FROM artwork_series as_rel
         INNER JOIN series s ON as_rel.series_id = s.id
         WHERE as_rel.artwork_id IN (${placeholders})
         ORDER BY s.name`,
        artworkIds,
        (seriesErr, seriesRows) => {
          if (!seriesErr && seriesRows) {
            // Group series by artwork_id
            const seriesByArtwork = {};
            seriesRows.forEach(row => {
              if (!seriesByArtwork[row.artwork_id]) {
                seriesByArtwork[row.artwork_id] = [];
              }
              seriesByArtwork[row.artwork_id].push({
                id: row.id,
                name: row.name,
                description: row.description
              });
            });
            
            // Add series to artworks
            artworks.forEach(artwork => {
              artwork.series = seriesByArtwork[artwork.id] || [];
            });
          }
          
          console.log(`Sending ${artworks.length} artworks to client`);
          if (artworks.length > 0) {
            console.log(`Response first: ID=${artworks[0].id}, Title="${artworks[0].title || 'N/A'}"`);
            console.log(`Response last: ID=${artworks[artworks.length - 1].id}, Title="${artworks[artworks.length - 1].title || 'N/A'}"`);
          }
          res.json(artworks);
        }
      );
    } else {
      res.json(artworks);
    }
  });
});

// GET single artwork by ID
app.get('/api/artworks/:id', optionalAuthenticateToken, (req, res) => {
  const id = req.params.id;
  const includeHidden = !!req.user;
  
  // First get the artwork
  db.get(
    `SELECT * FROM artworks WHERE id = ?`,
    [id],
    (err, artwork) => {
      if (err) {
        console.error('Error fetching artwork:', err);
        return res.status(500).json({ error: 'Failed to fetch artwork' });
      }
      
      if (!artwork) {
        return res.status(404).json({ error: 'Artwork not found' });
      }

      if (!includeHidden && (artwork.is_hidden === 1 || artwork.is_hidden === true)) {
        // Don't reveal hidden artworks to unauthenticated users
        return res.status(404).json({ error: 'Artwork not found' });
      }
      
      // Then get media files in order
      db.all(
        `SELECT filename, file_type, is_primary, display_name, is_public 
         FROM media 
         WHERE artwork_id = ? 
         ORDER BY id`,
        [id],
        (mediaErr, mediaRows) => {
          if (mediaErr) {
            console.error('Error fetching media:', mediaErr);
            return res.status(500).json({ error: 'Failed to fetch media' });
          }
          
          const formattedId = formatArtworkId(artwork.id);
          const mediaFiles = mediaRows.map(m => `${formattedId}/${m.filename}`);
          const mediaTypes = mediaRows.map(m => m.file_type);
          const mediaPrimary = mediaRows.map(m => m.is_primary);
          const mediaDisplayNames = mediaRows.map(m => m.display_name);
          const mediaPublic = mediaRows.map(m => m.is_public);
          
          // Get series for this artwork
          db.all(
            `SELECT s.id, s.name, s.description 
             FROM series s
             INNER JOIN artwork_series as_rel ON s.id = as_rel.series_id
             WHERE as_rel.artwork_id = ?
             ORDER BY s.name`,
            [id],
            (seriesErr, seriesRows) => {
              if (seriesErr) {
                console.error('Error fetching artwork series:', seriesErr);
                // Continue without series data if there's an error
              }
              
              const response = {
                ...artwork,
                id_display: displayArtworkId(artwork.id),
                media_files: mediaFiles,
                media_types: mediaTypes,
                media_primary: mediaPrimary,
                media_display_names: mediaDisplayNames,
                media_public: mediaPublic,
                series: seriesRows || []
              };
              
              res.json(response);
            }
          );
        }
      );
    }
  );
});

// GET check if ID is available
app.get('/api/artworks/check-id/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id) || id < 1 || id > 999999) {
    return res.json({ available: false, error: 'ID must be between 1 and 999999' });
  }
  
  db.get('SELECT id FROM artworks WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error checking ID:', err);
      return res.status(500).json({ error: 'Failed to check ID availability' });
    }
    
    res.json({ available: !row });
  });
});

// POST create new artwork
app.post('/api/artworks', (req, res) => {
  const {
    id, year, title, dimensions, medium, value, availability,
    for_sale_price, description, owner_name, owner_address,
    owner_phone, more_info, storage_location, past_exhibitions,
    is_hidden, hide_images_public
  } = req.body;

  console.log('========================================');
  console.log('POST /api/artworks - FULL REQUEST DATA:');
  console.log('========================================');
  console.log('req.body:', JSON.stringify(req.body, null, 2));
  console.log('id value:', id);
  console.log('id type:', typeof id);
  console.log('id === undefined:', id === undefined);
  console.log('id === null:', id === null);
  console.log('id === 0:', id === 0);
  console.log('id === "0":', id === "0");
  console.log('id === "":', id === "");
  console.log('========================================');

  // If manual ID is provided, validate it
  // Check for id as number, string, or in various formats
  let artworkId = null;
  
  // CRITICAL: Check if id exists in ANY form - be extremely permissive
  // The issue is that id might be 0, which is falsy but still a valid "provided" value
  const hasId = 'id' in req.body; // Check if key exists, regardless of value
  
  console.log('Has "id" key in req.body:', hasId);
  
  if (hasId) {
    // ID key exists - now parse it
    let idValue = req.body.id;
    let idStr = '';
    
    if (typeof idValue === 'number') {
      idStr = String(idValue);
    } else if (typeof idValue === 'string') {
      idStr = idValue.trim();
    } else if (idValue !== null && idValue !== undefined) {
      idStr = String(idValue).trim();
    }
    
    console.log('ID processing - original:', idValue, 'type:', typeof idValue, 'string:', idStr);
    
    // Parse the ID - accept any numeric string
    if (idStr && idStr !== '' && idStr !== 'null' && idStr !== 'undefined' && idStr !== 'NaN') {
      artworkId = parseInt(idStr, 10);
      console.log('Parsed ID:', idValue, '->', artworkId, '(isNaN:', isNaN(artworkId), ')');
      
      // Validate the parsed ID
      if (!isNaN(artworkId) && artworkId >= 1 && artworkId <= 999999) {
        console.log('✓✓✓ VALID ID DETECTED:', artworkId, '✓✓✓');
      } else {
        console.error('✗✗✗ INVALID ID after parsing:', idValue, '->', artworkId, '(must be 1-999999) ✗✗✗');
        artworkId = null;
      }
    } else {
      console.warn('ID key exists but value is empty/invalid:', idValue, '->', idStr);
    }
  } else {
    console.log('✗✗✗ NO "id" KEY IN REQ.BODY - WILL AUTO-GENERATE ✗✗✗');
  }
  
  console.log('========================================');
  console.log('=== FINAL ID DECISION ===');
  console.log('artworkId:', artworkId);
  console.log('Will use manual ID:', !!artworkId);
  console.log('========================================');
  
  if (artworkId) {
    console.log(`Using provided ID: ${artworkId}`);
    
    // Check if ID already exists
    db.get('SELECT id FROM artworks WHERE id = ?', [artworkId], (err, row) => {
      if (err) {
        console.error('Error checking ID:', err);
        return res.status(500).json({ error: 'Failed to check ID availability' });
      }
      
      if (row) {
        console.log(`ID ${artworkId} already exists - rejecting (should use PUT for updates)`);
        return res.status(400).json({ error: `Artwork with ID ${artworkId} already exists` });
      }
      
      // Insert with manual ID
      console.log(`Creating artwork with manual ID ${artworkId}`);
      db.run(
        `INSERT INTO artworks (
          id, year, title, dimensions, medium, value, availability,
          for_sale_price, description, owner_name, owner_address,
          owner_phone, more_info, storage_location, past_exhibitions,
          is_hidden, hide_images_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          artworkId, year || null, title || '', dimensions || '', medium || '', value || '',
          availability || '', for_sale_price || '', description || '',
          owner_name || '', owner_address || '', owner_phone || '',
          more_info || '', storage_location || '', past_exhibitions || '',
          (is_hidden === true || is_hidden === 1 || is_hidden === '1' || is_hidden === 'true') ? 1 : 0,
          (hide_images_public === true || hide_images_public === 1 || hide_images_public === '1' || hide_images_public === 'true') ? 1 : 0
        ],
        function(err) {
          if (err) {
            console.error('Error creating artwork:', err);
            console.error('SQLite error details:', err.message, err.code);
            return res.status(500).json({ error: 'Failed to create artwork', details: err.message });
          }
          
          console.log(`✓ Successfully created artwork with ID ${artworkId} (manual ID)`);
          
          // Get created artwork and save backup
          db.get(
            'SELECT * FROM artworks WHERE id = ?',
            [artworkId],
            (fetchErr, artwork) => {
              if (!fetchErr && artwork) {
                saveArtworkBackup(artworkId, artwork, null);
              }
              
              res.json({ 
                id: artworkId,
                id_display: displayArtworkId(artworkId),
                message: 'Artwork created successfully'
              });
            }
          );
        }
      );
    });
    return; // Important: return here to prevent falling through to auto-generate
  } else {
    // Auto-generate ID by finding the next available ID
    db.get('SELECT MAX(id) as max_id FROM artworks', [], (err, row) => {
      if (err) {
        console.error('Error finding next ID:', err);
        return res.status(500).json({ error: 'Failed to generate ID' });
      }
      
      const nextId = (row && row.max_id ? row.max_id + 1 : 1);
      
      db.run(
        `INSERT INTO artworks (
          id, year, title, dimensions, medium, value, availability,
          for_sale_price, description, owner_name, owner_address,
          owner_phone, more_info, storage_location, past_exhibitions,
          is_hidden, hide_images_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nextId, year || null, title || '', dimensions || '', medium || '', value || '',
          availability || '', for_sale_price || '', description || '',
          owner_name || '', owner_address || '', owner_phone || '',
          more_info || '', storage_location || '', past_exhibitions || '',
          (is_hidden === true || is_hidden === 1 || is_hidden === '1' || is_hidden === 'true') ? 1 : 0,
          (hide_images_public === true || hide_images_public === 1 || hide_images_public === '1' || hide_images_public === 'true') ? 1 : 0
        ],
        function(err) {
          if (err) {
            console.error('Error creating artwork:', err);
            return res.status(500).json({ error: 'Failed to create artwork' });
          }
          
          // Get created artwork and save backup
          db.get(
            'SELECT * FROM artworks WHERE id = ?',
            [nextId],
            (fetchErr, artwork) => {
              if (!fetchErr && artwork) {
                saveArtworkBackup(nextId, artwork, null);
              }
              
              res.json({ 
                id: nextId,
                id_display: displayArtworkId(nextId),
                message: 'Artwork created successfully'
              });
            }
          );
        }
      );
    });
  }
});

// PUT update artwork
app.put('/api/artworks/:id', (req, res) => {
  const id = req.params.id;
  // IMPORTANT:
  // This endpoint supports partial updates. If a field is omitted from the request body,
  // we preserve the existing value from the DB. This prevents bulk-edit "patch" updates
  // from unintentionally wiping other fields.
  const body = req.body || {};

  // Get old data for history
  db.get(
    'SELECT * FROM artworks WHERE id = ?',
    [id],
    (err, oldData) => {
      if (err) {
        console.error('Error fetching old artwork data:', err);
        return res.status(500).json({ error: 'Failed to fetch artwork data' });
      }
      
      if (!oldData) {
        return res.status(404).json({ error: 'Artwork not found' });
      }

      const fields = [
        'year', 'title', 'dimensions', 'medium', 'value', 'availability',
        'for_sale_price', 'description', 'owner_name', 'owner_address',
        'owner_phone', 'more_info', 'storage_location', 'past_exhibitions',
        'is_hidden', 'hide_images_public'
      ];

      // Merge old + new (only apply fields explicitly present in request body)
      const merged = {};
      fields.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(body, f)) {
          merged[f] = body[f];
        } else {
          merged[f] = oldData[f];
        }
      });

      // Update artwork
      db.run(
        `UPDATE artworks SET
          year = ?, title = ?, dimensions = ?, medium = ?, value = ?,
          availability = ?, for_sale_price = ?, description = ?,
          owner_name = ?, owner_address = ?, owner_phone = ?,
          more_info = ?, storage_location = ?, past_exhibitions = ?,
          is_hidden = ?, hide_images_public = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          (merged.year === undefined || merged.year === null || String(merged.year).trim() === '') ? null : String(merged.year),
          merged.title || '',
          merged.dimensions || '',
          merged.medium || '',
          merged.value || '',
          merged.availability || '',
          merged.for_sale_price || '',
          merged.description || '',
          merged.owner_name || '',
          merged.owner_address || '',
          merged.owner_phone || '',
          merged.more_info || '',
          merged.storage_location || '',
          merged.past_exhibitions || '',
          (merged.is_hidden === true || merged.is_hidden === 1 || merged.is_hidden === '1' || merged.is_hidden === 'true') ? 1 : 0,
          (merged.hide_images_public === true || merged.hide_images_public === 1 || merged.hide_images_public === '1' || merged.hide_images_public === 'true') ? 1 : 0,
          id
        ],
        function(updateErr) {
          if (updateErr) {
            console.error('Error updating artwork:', updateErr);
            return res.status(500).json({ error: 'Failed to update artwork' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Artwork not found' });
          }
          
          // Get updated data and save backup
          db.get(
            'SELECT * FROM artworks WHERE id = ?',
            [id],
            (fetchErr, newData) => {
              if (!fetchErr && newData) {
                saveArtworkBackup(id, newData, oldData);
              }
              
              res.json({ 
                id: parseInt(id),
                id_display: displayArtworkId(id),
                message: 'Artwork updated successfully'
              });
            }
          );
        }
      );
    }
  );
});

// PUT change artwork ID
app.put('/api/artworks/:id/change-id', (req, res) => {
  const oldId = parseInt(req.params.id);
  const newId = parseInt(req.body.newId);

  if (!newId || isNaN(newId) || newId < 1 || newId > 999999) {
    return res.status(400).json({ error: 'Invalid new ID. Must be between 1 and 999999' });
  }

  if (oldId === newId) {
    return res.status(400).json({ error: 'New ID must be different from current ID' });
  }

  // Check if new ID is available
  db.get('SELECT id FROM artworks WHERE id = ?', [newId], (err, row) => {
    if (err) {
      console.error('Error checking new ID availability:', err);
      return res.status(500).json({ error: 'Failed to check ID availability' });
    }

    if (row) {
      return res.status(400).json({ error: `ID ${newId} is already in use` });
    }

    // Check if old artwork exists
    db.get('SELECT * FROM artworks WHERE id = ?', [oldId], (err, oldArtwork) => {
      if (err) {
        console.error('Error fetching old artwork:', err);
        return res.status(500).json({ error: 'Failed to fetch artwork' });
      }

      if (!oldArtwork) {
        return res.status(404).json({ error: 'Artwork not found' });
      }

      // Get all media files for this artwork
      db.all('SELECT * FROM media WHERE artwork_id = ?', [oldId], (err, mediaFiles) => {
        if (err) {
          console.error('Error fetching media files:', err);
          return res.status(500).json({ error: 'Failed to fetch media files' });
        }

        // Use a transaction to ensure atomicity
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          // Create new artwork with new ID
          db.run(
            `INSERT INTO artworks (
              id, year, title, dimensions, medium, value, availability,
              for_sale_price, description, owner_name, owner_address,
              owner_phone, more_info, storage_location, past_exhibitions,
              is_hidden, hide_images_public, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              newId,
              oldArtwork.year || null,
              oldArtwork.title || '',
              oldArtwork.dimensions || '',
              oldArtwork.medium || '',
              oldArtwork.value || '',
              oldArtwork.availability || '',
              oldArtwork.for_sale_price || '',
              oldArtwork.description || '',
              oldArtwork.owner_name || '',
              oldArtwork.owner_address || '',
              oldArtwork.owner_phone || '',
              oldArtwork.more_info || '',
              oldArtwork.storage_location || '',
              oldArtwork.past_exhibitions || '',
              oldArtwork.is_hidden ? 1 : 0,
              oldArtwork.hide_images_public ? 1 : 0,
              oldArtwork.created_at || null
            ],
            function(insertErr) {
              if (insertErr) {
                console.error('Error creating new artwork:', insertErr);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to create artwork with new ID' });
              }

              // Update media records to reference new ID
              let mediaUpdated = 0;
              let mediaErrors = 0;

              if (mediaFiles.length === 0) {
                // No media files, just delete old artwork
                db.run('DELETE FROM artworks WHERE id = ?', [oldId], (deleteErr) => {
                  if (deleteErr) {
                    console.error('Error deleting old artwork:', deleteErr);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to delete old artwork' });
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      console.error('Error committing transaction:', commitErr);
                      return res.status(500).json({ error: 'Failed to commit changes' });
                    }

                    // Move media directory if it exists
                    const oldDir = getArtworkMediaDir(oldId);
                    const newDir = getArtworkMediaDir(newId);
                    if (fs.existsSync(oldDir)) {
                      fs.moveSync(oldDir, newDir, { overwrite: false });
                    }

                    // Get new artwork and save backup with ID change history
                    db.get('SELECT * FROM artworks WHERE id = ?', [newId], (fetchErr, newArtwork) => {
                      if (!fetchErr && newArtwork) {
                        // Create a special history entry for ID change
                        const historyEntry = {
                          ...oldArtwork,
                          id: oldId // Keep old ID in history
                        };
                        saveArtworkBackup(newId, newArtwork, historyEntry);
                        
                        // Also add ID change note to history
                        try {
                          const historyFile = path.join(newDir, 'change_history.txt');
                          const timestamp = new Date().toISOString();
                          const idChangeNote = `\n\n${'='.repeat(60)}\nID CHANGE: ${timestamp}\n${'='.repeat(60)}\nArtwork ID changed from ${oldId} (${displayArtworkId(oldId)}) to ${newId} (${displayArtworkId(newId)})\n${'='.repeat(60)}\n`;
                          if (fs.existsSync(historyFile)) {
                            fs.appendFileSync(historyFile, idChangeNote, 'utf8');
                          }
                        } catch (err) {
                          console.error('Error adding ID change note:', err);
                        }
                      }
                      
                      res.json({
                        id: newId,
                        id_display: displayArtworkId(newId),
                        message: 'Artwork ID changed successfully'
                      });
                    });
                  });
                });
                return;
              }

              // Update each media record
              mediaFiles.forEach((media, index) => {
                db.run(
                  'UPDATE media SET artwork_id = ? WHERE id = ?',
                  [newId, media.id],
                  function(updateErr) {
                    if (updateErr) {
                      console.error('Error updating media record:', updateErr);
                      mediaErrors++;
                    } else {
                      mediaUpdated++;
                    }

                    // When all media records are processed
                    if (mediaUpdated + mediaErrors === mediaFiles.length) {
                      if (mediaErrors > 0) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to update some media records' });
                      }

                      // Delete old artwork
                      db.run('DELETE FROM artworks WHERE id = ?', [oldId], (deleteErr) => {
                        if (deleteErr) {
                          console.error('Error deleting old artwork:', deleteErr);
                          db.run('ROLLBACK');
                          return res.status(500).json({ error: 'Failed to delete old artwork' });
                        }

                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            console.error('Error committing transaction:', commitErr);
                            return res.status(500).json({ error: 'Failed to commit changes' });
                          }

                          // Move media directory
                          const oldDir = getArtworkMediaDir(oldId);
                          const newDir = getArtworkMediaDir(newId);
                          if (fs.existsSync(oldDir)) {
                            try {
                              fs.ensureDirSync(path.dirname(newDir));
                              fs.moveSync(oldDir, newDir, { overwrite: false });
                            } catch (moveErr) {
                              console.error('Error moving media directory:', moveErr);
                              // Don't fail the request - files are already updated in DB
                            }
                          }

                          // Get new artwork and save backup with ID change history
                          db.get('SELECT * FROM artworks WHERE id = ?', [newId], (fetchErr, newArtwork) => {
                            if (!fetchErr && newArtwork) {
                              // Create a special history entry for ID change
                              const historyEntry = {
                                ...oldArtwork,
                                id: oldId // Keep old ID in history
                              };
                              saveArtworkBackup(newId, newArtwork, historyEntry);
                              
                              // Also add ID change note to history
                              try {
                                const historyFile = path.join(newDir, 'change_history.txt');
                                const timestamp = new Date().toISOString();
                                const idChangeNote = `\n\n${'='.repeat(60)}\nID CHANGE: ${timestamp}\n${'='.repeat(60)}\nArtwork ID changed from ${oldId} (${displayArtworkId(oldId)}) to ${newId} (${displayArtworkId(newId)})\n${'='.repeat(60)}\n`;
                                if (fs.existsSync(historyFile)) {
                                  fs.appendFileSync(historyFile, idChangeNote, 'utf8');
                                }
                              } catch (err) {
                                console.error('Error adding ID change note:', err);
                              }
                            }
                            
                            res.json({
                              id: newId,
                              id_display: displayArtworkId(newId),
                              message: 'Artwork ID changed successfully',
                              mediaFilesUpdated: mediaUpdated
                            });
                          });
                        });
                      });
                    }
                  }
                );
              });
            }
          );
        });
      });
    });
  });
});

// DELETE artwork
app.delete('/api/artworks/:id', (req, res) => {
  const id = req.params.id;
  
  // First, get all media files for this artwork
  db.all('SELECT filename FROM media WHERE artwork_id = ?', [id], (err, mediaFiles) => {
    if (err) {
      console.error('Error fetching media files:', err);
      return res.status(500).json({ error: 'Failed to fetch media files' });
    }
    
    const formattedId = formatArtworkId(id);
    const artworkDir = getArtworkMediaDir(id);
    
    // Delete media files from filesystem
    mediaFiles.forEach(media => {
      const filePath = path.join(artworkDir, media.filename);
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
      }
    });
    
    // Delete artwork subfolder if it exists and is empty
    if (fs.existsSync(artworkDir)) {
      try {
        const remainingFiles = fs.readdirSync(artworkDir);
        if (remainingFiles.length === 0) {
          fs.removeSync(artworkDir);
        }
      } catch (error) {
        console.error('Error cleaning up artwork directory:', error);
      }
    }
    
    // Delete from database (cascade will handle media table)
    db.run('DELETE FROM artworks WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting artwork:', err);
        return res.status(500).json({ error: 'Failed to delete artwork' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Artwork not found' });
      }
      
      res.json({ message: 'Artwork deleted successfully' });
    });
  });
});

// POST upload media for artwork
app.post('/api/artworks/:id/media', upload.single('media'), (req, res) => {
  const artworkId = req.params.id;
  const isPrimary = req.body.is_primary === 'true' || req.body.is_primary === true;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // If this is primary, remove old primary media
  if (isPrimary) {
    db.run('UPDATE media SET is_primary = 0 WHERE artwork_id = ?', [artworkId]);
  }
  
  // Determine file type
  const ext = path.extname(req.file.filename).toLowerCase();
  let fileType = 'image';
  if (['.mp4', '.avi', '.mov'].includes(ext)) fileType = 'video';
  else if (['.mp3', '.wav', '.ogg', '.m4a', '.webm'].includes(ext)) fileType = 'audio';
  else if (['.txt', '.pdf', '.doc', '.docx'].includes(ext)) fileType = 'text';

  // Special case: recorded audio descriptions are uploaded from the client with an originalname
  // that starts with "audio_description_". The server renames files to the artwork ID pattern,
  // so we persist the meaning via file_type (and a default display_name).
  const originalName = (req.file.originalname || '').toLowerCase();
  const isAudioDescription = originalName.startsWith('audio_description_');
  const displayName = isAudioDescription ? 'Audio Description' : null;
  if (isAudioDescription) {
    fileType = 'audio_description';
  }
  
  // Insert media record
  db.run(
    'INSERT INTO media (artwork_id, filename, file_type, display_name, is_primary, is_public) VALUES (?, ?, ?, ?, ?, ?)',
    [artworkId, req.file.filename, fileType, displayName, isPrimary ? 1 : 0, 1],
    function(err) {
      if (err) {
        console.error('Error saving media record:', err);
        // Delete uploaded file if database insert fails
        fs.removeSync(req.file.path);
        return res.status(500).json({ error: 'Failed to save media record' });
      }
      
      res.json({
        id: this.lastID,
        filename: req.file.filename,
        file_type: fileType,
        display_name: displayName,
        is_primary: isPrimary,
        is_public: 1,
        message: 'Media uploaded successfully'
      });
    }
  );
});

// PUT set media as primary
app.put('/api/media/:artworkId/:filename/set-primary', (req, res) => {
  const filename = req.params.filename;
  const artworkId = req.params.artworkId;
  
  // First, unset all primary media for this artwork
  db.run('UPDATE media SET is_primary = 0 WHERE artwork_id = ?', [artworkId], (err) => {
    if (err) {
      console.error('Error unsetting primary media:', err);
      return res.status(500).json({ error: 'Failed to update primary media' });
    }
    
    // Then set the specified media as primary
    db.run('UPDATE media SET is_primary = 1 WHERE filename = ? AND artwork_id = ?', [filename, artworkId], function(updateErr) {
      if (updateErr) {
        console.error('Error setting primary media:', updateErr);
        return res.status(500).json({ error: 'Failed to set primary media' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Media file not found' });
      }
      
      res.json({ message: 'Primary media updated successfully' });
    });
  });
});

// PUT update media display name
app.put('/api/media/:artworkId/:filename/display-name', (req, res) => {
  // Decode the filename in case it was URL encoded
  const filename = decodeURIComponent(req.params.filename);
  const artworkId = req.params.artworkId;
  const { display_name } = req.body;
  
  console.log('Updating display name for:', filename, 'artwork:', artworkId, 'display_name:', display_name);
  
  db.run(
    'UPDATE media SET display_name = ? WHERE filename = ? AND artwork_id = ?',
    [display_name || null, filename, artworkId],
    function(err) {
      if (err) {
        console.error('Error updating media display name:', err);
        return res.status(500).json({ error: 'Failed to update display name' });
      }
      
      if (this.changes === 0) {
        console.log('No rows updated. Filename:', filename, 'Artwork ID:', artworkId);
        return res.status(404).json({ error: 'Media file not found' });
      }
      
      console.log('Display name updated successfully for:', filename);
      res.json({ message: 'Display name updated successfully' });
    }
  );
});

// PUT update media public visibility
app.put('/api/media/:artworkId/:filename/public', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const artworkId = req.params.artworkId;
  const { is_public } = req.body || {};
  const nextPublic = (is_public === true || is_public === 1 || is_public === '1' || is_public === 'true') ? 1 : 0;

  db.run(
    'UPDATE media SET is_public = ? WHERE filename = ? AND artwork_id = ?',
    [nextPublic, filename, artworkId],
    function(err) {
      if (err) {
        console.error('Error updating media visibility:', err);
        return res.status(500).json({ error: 'Failed to update media visibility' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Media file not found' });
      }

      res.json({ message: 'Media visibility updated successfully', is_public: nextPublic });
    }
  );
});

// DELETE media file
app.delete('/api/media/:artworkId/:filename', (req, res) => {
  const filename = req.params.filename;
  const artworkId = req.params.artworkId;
  const artworkDir = getArtworkMediaDir(artworkId);
  const filePath = path.join(artworkDir, filename);
  
  // Delete from database
  db.run('DELETE FROM media WHERE filename = ? AND artwork_id = ?', [filename, artworkId], function(err) {
    if (err) {
      console.error('Error deleting media record:', err);
      return res.status(500).json({ error: 'Failed to delete media record' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Media file not found' });
    }
    
    // Delete from filesystem
    if (fs.existsSync(filePath)) {
      fs.removeSync(filePath);
    }
    
    res.json({ message: 'Media deleted successfully' });
  });
});

// GET endpoint to purge all data from database (easier to call)
app.get('/api/purge-database', (req, res) => {
  console.log('Purging database...');
  db.serialize(() => {
    db.run('DELETE FROM media', (err) => {
      if (err) {
        console.error('Error deleting media:', err);
        return res.status(500).json({ error: 'Failed to delete media', details: err.message });
      }
      db.run('DELETE FROM artworks', (err) => {
        if (err) {
          console.error('Error deleting artworks:', err);
          return res.status(500).json({ error: 'Failed to delete artworks', details: err.message });
        }
        console.log('Database purged successfully - all artworks and media deleted');
        res.json({ message: 'Database purged successfully - all artworks and media deleted' });
      });
    });
  });
});

// GET backup media files as zip
app.get('/api/backup/media', (req, res) => {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `media_backup_${timestamp}.zip`;
  
  res.attachment(filename);
  res.setHeader('Content-Type', 'application/zip');
  
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });
  
  archive.pipe(res);
  
  // Add all files from media directory
  if (fs.existsSync(MEDIA_DIR)) {
    archive.directory(MEDIA_DIR, 'media', false);
  }
  
  archive.finalize();
});

// GET backup image files only as zip
app.get('/api/backup/images', (req, res) => {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `image_backup_${timestamp}.zip`;

  res.attachment(filename);
  res.setHeader('Content-Type', 'application/zip');

  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });

  archive.pipe(res);

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tif', '.tiff']);

  const addImageFiles = (dir, root) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        addImageFiles(fullPath, root);
        return;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!imageExts.has(ext)) return;
      const relativePath = path.relative(root, fullPath);
      archive.file(fullPath, { name: path.join('media', relativePath) });
    });
  };

  if (fs.existsSync(MEDIA_DIR)) {
    addImageFiles(MEDIA_DIR, MEDIA_DIR);
  }

  archive.finalize();
});

// Series endpoints
// GET all series
app.get('/api/series', (req, res) => {
  db.all('SELECT * FROM series ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Error fetching series:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
    res.json(rows || []);
  });
});

// GET single series with artworks
app.get('/api/series/:id', optionalAuthenticateToken, (req, res) => {
  const seriesId = req.params.id;
  const includeHidden = !!req.user;
  
  db.get('SELECT * FROM series WHERE id = ?', [seriesId], (err, series) => {
    if (err) {
      console.error('Error fetching series:', err);
      return res.status(500).json({ error: 'Failed to fetch series' });
    }
    
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }
    
    // Get artworks in this series
    db.all(
      `SELECT a.* FROM artworks a
       INNER JOIN artwork_series as_rel ON a.id = as_rel.artwork_id
       WHERE as_rel.series_id = ?
         ${includeHidden ? '' : 'AND (a.is_hidden IS NULL OR a.is_hidden = 0)'}
       ORDER BY a.id`,
      [seriesId],
      (artworkErr, artworks) => {
        if (artworkErr) {
          console.error('Error fetching series artworks:', artworkErr);
          return res.status(500).json({ error: 'Failed to fetch series artworks' });
        }
        
        if (!artworks || artworks.length === 0) {
          return res.json({
            ...series,
            artworks: []
          });
        }
        
        // Get media files for all artworks
        const artworkIds = artworks.map(a => a.id);
        const placeholders = artworkIds.map(() => '?').join(',');
        
        db.all(
          `SELECT artwork_id, filename, file_type, is_primary, display_name, is_public 
           FROM media 
           WHERE artwork_id IN (${placeholders})
           ORDER BY artwork_id, id`,
          artworkIds,
          (mediaErr, mediaRows) => {
            if (mediaErr) {
              console.error('Error fetching series artwork media:', mediaErr);
              // Continue without media if there's an error
              return res.json({
                ...series,
                artworks: artworks || []
              });
            }
            
            // Group media by artwork_id
            const mediaByArtwork = {};
            mediaRows.forEach(row => {
              if (!mediaByArtwork[row.artwork_id]) {
                mediaByArtwork[row.artwork_id] = [];
              }
              mediaByArtwork[row.artwork_id].push(row);
            });
            
            // Add media to artworks
            const artworksWithMedia = artworks.map(artwork => {
              const formattedId = formatArtworkId(artwork.id);
              const media = mediaByArtwork[artwork.id] || [];
              
              const mediaFiles = media.map(m => `${formattedId}/${m.filename}`);
              const mediaTypes = media.map(m => m.file_type);
              const mediaPrimary = media.map(m => m.is_primary);
              const mediaDisplayNames = media.map(m => m.display_name);
              const mediaPublic = media.map(m => m.is_public);
              
              return {
                ...artwork,
                media_files: mediaFiles,
                media_types: mediaTypes,
                media_primary: mediaPrimary,
                media_display_names: mediaDisplayNames,
                media_public: mediaPublic
              };
            });
            
            res.json({
              ...series,
              artworks: artworksWithMedia
            });
          }
        );
      }
    );
  });
});

// POST create new series
app.post('/api/series', (req, res) => {
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Series name is required' });
  }
  
  db.run(
    'INSERT INTO series (name, description) VALUES (?, ?)',
    [name.trim(), description || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'A series with this name already exists' });
        }
        console.error('Error creating series:', err);
        return res.status(500).json({ error: 'Failed to create series' });
      }
      
      res.json({
        id: this.lastID,
        name: name.trim(),
        description: description || null,
        message: 'Series created successfully'
      });
    }
  );
});

// PUT update series
app.put('/api/series/:id', (req, res) => {
  const seriesId = req.params.id;
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Series name is required' });
  }
  
  db.run(
    'UPDATE series SET name = ?, description = ? WHERE id = ?',
    [name.trim(), description || null, seriesId],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'A series with this name already exists' });
        }
        console.error('Error updating series:', err);
        return res.status(500).json({ error: 'Failed to update series' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Series not found' });
      }
      
      res.json({ message: 'Series updated successfully' });
    }
  );
});

// DELETE series
app.delete('/api/series/:id', (req, res) => {
  const seriesId = req.params.id;
  
  db.run('DELETE FROM series WHERE id = ?', [seriesId], function(err) {
    if (err) {
      console.error('Error deleting series:', err);
      return res.status(500).json({ error: 'Failed to delete series' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }
    
    res.json({ message: 'Series deleted successfully' });
  });
});

// PUT add artwork to series
app.put('/api/artworks/:artworkId/series/:seriesId', (req, res) => {
  const artworkId = req.params.artworkId;
  const seriesId = req.params.seriesId;
  
  db.run(
    'INSERT OR IGNORE INTO artwork_series (artwork_id, series_id) VALUES (?, ?)',
    [artworkId, seriesId],
    function(err) {
      if (err) {
        console.error('Error adding artwork to series:', err);
        return res.status(500).json({ error: 'Failed to add artwork to series' });
      }
      
      res.json({ message: 'Artwork added to series successfully' });
    }
  );
});

// DELETE remove artwork from series
app.delete('/api/artworks/:artworkId/series/:seriesId', (req, res) => {
  const artworkId = req.params.artworkId;
  const seriesId = req.params.seriesId;
  
  db.run(
    'DELETE FROM artwork_series WHERE artwork_id = ? AND series_id = ?',
    [artworkId, seriesId],
    function(err) {
      if (err) {
        console.error('Error removing artwork from series:', err);
        return res.status(500).json({ error: 'Failed to remove artwork from series' });
      }
      
      res.json({ message: 'Artwork removed from series successfully' });
    }
  );
});

// Admin endpoints
// GET server status
app.get('/api/admin/status', (req, res) => {
  try {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;

    // Get database stats
    let dbStats = {
      artworks: 0,
      media: 0,
      series: 0,
      exhibitions: 0
    };

    db.serialize(() => {
      db.get('SELECT COUNT(*) as count FROM artworks', [], (err, row) => {
        if (!err && row) dbStats.artworks = row.count;
      });
      db.get('SELECT COUNT(*) as count FROM media', [], (err, row) => {
        if (!err && row) dbStats.media = row.count;
      });
      db.get('SELECT COUNT(*) as count FROM series', [], (err, row) => {
        if (!err && row) dbStats.series = row.count;
      });
      db.get('SELECT COUNT(*) as count FROM exhibitions', [], (err, row) => {
        if (!err && row) {
          dbStats.exhibitions = row.count;
          // Send response after all queries complete
          res.json({
            status: 'running',
            uptime,
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            memory: {
              used: memUsage.heapUsed,
              total: memUsage.heapTotal,
              rss: memUsage.rss,
              external: memUsage.external,
              systemTotal: totalMem,
              systemUsed: usedMem,
              percentage: memPercentage
            },
            cpu: {
              usage: null // CPU usage calculation would need external library
            },
            database: dbStats,
            logs: serverLogs.slice(-50) // Last 50 logs
          });
        }
      });
    });
  } catch (error) {
    console.error('Error getting server status:', error);
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

// POST graceful shutdown
app.post('/api/admin/shutdown', (req, res) => {
  addLog('warn', 'Server shutdown requested via admin panel');
  res.json({ message: 'Server shutting down...' });
  
  // Give time for response to be sent
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// POST restart (graceful shutdown - external process manager should restart)
app.post('/api/admin/restart', (req, res) => {
  addLog('warn', 'Server restart requested via admin panel');
  res.json({ message: 'Server restarting...' });
  
  // Give time for response to be sent
  setTimeout(() => {
    process.exit(1); // Exit with code 1 to signal restart needed
  }, 1000);
});

// === Authentication API ===

// POST login
app.post('/api/auth/login', login);

// GET verify token
app.get('/api/auth/verify', verifyToken);

// POST change password (requires authentication)
app.post('/api/auth/change-password', authenticateToken, changePassword);

// POST reset admin password (unauthenticated - for setup only)
app.post('/api/auth/reset-admin', (req, res) => {
  const { password } = req.body;
  const username = 'admin';
  
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Error checking user:', err);
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) {
        console.error('Error hashing password:', hashErr);
        return res.status(500).json({ error: 'Failed to reset password' });
      }

      db.run(
        'UPDATE users SET password_hash = ? WHERE username = ?',
        [hash, username],
        function(updateErr) {
          if (updateErr) {
            console.error('Error updating password:', updateErr);
            return res.status(500).json({ error: 'Failed to reset password' });
          }

          res.json({ message: 'Admin password reset successfully' });
        }
      );
    });
  });
});

// === User Management API ===

// GET all users (requires authentication)
app.get('/api/users', authenticateToken, getAllUsers);

// POST create new user (requires authentication)
app.post('/api/users', authenticateToken, createUser);

// PUT update user password (requires authentication)
app.put('/api/users/:id/password', authenticateToken, updateUserPassword);

// DELETE user (requires authentication)
app.delete('/api/users/:id', authenticateToken, deleteUser);

// === Database Management API ===

// === Database Backup / Restore API ===
const DB_BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
fs.ensureDirSync(DB_BACKUP_DIR);

function sanitizeBackupLabel(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildBackupFilename(label) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = sanitizeBackupLabel(label);
  const suffix = safe ? `-${safe}` : '';
  return `artarc-${ts}${suffix}.db`;
}

function isSafeBackupFilename(filename) {
  if (!filename) return false;
  if (filename.includes('/') || filename.includes('\\')) return false;
  // Only allow our own naming pattern and .db files
  return filename.endsWith('.db') && filename.length <= 200;
}

function sqliteBackupToFile(destPath) {
  return new Promise((resolve, reject) => {
    try {
      const backup = db.backup(destPath);
      backup.step(-1, (err) => {
        if (err) {
          return backup.finish(() => reject(err));
        }
        backup.finish((finishErr) => {
          if (finishErr) return reject(finishErr);
          resolve();
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

function sqliteRestoreFromFile(srcPath) {
  return new Promise((resolve, reject) => {
    try {
      // filenameIsDest=false means: copy FROM filename (srcPath) INTO this db connection
      const backup = db.backup(srcPath, 'main', 'main', false);
      backup.step(-1, (err) => {
        if (err) {
          return backup.finish(() => reject(err));
        }
        backup.finish((finishErr) => {
          if (finishErr) return reject(finishErr);
          resolve();
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

// GET list DB backups (authenticated)
app.get('/api/admin/db-backups', authenticateToken, async (req, res) => {
  try {
    const files = await fs.readdir(DB_BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter((f) => isSafeBackupFilename(f))
        .map(async (filename) => {
          const fullPath = path.join(DB_BACKUP_DIR, filename);
          const stat = await fs.stat(fullPath);
          return {
            filename,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString()
          };
        })
    );
    backups.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
    res.json({ backups });
  } catch (error) {
    console.error('Error listing DB backups:', error);
    res.status(500).json({ error: 'Failed to list DB backups' });
  }
});

// POST create DB backup (authenticated)
app.post('/api/admin/db-backups', authenticateToken, async (req, res) => {
  try {
    const label = req.body?.label || 'manual';
    const filename = buildBackupFilename(label);
    const destPath = path.join(DB_BACKUP_DIR, filename);

    await sqliteBackupToFile(destPath);
    const stat = await fs.stat(destPath);

    res.status(201).json({
      backup: {
        filename,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating DB backup:', error);
    res.status(500).json({ error: 'Failed to create DB backup' });
  }
});

// POST restore DB backup (authenticated)
app.post('/api/admin/db-backups/restore', authenticateToken, async (req, res) => {
  try {
    const filename = req.body?.filename;
    if (!isSafeBackupFilename(filename)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }

    const srcPath = path.join(DB_BACKUP_DIR, filename);
    const exists = await fs.pathExists(srcPath);
    if (!exists) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Safety backup before restoring
    const safetyFilename = buildBackupFilename(`pre-restore-${filename}`);
    const safetyPath = path.join(DB_BACKUP_DIR, safetyFilename);
    await sqliteBackupToFile(safetyPath);

    // Restore into the live DB
    await sqliteRestoreFromFile(srcPath);

    res.json({
      message: 'Database restored from backup successfully',
      restoredFrom: filename,
      safetyBackupCreated: safetyFilename,
      recommendedRestart: true
    });
  } catch (error) {
    console.error('Error restoring DB backup:', error);
    res.status(500).json({ error: 'Failed to restore DB backup' });
  }
});

// Helper functions for database management
function parseArtworkIdFromFolder(folderName) {
  if (/^\d{6}$/.test(folderName)) {
    return parseInt(folderName, 10);
  }
  return null;
}

function getFileTypeFromExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (['.mp4', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.txt', '.pdf', '.doc', '.docx'].includes(ext)) return 'text';
  return 'unknown';
}

function shouldRegisterFile(filename) {
  const skipFiles = ['artwork_info.txt', 'change_history.txt'];
  return !skipFiles.includes(filename);
}

// GET check media database
app.get('/api/db/check-media', (req, res) => {
  const issues = {
    foldersWithoutArtwork: [],
    filesNotInMediaTable: [],
    artworksWithoutFolders: [],
    mediaRecordsWithoutFiles: [],
    artworksWithoutMedia: [],
    summary: {
      totalFolders: 0,
      totalArtworks: 0,
      totalMediaRecords: 0,
      totalIssues: 0
    }
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

  issues.summary.totalFolders = folders.length;

  // Step 2: Get all artworks from database
  db.all('SELECT id, title FROM artworks ORDER BY id', [], (err, artworks) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch artworks', details: err.message });
    }

    issues.summary.totalArtworks = artworks.length;
    const artworkIds = new Set(artworks.map(a => a.id));
    const artworkMap = new Map(artworks.map(a => [a.id, a]));

    // Step 3: Get all media records from database
    db.all('SELECT artwork_id, filename, file_type FROM media ORDER BY artwork_id, filename', [], (err, mediaRecords) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch media records', details: err.message });
      }

      issues.summary.totalMediaRecords = mediaRecords.length;

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
            if (!mediaFiles.has(mediaKey) && shouldRegisterFile(file)) {
              issues.filesNotInMediaTable.push({
                folder: folderName,
                artworkId: artworkId,
                filename: file,
                fileType: getFileTypeFromExtension(file)
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

      // Calculate total issues
      issues.summary.totalIssues = 
        issues.foldersWithoutArtwork.length +
        issues.filesNotInMediaTable.length +
        issues.artworksWithoutFolders.length +
        issues.mediaRecordsWithoutFiles.length +
        issues.artworksWithoutMedia.length;

      res.json(issues);
    });
  });
});

// POST upload misc video
app.post('/api/misc-videos', miscVideoUpload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Create media record with artwork_id = 0 for misc videos
  db.run(
    'INSERT INTO media (artwork_id, filename, file_type, is_public) VALUES (?, ?, ?, ?)',
    [0, req.file.filename, 'video', 1],
    function(err) {
      if (err) {
        console.error('Error creating misc video record:', err);
        // Delete uploaded file if database insert fails
        fs.removeSync(req.file.path);
        return res.status(500).json({ error: 'Failed to save video record', details: err.message });
      }
      
      res.json({
        filename: req.file.filename,
        message: 'Misc video uploaded successfully'
      });
    }
  );
});

// GET misc videos (standalone videos not associated with artworks)
app.get('/api/misc-videos', (req, res) => {
  // Get all video files in root media directory
  const miscVideos = [];
  
  try {
    const files = fs.readdirSync(MEDIA_DIR)
      .filter(file => {
        const fullPath = path.join(MEDIA_DIR, file);
        if (!fs.statSync(fullPath).isFile()) return false;
        const ext = path.extname(file).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.webm', '.mkv', '.flv', '.wmv'].includes(ext);
      })
      .map(file => ({
        filename: file,
        path: file,
        size: fs.statSync(path.join(MEDIA_DIR, file)).size,
        modified: fs.statSync(path.join(MEDIA_DIR, file)).mtime
      }));

    // Get display names from database if they exist (checking for artwork_id = 0 or NULL)
    db.all('SELECT filename, display_name FROM media WHERE file_type = "video" AND (artwork_id = 0 OR artwork_id IS NULL)', [], (err, mediaRecords) => {
      if (err) {
        console.error('Error fetching misc video records:', err);
      }
      
      const displayNameMap = new Map();
      if (mediaRecords) {
        mediaRecords.forEach(record => {
          displayNameMap.set(record.filename, record.display_name);
        });
      }

      const videos = files.map(file => ({
        filename: file.filename,
        path: file.path,
        size: file.size,
        modified: file.modified,
        displayName: displayNameMap.get(file.filename) || null
      }));

      res.json(videos);
    });
  } catch (error) {
    console.error('Error fetching misc videos:', error);
    res.status(500).json({ error: 'Failed to fetch misc videos', details: error.message });
  }
});

// PUT update misc video display name
app.put('/api/misc-videos/:filename/display-name', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const { display_name } = req.body;
  
  // First check if record exists with artwork_id = 0 or NULL
  db.get('SELECT id FROM media WHERE filename = ? AND file_type = "video" AND (artwork_id = 0 OR artwork_id IS NULL)', [filename], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to check media record', details: err.message });
    }
    
    if (row) {
      // Update existing record
      db.run('UPDATE media SET display_name = ? WHERE id = ?', [display_name || null, row.id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update display name', details: err.message });
        }
        res.json({ message: 'Display name updated successfully' });
      });
    } else {
      // Create new record with artwork_id = 0 for misc videos
      db.run(
        'INSERT INTO media (artwork_id, filename, file_type, display_name, is_public) VALUES (?, ?, ?, ?, ?)',
        [0, filename, 'video', display_name || null, 1],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create media record', details: err.message });
          }
          res.json({ message: 'Display name created successfully' });
        }
      );
    }
  });
});

// POST fix media database
app.post('/api/db/fix-media', (req, res) => {
  const fixes = [];
  const results = {
    added: 0,
    errors: 0,
    fixes: []
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

  // Step 2: Get all media records from database
  db.all('SELECT artwork_id, filename FROM media', [], (err, mediaRecords) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch media records', details: err.message });
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
            const fileType = getFileTypeFromExtension(file);
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

    if (fixes.length === 0) {
      return res.json({
        message: 'No fixes needed',
        added: 0,
        errors: 0,
        fixes: []
      });
    }

    // Step 4: Apply fixes
    let completed = 0;
    let errors = 0;
    const totalFixes = fixes.length;

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
        'INSERT INTO media (artwork_id, filename, file_type, is_primary, is_public) VALUES (?, ?, ?, ?, ?)',
        [fix.artworkId, fix.filename, fix.fileType, fix.isPrimary, 1],
        function(err) {
          if (err) {
            console.error(`Error adding media record for ${fix.artworkId}/${fix.filename}:`, err);
            errors++;
            results.errors++;
            results.fixes.push({
              ...fix,
              success: false,
              error: err.message
            });
          } else {
            completed++;
            results.added++;
            results.fixes.push({
              ...fix,
              success: true
            });
          }

          // When all fixes are processed
          if (completed + errors === totalFixes) {
            res.json({
              message: `Completed: ${completed} added, ${errors} errors`,
              added: completed,
              errors: errors,
              fixes: results.fixes
            });
          }
        }
      );
    });
  });
});

// Serve static files from the React app build directory (must be after all API routes)
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  
  // The "catchall" handler: for any request that doesn't match an API route,
  // send back React's index.html file (for client-side routing)
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // Development mode: serve a message if build doesn't exist
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.status(503).send('React build not found. Please run "npm run build" in the client directory.');
  });
}

app.listen(PORT, () => {
  addLog('info', `Server running on http://localhost:${PORT}`);
  if (fs.existsSync(clientBuildPath)) {
    addLog('info', 'Serving React app from build directory');
  } else {
    addLog('warn', 'React build not found. Run "cd client && npm run build" to build the app.');
    addLog('info', 'API endpoints are still available.');
  }
});

