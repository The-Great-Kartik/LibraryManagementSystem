const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  let dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  };

  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      dbConfig = { ...dbConfig, ...localConfig };
    } catch (e) {
      console.warn('Could not parse config.json, using defaults.');
    }
  }

  console.log(`Connecting to MySQL on ${dbConfig.host}:${dbConfig.port} as user '${dbConfig.user}'...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      multipleStatements: true,
    });
    console.log('Connected to MySQL successfully!');
  } catch (err) {
    console.error('Failed to connect to MySQL:', err.message);
    console.log('\nTip: If your MySQL root account has a password, update it in:');
    console.log('   library-backend/config.json');
    process.exit(1);
  }

  try {
    // 1. Run schema.sql
    console.log('\n1. Applying schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schemaSql);
    console.log('schema.sql executed successfully.');

    // 2. Run migrate.sql
    console.log('\n2. Applying migrate.sql (Seed data & Schema upgrades)...');
    const migrateSql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');
    await connection.query(migrateSql);
    console.log('migrate.sql executed successfully.');

    console.log('\nDatabase setup complete! All tables and seed data are ready in library_db.');
  } catch (err) {
    console.error('Error applying SQL scripts:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

run();
