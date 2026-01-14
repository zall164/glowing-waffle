const { db } = require('./database');

console.log('Starting availability value update (Y/N -> Yes/No)...');

db.serialize(() => {
  db.run(
    "UPDATE artworks SET availability = 'Yes' WHERE availability = 'Y'",
    (err) => {
      if (err) {
        console.error("Error updating 'Y' to 'Yes':", err);
      } else {
        console.log("Updated all availability = 'Y' to 'Yes'");
      }
    }
  );

  db.run(
    "UPDATE artworks SET availability = 'No' WHERE availability = 'N'",
    (err) => {
      if (err) {
        console.error("Error updating 'N' to 'No':", err);
      } else {
        console.log("Updated all availability = 'N' to 'No'");
      }
    }
  );

  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Availability update complete. Database connection closed.');
    }
  });
});






