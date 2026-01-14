const { db } = require('./database');

const exhibitions = [];

console.log('Seeding exhibitions table...');

db.serialize(() => {
  // Ensure table exists in case this script is run before initializeDatabase
  db.run(
    `CREATE TABLE IF NOT EXISTS exhibitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year TEXT,
      title TEXT,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (createErr) => {
      if (createErr) {
        console.error('Error ensuring exhibitions table exists:', createErr);
        db.close();
        return;
      }

      const stmt = db.prepare(
        `INSERT INTO exhibitions (year, title, location, notes)
         VALUES (?, ?, ?, ?)`
      );

      exhibitions.forEach((ex) => {
        stmt.run([ex.year, ex.title, ex.location, ex.notes], (err) => {
          if (err) {
            console.error('Error inserting exhibition:', ex, err);
          }
        });
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing statement:', err);
        } else {
          console.log('Exhibitions seeding completed.');
        }
        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database:', closeErr);
          } else {
            console.log('Database connection closed.');
          }
        });
      });
    }
  );
});


