-- ============================================================
-- migrate.sql
-- Library Management System — Migration & Seed Data
-- Run this AFTER schema.sql
-- All inserts use INSERT IGNORE for idempotency.
-- ============================================================

USE library_db;

-- ============================================================
-- 1. ADD MISSING COLUMNS
-- ============================================================

ALTER TABLE book_items ADD COLUMN IF NOT EXISTS floor_number INT;
ALTER TABLE book_items ADD COLUMN IF NOT EXISTS rack_code VARCHAR(20);
ALTER TABLE book_items ADD COLUMN IF NOT EXISTS condition_status VARCHAR(20) DEFAULT 'Good';
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_books_allowed INT DEFAULT NULL;


-- ============================================================
-- 2. PERFORMANCE INDEXES ON borrow_records
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_borrow_user    ON borrow_records(user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_barcode ON borrow_records(barcode_id);


-- ============================================================
-- 3. SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- Publishers  (schema: publisher_id, name, contact_email, address)
-- ------------------------------------------------------------
INSERT IGNORE INTO publishers (publisher_id, name, contact_email, address) VALUES
(1, 'Pearson Education', 'info@pearson.com',  'London, UK'),
(2, 'O''Reilly Media',   'info@oreilly.com',  'Sebastopol, California'),
(3, 'McGraw-Hill',       'info@mcgraw.com',   'New York, NY'),
(4, 'Wiley',             'info@wiley.com',    'Hoboken, New Jersey');


-- ------------------------------------------------------------
-- Categories  (schema: category_id, category_name, floor_number, rack_code)
-- ------------------------------------------------------------
INSERT IGNORE INTO categories (category_id, category_name, floor_number, rack_code) VALUES
(1, 'Computer Science', 2, 'CS-A'),
(2, 'Mathematics',      1, 'MA-B'),
(3, 'Physics',          1, 'PH-C'),
(4, 'Engineering',      3, 'EN-D'),
(5, 'Literature',       4, 'LT-E'),
(6, 'History',          4, 'HI-F');


-- ------------------------------------------------------------
-- Authors  (schema: author_id, first_name, last_name, bio)
-- ------------------------------------------------------------
INSERT IGNORE INTO authors (author_id, first_name, last_name, bio) VALUES
(1, 'Abraham',  'Silberschatz', 'Database systems expert, Yale University'),
(2, 'Henry',    'Korth',        'Database systems expert, Lehigh University'),
(3, 'S.',       'Sudarshan',    'Database systems expert, IIT Bombay'),
(4, 'Andrew',   'Tanenbaum',    'OS and Networks expert, Vrije Universiteit'),
(5, 'Donald',   'Knuth',        'Father of algorithm analysis, Stanford'),
(6, 'Thomas',   'Cormen',       'Algorithms expert, Dartmouth College'),
(7, 'Robert',   'Sedgewick',    'Algorithms expert, Princeton University'),
(8, 'James',    'Gosling',      'Creator of the Java programming language');


-- ------------------------------------------------------------
-- Books  (schema: book_id, isbn, title, publisher_id, edition, publication_year, total_copies)
-- ------------------------------------------------------------
INSERT IGNORE INTO books (book_id, isbn, title, publisher_id, edition, publication_year, total_copies) VALUES
(1, '978-0-07-352332-3', 'Database System Concepts',      1, '7th',  2019, 3),
(2, '978-0-13-468599-1', 'Operating System Concepts',     1, '10th', 2018, 3),
(3, '978-0-262-03384-8', 'Introduction to Algorithms',    3, '4th',  2022, 3),
(4, '978-0-13-235088-4', 'Computer Networks',             1, '5th',  2010, 2),
(5, '978-0-13-468791-9', 'The C Programming Language',    4, '2nd',  1988, 2),
(6, '978-0-596-51774-8', 'Learning Python',               2, '5th',  2013, 3),
(7, '978-0-13-110362-7', 'Java: The Complete Reference',  1, '12th', 2021, 3),
(8, '978-0-07-874698-1', 'Discrete Mathematics',          3, '8th',  2018, 2);


-- ------------------------------------------------------------
-- book_authors  (book ↔ author)
-- ------------------------------------------------------------
INSERT IGNORE INTO book_authors (book_id, author_id) VALUES
-- Database System Concepts → Silberschatz, Korth, Sudarshan
(1, 1), (1, 2), (1, 3),
-- Operating System Concepts → Silberschatz
(2, 1),
-- Introduction to Algorithms → Cormen
(3, 6),
-- Computer Networks → Tanenbaum
(4, 4),
-- The C Programming Language → Knuth (placeholder)
(5, 5),
-- Learning Python → Sedgewick (placeholder)
(6, 7),
-- Java: The Complete Reference → Gosling
(7, 8),
-- Discrete Mathematics → Knuth
(8, 5);


-- ------------------------------------------------------------
-- book_categories  (book ↔ category)
-- ------------------------------------------------------------
INSERT IGNORE INTO book_categories (book_id, category_id) VALUES
(1, 1),  -- Database System Concepts      → Computer Science
(2, 1),  -- Operating System Concepts     → Computer Science
(3, 1),  -- Introduction to Algorithms    → Computer Science
(3, 2),  -- Introduction to Algorithms    → Mathematics
(4, 1),  -- Computer Networks             → Computer Science
(4, 4),  -- Computer Networks             → Engineering
(5, 1),  -- The C Programming Language    → Computer Science
(6, 1),  -- Learning Python               → Computer Science
(7, 1),  -- Java: The Complete Reference  → Computer Science
(8, 1),  -- Discrete Mathematics          → Computer Science
(8, 2);  -- Discrete Mathematics          → Mathematics


-- ------------------------------------------------------------
-- Courses  (schema: course_id, course_code, course_name, department)
-- ------------------------------------------------------------
INSERT IGNORE INTO courses (course_id, course_code, course_name, department) VALUES
(1, 'CS301', 'Database Management Systems',  'Computer Science'),
(2, 'CS201', 'Operating Systems',            'Computer Science'),
(3, 'CS101', 'Introduction to Programming',  'Computer Science'),
(4, 'CS401', 'Computer Networks',            'Computer Science'),
(5, 'MA201', 'Discrete Mathematics',         'Mathematics');


-- ------------------------------------------------------------
-- course_books  (schema: course_id, book_id, suggestion_type)
-- ------------------------------------------------------------
INSERT IGNORE INTO course_books (course_id, book_id, suggestion_type) VALUES
-- CS301 — DBMS
(1, 1, 'primary'),    -- Database System Concepts
(1, 3, 'reference'),  -- Introduction to Algorithms (supplementary)
-- CS201 — Operating Systems
(2, 2, 'primary'),    -- Operating System Concepts
(2, 4, 'reference'),  -- Computer Networks (supplementary)
-- CS101 — Intro to Programming
(3, 5, 'primary'),    -- The C Programming Language
(3, 6, 'reference'),  -- Learning Python
(3, 7, 'reference'),  -- Java: The Complete Reference
-- CS401 — Computer Networks
(4, 4, 'primary'),    -- Computer Networks
(4, 2, 'reference'),  -- Operating System Concepts (supplementary)
-- MA201 — Discrete Mathematics
(5, 8, 'primary'),    -- Discrete Mathematics
(5, 3, 'reference');  -- Introduction to Algorithms


-- ------------------------------------------------------------
-- book_items  (physical copies)
-- barcode_id, book_id, shelf_slot, acquisition_date, status,
-- floor_number, rack_code, condition_status
-- ------------------------------------------------------------
INSERT IGNORE INTO book_items
    (barcode_id, book_id, shelf_slot, acquisition_date, status, floor_number, rack_code, condition_status)
VALUES
-- Book 1: Database System Concepts
('BC-001', 1, 'CS-A-01', '2023-01-10', 'available', 2, 'CS-A', 'Good'),
('BC-002', 1, 'CS-A-02', '2023-01-10', 'available', 2, 'CS-A', 'Good'),
('BC-003', 1, 'CS-A-03', '2023-06-15', 'available', 2, 'CS-A', 'Good'),

-- Book 2: Operating System Concepts
('BC-004', 2, 'CS-A-04', '2023-01-10', 'available', 2, 'CS-A', 'Good'),
('BC-005', 2, 'CS-A-05', '2023-01-10', 'available', 2, 'CS-A', 'Good'),
('BC-006', 2, 'CS-A-06', '2023-06-15', 'available', 2, 'CS-A', 'Damaged'),

-- Book 3: Introduction to Algorithms
('BC-007', 3, 'CS-A-07', '2023-02-20', 'available', 2, 'CS-A', 'Good'),
('BC-008', 3, 'CS-A-08', '2023-02-20', 'available', 2, 'CS-A', 'Good'),
('BC-009', 3, 'CS-A-09', '2024-01-05', 'available', 2, 'CS-A', 'Good'),

-- Book 4: Computer Networks
('BC-010', 4, 'CS-A-10', '2022-07-01', 'available', 2, 'CS-A', 'Good'),
('BC-011', 4, 'CS-A-11', '2022-07-01', 'available', 2, 'CS-A', 'Good'),

-- Book 5: The C Programming Language
('BC-012', 5, 'CS-A-12', '2021-09-01', 'available', 2, 'CS-A', 'Good'),
('BC-013', 5, 'CS-A-13', '2021-09-01', 'available', 2, 'CS-A', 'Damaged'),

-- Book 6: Learning Python
('BC-014', 6, 'CS-A-14', '2023-03-15', 'available', 2, 'CS-A', 'Good'),
('BC-015', 6, 'CS-A-15', '2023-03-15', 'available', 2, 'CS-A', 'Good'),
('BC-016', 6, 'CS-A-16', '2024-02-10', 'available', 2, 'CS-A', 'Good'),

-- Book 7: Java: The Complete Reference
('BC-017', 7, 'CS-A-17', '2023-08-20', 'available', 2, 'CS-A', 'Good'),
('BC-018', 7, 'CS-A-18', '2023-08-20', 'available', 2, 'CS-A', 'Good'),
('BC-019', 7, 'CS-A-19', '2024-01-15', 'available', 2, 'CS-A', 'Good'),

-- Book 8: Discrete Mathematics
('BC-020', 8, 'MA-B-01', '2022-05-10', 'available', 1, 'MA-B', 'Good'),
('BC-021', 8, 'MA-B-02', '2022-05-10', 'available', 1, 'MA-B', 'Good');


-- ------------------------------------------------------------
-- Users  (schema: user_id, role_id, first_name, last_name, email, password_hash, phone)
-- role_id: 1=admin, 2=teacher, 3=student
-- ------------------------------------------------------------
INSERT IGNORE INTO users (user_id, role_id, first_name, last_name, email, password_hash, phone) VALUES
(1, 3, 'Test',      'Student',   'student@college.edu',   'password123',  '9876543210'),
(2, 1, 'Admin',     'User',      'admin@college.edu',     'admin123',     '9876543211'),
(4, 2, 'Prof',      'Sharma',    'teacher@college.edu',   'teacher123',   '9876543213'),
(5, 3, 'Priya',     'Patel',     'priya@college.edu',     'student456',   '9876543214');


-- ------------------------------------------------------------
-- Book requests (seed)
-- (request_id, user_id, book_title, author_name, isbn, status)
-- ------------------------------------------------------------
INSERT IGNORE INTO book_requests (request_id, user_id, book_title, author_name, status) VALUES
(1, 1, 'Clean Code',               'Robert Martin', 'pending'),
(2, 5, 'The Pragmatic Programmer', 'David Thomas',  'pending'),
(3, 1, 'Design Patterns',          'Gang of Four',  'pending');


-- ------------------------------------------------------------
-- Request upvotes (seed)
-- ------------------------------------------------------------
INSERT IGNORE INTO request_upvotes (request_id, user_id) VALUES
(1, 5),
(1, 4),
(2, 1),
(2, 4),
(3, 5);


-- ============================================================
-- END OF MIGRATION
-- ============================================================
