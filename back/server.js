const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── DB Configuration ──────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

let dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'library_db',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Check for local config.json override (easy for lab demo without setting env vars)
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    dbConfig = { ...dbConfig, ...localConfig };
  } catch (e) {
    console.warn('Could not parse config.json, using defaults.');
  }
}

const pool = mysql.createPool(dbConfig);

// Self-healing migration for optional per-user borrow limits and condition status tracking
pool.execute("SHOW COLUMNS FROM users LIKE 'max_books_allowed'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE users ADD COLUMN max_books_allowed INT DEFAULT NULL");
    }
  })
  .catch((err) => console.warn('Could not verify max_books_allowed column:', err.message));

pool.execute("SHOW COLUMNS FROM borrow_records LIKE 'return_condition'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE borrow_records ADD COLUMN return_condition VARCHAR(30) DEFAULT NULL");
    }
  })
  .catch((err) => console.warn('Could not verify return_condition column:', err.message));

pool.execute("SHOW COLUMNS FROM borrow_records LIKE 'return_status'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE borrow_records ADD COLUMN return_status VARCHAR(30) DEFAULT 'borrowed'");
    }
  })
  .catch((err) => console.warn('Could not verify return_status column:', err.message));

pool.execute("SHOW COLUMNS FROM users LIKE 'merit_stars'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE users ADD COLUMN merit_stars INT DEFAULT 7");
    }
  })
  .catch((err) => console.warn('Could not verify merit_stars column:', err.message));

pool.execute("SHOW COLUMNS FROM borrow_records LIKE 'stars_deducted'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE borrow_records ADD COLUMN stars_deducted INT DEFAULT 0");
    }
  })
  .catch((err) => console.warn('Could not verify stars_deducted column:', err.message));

pool.execute("SHOW COLUMNS FROM fines_and_payments LIKE 'fine_reason'")
  .then(([cols]) => {
    if (cols.length === 0) {
      return pool.execute("ALTER TABLE fines_and_payments ADD COLUMN fine_reason VARCHAR(255) DEFAULT 'Overdue or condition penalty'");
    }
  })
  .catch((err) => console.warn('Could not verify fine_reason column:', err.message));

// Ensure book_items condition_status is wide enough (VARCHAR(100))
pool.execute("ALTER TABLE book_items MODIFY COLUMN condition_status VARCHAR(100) DEFAULT 'Good'")
  .catch((err) => console.warn('Could not widen condition_status column:', err.message));

// Self-healing migration for standard 3-tier roles: 1=admin, 2=teacher, 3=student
(async () => {
  try {
    // 1. Temporarily disable foreign keys for safe role remap
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Clear out legacy roles and re-seed with 1=admin, 2=teacher, 3=student
    await pool.execute('DELETE FROM roles');
    await pool.execute(`
      INSERT INTO roles (role_id, role_name, max_books_allowed, borrow_duration_days, fine_rate_per_day) VALUES
      (1, 'admin', 0, 0, 0.00),
      (2, 'teacher', 10, 30, 0.00),
      (3, 'student', 3, 14, 5.00)
    `);

    // 3. Update existing users: map faculty/teacher to role 2, students to role 3, admins to role 1
    await pool.execute(`
      UPDATE users SET role_id = CASE
        WHEN role_id = 1 OR email LIKE '%admin%' OR email LIKE '%librarian%' THEN 1
        WHEN email LIKE '%teacher%' OR email LIKE '%prof%' THEN 2
        ELSE 3
      END
    `);

    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Roles successfully mapped: 1=admin, 2=teacher, 3=student');
  } catch (e) {
    console.warn('Could not migrate roles hierarchy:', e.message);
  }
})();

// ─── System Date Simulation State ──────────────────────────────────────────
let simulatedDateOffsetDays = 0; // Days added to real current date

function getSimulatedDateSql() {
  if (simulatedDateOffsetDays === 0) return 'CURDATE()';
  return `DATE_ADD(CURDATE(), INTERVAL ${simulatedDateOffsetDays} DAY)`;
}

// Helper to get formatted simulated date YYYY-MM-DD
function getSimulatedDateString() {
  const d = new Date();
  d.setDate(d.getDate() + simulatedDateOffsetDays);
  return d.toISOString().split('T')[0];
}

