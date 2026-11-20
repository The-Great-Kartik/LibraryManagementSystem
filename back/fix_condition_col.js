const mysql = require('mysql2/promise');
const fs = require('fs');

async function fix() {
  const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  const pool = await mysql.createPool(config);

  const [cols] = await pool.execute("SHOW COLUMNS FROM book_items LIKE 'condition_status'");
  console.log("Current condition_status column:", cols[0]);

  // Alter column to VARCHAR(100) so it comfortably fits any descriptive status
  await pool.execute("ALTER TABLE book_items MODIFY COLUMN condition_status VARCHAR(100) DEFAULT 'Good'");
  console.log("Successfully altered condition_status to VARCHAR(100).");

  await pool.end();
}

fix().catch(console.error);
