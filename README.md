# Library Management System (DBMS Lab Project)

A full-stack, copy-level Library Management System built with **React + TailwindCSS**, **Node.js + Express**, and **MySQL**, strictly following relational normalization and real-world circulation workflows.

---

## 🚀 Key Highlights & Novelty

1. **Individual Physical Copy & Barcode Tracking:**
   - Tracks each physical copy (`book_items`) with unique `barcode_id`, physical condition (`Good`, `Damaged`, `Lost`), floor number, and rack/shelf slot (`shelf_slot`).
2. **Automated 48-Hour Waitlist Queue (Reservations):**
   - When all copies of a book are borrowed, users join a queue.
   - Returning a book copy automatically transitions the top waitlisted member to `held` status.
3. **Role-Based Circulation Policies:**
   - Students: 3 books max, 14-day duration, ₹5.00/day late fine.
   - Teachers: 10 books max, 30-day duration, ₹0.00/day fine.
   - Overdue fines are calculated automatically upon return (`days_overdue × fine_rate_per_day`).
4. **Course-Based Book Discovery:**
   - Search by course code (e.g. `CS301`, `CS201`, `MA201`) to view primary and reference textbooks mapped to that curriculum.
5. **Community Book Requests & Upvoting:**
   - Students request new books; peers and faculty upvote them.
   - Admin acquisitions dashboard ranks requests by popularity.
6. **Complete Financial & Audit History:**
   - Detailed ledger of assessed fines, receipts, payment methods (Cash, UPI, Card), and admin waiver logs.

---

## 👥 Demo Accounts (Pre-seeded in DB)

| Role | Email | Password | Allowed Books | Duration | Late Fee Rate |
|---|---|---|---|---|---|
| **Student** | `student@college.edu` | `password123` | 3 books | 14 days | ₹5.00 / day |
| **Student** | `priya@college.edu` | `student456` | 3 books | 14 days | ₹5.00 / day |
| **Faculty (Teacher)** | `teacher@college.edu` | `teacher123` | 10 books | 30 days | ₹0.00 / day |
| **Admin** | `admin@college.edu` | `admin123` | N/A | N/A | Full Administrative Access |

> *Tip: On the login page, you can click any of the 3 demo profile buttons at the bottom to fill credentials in 1 click!*

---

## 🛠️ How to Run

### Step 1: Initialize Database (MySQL)

1. Make sure your MySQL service is running (e.g., MySQL 8.0, XAMPP, or Workbench).
2. If your MySQL `root` user has a password, open `library-backend/config.json` and set your password:
   ```json
   {
     "host": "localhost",
     "user": "root",
     "password": "YOUR_MYSQL_PASSWORD",
     "database": "library_db",
     "port": 3306
   }
   ```
3. Run the automated database setup script:
   ```bash
   cd library-backend
   npm run setup-db
   ```
   *(This creates `library_db`, all 16 relational tables from `schema.sql`, and seeds books, copies, courses, users, and requests from `migrate.sql`.)*

---

### Step 2: Start the Backend API

In the `library-backend` folder:
```bash
npm start
```
Server runs on: **`http://localhost:3000`**

---

### Step 3: Start the Frontend UI

Open a new terminal in the `library-frontend` folder:
```bash
npm run dev
```
Open your browser at: **`http://localhost:5173`** (or the URL shown in Vite).

---

## 📁 System Architecture & Modules

### 1. User & Student/Teacher View
- **Dashboard (`/dashboard`):** Active loans with overdue indicators, reservation queue status, and pending fee breakdown.
- **Catalog & Waitlist (`/catalog`):** Category browsing, real-time physical copy count, direct borrow, or automatic queue placement.
- **Course Discovery (`/courses`):** Search by syllabus course code (`CS301`, `CS101`, `MA201`) to view recommended textbooks.
- **Book Requests (`/requests`):** Submit purchase suggestions and upvote existing requests.
- **Financial History (`/fines`):** Full transaction log with inline self-service payment recording.

### 2. Admin & Librarian View
- **Admin Hub (`/admin`):** High-level KPI metrics (active checkouts, overdue count, uncollected fines, pending requests).
- **Circulation Desk (`/admin/circulation`):** Rapid scanner interface for issuing and returning physical copies by `barcode_id`.
- **Inventory Manager (`/admin/inventory`):** Catalog new titles and register barcode items with shelf, floor, and condition tracking.
- **User & Role Admin (`/admin/users`):** Manage accounts and dynamically adjust role assignments.
- **Acquisitions (`/admin/acquisitions`):** Review community requests sorted by upvote tally with approve/reject actions.
- **Fines & Overrides (`/admin/fines`):** Financial audit log, payment confirmation, and administrative waivers.