// ─── Helper: shared return logic ──────────────────────────────────────────────
async function processReturn(barcodeId, conn, condition = 'Pristine') {
  // Normalize formal condition values: 'Pristine' (Perfect), 'Minor Damage' (Bad), 'Severe Damage' (Worse)
  const validCondition = ['Pristine', 'Minor Damage', 'Severe Damage'].includes(condition)
    ? condition
    : 'Pristine';

  // 1. Find active borrow record
  const [[borrow]] = await conn.execute(
    `SELECT br.borrow_id, br.user_id, br.due_date,
            bi.book_id AS bi_book_id
     FROM borrow_records br
     JOIN book_items bi ON bi.barcode_id = br.barcode_id
     WHERE br.barcode_id = ? AND br.return_date IS NULL`,
    [barcodeId]
  );
  if (!borrow) throw { status: 404, message: 'No active borrow found for this barcode.' };

  const bookId = borrow.bi_book_id;
  const userId = borrow.user_id;

  // 2. Set return_date = simulated date, return_condition, and return_status = 'returned'
  await conn.execute(
    `UPDATE borrow_records SET return_date = ${getSimulatedDateSql()}, return_condition = ?, return_status = 'returned' WHERE borrow_id = ?`,
    [validCondition, borrow.borrow_id]
  );

  // 3. Fetch actual return_date and due_date as JS dates for late fine calculation
  const [[dates]] = await conn.execute(
    `SELECT DATEDIFF(${getSimulatedDateSql()}, due_date) AS days_overdue
     FROM borrow_records WHERE borrow_id = ?`,
    [borrow.borrow_id]
  );
  const daysOverdue = Math.max(0, dates.days_overdue || 0);

  let fineAmount = 0;
  let fineReasons = [];

  // Overdue fine calculation
  if (daysOverdue > 0) {
    const [[role]] = await conn.execute(
      `SELECT r.fine_rate_per_day FROM roles r
       JOIN users u ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [userId]
    );
    if (role) {
      const overdueFine = daysOverdue * parseFloat(role.fine_rate_per_day);
      fineAmount += overdueFine;
      fineReasons.push(`Late return (${daysOverdue} days overdue): ₹${overdueFine.toFixed(2)}`);
    }
  }

  // 4. Merit Point System (7 Stars):
  // Deduct 1 star if 'Minor Damage' (bad), 2 stars if 'Severe Damage' (worse).
  // Once merit ends (<= 0), a fine of ₹200 is put on the user and stars restart to 7.
  let starsDeducted = 0;
  if (validCondition === 'Minor Damage') {
    starsDeducted = 1;
  } else if (validCondition === 'Severe Damage') {
    starsDeducted = 2;
  }

  // Fetch current user merit stars
  const [[userMerit]] = await conn.execute(
    `SELECT merit_stars FROM users WHERE user_id = ?`,
    [userId]
  );
  let currentStars = userMerit && userMerit.merit_stars !== null ? parseInt(userMerit.merit_stars, 10) : 7;
  let newStars = currentStars - starsDeducted;
  let meritPenaltyTriggered = false;

  if (newStars <= 0) {
    meritPenaltyTriggered = true;
    const damageFine = 200.00;
    fineAmount += damageFine;
    fineReasons.push(`Condition Merit Depleted (0/7 stars reached from damage): ₹${damageFine.toFixed(2)} penalty assessed. Merit restarted to 7 stars.`);
    newStars = 7; // Stars restarted as requested
  }

  // Update user's merit stars
  await conn.execute(
    `UPDATE users SET merit_stars = ? WHERE user_id = ?`,
    [newStars, userId]
  );

  // Update borrow_record with return date, condition, and stars_deducted
  await conn.execute(
    `UPDATE borrow_records
     SET return_date = ${getSimulatedDateSql()},
         return_condition = ?,
         return_status = 'returned',
         stars_deducted = ?
     WHERE borrow_id = ?`,
    [validCondition, starsDeducted, borrow.borrow_id]
  );

  // Record assessed fine in fines_and_payments with status = 'pending_approval' (awaiting admin approval)
  if (fineAmount > 0) {
    await conn.execute(
      `INSERT INTO fines_and_payments (borrow_id, user_id, amount_assessed, amount_paid, status, fine_reason)
       VALUES (?, ?, ?, 0, 'pending_approval', ?)`,
      [borrow.borrow_id, userId, fineAmount, fineReasons.join('; ')]
    );
  }

  // 5. Update book_item status & cumulative condition/damage_score:
  // Cumulative damage rule:
  // If a book with existing minor damage receives another minor damage, it escalates to Severe Damage!
  // damage_score: 0 = Good/Pristine, 1 = Minor Damage (Worn), >= 2 = Severe Damage (Needs replacement)
  const [[existingItem]] = await conn.execute(
    `SELECT condition_status, COALESCE(damage_score, 0) AS damage_score FROM book_items WHERE barcode_id = ?`,
    [barcodeId]
  );
  let currentDamageScore = existingItem ? parseInt(existingItem.damage_score, 10) : 0;
  let addedDamage = validCondition === 'Minor Damage' ? 1 : validCondition === 'Severe Damage' ? 2 : 0;
  let newDamageScore = currentDamageScore + addedDamage;

  let finalConditionStatus = 'Good';
  let damageNotes = 'Normal wear';

  if (newDamageScore >= 2 || validCondition === 'Severe Damage') {
    finalConditionStatus = 'Severe Damage';
    damageNotes = 'Severely damaged copy - flagged for admin ordering and replacement';
  } else if (newDamageScore === 1 || validCondition === 'Minor Damage') {
    finalConditionStatus = 'Minor Damage';
    damageNotes = 'Minor wear / edge damage recorded. Handle with caution.';
  }

  // If a book is severely damaged, change its status to 'under_repair' / 'needs_replacement' so it cannot be borrowed normally until replaced!
  const finalItemStatus = finalConditionStatus === 'Severe Damage' ? 'needs_replacement' : 'available';

  await conn.execute(
    `UPDATE book_items 
     SET status = ?, condition_status = ?, damage_score = ?, damage_notes = ? 
     WHERE barcode_id = ?`,
    [finalItemStatus, finalConditionStatus, newDamageScore, damageNotes, barcodeId]
  );

  // 6. Waitlist trigger: find lowest queue_position active reservation for this book
  let heldForReservation = false;
  const [[reservation]] = await conn.execute(
    `SELECT reservation_id FROM reservations
     WHERE book_id = ? AND status = 'active'
     ORDER BY queue_position ASC LIMIT 1`,
    [bookId]
  );
  if (reservation) {
    await conn.execute(
      `UPDATE reservations SET status = 'held' WHERE reservation_id = ?`,
      [reservation.reservation_id]
    );
    heldForReservation = true;
  }

  return {
    borrow_id: borrow.borrow_id,
    user_id: userId,
    fine_amount: fineAmount,
    days_overdue: daysOverdue,
    return_condition: validCondition,
    stars_deducted: starsDeducted,
    remaining_stars: newStars,
    merit_reset: meritPenaltyTriggered,
    fine_reasons: fineReasons,
    fine_status: fineAmount > 0 ? 'pending_approval' : null,
    held_for_reservation: heldForReservation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/login (Passwordless: Sign in using email directly for all roles)
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const [rows] = await pool.execute(
      `SELECT u.user_id, u.role_id, u.first_name, u.last_name, u.email,
              u.phone, u.account_status, r.role_name,
              COALESCE(u.merit_stars, 7) AS merit_stars,
              u.max_books_allowed AS custom_max_books,
              COALESCE(u.max_books_allowed, r.max_books_allowed) AS max_books_allowed
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE LOWER(u.email) = LOWER(?)`,
      [email.trim()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No member account found with this email address.' });
    }
    const user = rows[0];
    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated. Contact library admin.' });
    }
    
    // Provide both id and user_id, plus name for easy UI binding
    const userObj = {
      ...user,
      id: user.user_id,
      name: `${user.first_name} ${user.last_name}`.trim()
    };
    res.json({ message: 'Login successful', user: userObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.role_id, r.role_name, u.first_name, u.last_name,
              u.email, u.phone, u.account_status,
              COALESCE(u.merit_stars, 7) AS merit_stars,
              u.max_books_allowed AS custom_max_books,
              COALESCE(u.max_books_allowed, r.max_books_allowed) AS effective_max_books,
              r.max_books_allowed AS default_max_books
       FROM users u JOIN roles r ON r.role_id = u.role_id
       ORDER BY u.user_id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users (Admin registers a new Student or Teacher / Faculty)
app.post('/api/users', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, role_id, custom_max_books } = req.body;
    if (!first_name || !email || !role_id) {
      return res.status(400).json({ error: 'First name, institutional email, and member role are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    const [existing] = await pool.execute(`SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)`, [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A member account with this institutional email already exists.' });
    }

    const numRoleId = parseInt(role_id, 10);
    const limitVal = custom_max_books ? parseInt(custom_max_books, 10) : null;

    const [result] = await pool.execute(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash, phone, account_status, merit_stars, max_books_allowed)
       VALUES (?, ?, ?, ?, 'passwordless', ?, 'active', 7, ?)`,
      [numRoleId, first_name.trim(), (last_name || '').trim(), cleanEmail, phone ? phone.trim() : null, limitVal]
    );

    res.json({
      message: 'New member account successfully registered.',
      user_id: result.insertId,
      first_name,
      last_name,
      email: cleanEmail,
      role_id: numRoleId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.role_id, r.role_name, u.first_name, u.last_name,
              u.email, u.phone, u.account_status,
              COALESCE(u.merit_stars, 7) AS merit_stars,
              u.max_books_allowed AS custom_max_books,
              COALESCE(u.max_books_allowed, r.max_books_allowed) AS max_books_allowed,
              r.max_books_allowed AS default_max_books,
              r.borrow_duration_days, r.fine_rate_per_day
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/limit (Admin override for individual borrow limit)
app.put('/api/users/:id/limit', async (req, res) => {
  try {
    const { max_books_allowed } = req.body;
    let limitVal = null;
    if (max_books_allowed !== null && max_books_allowed !== '' && max_books_allowed !== undefined) {
      const parsed = parseInt(max_books_allowed, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({ error: 'Borrow limit must be a positive integer.' });
      }
      limitVal = parsed;
    }
    await pool.execute(`UPDATE users SET max_books_allowed = ? WHERE user_id = ?`, [limitVal, req.params.id]);
    res.json({ message: 'Borrow limit updated successfully.', max_books_allowed: limitVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/role
app.put('/api/users/:id/role', async (req, res) => {
  try {
    const { role_id } = req.body;
    await pool.execute(`UPDATE users SET role_id = ? WHERE user_id = ?`, [role_id, req.params.id]);
    res.json({ message: 'Role updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/status
app.put('/api/users/:id/status', async (req, res) => {
  try {
    const { account_status } = req.body;
    await pool.execute(`UPDATE users SET account_status = ? WHERE user_id = ?`, [account_status, req.params.id]);
    res.json({ message: 'Account status updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKS / CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/books?search=
app.get('/api/books', async (req, res) => {
  try {
    const search = `%${req.query.search || ''}%`;
    const [rows] = await pool.execute(
      `SELECT b.book_id, b.isbn, b.title, b.edition, b.publication_year,
              COALESCE(NULLIF(COUNT(DISTINCT bi.barcode_id), 0), b.total_copies) AS total_copies,
              COUNT(DISTINCT CASE WHEN bi.status = 'available' THEN bi.barcode_id END) AS available_copies,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
              COALESCE(MAX(bi.rack_code), MAX(c.rack_code), 'CS-A') AS rack_code,
              COALESCE(MAX(bi.floor_number), MAX(c.floor_number), 2) AS floor_number
       FROM books b
       LEFT JOIN book_items bi ON bi.book_id = b.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       LEFT JOIN book_categories bc ON bc.book_id = b.book_id
       LEFT JOIN categories c ON c.category_id = bc.category_id
       WHERE b.title LIKE ? OR a.last_name LIKE ?
       GROUP BY b.book_id`,
      [search, search]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id
app.get('/api/books/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.book_id, b.isbn, b.title, b.publisher_id, b.edition, b.publication_year,
              COALESCE(NULLIF(COUNT(DISTINCT bi.barcode_id), 0), b.total_copies) AS total_copies,
              COUNT(DISTINCT CASE WHEN bi.status = 'available' THEN bi.barcode_id END) AS available_copies,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
              GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories
       FROM books b
       LEFT JOIN book_items bi ON bi.book_id = b.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       LEFT JOIN book_categories bc ON bc.book_id = b.book_id
       LEFT JOIN categories c ON c.category_id = bc.category_id
       WHERE b.book_id = ?
       GROUP BY b.book_id`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Book not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/shelf-locator (Interactive 2D Physical Shelf & Stacks Locator)
app.get('/api/books/:id/shelf-locator', async (req, res) => {
  try {
    const bookId = req.params.id;
    // 1. Get book metadata
    const [bookRows] = await pool.execute(
      `SELECT b.book_id, b.isbn, b.title, b.edition, b.publication_year,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
              GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories,
              MAX(c.floor_number) AS default_floor,
              MAX(c.rack_code) AS default_rack
       FROM books b
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       LEFT JOIN book_categories bc ON bc.book_id = b.book_id
       LEFT JOIN categories c ON c.category_id = bc.category_id
       WHERE b.book_id = ?
       GROUP BY b.book_id`,
      [bookId]
    );

    if (bookRows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const book = bookRows[0];

    // 2. Get all physical copies of this book
    const [copies] = await pool.execute(
      `SELECT barcode_id, book_id, shelf_slot, floor_number, rack_code, condition_status, status
       FROM book_items
       WHERE book_id = ?
       ORDER BY shelf_slot ASC`,
      [bookId]
    );

    // Determine primary floor and rack
    const primaryFloor = copies[0]?.floor_number || book.default_floor || 2;
    const primaryRack = copies[0]?.rack_code || book.default_rack || 'CS-A';

    // 3. Get all books/copies located on this same rack for realistic bookshelf visualization
    const [rackItems] = await pool.execute(
      `SELECT bi.barcode_id, bi.book_id, b.title, bi.shelf_slot, bi.status, bi.condition_status,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors
       FROM book_items bi
       JOIN books b ON b.book_id = bi.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       WHERE bi.floor_number = ? AND bi.rack_code = ?
       GROUP BY bi.barcode_id
       ORDER BY bi.shelf_slot ASC`,
      [primaryFloor, primaryRack]
    );

    // 4. Floor directory layout
    const floorDirectory = [
      { floor: 1, name: 'Natural Sciences & Mathematics', racks: [{ code: 'MA-B', label: 'Mathematics & Statistics' }, { code: 'PH-C', label: 'Physics & Astronomy' }] },
      { floor: 2, name: 'Computing, Software & Systems', racks: [{ code: 'CS-A', label: 'Computer Science & AI' }] },
      { floor: 3, name: 'Engineering & Applied Sciences', racks: [{ code: 'EN-D', label: 'Engineering & Robotics' }] },
      { floor: 4, name: 'Humanities, History & Literature', racks: [{ code: 'LT-E', label: 'Literature & Linguistics' }, { code: 'HI-F', label: 'World History & Philosophy' }] }
    ];

    res.json({
      book,
      copies,
      primaryFloor,
      primaryRack,
      rackItems,
      floorDirectory
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/copies (Detailed physical copies with damage & condition info)
app.get('/api/books/:id/copies', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT bi.barcode_id, bi.book_id, bi.shelf_slot, bi.floor_number, bi.rack_code,
              bi.condition_status, bi.status, bi.damage_score, bi.damage_notes,
              bi.acquisition_date
       FROM book_items bi
       WHERE bi.book_id = ?
       ORDER BY bi.damage_score ASC, bi.barcode_id ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM categories ORDER BY category_name`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/categories/:id/books
app.get('/api/categories/:id/books', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.book_id, b.isbn, b.title, b.edition, b.publication_year,
              COALESCE(NULLIF(COUNT(DISTINCT bi.barcode_id), 0), b.total_copies) AS total_copies,
              COUNT(DISTINCT CASE WHEN bi.status = 'available' THEN bi.barcode_id END) AS available_copies,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
              COALESCE(MAX(bi.rack_code), MAX(c.rack_code), 'CS-A') AS rack_code,
              COALESCE(MAX(bi.floor_number), MAX(c.floor_number), 2) AS floor_number
       FROM books b
       JOIN book_categories bc ON bc.book_id = b.book_id
       LEFT JOIN categories c ON c.category_id = bc.category_id
       LEFT JOIN book_items bi ON bi.book_id = b.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       WHERE bc.category_id = ?
       GROUP BY b.book_id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/courses
app.get('/api/courses', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM courses ORDER BY course_code`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses/search?code=
app.get('/api/courses/search', async (req, res) => {
  try {
    const code = `%${req.query.code || ''}%`;
    const [rows] = await pool.execute(
      `SELECT * FROM courses WHERE course_code LIKE ? ORDER BY course_code`,
      [code]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses/:id/books
app.get('/api/courses/:id/books', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.book_id, b.isbn, b.title, b.edition, b.publication_year,
              COALESCE(NULLIF(COUNT(DISTINCT bi.barcode_id), 0), b.total_copies) AS total_copies,
              cb.suggestion_type,
              COUNT(DISTINCT CASE WHEN bi.status = 'available' THEN bi.barcode_id END) AS available_copies,
              GROUP_CONCAT(DISTINCT CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS authors,
              COALESCE(MAX(bi.rack_code), 'CS-A') AS rack_code,
              COALESCE(MAX(bi.floor_number), 2) AS floor_number
       FROM books b
       JOIN course_books cb ON cb.book_id = b.book_id
       LEFT JOIN book_items bi ON bi.book_id = b.book_id
       LEFT JOIN book_authors ba ON ba.book_id = b.book_id
       LEFT JOIN authors a ON a.author_id = ba.author_id
       WHERE cb.course_id = ?
       GROUP BY b.book_id, cb.suggestion_type`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BORROW & RETURN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users/:id/borrows
app.get('/api/users/:id/borrows', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT br.borrow_id, br.barcode_id, b.book_id, b.title, br.issue_date, br.due_date,
              COALESCE(br.return_status, 'borrowed') AS return_status,
              CASE WHEN br.due_date < ${getSimulatedDateSql()} THEN 1 ELSE 0 END AS is_overdue
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       JOIN books b ON b.book_id = bi.book_id
       WHERE br.user_id = ? AND br.return_date IS NULL
       ORDER BY br.due_date`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/borrow
app.post('/api/borrow', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, book_id, barcode_id } = req.body;

    // Get user policy limits (custom override takes precedence over role limit)
    const [[policy]] = await conn.execute(
      `SELECT COALESCE(u.max_books_allowed, r.max_books_allowed) AS max_books_allowed,
              r.borrow_duration_days
       FROM roles r JOIN users u ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [user_id]
    );
    if (!policy) throw { status: 404, message: 'User not found.' };

    // Check active borrow count
    const [[{ active_count }]] = await conn.execute(
      `SELECT COUNT(*) AS active_count FROM borrow_records WHERE user_id = ? AND return_date IS NULL`,
      [user_id]
    );
    if (active_count >= policy.max_books_allowed) {
      throw { status: 400, message: `Borrow limit reached (max: ${policy.max_books_allowed} books).` };
    }

    // Check if user already holds an active copy of this exact book title
    const [[alreadyHolding]] = await conn.execute(
      `SELECT br.borrow_id 
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       WHERE br.user_id = ? AND bi.book_id = ? AND br.return_date IS NULL
       LIMIT 1`,
      [user_id, book_id]
    );
    if (alreadyHolding) {
      throw { status: 400, message: 'Policy violation: You already hold an active copy of this book. Only one copy per title is permitted at a time.' };
    }

    // Find the requested or best available book_item
    let item;
    if (barcode_id) {
      const [[specificItem]] = await conn.execute(
        `SELECT barcode_id, condition_status, damage_score, damage_notes FROM book_items WHERE barcode_id = ? AND book_id = ? AND status = 'available'`,
        [barcode_id, book_id]
      );
      if (!specificItem) throw { status: 400, message: `Selected copy (${barcode_id}) is not currently available for checkout.` };
      item = specificItem;
    } else {
      // Prioritize pristine/good copies over damaged copies when auto-selecting
      const [[autoItem]] = await conn.execute(
        `SELECT barcode_id, condition_status, damage_score, damage_notes FROM book_items WHERE book_id = ? AND status = 'available' ORDER BY damage_score ASC LIMIT 1`,
        [book_id]
      );
      if (!autoItem) throw { status: 400, message: 'No available copies for this book.' };
      item = autoItem;
    }

    // Insert borrow_record
    await conn.execute(
      `INSERT INTO borrow_records (user_id, barcode_id, issue_date, due_date)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [user_id, item.barcode_id, policy.borrow_duration_days]
    );

    // Mark item as borrowed
    await conn.execute(
      `UPDATE book_items SET status = 'borrowed' WHERE barcode_id = ?`,
      [item.barcode_id]
    );

    await conn.commit();
    res.json({
      message: 'Book borrowed successfully.',
      barcode_id: item.barcode_id,
      condition_status: item.condition_status,
      damage_score: item.damage_score || 0,
      damage_warning: (item.damage_score > 0 || item.condition_status !== 'Good')
        ? `Warning: This physical copy (${item.barcode_id}) has existing wear/damage recorded (${item.damage_notes || item.condition_status}). Please handle with extra caution to avoid severe escalation.`
        : null
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/returns (Student marks book as returned / dropped off -> sets status = 'pending_verification')
app.post('/api/returns', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { borrow_id } = req.body;

    // Verify active borrow record
    const [[borrow]] = await conn.execute(
      `SELECT br.borrow_id, br.barcode_id, b.book_id, b.title
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       JOIN books b ON b.book_id = bi.book_id
       WHERE br.borrow_id = ? AND br.return_date IS NULL`,
      [borrow_id]
    );
    if (!borrow) throw { status: 404, message: 'Active borrow record not found.' };

    // Update return_status to 'pending_verification'
    await conn.execute(
      `UPDATE borrow_records SET return_status = 'pending_verification' WHERE borrow_id = ?`,
      [borrow_id]
    );

    await conn.commit();
    res.json({
      message: 'Return initiated. Book status set to awaiting admin verification.',
      borrow_id,
      barcode_id: borrow.barcode_id,
      book_id: borrow.book_id,
      title: borrow.title,
      return_status: 'pending_verification',
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESERVATIONS (WAITLIST)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users/:id/reservations
app.get('/api/users/:id/reservations', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rv.reservation_id, rv.book_id, b.title, rv.reservation_date,
              rv.queue_position, rv.status
       FROM reservations rv
       JOIN books b ON b.book_id = rv.book_id
       WHERE rv.user_id = ? AND rv.status IN ('active', 'held')
       ORDER BY rv.reservation_date`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reservations
app.post('/api/reservations', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, book_id } = req.body;

    // Block if book has available copies
    const [[{ avail }]] = await conn.execute(
      `SELECT COUNT(*) AS avail FROM book_items WHERE book_id = ? AND status = 'available'`,
      [book_id]
    );
    if (avail > 0) throw { status: 400, message: 'Book has available copies. Please borrow directly.' };

    // Block if user already holds an active copy of this exact book
    const [[activeBorrow]] = await conn.execute(
      `SELECT br.borrow_id 
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       WHERE br.user_id = ? AND bi.book_id = ? AND br.return_date IS NULL
       LIMIT 1`,
      [user_id, book_id]
    );
    if (activeBorrow) {
      throw { status: 400, message: 'Policy violation: You currently hold an active copy of this book. Members cannot waitlist books they already possess.' };
    }

    // Block duplicate active reservations
    const [[{ dup }]] = await conn.execute(
      `SELECT COUNT(*) AS dup FROM reservations WHERE book_id = ? AND user_id = ? AND status IN ('active','held')`,
      [book_id, user_id]
    );
    if (dup > 0) throw { status: 400, message: 'You already have an active reservation for this book.' };

    // Get next queue_position
    const [[{ max_pos }]] = await conn.execute(
      `SELECT COALESCE(MAX(queue_position), 0) AS max_pos FROM reservations WHERE book_id = ? AND status = 'active'`,
      [book_id]
    );

    await conn.execute(
      `INSERT INTO reservations (book_id, user_id, reservation_date, queue_position, status)
       VALUES (?, ?, CURDATE(), ?, 'active')`,
      [book_id, user_id, max_pos + 1]
    );

    await conn.commit();
    res.json({ message: 'Reservation placed successfully.', queue_position: max_pos + 1 });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/reservations/:id
app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Reservation not found.' });
    res.json({ message: 'Reservation cancelled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/reservations (Admin view of all active & held waitlist queues)
app.get('/api/admin/reservations', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rv.reservation_id, rv.book_id, b.title, rv.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email, r.role_name,
              rv.reservation_date, rv.queue_position, rv.status,
              (SELECT bi.barcode_id FROM book_items bi WHERE bi.book_id = rv.book_id LIMIT 1) AS available_barcode
       FROM reservations rv
       JOIN books b ON b.book_id = rv.book_id
       JOIN users u ON u.user_id = rv.user_id
       JOIN roles r ON r.role_id = u.role_id
       WHERE rv.status IN ('active', 'held')
       ORDER BY rv.book_id, rv.queue_position ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reservations/:id/fulfill (Admin inspects copy condition & issues directly to waitlisted patron)
app.post('/api/admin/reservations/:id/fulfill', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { barcode_id, condition = 'Pristine', librarian_id } = req.body;
    const reservationId = req.params.id;

    // 1. Get reservation details
    const [[reservation]] = await conn.execute(
      `SELECT rv.reservation_id, rv.book_id, rv.user_id, rv.status, b.title
       FROM reservations rv
       JOIN books b ON b.book_id = rv.book_id
       WHERE rv.reservation_id = ? AND rv.status IN ('active', 'held')`,
      [reservationId]
    );
    if (!reservation) throw { status: 404, message: 'Active or held waitlist reservation not found.' };

    const { user_id, book_id } = reservation;

    // 2. Select copy: use specified barcode or find any available copy for this book
    let copyBarcode = barcode_id;
    if (!copyBarcode) {
      const [[avail]] = await conn.execute(
        `SELECT barcode_id FROM book_items WHERE book_id = ? AND status = 'available' LIMIT 1`,
        [book_id]
      );
      if (!avail) throw { status: 400, message: 'No available physical copies for this title to hand off.' };
      copyBarcode = avail.barcode_id;
    }

    // 3. Update copy physical condition
    const itemCondition = condition === 'Pristine' ? 'Good' : condition === 'Minor Damage' ? 'Worn' : 'Damaged';
    await conn.execute(
      `UPDATE book_items SET status = 'borrowed', condition_status = ? WHERE barcode_id = ?`,
      [itemCondition, copyBarcode]
    );

    // 4. Get recipient borrow policy limits
    const [[policy]] = await conn.execute(
      `SELECT COALESCE(u.max_books_allowed, r.max_books_allowed) AS max_books_allowed,
              r.borrow_duration_days
       FROM roles r JOIN users u ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [user_id]
    );
    const durationDays = policy ? policy.borrow_duration_days : 14;

    // 5. Create borrow_record for the waitlisted patron
    const [borrowResult] = await conn.execute(
      `INSERT INTO borrow_records (user_id, barcode_id, issue_date, due_date, issued_by_librarian_id, return_status)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, 'borrowed')`,
      [user_id, copyBarcode, durationDays, librarian_id || null]
    );

    // 6. Mark reservation fulfilled
    await conn.execute(
      `UPDATE reservations SET status = 'fulfilled' WHERE reservation_id = ?`,
      [reservationId]
    );

    // 7. Adjust queue positions for remaining active reservations on this title
    await conn.execute(
      `UPDATE reservations SET queue_position = queue_position - 1
       WHERE book_id = ? AND status = 'active' AND queue_position > 1`,
      [book_id]
    );

    await conn.commit();
    res.json({
      message: `Copy [${copyBarcode}] condition set to '${condition}' and successfully checked out to waitlisted member.`,
      borrow_id: borrowResult.insertId,
      barcode_id: copyBarcode,
      user_id,
      condition,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINES & AUDIT LEDGER
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users/:id/fines
app.get('/api/users/:id/fines', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT fp.transaction_id, fp.borrow_id, fp.amount_assessed, fp.amount_paid,
              fp.status, fp.fine_reason, fp.payment_date, fp.payment_method,
              b.title, br.issue_date, br.due_date, br.return_date
       FROM fines_and_payments fp
       LEFT JOIN borrow_records br ON br.borrow_id = fp.borrow_id
       LEFT JOIN book_items bi ON bi.barcode_id = br.barcode_id
       LEFT JOIN books b ON b.book_id = bi.book_id
       WHERE fp.user_id = ?
       ORDER BY fp.transaction_id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id/condition-history (History of physical book conditions returned by patron)
app.get('/api/users/:id/condition-history', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT br.borrow_id, br.barcode_id, br.issue_date, br.due_date, br.return_date,
              br.return_condition, COALESCE(br.stars_deducted, 0) AS stars_deducted,
              b.book_id, b.title, b.isbn,
              bi.shelf_slot
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       JOIN books b ON b.book_id = bi.book_id
       WHERE br.user_id = ? AND br.return_date IS NOT NULL
       ORDER BY br.return_date DESC, br.borrow_id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fines
app.get('/api/fines', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT fp.transaction_id, fp.borrow_id, fp.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email,
              fp.amount_assessed, fp.amount_paid, fp.status, fp.fine_reason, fp.payment_date, fp.payment_method,
              b.title AS book_title, br.issue_date, br.due_date, br.return_date
       FROM fines_and_payments fp
       JOIN users u ON u.user_id = fp.user_id
       LEFT JOIN borrow_records br ON br.borrow_id = fp.borrow_id
       LEFT JOIN book_items bi ON bi.barcode_id = br.barcode_id
       LEFT JOIN books b ON b.book_id = bi.book_id
       ORDER BY fp.transaction_id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/fines/:id/approve (Admin approves a pending fine -> becomes 'unpaid' / due)
app.post(['/api/admin/fines/:id/approve', '/api/fines/:id/approve'], async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE fines_and_payments
       SET status = 'unpaid'
       WHERE transaction_id = ? AND status = 'pending_approval'`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fine not found or not in pending approval status.' });
    }
    res.json({ message: `Fine #${req.params.id} approved by admin. Now active and due for payment.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fines/:id/pay
app.post('/api/fines/:id/pay', async (req, res) => {
  try {
    const { amount_paid, payment_method } = req.body;
    const [[fine]] = await pool.execute(
      `SELECT amount_assessed FROM fines_and_payments WHERE transaction_id = ?`,
      [req.params.id]
    );
    if (!fine) return res.status(404).json({ error: 'Fine not found.' });

    const newStatus = parseFloat(amount_paid) >= parseFloat(fine.amount_assessed) ? 'paid' : 'unpaid';
    await pool.execute(
      `UPDATE fines_and_payments
       SET amount_paid = ?, payment_method = ?, payment_date = CURDATE(), status = ?
       WHERE transaction_id = ?`,
      [amount_paid, payment_method, newStatus, req.params.id]
    );
    res.json({ message: 'Payment recorded.', status: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fines/:id/waive & /api/admin/fines/:id/waive
app.post(['/api/fines/:id/waive', '/api/admin/fines/:id/waive'], async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE fines_and_payments
       SET status = 'waived', amount_paid = amount_assessed, payment_date = CURDATE()
       WHERE transaction_id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Fine not found.' });
    res.json({ message: `Fine #${req.params.id} waived / dismissed.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK REQUESTS (COMMUNITY)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/book-requests
app.get('/api/book-requests', async (req, res) => {
  try {
    const currentUserId = req.query.user_id ? Number(req.query.user_id) : null;
    const [rows] = await pool.execute(
      `SELECT br.request_id, br.book_title, br.author_name, br.isbn, br.status, br.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS requester_name,
              COUNT(ru.user_id) AS upvote_count,
              MAX(CASE WHEN ru.user_id = ? THEN 1 ELSE 0 END) AS has_upvoted
       FROM book_requests br
       JOIN users u ON u.user_id = br.user_id
       LEFT JOIN request_upvotes ru ON ru.request_id = br.request_id
       GROUP BY br.request_id
       ORDER BY upvote_count DESC, br.created_at DESC`,
      [currentUserId || 0]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/book-requests
app.post('/api/book-requests', async (req, res) => {
  try {
    const { user_id, book_title, author_name, isbn } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO book_requests (user_id, book_title, author_name, isbn, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [user_id, book_title, author_name || null, isbn || null]
    );
    res.json({ message: 'Book request submitted.', request_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/book-requests/:id/upvote (Toggle: adds upvote or reverts/removes if already upvoted)
app.post('/api/book-requests/:id/upvote', async (req, res) => {
  try {
    const { user_id } = req.body;
    // Check if already upvoted
    const [[dup]] = await pool.execute(
      `SELECT 1 FROM request_upvotes WHERE request_id = ? AND user_id = ?`,
      [req.params.id, user_id]
    );

    if (dup) {
      // Revert / remove upvote
      await pool.execute(
        `DELETE FROM request_upvotes WHERE request_id = ? AND user_id = ?`,
        [req.params.id, user_id]
      );
      const [[{ upvote_count }]] = await pool.execute(
        `SELECT COUNT(*) AS upvote_count FROM request_upvotes WHERE request_id = ?`,
        [req.params.id]
      );
      return res.json({ message: 'Upvote reverted.', upvote_count, has_upvoted: 0 });
    }

    // Add upvote
    await pool.execute(
      `INSERT INTO request_upvotes (request_id, user_id, upvoted_at) VALUES (?, ?, NOW())`,
      [req.params.id, user_id]
    );
    const [[{ upvote_count }]] = await pool.execute(
      `SELECT COUNT(*) AS upvote_count FROM request_upvotes WHERE request_id = ?`,
      [req.params.id]
    );
    res.json({ message: 'Upvoted.', upvote_count, has_upvoted: 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/book-requests/:id/upvote (Explicit revert endpoint)
app.delete('/api/book-requests/:id/upvote', async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.execute(
      `DELETE FROM request_upvotes WHERE request_id = ? AND user_id = ?`,
      [req.params.id, user_id]
    );
    const [[{ upvote_count }]] = await pool.execute(
      `SELECT COUNT(*) AS upvote_count FROM request_upvotes WHERE request_id = ?`,
      [req.params.id]
    );
    res.json({ message: 'Upvote removed.', upvote_count, has_upvoted: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/book-requests/:id/status
app.put('/api/book-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const [result] = await pool.execute(
      `UPDATE book_requests SET status = ? WHERE request_id = ?`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Request not found.' });
    res.json({ message: 'Request status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - CIRCULATION DESK
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/issue
app.post('/api/admin/issue', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, barcode_id, librarian_id } = req.body;

    // Check book_item exists and is available
    const [[item]] = await conn.execute(
      `SELECT barcode_id, book_id, status FROM book_items WHERE barcode_id = ?`,
      [barcode_id]
    );
    if (!item) throw { status: 404, message: 'Book item not found.' };
    if (item.status !== 'available') throw { status: 400, message: 'Book item is not available.' };

    // Check user borrow limit (custom override takes precedence over role limit)
    const [[policy]] = await conn.execute(
      `SELECT COALESCE(u.max_books_allowed, r.max_books_allowed) AS max_books_allowed,
              r.borrow_duration_days
       FROM roles r JOIN users u ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [user_id]
    );
    if (!policy) throw { status: 404, message: 'User not found.' };

    const [[{ active_count }]] = await conn.execute(
      `SELECT COUNT(*) AS active_count FROM borrow_records WHERE user_id = ? AND return_date IS NULL`,
      [user_id]
    );
    if (active_count >= policy.max_books_allowed) {
      throw { status: 400, message: `Borrow limit reached (max: ${policy.max_books_allowed} books).` };
    }

    // Check if user already holds an active copy of this exact book title
    const [[alreadyHolding]] = await conn.execute(
      `SELECT br.borrow_id 
       FROM borrow_records br
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       WHERE br.user_id = ? AND bi.book_id = ? AND br.return_date IS NULL
       LIMIT 1`,
      [user_id, item.book_id]
    );
    if (alreadyHolding) {
      throw { status: 400, message: 'Policy violation: Member already holds an active copy of this book title. Only one copy per title is permitted at a time.' };
    }

    // Create borrow_record
    await conn.execute(
      `INSERT INTO borrow_records (user_id, barcode_id, issue_date, due_date, issued_by_librarian_id)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)`,
      [user_id, barcode_id, policy.borrow_duration_days, librarian_id]
    );

    // Mark item borrowed
    await conn.execute(
      `UPDATE book_items SET status = 'borrowed' WHERE barcode_id = ?`,
      [barcode_id]
    );

    await conn.commit();
    res.json({ message: 'Book issued successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/admin/pending-returns (Returns waiting for admin inspection & acceptance)
app.get('/api/admin/pending-returns', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT br.borrow_id, br.barcode_id, br.user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS user_name,
              u.email AS user_email, r.role_name,
              b.title, br.issue_date, br.due_date,
              COALESCE(br.return_status, 'borrowed') AS return_status,
              CASE WHEN br.due_date < ${getSimulatedDateSql()} THEN 1 ELSE 0 END AS is_overdue,
              DATEDIFF(${getSimulatedDateSql()}, br.due_date) AS days_overdue
       FROM borrow_records br
       JOIN users u ON u.user_id = br.user_id
       JOIN roles r ON r.role_id = u.role_id
       JOIN book_items bi ON bi.barcode_id = br.barcode_id
       JOIN books b ON b.book_id = bi.book_id
       WHERE br.return_date IS NULL AND br.return_status = 'pending_verification'
       ORDER BY br.due_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/return
app.post('/api/admin/return', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { barcode_id, borrow_id, condition } = req.body;
    let barcode = barcode_id;
    if (!barcode && borrow_id) {
      const [[bRow]] = await conn.execute(
        `SELECT barcode_id FROM borrow_records WHERE borrow_id = ?`,
        [borrow_id]
      );
      if (bRow) barcode = bRow.barcode_id;
    }
    if (!barcode) {
      throw { status: 400, message: 'barcode_id or borrow_id is required to process return.' };
    }
    const result = await processReturn(barcode, conn, condition);
    await conn.commit();
    res.json({ message: 'Return processed.', ...result });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK REVIEWS & CAMPUS DISCUSSIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/reviews?book_id= (Fetch all reviews or book-specific reviews)
app.get('/api/reviews', async (req, res) => {
  try {
    const { book_id } = req.query;
    let query = `
      SELECT r.review_id, r.book_id, b.title AS book_title, b.isbn,
             r.user_id, CONCAT(u.first_name, ' ', u.last_name) AS user_name,
             u.email, ro.role_name,
             r.rating, r.review_text, r.created_at
      FROM book_reviews r
      JOIN books b ON b.book_id = r.book_id
      JOIN users u ON u.user_id = r.user_id
      JOIN roles ro ON ro.role_id = u.role_id
    `;
    const params = [];
    if (book_id) {
      query += ` WHERE r.book_id = ?`;
      params.push(book_id);
    }
    query += ` ORDER BY r.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews (Submit review on return or from discussions)
app.post('/api/reviews', async (req, res) => {
  try {
    const { book_id, barcode_id, user_id, rating, review_text } = req.body;
    let resolvedBookId = book_id;

    // Self-healing: if book_id wasn't directly supplied, resolve it using barcode_id
    if (!resolvedBookId && barcode_id) {
      const [[item]] = await pool.execute(`SELECT book_id FROM book_items WHERE barcode_id = ?`, [barcode_id]);
      if (item) resolvedBookId = item.book_id;
    }

    if (!resolvedBookId || !user_id || !rating) {
      return res.status(400).json({ error: 'Book ID, user ID, and star rating (1-5) are required.' });
    }

    const numRating = Math.min(5, Math.max(1, parseInt(rating, 10)));
    const [result] = await pool.execute(
      `INSERT INTO book_reviews (book_id, user_id, rating, review_text)
       VALUES (?, ?, ?, ?)`,
      [resolvedBookId, user_id, numRating, (review_text || '').trim()]
    );

    res.json({ message: 'Review published to campus discussions.', review_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - DAMAGED BOOKS REPLACEMENT & ORDERING
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/damaged-books (Returns copies with damage_score >= 1 or severe damage)
app.get('/api/admin/damaged-books', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT bi.barcode_id, bi.book_id, b.title, b.isbn,
             bi.floor_number, bi.rack_code, bi.shelf_slot,
             bi.condition_status, bi.status,
             COALESCE(bi.damage_score, 0) AS damage_score,
             COALESCE(bi.damage_notes, 'Wear recorded') AS damage_notes,
             bi.acquisition_date,
             (SELECT COUNT(*) FROM borrow_records br WHERE br.barcode_id = bi.barcode_id) AS total_times_borrowed
      FROM book_items bi
      JOIN books b ON b.book_id = bi.book_id
      WHERE bi.damage_score > 0 OR bi.condition_status IN ('Severe Damage', 'Minor Damage', 'Damaged', 'Worn')
      ORDER BY bi.damage_score DESC, bi.barcode_id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/replace-book (Order and replace damaged copy with a brand new physical copy)
app.post('/api/admin/replace-book', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { barcode_id, new_barcode_id } = req.body;
    if (!barcode_id) {
      return res.status(400).json({ error: 'barcode_id is required.' });
    }

    const replacementBarcode = (new_barcode_id || `${barcode_id}-R`).trim();

    // 1. Fetch damaged item details
    const [[oldItem]] = await conn.execute(
      `SELECT book_id, shelf_slot, floor_number, rack_code FROM book_items WHERE barcode_id = ?`,
      [barcode_id]
    );
    if (!oldItem) throw { status: 404, message: 'Damaged physical copy not found.' };

    // 2. Mark old item as 'decommissioned'
    await conn.execute(
      `UPDATE book_items 
       SET status = 'decommissioned', condition_status = 'Decommissioned', damage_notes = 'Replaced with brand new pristine acquisition'
       WHERE barcode_id = ?`,
      [barcode_id]
    );

    // 3. Insert new pristine replacement copy with identical shelf coordinates
    await conn.execute(
      `INSERT INTO book_items (barcode_id, book_id, shelf_slot, floor_number, rack_code, acquisition_date, condition_status, status, damage_score, damage_notes)
       VALUES (?, ?, ?, ?, ?, ${getSimulatedDateSql()}, 'Good', 'available', 0, 'Pristine new replacement order')
       ON DUPLICATE KEY UPDATE status='available', condition_status='Good', damage_score=0, damage_notes='Pristine new replacement order'`,
      [replacementBarcode, oldItem.book_id, oldItem.shelf_slot, oldItem.floor_number, oldItem.rack_code]
    );

    await conn.commit();
    res.json({
      message: `Damaged copy ${barcode_id} successfully decommissioned and replaced with new copy ${replacementBarcode}.`,
      old_barcode: barcode_id,
      new_barcode: replacementBarcode
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/admin/books
app.post('/api/admin/books', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { isbn, title, publisher_id, edition, publication_year, author_ids, category_ids } = req.body;

    const [result] = await conn.execute(
      `INSERT INTO books (isbn, title, publisher_id, edition, publication_year, total_copies)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [isbn, title, publisher_id || null, edition || null, publication_year || null]
    );
    const book_id = result.insertId;

    if (Array.isArray(author_ids)) {
      for (const author_id of author_ids) {
        await conn.execute(
          `INSERT IGNORE INTO book_authors (book_id, author_id) VALUES (?, ?)`,
          [book_id, author_id]
        );
      }
    }

    if (Array.isArray(category_ids)) {
      for (const category_id of category_ids) {
        await conn.execute(
          `INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)`,
          [book_id, category_id]
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Book added successfully.', book_id });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/admin/book-items
app.post('/api/admin/book-items', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { barcode_id, book_id, shelf_slot, floor_number, rack_code, condition_status, acquisition_date } = req.body;

    await conn.execute(
      `INSERT INTO book_items (barcode_id, book_id, shelf_slot, floor_number, rack_code, condition_status, acquisition_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available')`,
      [barcode_id, book_id, shelf_slot || null, floor_number || null, rack_code || null, condition_status || 'good', acquisition_date || null]
    );

    await conn.execute(
      `UPDATE books SET total_copies = total_copies + 1 WHERE book_id = ?`,
      [book_id]
    );

    await conn.commit();
    res.json({ message: 'Book item added successfully.', barcode_id });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/admin/book-items/:barcode_id
app.put('/api/admin/book-items/:barcode_id', async (req, res) => {
  try {
    const { condition_status, shelf_slot } = req.body;
    const [result] = await pool.execute(
      `UPDATE book_items SET condition_status = ?, shelf_slot = ? WHERE barcode_id = ?`,
      [condition_status, shelf_slot, req.params.barcode_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Book item not found.' });
    res.json({ message: 'Book item updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/book-items?book_id=
app.get('/api/admin/book-items', async (req, res) => {
  try {
    const { book_id } = req.query;
    let query = `SELECT barcode_id, book_id, shelf_slot, floor_number, rack_code,
                        condition_status, acquisition_date, status
                 FROM book_items`;
    const params = [];
    if (book_id) {
      query += ` WHERE book_id = ?`;
      params.push(book_id);
    }
    query += ` ORDER BY barcode_id`;
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - AUTHORS & PUBLISHERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/authors
app.get('/api/authors', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM authors ORDER BY last_name, first_name`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/authors
app.post('/api/authors', async (req, res) => {
  try {
    const { first_name, last_name, bio } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO authors (first_name, last_name, bio) VALUES (?, ?, ?)`,
      [first_name, last_name, bio || null]
    );
    res.json({ message: 'Author added.', author_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/publishers
app.get('/api/publishers', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM publishers ORDER BY name`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/publishers
app.post('/api/publishers', async (req, res) => {
  try {
    const { name, contact_email, address } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO publishers (name, contact_email, address) VALUES (?, ?, ?)`,
      [name, contact_email || null, address || null]
    );
    res.json({ message: 'Publisher added.', publisher_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - ROLES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/roles
app.get('/api/roles', async (req, res) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM roles ORDER BY role_id`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN - STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [[{ total_books }]] = await pool.execute(`SELECT COUNT(*) AS total_books FROM books`);
    const [[{ total_users }]] = await pool.execute(`SELECT COUNT(*) AS total_users FROM users`);
    const [[{ active_borrows }]] = await pool.execute(
      `SELECT COUNT(*) AS active_borrows FROM borrow_records WHERE return_date IS NULL`
    );
    const [[{ overdue_borrows }]] = await pool.execute(
      `SELECT COUNT(*) AS overdue_borrows FROM borrow_records WHERE return_date IS NULL AND due_date < ${getSimulatedDateSql()}`
    );
    const [[{ pending_fines_total }]] = await pool.execute(
      `SELECT COALESCE(SUM(amount_assessed - amount_paid), 0) AS pending_fines_total
       FROM fines_and_payments WHERE status = 'unpaid'`
    );
    const [[{ pending_requests }]] = await pool.execute(
      `SELECT COUNT(*) AS pending_requests FROM book_requests WHERE status = 'pending'`
    );
    const [[{ waitlist_count }]] = await pool.execute(
      `SELECT COUNT(*) AS waitlist_count FROM reservations WHERE status IN ('active', 'held')`
    );
    const [[{ pending_approval_fines }]] = await pool.execute(
      `SELECT COUNT(*) AS pending_approval_fines FROM fines_and_payments WHERE status = 'pending_approval'`
    );

    res.json({
      total_books,
      total_users,
      active_borrows,
      overdue_borrows,
      pending_fines_total,
      pending_requests,
      waitlist_count,
      pending_approval_fines,
      simulated_date: getSimulatedDateString(),
      offset_days: simulatedDateOffsetDays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system-date
app.get('/api/admin/system-date', (req, res) => {
  res.json({
    current_simulated_date: getSimulatedDateString(),
    offset_days: simulatedDateOffsetDays,
  });
});

// POST /api/admin/system-date (fast date change / fast-forward simulation)
app.post('/api/admin/system-date', async (req, res) => {
  try {
    const { offset_days, target_date } = req.body;
    if (offset_days !== undefined) {
      simulatedDateOffsetDays = parseInt(offset_days, 10) || 0;
    } else if (target_date) {
      const target = new Date(target_date);
      const today = new Date();
      // Normalize to UTC midnight
      const diffTime = target.getTime() - today.getTime();
      simulatedDateOffsetDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    }
    res.json({
      message: 'System simulation date updated.',
      simulated_date: getSimulatedDateString(),
      offset_days: simulatedDateOffsetDays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log('Library Management System API running on http://localhost:3000');
});
