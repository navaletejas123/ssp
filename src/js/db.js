const Database = require('better-sqlite3');
const path = require('node:path');
const { app } = require('electron');

let db;

function setupDatabase() {
    // Store database in the app's userData directory so it persists after building the app
    const dbPath = path.join(app.getPath('userData'), 'spa_manager.db');
    console.log('Database path:', dbPath);
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables if they don't exist
    setupTables();

    return db;
}

function setupTables() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS Customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      vip_status INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0.0,
      total_visits INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Therapists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_customers_handled INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0.0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS Visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      visit_date DATE NOT NULL,
      package_name TEXT NOT NULL,
      package_price REAL NOT NULL,
      paid_amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- Cash, Online, Card, UPI
      transaction_id TEXT,
      payment_app TEXT,
      therapist_id INTEGER,
      extra_services TEXT,
      extra_amount REAL DEFAULT 0.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES Customers(id),
      FOREIGN KEY (therapist_id) REFERENCES Therapists(id)
    );

    CREATE TABLE IF NOT EXISTS Enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      enquiry_date DATE NOT NULL,
      counselor_name TEXT NOT NULL,
      source TEXT NOT NULL, -- Walk-in, Phone, WhatsApp, etc.
      service_interested TEXT,
      description TEXT,
      follow_up_date DATE,
      status TEXT DEFAULT 'New', -- New, Follow-up Pending, Converted, Closed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CallRecords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER, -- Optional, if linked to a known customer/enquiry
      customer_name TEXT,
      phone TEXT NOT NULL,
      call_date DATE NOT NULL,
      counselor_name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      notes TEXT,
      next_follow_up DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date DATE NOT NULL,
      category TEXT NOT NULL, -- Staff salary, Oil / products, Rent, Utilities
      amount REAL NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Insert some default therapists if empty
    const therapistCount = db.prepare('SELECT COUNT(*) as count FROM Therapists').get();
    if (therapistCount.count === 0) {
        const insertTherapist = db.prepare('INSERT INTO Therapists (name) VALUES (?)');
        insertTherapist.run('Alice Johnson');
        insertTherapist.run('Bob Smith');
        insertTherapist.run('Clara Davis');
    }
}

module.exports = setupDatabase;
