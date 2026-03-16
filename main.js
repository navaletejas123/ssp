const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const setupDatabase = require('./src/js/db');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true, // Hide menu for a cleaner app feel
  });

  mainWindow.loadFile('index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  db = setupDatabase();

  // Run migrations (add new columns if missing)
  try { db.exec(`ALTER TABLE CallRecords ADD COLUMN status TEXT DEFAULT 'Pending'`); } catch (e) { }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler for DB operations
ipcMain.handle('get-dashboard-stats', (event, filter) => {
  // filter can be 'today', 'yesterday', 'weekly', 'monthly', 'yearly', 'all'
  let dateFilter = '';
  const now = new Date();
  let startDate = '';

  if (filter === 'today') {
    startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString().split('T')[0];
    dateFilter = `WHERE date(visit_date) = '${startDate}'`;
  } else if (filter === 'weekly') {
    const first = now.getDate() - now.getDay();
    startDate = new Date(now.setDate(first)).toISOString().split('T')[0];
    dateFilter = `WHERE date(visit_date) >= '${startDate}'`;
  } else if (filter === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    dateFilter = `WHERE date(visit_date) >= '${startDate}'`;
  } // More filters can be added

  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT customer_id) as totalCustomers,
      SUM(paid_amount) as revenue
    FROM Visits
    ${dateFilter}
  `).get();

  return {
    totalCustomers: stats.totalCustomers || 0,
    revenue: stats.revenue || 0,
    avgSpending: stats.totalCustomers ? (stats.revenue / stats.totalCustomers).toFixed(2) : 0
  };
});

ipcMain.handle('get-therapist-stats', (event, filter) => {
  // Similar filter logic can be applied if needed
  return db.prepare(`
    SELECT t.name, COUNT(v.id) as customers_handled, SUM(v.paid_amount) as revenue
    FROM Therapists t
    LEFT JOIN Visits v ON t.id = v.therapist_id
    GROUP BY t.id
    ORDER BY revenue DESC
  `).all();
});

ipcMain.handle('get-top-customers', () => {
  return db.prepare(`
    SELECT name, phone, COUNT(Visits.id) as visits, SUM(paid_amount) as total_spent, vip_status
    FROM Visits
    JOIN Customers ON Visits.customer_id = Customers.id
    WHERE phone NOT LIKE 'GUEST-%'
    GROUP BY customer_id
    ORDER BY total_spent DESC
    LIMIT 5
  `).all();
});

ipcMain.handle('add-visit', (event, visitData) => {
  let { phone, name, date, therapistId, pkg, price, extra, extraPrice, paid, method, appName, txn, notes } = visitData;

  if (!phone || phone.trim() === '') {
    phone = 'GUEST-' + Date.now() + Math.floor(Math.random() * 1000);
  }
  if (!name || name.trim() === '') {
    name = 'Walk-in';
  }

  const transaction = db.transaction(() => {
    // 1. Check or create customer
    let customer = db.prepare('SELECT id, total_spent, total_visits FROM Customers WHERE phone = ?').get(phone);
    let customerId;

    if (customer) {
      customerId = customer.id;
      db.prepare('UPDATE Customers SET total_spent = total_spent + ?, total_visits = total_visits + 1 WHERE id = ?')
        .run(parseFloat(paid), customerId);
    } else {
      const res = db.prepare('INSERT INTO Customers (name, phone, total_spent, total_visits) VALUES (?, ?, ?, 1)')
        .run(name, phone, parseFloat(paid));
      customerId = res.lastInsertRowid;
    }

    // 2. Add Visit Record
    // therapistId is ignored for foreign key if not integer, we store it as text in notes or as a new column, or if it's a name, we can look it up or create it.
    // wait, the Therapist foreign key expects an integer ID. If user types standard text, we should try to match it or insert it.
    let finalTherapistId = null;
    if (therapistId && therapistId.trim() !== '') {
      const match = db.prepare('SELECT id FROM Therapists WHERE name LIKE ?').get(therapistId.trim());
      if (match) {
        finalTherapistId = match.id;
      } else {
        const res = db.prepare('INSERT INTO Therapists (name) VALUES (?)').run(therapistId.trim());
        finalTherapistId = res.lastInsertRowid;
      }
    }

    db.prepare(`
      INSERT INTO Visits (customer_id, visit_date, package_name, package_price, paid_amount, payment_method, transaction_id, payment_app, therapist_id, extra_services, extra_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, date, pkg, parseFloat(price), parseFloat(paid), method, txn || null, appName || null, finalTherapistId, extra || null, parseFloat(extraPrice) || 0, notes || null);

    // 3. Update Therapist stats
    if (finalTherapistId) {
      db.prepare('UPDATE Therapists SET total_customers_handled = total_customers_handled + 1, total_revenue = total_revenue + ? WHERE id = ?')
        .run(parseFloat(paid), finalTherapistId);
    }
  });

  try {
    transaction();
    return { success: true };
  } catch (err) {
    console.error("Error saving visit:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-therapists', () => {
  return db.prepare('SELECT id, name FROM Therapists WHERE is_active = 1').all();
});

