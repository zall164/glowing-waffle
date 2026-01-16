const sqlite3 = require('sqlite3').verbose();
const fs = require('fs-extra');
const bcrypt = require('bcrypt');
const { resolveStoragePaths } = require('./storage-paths');

const { dataDir, mediaDir, dbPath } = resolveStoragePaths();
const DB_PATH = dbPath;
const MEDIA_DIR = mediaDir;

// Ensure directories exist
fs.ensureDirSync(dataDir);
fs.ensureDirSync(MEDIA_DIR);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY,
        year TEXT,
        title TEXT,
        dimensions TEXT,
        medium TEXT,
        value TEXT,
        availability TEXT,
        for_sale_price TEXT,
        description TEXT,
        owner_name TEXT,
        owner_address TEXT,
        owner_phone TEXT,
        more_info TEXT,
        storage_location TEXT,
        past_exhibitions TEXT,
        is_hidden INTEGER DEFAULT 0,
        hide_images_public INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add is_hidden column to existing artworks table if it doesn't exist
    db.run(`
      ALTER TABLE artworks ADD COLUMN is_hidden INTEGER DEFAULT 0
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding is_hidden column:', err);
      }
    });

    // Add hide_images_public column to existing artworks table if it doesn't exist
    db.run(`
      ALTER TABLE artworks ADD COLUMN hide_images_public INTEGER DEFAULT 0
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding hide_images_public column:', err);
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artwork_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        display_name TEXT,
        is_primary BOOLEAN DEFAULT 0,
        is_public BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE
      )
    `);

    // Add display_name column to existing media table if it doesn't exist
    db.run(`
      ALTER TABLE media ADD COLUMN display_name TEXT
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding display_name column:', err);
      }
    });

    // Add is_public column to existing media table if it doesn't exist
    db.run(`
      ALTER TABLE media ADD COLUMN is_public BOOLEAN DEFAULT 1
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding is_public column:', err);
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS exhibitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year TEXT,
        title TEXT,
        location TEXT,
        notes TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add description column to existing exhibitions table if it doesn't exist
    db.run(`
      ALTER TABLE exhibitions ADD COLUMN description TEXT
    `, (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding description column to exhibitions:', err);
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS exhibition_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhibition_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artwork_series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artwork_id INTEGER NOT NULL,
        series_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artwork_id) REFERENCES artworks(id) ON DELETE CASCADE,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
        UNIQUE(artwork_id, series_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artist (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT,
        bio TEXT,
        statement TEXT,
        contact_bio TEXT,
        contact_statement TEXT,
        inquiry_email TEXT,
        photo_filename TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS artist_gallery_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      // Create default admin user if no users exist
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err && row && row.count === 0) {
          // Default admin credentials: admin / admin123
          const defaultUsername = 'admin';
          const defaultPassword = 'admin123';
          
          bcrypt.hash(defaultPassword, 10, (hashErr, hash) => {
            if (!hashErr) {
              db.run(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [defaultUsername, hash],
                (insertErr) => {
                  if (!insertErr) {
                    console.log('Default admin user created: username="admin", password="admin123"');
                  } else {
                    console.error('Error creating default admin user:', insertErr);
                  }
                }
              );
            } else {
              console.error('Error hashing default password:', hashErr);
            }
          });
        }
      });
    });

    // Create indexes for search performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_artwork_title ON artworks(title)`);
    // Note: year index removed as year is now TEXT for flexible formats (spans, decades, uncertain dates)
    db.run(`CREATE INDEX IF NOT EXISTS idx_artwork_medium ON artworks(medium)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_artwork_owner ON artworks(owner_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_artwork ON media(artwork_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_exhibitions_year ON exhibitions(year)`);
    
    // Note: For existing databases with INTEGER year column, SQLite will handle type coercion
    // automatically. New entries will be stored as TEXT, allowing flexible formats.
  });
}

function formatArtworkId(id) {
  // Format ID as 6 digits with leading zeros for storage
  return String(id).padStart(6, '0');
}

function displayArtworkId(id) {
  // Display ID without leading zeros
  return String(id);
}

module.exports = {
  db,
  DB_PATH,
  MEDIA_DIR,
  formatArtworkId,
  displayArtworkId
};

