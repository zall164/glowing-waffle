const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'artarc.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database. Purging...');
  
  db.serialize(() => {
    db.run('DELETE FROM media', (err) => {
      if (err) {
        console.error('Error deleting media:', err);
        process.exit(1);
      }
      console.log('Media deleted');
      
      db.run('DELETE FROM artworks', (err) => {
        if (err) {
          console.error('Error deleting artworks:', err);
          process.exit(1);
        }
        console.log('Artworks deleted');
        console.log('Database purged successfully!');
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          }
          process.exit(0);
        });
      });
    });
  });
});