ipcMain.handle('search-customers-live', (event, query) => {
  const likeQuery = `%${query}%`;
  return db.prepare(`
    SELECT id, name, phone, vip_status
    FROM Customers
    WHERE (name LIKE ? OR phone LIKE ?) AND phone NOT LIKE 'GUEST-%'
    LIMIT 10
  `).all(likeQuery, likeQuery);
});

ipcMain.handle('export-all-customers', () => {
  return db.prepare(`
    SELECT name, phone
    FROM Customers
    WHERE phone NOT LIKE 'GUEST-%'
    GROUP BY phone
    ORDER BY name ASC
  `).all();
});

ipcMain.handle('get-visits', (event, page = 1, limit = 10, searchQuery = '') => {
  const offset = (page - 1) * limit;
  let countQuery = 'SELECT COUNT(*) as total FROM Visits v JOIN Customers c ON v.customer_id = c.id';
  let dataQuery = `
    SELECT v.id, v.visit_date, c.name as customer_name, c.phone as phone, v.package_name, v.paid_amount, v.therapist_id, v.payment_method, v.transaction_id, v.payment_app, v.extra_services, v.extra_amount, v.notes, t.name as therapist_name, c.id as customer_id
    FROM Visits v
    JOIN Customers c ON v.customer_id = c.id
    LEFT JOIN Therapists t ON v.therapist_id = t.id
  `;
  const params = [];

  if (searchQuery) {
    const likeQuery = `%${searchQuery}%`;
    const searchCondition = " WHERE (c.name LIKE ? OR c.phone LIKE ?)";
    countQuery += searchCondition;
    dataQuery += searchCondition;
    params.push(likeQuery, likeQuery);
  }

  // Get total count
  const countRes = db.prepare(countQuery).get(...params);
  const totalCount = countRes.total;

  dataQuery += ' ORDER BY v.visit_date DESC, v.id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(dataQuery).all(...params);

  return { rows, totalCount };
});

