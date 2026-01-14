const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'data', 'artarc.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  console.log(`Resetting password for user: ${username}`);

  bcrypt.hash(password, 10, (hashErr, hash) => {
    if (hashErr) {
      console.error('Error hashing password:', hashErr);
      process.exit(1);
    }

    db.run(
      'UPDATE users SET password_hash = ? WHERE username = ?',
      [hash, username],
      function(updateErr) {
        if (updateErr) {
          console.error('Error updating password:', updateErr);
          process.exit(1);
        }

        if (this.changes === 0) {
          console.error(`User "${username}" not found`);
          process.exit(1);
        }

        console.log(`Password reset successfully for user "${username}"`);
        console.log(`New password: ${password}`);
        db.close();
        process.exit(0);
      }
    );
  });
});





