const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
  const c = JSON.parse(fs.readFileSync('config.json'));
  const p = await mysql.createPool(c);
  const [tables] = await p.execute("SHOW TABLES");
  console.log("Tables in DB:", tables.map(t => Object.values(t)[0]));
  await p.end();
}

check().catch(console.error);