ipcMain.handle('delete-visit', (event, id) => {
  try {
    const visit = db.prepare('SELECT customer_id, therapist_id, paid_amount FROM Visits WHERE id = ?').get(id);
    if (!visit) return { success: false, error: 'Visit not found' };

    const transaction = db.transaction(() => {
      // Revert customer stats
      db.prepare('UPDATE Customers SET total_spent = total_spent - ?, total_visits = total_visits - 1 WHERE id = ?')
        .run(visit.paid_amount, visit.customer_id);

      // Revert therapist stats
      if (visit.therapist_id) {
        db.prepare('UPDATE Therapists SET total_customers_handled = total_customers_handled - 1, total_revenue = total_revenue - ? WHERE id = ?')
          .run(visit.paid_amount, visit.therapist_id);
      }

      // Delete visit
      db.prepare('DELETE FROM Visits WHERE id = ?').run(id);
    });

    transaction();
    return { success: true };
  } catch (err) {
    console.error("Error deleting visit:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-visit', (event, visitData) => {
  const { id, date, therapistId, pkg, price, extra, extraPrice, paid, method, appName, txn, notes } = visitData;

  try {
    const transaction = db.transaction(() => {
      // Fetch old visit details to calculate diff and handle therapist change
      const oldVisit = db.prepare('SELECT customer_id, therapist_id, paid_amount FROM Visits WHERE id = ?').get(id);

      let finalTherapistId = null;
      if (therapistId && therapistId.trim() !== '') {
        const match = db.prepare('SELECT id FROM Therapists WHERE name LIKE ?').get(therapistId.trim());
        if (match) {
          finalTherapistId = match.id;
        } else {
          const res = db.prepare('INSERT INTO Therapists (name) VALUES (?)').run(therapistId.trim());
          finalTherapistId = res.lastInsertRowid;
        }
      }

      db.prepare(`
        UPDATE Visits 
        SET visit_date = ?, package_name = ?, package_price = ?, paid_amount = ?, payment_method = ?, transaction_id = ?, payment_app = ?, extra_services = ?, extra_amount = ?, notes = ?, therapist_id = ?
        WHERE id = ?
      `).run(date, pkg, parseFloat(price), parseFloat(paid), method, txn || null, appName || null, extra || null, parseFloat(extraPrice) || 0, notes || null, finalTherapistId, id);

      if (oldVisit) {
        const diff = parseFloat(paid) - oldVisit.paid_amount;

        // Update customer total_spent
        if (diff !== 0) {
          db.prepare('UPDATE Customers SET total_spent = total_spent + ? WHERE id = ?').run(diff, oldVisit.customer_id);
        }

        // Update therapist stats
        if (oldVisit.therapist_id === finalTherapistId) {
          if (diff !== 0 && finalTherapistId) {
            db.prepare('UPDATE Therapists SET total_revenue = total_revenue + ? WHERE id = ?').run(diff, finalTherapistId);
          }
        } else {
          // Revert old therapist stats
          if (oldVisit.therapist_id) {
            db.prepare('UPDATE Therapists SET total_customers_handled = total_customers_handled - 1, total_revenue = total_revenue - ? WHERE id = ?').run(oldVisit.paid_amount, oldVisit.therapist_id);
          }
          // Apply new therapist stats
          if (finalTherapistId) {
            db.prepare('UPDATE Therapists SET total_customers_handled = total_customers_handled + 1, total_revenue = total_revenue + ? WHERE id = ?').run(parseFloat(paid), finalTherapistId);
          }
        }
      }
    });
    transaction();
    return { success: true };
  } catch (err) {
    console.error("Error updating visit:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-customer-details', (event, id) => {
  const customer = db.prepare('SELECT * FROM Customers WHERE id = ?').get(id);
  const visits = db.prepare(`
    SELECT v.*, t.name as therapist_name
    FROM Visits v
    LEFT JOIN Therapists t ON v.therapist_id = t.id
    WHERE v.customer_id = ?
    ORDER BY v.visit_date DESC
  `).all(id);
  return { customer, visits };
});

ipcMain.handle('merge-customers', (event, primaryId, targetId) => {
  try {
    const transaction = db.transaction(() => {
      // 1. Get both customers
      const primary = db.prepare('SELECT id, name, phone, total_spent, total_visits FROM Customers WHERE id = ?').get(primaryId);
      const target = db.prepare('SELECT id, name, phone, total_spent, total_visits FROM Customers WHERE id = ?').get(targetId);

      if (!primary || !target) throw new Error("One or both customers not found.");

      // 2. Transfer Visits
      db.prepare('UPDATE Visits SET customer_id = ? WHERE customer_id = ?').run(primaryId, targetId);

      // 3. Transfer Call Records (based on exact name/phone matching if needed, or if customer_id is used. The schema has customer_name/phone mainly, we can just update those)
      db.prepare('UPDATE CallRecords SET customer_name = ?, phone = ? WHERE phone = ?').run(primary.name, primary.phone, target.phone);

      // 4. Transfer Enquiries
      db.prepare('UPDATE Enquiries SET customer_name = ?, phone = ? WHERE phone = ?').run(primary.name, primary.phone, target.phone);

      // 5. Update Primary Customer Stats
      db.prepare('UPDATE Customers SET total_spent = total_spent + ?, total_visits = total_visits + ? WHERE id = ?')
        .run(target.total_spent, target.total_visits, primaryId);

      // 6. Delete Target Customer
      db.prepare('DELETE FROM Customers WHERE id = ?').run(targetId);
    });

    transaction();
    return { success: true };
  } catch (err) {
    console.error("Error merging customers:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-enquiries', (event, page = 1, limit = 10, searchQuery = '') => {
  const offset = (page - 1) * limit;
  let countQuery = 'SELECT COUNT(*) as total FROM Enquiries';
  let dataQuery = 'SELECT * FROM Enquiries';
  const params = [];

  if (searchQuery) {
    const likeQuery = `%${searchQuery}%`;
    const searchCondition = " WHERE (customer_name LIKE ? OR phone LIKE ?)";
    countQuery += searchCondition;
    dataQuery += searchCondition;
    params.push(likeQuery, likeQuery);
  }

  const countRes = db.prepare(countQuery).get(...params);
  const totalCount = countRes.total;

  dataQuery += ' ORDER BY enquiry_date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(dataQuery).all(...params);

  return { rows, totalCount };
});

ipcMain.handle('add-enquiry', (event, data) => {
  const { name, phone, date, followup, counselor, source, service, desc } = data;
  try {
    let finalPhone = phone;
    let finalName = name;

    if (!finalPhone || finalPhone.trim() === '') {
      finalPhone = `GUEST-${Date.now()}`;
      finalName = finalName && finalName.trim() !== '' ? finalName.trim() : 'Walk-in';
    }

    db.prepare(`
      INSERT INTO Enquiries (customer_name, phone, enquiry_date, counselor_name, source, service_interested, description, follow_up_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(finalName || 'Walk-in', finalPhone, date, counselor, source || 'Walk-in', service || null, desc || null, followup || null);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-enquiry', (event, data) => {
  const { id, name, phone, date, followup, counselor, source, service, desc, status } = data;
  try {
    let finalPhone = phone;
    let finalName = name;

    if (!finalPhone || finalPhone.trim() === '') {
      finalPhone = `GUEST-${Date.now()}`;
      finalName = finalName && finalName.trim() !== '' ? finalName.trim() : 'Walk-in';
    }

    db.prepare(`
      UPDATE Enquiries
      SET customer_name = ?, phone = ?, enquiry_date = ?, counselor_name = ?, 
          source = ?, service_interested = ?, description = ?, follow_up_date = ?, status = ?
      WHERE id = ?
    `).run(
      finalName || 'Walk-in', finalPhone, date, counselor, source || 'Walk-in',
      service || null, desc || null, followup || null, status || 'New', id
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-enquiry', (event, id) => {
  try {
    db.prepare('DELETE FROM Enquiries WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-calls', (event, page = 1, limit = 10, searchQuery = '', statusFilter = '') => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (searchQuery) {
    conditions.push('(customer_name LIKE ? OR phone LIKE ?)');
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (statusFilter) {
    conditions.push('status = ?');
    params.push(statusFilter);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countRes = db.prepare(`SELECT COUNT(*) as total FROM CallRecords${where}`).get(...params);
  const totalCount = countRes.total;

  const rows = db.prepare(
    `SELECT id, customer_name, phone, call_date, counselor_name, purpose, status, notes, next_follow_up
     FROM CallRecords${where} ORDER BY call_date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { rows, totalCount };
});

ipcMain.handle('add-call', (event, data) => {
  const { name, phone, date, counselor, purpose, status, follow, notes } = data;
  try {
    db.prepare(`
      INSERT INTO CallRecords (customer_name, phone, call_date, counselor_name, purpose, status, notes, next_follow_up)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone, date, counselor, purpose, status || 'Pending', notes || null, follow || null);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-call', (event, data) => {
  const { id, name, phone, date, counselor, purpose, status, follow, notes } = data;
  try {
    db.prepare(`
      UPDATE CallRecords
      SET customer_name = ?, phone = ?, call_date = ?, counselor_name = ?, purpose = ?, status = ?, notes = ?, next_follow_up = ?
      WHERE id = ?
    `).run(name, phone, date, counselor, purpose, status || 'Pending', notes || null, follow || null, id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-call', (event, id) => {
  try {
    db.prepare('DELETE FROM CallRecords WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-expenses', (event, page = 1, limit = 10, searchQuery = '') => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (searchQuery) {
    conditions.push('(category LIKE ? OR remarks LIKE ?)');
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countRes = db.prepare(`SELECT COUNT(*) as total FROM Expenses${where}`).get(...params);
  const totalCount = countRes.total;

  const rows = db.prepare(
    `SELECT id, expense_date, category, amount, remarks
     FROM Expenses${where} ORDER BY expense_date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { rows, totalCount };
});

ipcMain.handle('add-expense', (event, data) => {
  const { date, category, amount, remarks } = data;
  try {
    db.prepare(`
      INSERT INTO Expenses (expense_date, category, amount, remarks)
      VALUES (?, ?, ?, ?)
    `).run(date, category, amount, remarks || null);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-expense', (event, data) => {
  const { id, date, category, amount, remarks } = data;
  try {
    db.prepare(`
      UPDATE Expenses SET expense_date = ?, category = ?, amount = ?, remarks = ?
      WHERE id = ?
    `).run(date, category, parseFloat(amount), remarks || null, id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-expense', (event, id) => {
  try {
    db.prepare('DELETE FROM Expenses WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-expense-summary', () => {
  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().split('T')[0];

  const total = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM Expenses').get();
  const monthly = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM Expenses WHERE expense_date >= ?').get(monthStart);
  const byCategory = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM Expenses
    WHERE expense_date >= ?
    GROUP BY category
    ORDER BY total DESC
  `).all(monthStart);

  return {
    totalExpenses: total.total,
    monthlyExpenses: monthly.total,
    categoryBreakdown: byCategory
  };
});

// ========= DASHBOARD CHART DATA =========

ipcMain.handle('get-revenue-trend', () => {
  // Get last 6 months of revenue data
  const rows = db.prepare(`
    SELECT 
      strftime('%Y-%m', visit_date) AS month,
      SUM(paid_amount) AS revenue,
      COUNT(*) AS visit_count
    FROM Visits
    WHERE visit_date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC
  `).all();

  // Fill in missing months with 0
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7); // YYYY-MM
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const found = rows.find(r => r.month === key);
    result.push({
      label,
      revenue: found ? found.revenue : 0,
      visits: found ? found.visit_count : 0
    });
  }
  return result;
});

ipcMain.handle('get-service-breakdown', () => {
  return db.prepare(`
    SELECT 
      package_name AS service,
      SUM(paid_amount) AS revenue,
      COUNT(*) AS count
    FROM Visits
    GROUP BY package_name
    ORDER BY revenue DESC
    LIMIT 6
  `).all();
});

ipcMain.handle('get-payment-breakdown', () => {
  return db.prepare(`
    SELECT 
      payment_method AS method,
      COUNT(*) AS count,
      SUM(paid_amount) AS revenue
    FROM Visits
    GROUP BY payment_method
    ORDER BY revenue DESC
  `).all();
});

ipcMain.handle('get-expense-revenue-comparison', () => {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 7);

    const rev = db.prepare(`SELECT COALESCE(SUM(paid_amount), 0) as total FROM Visits WHERE strftime('%Y-%m', visit_date) = ?`).get(key);
    const exp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM Expenses WHERE strftime('%Y-%m', expense_date) = ?`).get(key);

    result.push({
      label,
      revenue: rev.total,
      expense: exp.total,
      profit: rev.total - exp.total
    });
  }
  return result;
});

ipcMain.handle('get-daily-visits', () => {
  return db.prepare(`
    SELECT 
      visit_date AS date,
      COUNT(*) AS visits,
      SUM(paid_amount) AS revenue
    FROM Visits
    WHERE visit_date >= date('now', '-30 days')
    GROUP BY visit_date
    ORDER BY visit_date ASC
  `).all();
});

// ========= SMART RECALL QUERIES =========

// Inactive customers based on last visit (used for "Last Visits" 30/60/90+)
ipcMain.handle('get-smart-recall', (event, days = 30) => {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const cutoff = now.toISOString().split('T')[0]; // YYYY-MM-DD

  return db.prepare(`
    SELECT 
      c.id, 
      c.name, 
      c.phone, 
      c.total_visits, 
      c.total_spent, 
      MAX(v.visit_date) AS last_visit
    FROM Customers c
    JOIN Visits v ON c.id = v.customer_id
    WHERE c.phone NOT LIKE 'GUEST-%'
    GROUP BY c.id
    HAVING last_visit <= ?
       AND c.phone NOT IN (SELECT phone FROM CallRecords WHERE call_date > ?)
    ORDER BY last_visit ASC
  `).all(cutoff, cutoff);
});

// Customers with follow-up calls pending / not responded to (follow-up date is today or past)
ipcMain.handle('get-smart-recall-calls', (event, days = 30) => {
  const today = new Date().toISOString().split('T')[0];

  return db.prepare(`
    SELECT 
      customer_name,
      phone,
      MAX(call_date)       AS last_call,
      MAX(next_follow_up)  AS last_follow_up,
      COUNT(*)             AS total_calls
    FROM CallRecords
    WHERE phone NOT LIKE 'GUEST-%'
      AND (status = 'Pending' OR status = 'No Response')
    GROUP BY phone
    HAVING (last_follow_up IS NULL OR last_follow_up <= ?)
    ORDER BY COALESCE(last_follow_up, last_call) ASC
  `).all(today);
});

// Call history for a specific customer (by phone)
ipcMain.handle('get-customer-calls', (event, phone) => {
  if (!phone) return [];
  return db.prepare(`
    SELECT id, call_date, counselor_name, purpose, status, notes, next_follow_up
    FROM CallRecords
    WHERE phone = ?
    ORDER BY call_date DESC, id DESC
  `).all(phone);
});

// Customers with enquiries that are still open / need follow-up since N days
ipcMain.handle('get-smart-recall-enquiries', (event, days = 30) => {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const cutoff = now.toISOString().split('T')[0];

  return db.prepare(`
    SELECT 
      customer_name,
      phone,
      MAX(enquiry_date)    AS last_enquiry,
      MAX(follow_up_date)  AS last_follow_up,
      COUNT(*)             AS total_enquiries
    FROM Enquiries
    WHERE phone NOT LIKE 'GUEST-%'
      AND (status = 'New' OR status = 'Follow-up Pending')
    GROUP BY phone
    HAVING COALESCE(last_follow_up, last_enquiry) <= ?
       AND phone NOT IN (SELECT phone FROM CallRecords WHERE call_date > ?)
    ORDER BY last_enquiry ASC
  `).all(cutoff, cutoff);
});


