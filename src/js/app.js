// Basic UI interactions
document.addEventListener('DOMContentLoaded', () => {
    // Set current date
    const now = new Date();
    document.getElementById('current-date-time').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Set default date for visit form today
    if (document.getElementById('v-date')) {
        document.getElementById('v-date').valueAsDate = new Date();
    }

    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');
    const pageTitle = document.getElementById('page-title');

    // Populate therapists
    // (Therapists is now an input text, no need to populate dropdown)

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Update active state
            navItems.forEach(n => {
                n.classList.remove('active', 'bg-primary-800', 'text-white', 'border-l-4', 'border-primary-400');
                n.classList.add('text-primary-100');
            });
            item.classList.add('active', 'bg-primary-800', 'text-white', 'border-l-4', 'border-primary-400');
            item.classList.remove('text-primary-100');

            // Update Title
            pageTitle.textContent = item.querySelector('span').textContent;

            // Switch View
            const target = item.getAttribute('data-target');
            pageViews.forEach(view => {
                if (view.id === 'view-' + target) {
                    view.classList.remove('hidden');
                    if (target === 'dashboard') initDashboard(document.getElementById('dash-filter')?.value || 'all');
                    if (target === 'visit-entry') loadRecentVisits();
                    if (target === 'enquiries') loadEnquiries();
                    if (target === 'calls') loadCalls();
                    if (target === 'expenses') loadExpenses();
                    if (target === 'smart-recall') {
                        // Load all smart recall sources when entering the view
                        reloadAllSmartRecallSources();
                        setSmartRecallTab('visits');
                    }
                    if (target === 'customer-history') {
                        document.getElementById('ch-search').value = '';
                        document.getElementById('ch-results-list').innerHTML = '<p class="text-sm text-gray-500 italic">Enter a search query...</p>';
                        document.getElementById('ch-details-panel').classList.add('hidden');
                    }
                } else {
                    view.classList.add('hidden');
                }
            });
        });
    });

    // Initially show dashboard active state visual
    const dashItem = document.querySelector('[data-target="dashboard"]');
    if (dashItem) {
        dashItem.classList.add('active', 'bg-primary-800', 'text-white', 'border-l-4', 'border-primary-400');
        dashItem.classList.remove('text-primary-100');
    }

    // Initialize Dashboard data
    initDashboard('all');
});

let therapistChartInstance = null;
let revenueChartInstance = null;
let serviceChartInstance = null;
let paymentChartInstance = null;
let expenseRevenueChartInstance = null;
let dailyVisitsChartInstance = null;

async function initDashboard(filter) {
    try {
        if (!window.api) return; // For browser testing fallback

        // 1. Stats Cards
        const stats = await window.api.getDashboardStats(filter);
        document.getElementById('dash-customers').textContent = stats.totalCustomers.toLocaleString();
        document.getElementById('dash-revenue').textContent = `₹${stats.revenue.toLocaleString()}`;
        document.getElementById('dash-avg').textContent = `₹${Number(stats.avgSpending).toLocaleString()}`;

        // 2. Revenue Trend Chart (bar + line combo)
        const trendData = await window.api.getRevenueTrend();
        renderRevenueChart(trendData);

        // 3. Service Breakdown Doughnut
        const serviceData = await window.api.getServiceBreakdown();
        renderServiceChart(serviceData);

        // 4. Top Customers
        const topCustomers = await window.api.getTopCustomers();
        renderTopCustomers(topCustomers);

        // 5. Therapist Performance Chart
        const therapistData = await window.api.getTherapistStats(filter);
        renderTherapistChart(therapistData);

        // 6. Payment Methods Doughnut
        const paymentData = await window.api.getPaymentBreakdown();
        renderPaymentChart(paymentData);

        // 7. Expense vs Revenue Comparison
        const expRevData = await window.api.getExpenseRevenueComparison();
        renderExpenseRevenueChart(expRevData);

        // 8. Daily Visits Trend
        const dailyData = await window.api.getDailyVisits();
        renderDailyVisitsChart(dailyData);
    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
}

function renderRevenueChart(data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (revenueChartInstance) revenueChartInstance.destroy();

    const labels = data.map(d => d.label);
    const revenues = data.map(d => d.revenue);
    const visits = data.map(d => d.visits);

    revenueChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Revenue (₹)',
                    data: revenues,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return '#14b8a6';
                        const gradient = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(20, 184, 166, 0.4)');
                        gradient.addColorStop(1, 'rgba(13, 148, 136, 0.9)');
                        return gradient;
                    },
                    borderColor: '#0d9488',
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.6,
                    order: 2
                },
                {
                    label: 'Visits',
                    data: visits,
                    type: 'line',
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#7c3aed',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Revenue (₹)') {
                                return ` Revenue: ₹${context.parsed.y.toLocaleString()}`;
                            }
                            return ` Visits: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11, weight: '500' }, color: '#6b7280' }
                },
                y: {
                    position: 'left',
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        font: { size: 11 },
                        color: '#6b7280',
                        callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)
                    }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { font: { size: 11 }, color: '#7c3aed' },
                    title: { display: true, text: 'Visits', color: '#7c3aed', font: { size: 11 } }
                }
            }
        }
    });
}

function renderServiceChart(data) {
    const ctx = document.getElementById('serviceChart');
    if (!ctx) return;
    if (serviceChartInstance) serviceChartInstance.destroy();

    const spaColors = [
        '#0d9488', '#059669', '#7c3aed',
        '#f59e0b', '#ef4444', '#3b82f6'
    ];

    serviceChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.service),
            datasets: [{
                data: data.map(d => d.revenue),
                backgroundColor: spaColors,
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 14
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 14,
                        font: { size: 11 },
                        generateLabels: (chart) => {
                            const ds = chart.data.datasets[0];
                            const total = ds.data.reduce((a, b) => a + b, 0);
                            return chart.data.labels.map((label, i) => ({
                                text: `${label.length > 20 ? label.substring(0, 20) + '…' : label}`,
                                fillStyle: ds.backgroundColor[i],
                                strokeStyle: '#fff',
                                lineWidth: 0,
                                pointStyle: 'circle',
                                hidden: false,
                                index: i
                            }));
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((context.parsed / total) * 100).toFixed(1);
                            return ` ₹${context.parsed.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderTherapistChart(data) {
    const ctx = document.getElementById('therapistChart');
    if (!ctx) return;
    if (therapistChartInstance) therapistChartInstance.destroy();

    const colors = ['#0d9488','#059669','#7c3aed','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6'];

    therapistChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Revenue (₹)',
                data: data.map(d => d.revenue || 0),
                backgroundColor: data.map((_, i) => colors[i % colors.length] + 'cc'),
                borderColor: data.map((_, i) => colors[i % colors.length]),
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` ₹${context.parsed.x.toLocaleString()} (${data[context.dataIndex].customers_handled} clients)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v), font: { size: 11 }, color: '#6b7280' }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 11, weight: '500' }, color: '#374151' }
                }
            }
        }
    });
}

function renderPaymentChart(data) {
    const ctx = document.getElementById('paymentChart');
    if (!ctx) return;
    if (paymentChartInstance) paymentChartInstance.destroy();

    const colors = ['#0ea5e9','#8b5cf6','#f59e0b','#ef4444','#10b981','#ec4899'];

    paymentChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.method),
            datasets: [{
                data: data.map(d => d.revenue),
                backgroundColor: colors.slice(0, data.length),
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 14
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { usePointStyle: true, padding: 14, font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a,b) => a+b, 0);
                            const pct = ((context.parsed / total) * 100).toFixed(1);
                            return ` ₹${context.parsed.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderExpenseRevenueChart(data) {
    const ctx = document.getElementById('expenseRevenueChart');
    if (!ctx) return;
    if (expenseRevenueChartInstance) expenseRevenueChartInstance.destroy();

    expenseRevenueChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [
                {
                    label: 'Revenue',
                    data: data.map(d => d.revenue),
                    backgroundColor: 'rgba(16,185,129,0.75)',
                    borderColor: '#059669',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.4
                },
                {
                    label: 'Expenses',
                    data: data.map(d => d.expense),
                    backgroundColor: 'rgba(239,68,68,0.65)',
                    borderColor: '#dc2626',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.4
                },
                {
                    label: 'Profit',
                    data: data.map(d => d.profit),
                    type: 'line',
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#7c3aed',
                    pointRadius: 4,
                    tension: 0.4,
                    fill: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 14, font: { size: 11 } } },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) { return ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`; }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#6b7280' } },
                y: {
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v), font: { size: 11 }, color: '#6b7280' }
                }
            }
        }
    });
}

function renderDailyVisitsChart(data) {
    const ctx = document.getElementById('dailyVisitsChart');
    if (!ctx) return;
    if (dailyVisitsChartInstance) dailyVisitsChartInstance.destroy();

    const labels = data.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    });

    dailyVisitsChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Visits',
                data: data.map(d => d.visits),
                borderColor: '#6366f1',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return 'rgba(99,102,241,0.1)';
                    const gradient = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(99,102,241,0.02)');
                    gradient.addColorStop(1, 'rgba(99,102,241,0.25)');
                    return gradient;
                },
                borderWidth: 2.5,
                pointBackgroundColor: '#6366f1',
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: items => items[0].label,
                        label: function(context) { return ` ${context.parsed.y} visits`; }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 45, autoSkip: true, maxTicksLimit: 10 }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { font: { size: 11 }, color: '#6b7280', stepSize: 1 }
                }
            }
        }
    });
}

// Utility to format date to dd-mm-yyyy
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date; // Return original if invalid
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function renderTopCustomers(data) {
    const tbody = document.getElementById('top-customers-list');
    if (!tbody) return;
    tbody.innerHTML = '';

    const medals = ['🥇', '🥈', '🥉'];

    data.forEach((c, idx) => {
        const tr = document.createElement('tr');
        const rankDisplay = idx < 3
            ? `<span class="rank-medal">${medals[idx]}</span>`
            : `<span class="text-gray-500 font-medium">${idx + 1}</span>`;

        tr.innerHTML = `
            <td>${rankDisplay}</td>
            <td>
                <div class="font-semibold text-gray-900">${c.name} ${c.vip_status ? '<i class="fas fa-star text-yellow-400 text-xs ml-1"></i>' : ''}</div>
                <div class="text-xs text-gray-400">${c.phone}</div>
            </td>
            <td class="text-gray-600">${c.visits}</td>
            <td class="font-bold text-emerald-600">₹${c.total_spent.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal Utilities
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Visit Form Utilities
function toggleOnlinePaymentFields() {
    const method = document.getElementById('v-method').value;
    const fields = document.getElementById('v-online-fields');
    if (method === 'Online' || method === 'Card' || method === 'Both') {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
}

/**
 * Custom async password dialog replacing native prompt().
 * Returns a Promise<true> on correct password, or <false> on cancel/wrong.
 */
function askPassword(title) {
    return new Promise((resolve) => {
        const modal = document.getElementById('pwd-modal');
        const input = document.getElementById('pwd-modal-input');
        const errMsg = document.getElementById('pwd-modal-error');
        const titleEl = document.getElementById('pwd-modal-title');
        const confirmBtn = document.getElementById('pwd-modal-confirm');
        const cancelBtn = document.getElementById('pwd-modal-cancel');

        titleEl.textContent = title || 'Enter Password';
        input.value = '';
        errMsg.classList.add('hidden');
        modal.classList.remove('hidden');
        input.focus();

        function onConfirm() {
            if (input.value === '9097') {
                cleanup();
                resolve(true);
            } else {
                errMsg.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function onKeydown(e) {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        }

        function cleanup() {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeydown);
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeydown);
    });
}

/** Custom async Alert dialog */
function showAlert(message, title = 'Notice') {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        const msgEl = document.getElementById('alert-modal-msg');
        const titleEl = document.getElementById('alert-modal-title');
        const okBtn = document.getElementById('alert-modal-ok');

        msgEl.textContent = message;
        titleEl.textContent = title;
        modal.classList.remove('hidden');
        okBtn.focus();

        function onOk() {
            cleanup();
            resolve(true);
        }

        function onKeydown(e) {
            if (e.key === 'Enter' || e.key === 'Escape') onOk();
        }

        function cleanup() {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            okBtn.removeEventListener('keydown', onKeydown);
        }

        okBtn.addEventListener('click', onOk);
        okBtn.addEventListener('keydown', onKeydown);
    });
}

/** Custom async Confirm dialog */
function showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-modal-msg');
        const titleEl = document.getElementById('confirm-modal-title');
        const okBtn = document.getElementById('confirm-modal-ok');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        msgEl.textContent = message;
        titleEl.textContent = title;
        modal.classList.remove('hidden');
        cancelBtn.focus();

        function onOk() {
            cleanup();
            resolve(true);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function cleanup() {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// Global Visit Logic Variables
let currentVisitPage = 1;
const visitItemsPerPage = 10;
let totalVisitPages = 1;
let currentEditVisitId = null;

// Autocomplete debounce logic
let searchTimeout = null;

// Global Enquiry Logic Variables
let enquiryCache = new Map();
let currentEditEnquiryId = null;

document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('v-phone');
    const nameInput = document.getElementById('v-name');

    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fetchAutocompleteSuggestions(e.target.value), 300);
        });
    }

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fetchAutocompleteSuggestions(e.target.value), 300);
        });
    }

    const eNameInput = document.getElementById('e-name');
    if (eNameInput) {
        eNameInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fetchAutocompleteSuggestions(e.target.value), 300);
        });
    }

    const ePhoneInput = document.getElementById('e-phone');
    if (ePhoneInput) {
        ePhoneInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => fetchAutocompleteSuggestions(e.target.value), 300);
        });
    }

    const historySearchInput = document.getElementById('ch-search');
    if (historySearchInput) {
        historySearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchCustomers(), 300);
        });
    }

    const visitSearchInput = document.getElementById('v-search');
    if (visitSearchInput) {
        visitSearchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) return;

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                if (!window.api) return;
                const results = await window.api.searchCustomersLive(query);
                const searchList = document.getElementById('v-search-list');
                if (searchList) {
                    searchList.innerHTML = '';
                    results.forEach(c => {
                        const optName = document.createElement('option');
                        optName.value = c.name;
                        searchList.appendChild(optName);

                        if (c.phone && !c.phone.startsWith('GUEST-')) {
                            const optPhone = document.createElement('option');
                            optPhone.value = c.phone;
                            searchList.appendChild(optPhone);
                        }
                    });
                }
            }, 300);
        });
    }

    const enquirySearchInput = document.getElementById('e-search');
    if (enquirySearchInput) {
        enquirySearchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 2) return;

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                if (!window.api) return;
                const results = await window.api.searchCustomersLive(query);
                const searchList = document.getElementById('e-search-list');
                if (searchList) {
                    searchList.innerHTML = '';
                    results.forEach(c => {
                        const optName = document.createElement('option');
                        optName.value = c.name;
                        searchList.appendChild(optName);

                        if (c.phone && !c.phone.startsWith('GUEST-')) {
                            const optPhone = document.createElement('option');
                            optPhone.value = c.phone;
                            searchList.appendChild(optPhone);
                        }
                    });
                }
            }, 300);
        });
    }

    // Event delegation for visits table action buttons
    const visitsTableBody = document.getElementById('visits-table-body');
    if (visitsTableBody) {
        visitsTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = parseInt(btn.getAttribute('data-id'));
            const cid = parseInt(btn.getAttribute('data-cid'));
            if (action === 'view') viewVisit(cid);
            if (action === 'edit') editVisit(id);
            if (action === 'delete') deleteVisit(id);
        });
    }

    // Event delegation for enquiry followup shortcuts
    document.querySelectorAll('[data-months-shortcut]').forEach(btn => {
        btn.addEventListener('click', () => {
            const months = parseInt(btn.getAttribute('data-months-shortcut'));
            const enquiryDateVal = document.getElementById('e-date').value;
            if (!enquiryDateVal) return;

            const date = new Date(enquiryDateVal);
            date.setMonth(date.getMonth() + months);

            // Format to YYYY-MM-DD for date input
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            document.getElementById('e-follow').value = `${yyyy}-${mm}-${dd}`;
        });
    });

    // Event delegation for enquiry table action buttons
    const enquiriesTableBody = document.getElementById('enquiries-table-body');
    if (enquiriesTableBody) {
        enquiriesTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = parseInt(btn.getAttribute('data-id'));
            if (action === 'view') viewEnquiry(id);
            if (action === 'edit') editEnquiry(id);
            if (action === 'delete') deleteEnquiry(id);
        });
    }
});

async function fetchAutocompleteSuggestions(query) {
    if (!query || query.length < 2 || !window.api) return;
    const results = await window.api.searchCustomersLive(query);

    const phoneList = document.getElementById('customer-phones-list');
    const nameList = document.getElementById('customer-names-list');

    phoneList.innerHTML = '';
    nameList.innerHTML = '';

    results.forEach(c => {
        const pOpt = document.createElement('option');
        pOpt.value = c.phone;
        phoneList.appendChild(pOpt);

        const nOpt = document.createElement('option');
        nOpt.value = c.name;
        nameList.appendChild(nOpt);
    });
}

// Cache to store visit rows for edit lookup
const visitCache = new Map();

let currentVisitSearchQuery = '';

async function loadRecentVisits(searchQuery = currentVisitSearchQuery) {
    if (!window.api) return;
    const { rows: visits, totalCount } = await window.api.getVisits(currentVisitPage, visitItemsPerPage, searchQuery);

    const tbody = document.getElementById('visits-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    visitCache.clear();

    totalVisitPages = Math.ceil(totalCount / visitItemsPerPage) || 1;
    renderPagination();

    visits.forEach((v, index) => {
        visitCache.set(v.id, v);

        const srNo = (currentVisitPage - 1) * visitItemsPerPage + (index + 1);

        // Format Date to dd-mm-yyyy
        const formattedDate = formatDate(v.visit_date);

        const isGuest = v.phone && v.phone.startsWith('GUEST-');
        const displayPhone = isGuest ? '-' : v.phone;
        const displayName = (isGuest && v.customer_name === 'Walk-in') ? 'Walk-in' : v.customer_name;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${srNo}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${displayName}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${v.therapist_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">&#x20b9;${v.paid_amount}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-3">
                <button data-action="view" data-cid="${v.customer_id}" class="text-blue-600 hover:text-blue-900 transition-colors cursor-pointer" title="View"><i class="fas fa-eye text-lg"></i></button>
                <button data-action="edit" data-id="${v.id}" class="text-orange-500 hover:text-orange-700 transition-colors cursor-pointer" title="Edit"><i class="fas fa-edit text-lg"></i></button>
                <button data-action="delete" data-id="${v.id}" class="text-red-600 hover:text-red-900 transition-colors cursor-pointer" title="Delete"><i class="fas fa-trash-alt text-lg"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPagination() {
    const pageNumbersContainer = document.getElementById('v-page-numbers');
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = '';

    // Disable/Enable Prev Next
    document.getElementById('v-prev-btn').disabled = currentVisitPage === 1;
    document.getElementById('v-next-btn').disabled = currentVisitPage === totalVisitPages;
    document.getElementById('v-prev-mobile').disabled = currentVisitPage === 1;
    document.getElementById('v-next-mobile').disabled = currentVisitPage === totalVisitPages;

    for (let i = 1; i <= totalVisitPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.onclick = () => {
            currentVisitPage = i;
            loadRecentVisits();
        };
        if (i === currentVisitPage) {
            btn.className = 'z-10 bg-primary-50 border-primary-500 text-primary-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        } else {
            btn.className = 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        }
        pageNumbersContainer.appendChild(btn);
    }
}

function changeVisitPage(offset) {
    const newPage = currentVisitPage + offset;
    if (newPage > 0 && newPage <= totalVisitPages) {
        currentVisitPage = newPage;
        loadRecentVisits();
    }
}

function searchVisits() {
    const query = document.getElementById('v-search').value.trim();
    currentVisitSearchQuery = query;
    currentVisitPage = 1; // Reset to page 1 on new search
    loadRecentVisits();
}

async function viewVisit(customerId) {
    if (!window.api) return;
    const { customer, visits } = await window.api.getCustomerDetails(customerId);

    openModal('visit-view-modal');
    document.getElementById('vv-name').textContent = customer.name;
    document.getElementById('vv-phone').textContent = (customer.phone && customer.phone.startsWith('GUEST-')) ? 'N/A' : customer.phone;
    document.getElementById('vv-visits').textContent = customer.total_visits;
    document.getElementById('vv-spent').textContent = '₹' + customer.total_spent;

    if (customer.vip_status) {
        document.getElementById('vv-vip').classList.remove('hidden');
    } else {
        document.getElementById('vv-vip').classList.add('hidden');
    }

    const tbody = document.getElementById('vv-history-body');
    tbody.innerHTML = '';

    if (visits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500">No visits recorded.</td></tr>';
        return;
    }

    visits.forEach(v => {
        const formattedDate = formatDate(v.visit_date);

        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${v.therapist_name || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${v.package_name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">₹${v.paid_amount}</td>
            </tr>
        `;
    });
}

async function editVisit(visitOrId) {
    const visit = (typeof visitOrId === 'number') ? visitCache.get(visitOrId) : visitOrId;
    if (!visit) { await showAlert('Visit data not found.', 'Error'); return; }

    const ok = await askPassword('Enter Password to Edit');
    if (!ok) return;

    // Set edit mode
    currentEditVisitId = visit.id;
    document.querySelector('#visit-modal h3').textContent = 'Edit Customer Visit';

    // Populate form
    const isGuest = visit.phone && visit.phone.startsWith('GUEST-');
    document.getElementById('v-phone').value = isGuest ? '' : (visit.phone || '');
    document.getElementById('v-name').value = (isGuest && visit.customer_name === 'Walk-in') ? '' : (visit.customer_name || '');
    document.getElementById('v-date').value = visit.visit_date || '';
    document.getElementById('v-therapist').value = visit.therapist_name || '';
    document.getElementById('v-package').value = visit.package_name || '';
    document.getElementById('v-price').value = (visit.paid_amount - visit.extra_amount) || 0;
    document.getElementById('v-extra-services').value = visit.extra_services || '';
    document.getElementById('v-extra-price').value = visit.extra_amount || 0;
    document.getElementById('v-paid').value = visit.paid_amount || 0;
    document.getElementById('v-method').value = visit.payment_method || 'Cash';
    document.getElementById('v-app').value = visit.payment_app || 'UPI';
    document.getElementById('v-txn').value = visit.transaction_id || '';
    document.getElementById('v-notes').value = visit.notes || '';

    toggleOnlinePaymentFields();
    // Open modal directly
    const modal = document.getElementById('visit-modal');
    if (modal) modal.classList.remove('hidden');
}

async function deleteVisit(id) {
    const ok = await askPassword('Enter Password to Delete');
    if (!ok) return;

    const confirmed = await showConfirm('Are you sure you want to delete this record? This cannot be undone.', 'Confirm Delete');
    if (confirmed) {
        if (!window.api) return;
        const res = await window.api.deleteVisit(id);
        if (res.success) {
            loadRecentVisits();
            initDashboard('monthly');
            await showAlert('Record deleted successfully.', 'Success');
        } else {
            await showAlert('Error: ' + res.error, 'Error');
        }
    }
}

// Opens visit modal for a new visit (called from 'New Visit' button)
function openVisitModal() {
    currentEditVisitId = null;
    document.querySelector('#visit-modal h3').textContent = 'New Customer Visit';
    const vt = document.getElementById('visit-form');
    if (vt) vt.reset();
    const vDate = document.getElementById('v-date');
    if (vDate) vDate.valueAsDate = new Date();
    toggleOnlinePaymentFields();
    // Use the original openModal directly
    const modal = document.getElementById('visit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeVisitModal() {
    currentEditVisitId = null;
    const modal = document.getElementById('visit-modal');
    if (modal) modal.classList.add('hidden');
}

function calculateTotal() {
    const p = parseFloat(document.getElementById('v-price').value) || 0;
    const e = parseFloat(document.getElementById('v-extra-price').value) || 0;
    document.getElementById('v-paid').value = p + e;
}

// Add event listeners for dynamic pricing
document.addEventListener('DOMContentLoaded', () => {
    const pInput = document.getElementById('v-price');
    const eInput = document.getElementById('v-extra-price');
    if (pInput) pInput.addEventListener('input', calculateTotal);
    if (eInput) eInput.addEventListener('input', calculateTotal);
});

async function saveVisit() {
    if (!window.api) return;

    const visitData = {
        phone: document.getElementById('v-phone').value,
        name: document.getElementById('v-name').value,
        date: document.getElementById('v-date').value,
        therapistId: document.getElementById('v-therapist').value,
        pkg: document.getElementById('v-package').value,
        price: document.getElementById('v-price').value,
        extra: document.getElementById('v-extra-services').value,
        extraPrice: document.getElementById('v-extra-price').value,
        paid: document.getElementById('v-paid').value,
        method: document.getElementById('v-method').value,
        appName: document.getElementById('v-app').value,
        txn: document.getElementById('v-txn').value,
        notes: document.getElementById('v-notes').value
    };

    if (!visitData.date || !visitData.pkg || !visitData.paid) {
        await showAlert('Please fill required fields (Date, Package, Paid Amount).', 'Missing Information');
        return;
    }

    let res;
    if (currentEditVisitId) {
        visitData.id = currentEditVisitId;
        res = await window.api.updateVisit(visitData);
    } else {
        res = await window.api.addVisit(visitData);
    }

    if (res && res.success) {
        closeVisitModal();
        initDashboard('monthly');
        loadRecentVisits();
        await showAlert(currentEditVisitId ? 'Visit updated successfully!' : 'Visit saved successfully!', 'Success');
    } else {
        await showAlert('Failed to save visit: ' + (res ? res.error : 'Unknown error'), 'Error');
    }
}

let currentEnquiryPage = 1;
const enquiryItemsPerPage = 10;
let totalEnquiryPages = 1;
let currentEnquirySearchQuery = '';

function renderEnquiryPagination() {
    const pageNumbersContainer = document.getElementById('e-page-numbers');
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = '';

    document.getElementById('e-prev-btn').disabled = currentEnquiryPage === 1;
    document.getElementById('e-next-btn').disabled = currentEnquiryPage === totalEnquiryPages;
    document.getElementById('e-prev-mobile').disabled = currentEnquiryPage === 1;
    document.getElementById('e-next-mobile').disabled = currentEnquiryPage === totalEnquiryPages;

    for (let i = 1; i <= totalEnquiryPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.onclick = () => {
            currentEnquiryPage = i;
            loadEnquiries();
        };
        if (i === currentEnquiryPage) {
            btn.className = 'z-10 bg-primary-50 border-primary-500 text-primary-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        } else {
            btn.className = 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        }
        pageNumbersContainer.appendChild(btn);
    }
}

function changeEnquiryPage(offset) {
    const newPage = currentEnquiryPage + offset;
    if (newPage > 0 && newPage <= totalEnquiryPages) {
        currentEnquiryPage = newPage;
        loadEnquiries();
    }
}

function searchEnquiries() {
    const query = document.getElementById('e-search').value.trim();
    currentEnquirySearchQuery = query;
    currentEnquiryPage = 1;
    loadEnquiries();
}

async function loadEnquiries(searchQuery = currentEnquirySearchQuery) {
    if (!window.api) return;
    const { rows: items, totalCount } = await window.api.getEnquiries(currentEnquiryPage, enquiryItemsPerPage, searchQuery);

    enquiryCache.clear();
    items.forEach(e => enquiryCache.set(e.id, e));

    const tbody = document.getElementById('enquiries-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    totalEnquiryPages = Math.ceil(totalCount / enquiryItemsPerPage) || 1;
    renderEnquiryPagination();

    items.forEach(e => {
        const badgeColor = e.status === 'New' ? 'bg-blue-100 text-blue-800' :
            e.status === 'Converted' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800';

        const isGuest = e.phone && e.phone.startsWith('GUEST-');
        const displayPhone = isGuest ? '-' : e.phone;
        const displayName = isGuest && e.customer_name === 'Walk-in' ? 'Walk-in' : e.customer_name;

        const formattedDate = formatDate(e.enquiry_date);
        const followUpDate = e.follow_up_date ? formatDate(e.follow_up_date) : '-';
        const followUpClass = e.follow_up_date && new Date(e.follow_up_date) < new Date() && e.status !== 'Converted' && e.status !== 'Closed' ? 'text-red-600 font-semibold' : 'text-gray-500';

        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${displayName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.service_interested || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${e.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${followUpClass}">${followUpDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-2" data-action="view" data-id="${e.id}" title="View"><i class="fas fa-eye"></i></button>
                    <button class="text-primary-600 hover:text-primary-900 mr-2" data-action="edit" data-id="${e.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900" data-action="delete" data-id="${e.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

async function saveEnquiry() {
    if (!window.api) return;
    const data = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        date: document.getElementById('e-date').value,
        followup: document.getElementById('e-follow').value,
        counselor: document.getElementById('e-counselor').value,
        source: document.getElementById('e-source').value,
        service: document.getElementById('e-service').value,
        desc: document.getElementById('e-desc').value
    };

    if (!data.date || !data.counselor) {
        await showAlert("Please fill required fields (Date, Counselor).", "Missing Info");
        return;
    }

    let res;
    if (currentEditEnquiryId) {
        data.id = currentEditEnquiryId;
        res = await window.api.updateEnquiry(data);
    } else {
        res = await window.api.addEnquiry(data);
    }

    if (res && res.success) {
        await showAlert(currentEditEnquiryId ? "Enquiry updated safely!" : "Enquiry saved successfully!", "Success");
        currentEditEnquiryId = null;
        closeModal('enquiry-modal');
        document.getElementById('enquiry-form').reset();
        document.getElementById('e-date').valueAsDate = new Date();
        loadEnquiries(); // Refresh table
    } else {
        await showAlert("Failed to save enquiry: " + (res ? res.error : "Unknown error"), "Error");
    }
}

function viewEnquiry(id) {
    const e = enquiryCache.get(id);
    if (!e) return;

    document.getElementById('ev-name').value = e.customer_name;
    document.getElementById('ev-phone').value = e.phone;
    document.getElementById('ev-date').value = e.enquiry_date;
    document.getElementById('ev-follow').value = e.follow_up_date || '';
    document.getElementById('ev-counselor').value = e.counselor_name;
    document.getElementById('ev-source').value = e.source;
    document.getElementById('ev-status').value = e.status; 
    document.getElementById('ev-service').value = e.service_interested || '';
    document.getElementById('ev-desc').value = e.description || '';

    openModal('enquiry-view-modal');
}

async function editEnquiry(id) {
    const pwdRes = await askPassword();
    if (!pwdRes) return;

    const e = enquiryCache.get(id);
    if (!e) return;

    currentEditEnquiryId = id;

    document.getElementById('e-name').value = e.customer_name === 'Walk-in' && e.phone && e.phone.startsWith('GUEST-') ? '' : e.customer_name;
    document.getElementById('e-phone').value = e.phone && e.phone.startsWith('GUEST-') ? '' : e.phone;
    document.getElementById('e-date').value = e.enquiry_date;
    document.getElementById('e-follow').value = e.follow_up_date || '';
    document.getElementById('e-counselor').value = e.counselor_name;
    document.getElementById('e-source').value = e.source;
    document.getElementById('e-service').value = e.service_interested || '';
    document.getElementById('e-desc').value = e.description || '';

    openModal('enquiry-modal');
}

async function deleteEnquiry(id) {
    const pwdRes = await askPassword();
    if (!pwdRes) return;

    const confirmRes = await showConfirm('Are you absolutely sure you want to delete this enquiry?');
    if (!confirmRes) return;

    const res = await window.api.deleteEnquiry(id);
    if (res.success) {
        initDashboard('monthly');
        loadEnquiries();
    } else {
        await showAlert('Failed to delete enquiry: ' + res.error, 'Error');
    }
}

// ========== LEAD FOLLOW-UP (CALLS) ==========
let callCache = new Map();
let currentCallPage = 1;
const callItemsPerPage = 10;
let totalCallPages = 1;
let currentCallSearchQuery = '';
let currentCallStatusFilter = '';
let currentEditCallId = null;

function renderCallPagination() {
    const pageNumbersContainer = document.getElementById('lf-page-numbers');
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = '';

    const prevBtn = document.getElementById('lf-prev-btn');
    const nextBtn = document.getElementById('lf-next-btn');
    const prevMobile = document.getElementById('lf-prev-mobile');
    const nextMobile = document.getElementById('lf-next-mobile');
    if (prevBtn) prevBtn.disabled = currentCallPage === 1;
    if (nextBtn) nextBtn.disabled = currentCallPage === totalCallPages;
    if (prevMobile) prevMobile.disabled = currentCallPage === 1;
    if (nextMobile) nextMobile.disabled = currentCallPage === totalCallPages;

    for (let i = 1; i <= totalCallPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.onclick = () => { currentCallPage = i; loadCalls(); };
        btn.className = i === currentCallPage
            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium'
            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        pageNumbersContainer.appendChild(btn);
    }
}

function changeCallPage(offset) {
    const newPage = currentCallPage + offset;
    if (newPage > 0 && newPage <= totalCallPages) {
        currentCallPage = newPage;
        loadCalls();
    }
}

function searchLeadFollowup() {
    currentCallSearchQuery = (document.getElementById('lf-search')?.value || '').trim();
    currentCallStatusFilter = (document.getElementById('lf-status-filter')?.value || '');
    currentCallPage = 1;
    loadCalls();
}

async function loadCalls() {
    if (!window.api) return;
    // Try paginated API first, fallback to getCalls for backward compatibility
    let items = [];
    let totalCount = 0;
    try {
        const result = await window.api.getCalls(currentCallPage, callItemsPerPage, currentCallSearchQuery, currentCallStatusFilter);
        if (result && result.rows) {
            items = result.rows;
            totalCount = result.totalCount;
        } else if (Array.isArray(result)) {
            // Fallback: old API returning plain array
            items = result;
            totalCount = result.length;
        }
    } catch (e) {
        const result = await window.api.getCalls();
        items = Array.isArray(result) ? result : [];
        totalCount = items.length;
        // manual filter
        if (currentCallSearchQuery) {
            const q = currentCallSearchQuery.toLowerCase();
            items = items.filter(c => (c.customer_name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
        }
        if (currentCallStatusFilter) {
            items = items.filter(c => c.status === currentCallStatusFilter || c.call_status === currentCallStatusFilter);
        }
        totalCount = items.length;
        const start = (currentCallPage - 1) * callItemsPerPage;
        items = items.slice(start, start + callItemsPerPage);
    }

    callCache.clear();
    items.forEach(c => callCache.set(c.id, c));

    const tbody = document.getElementById('calls-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    totalCallPages = Math.ceil(totalCount / callItemsPerPage) || 1;
    renderCallPagination();

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">No call records found.</td></tr>';
        return;
    }

    items.forEach(c => {
        const status = c.status || c.call_status || 'Pending';
        const statusColor = status === 'Completed' ? 'bg-green-100 text-green-800' :
            status === 'No Response' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800';

        const followUp = c.next_follow_up ? formatDate(c.next_follow_up) : '-';
        const followUpClass = c.next_follow_up && new Date(c.next_follow_up) < new Date() && status !== 'Completed'
            ? 'text-red-600 font-semibold' : 'text-gray-500';

        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(c.call_date)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${c.customer_name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.phone}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.counselor_name || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.purpose}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${status}</span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${followUpClass}">${followUp}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <button data-action="view-call" data-id="${c.id}" class="text-blue-600 hover:text-blue-900 transition-colors cursor-pointer" title="View Details"><i class="fas fa-eye text-lg"></i></button>
                    <button data-action="edit-call" data-id="${c.id}" class="text-orange-500 hover:text-orange-700 transition-colors cursor-pointer" title="Edit"><i class="fas fa-edit text-lg"></i></button>
                    <button data-action="delete-call" data-id="${c.id}" class="text-red-600 hover:text-red-900 transition-colors cursor-pointer" title="Delete"><i class="fas fa-trash-alt text-lg"></i></button>
                </td>
            </tr>
        `;
    });
}

function viewCall(id) {
    const c = callCache.get(id);
    if (!c) return;
    document.getElementById('cv-name').value = c.customer_name || '';
    document.getElementById('cv-phone').value = c.phone || '';
    document.getElementById('cv-date').value = c.call_date || '';
    document.getElementById('cv-counselor').value = c.counselor_name || '';
    document.getElementById('cv-purpose').value = c.purpose || '';
    document.getElementById('cv-status').value = c.status || c.call_status || 'Pending';
    document.getElementById('cv-follow').value = c.next_follow_up || '';
    document.getElementById('cv-notes').value = c.notes || '';
    openModal('call-view-modal');
}

function openNewCallModal() {
    currentEditCallId = null;
    document.getElementById('call-modal-title').textContent = 'Record New Call';
    document.getElementById('call-form').reset();
    document.getElementById('c-date').valueAsDate = new Date();
    document.getElementById('c-status').value = 'Pending';
    openModal('call-modal');
}

function closeCallModal() {
    currentEditCallId = null;
    closeModal('call-modal');
}

async function editCall(id) {
    const ok = await askPassword('Enter Password to Edit');
    if (!ok) return;

    const c = callCache.get(id);
    if (!c) return;

    currentEditCallId = id;
    document.getElementById('call-modal-title').textContent = 'Edit Call Record';
    document.getElementById('c-name').value = c.customer_name || '';
    document.getElementById('c-phone').value = c.phone || '';
    document.getElementById('c-date').value = c.call_date || '';
    document.getElementById('c-counselor').value = c.counselor_name || '';
    document.getElementById('c-purpose').value = c.purpose || '';
    document.getElementById('c-status').value = c.status || c.call_status || 'Pending';
    document.getElementById('c-follow').value = c.next_follow_up || '';
    document.getElementById('c-notes').value = c.notes || '';
    openModal('call-modal');
}

async function deleteCall(id) {
    const ok = await askPassword('Enter Password to Delete');
    if (!ok) return;
    const confirmed = await showConfirm('Are you sure you want to delete this call record?', 'Confirm Delete');
    if (!confirmed) return;

    if (!window.api) return;
    let res;
    try { res = await window.api.deleteCall(id); } catch (e) { res = { success: false, error: e.message }; }
    if (res && res.success) {
        loadCalls();
        await showAlert('Call record deleted.', 'Success');
    } else {
        await showAlert('Failed to delete: ' + (res ? res.error : 'Unknown error'), 'Error');
    }
}

async function saveCall() {
    if (!window.api) return;
    const data = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        date: document.getElementById('c-date').value,
        counselor: document.getElementById('c-counselor').value,
        purpose: document.getElementById('c-purpose').value,
        status: document.getElementById('c-status').value,
        follow: document.getElementById('c-follow').value,
        notes: document.getElementById('c-notes').value
    };

    if (!data.name || !data.phone || !data.date || !data.counselor) {
        await showAlert("Please fill required fields (Name, Phone, Date, Counselor).", "Missing Info");
        return;
    }

    let res;
    if (currentEditCallId) {
        data.id = currentEditCallId;
        try { res = await window.api.updateCall(data); } catch (e) { res = { success: false, error: e.message }; }
    } else {
        res = await window.api.addCall(data);
    }

    if (res && res.success) {
        await showAlert(currentEditCallId ? "Call record updated!" : "Call recorded successfully!", "Success");
        closeCallModal();
        loadCalls();

        // Always refresh Smart Recall if it's currently visible
        const smartRecallView = document.getElementById('view-smart-recall');
        const isSmartRecallVisible = smartRecallView && !smartRecallView.classList.contains('hidden');
        if (isSmartRecallVisible) {
            await reloadAllSmartRecallSources();
        } else if (window._recallContext) {
            // Fallback: direct reload from context if navigated away
            const { source } = window._recallContext;
            try {
                if (source === 'visits') await loadSmartRecallVisits();
                else if (source === 'calls') await loadSmartRecallCalls();
                else if (source === 'enquiries') await loadSmartRecallEnquiries();
            } finally {
                window._recallContext = null;
            }
        }
        window._recallContext = null;
    } else {
        await showAlert("Failed to save: " + (res ? res.error : "Unknown error"), "Error");
    }
}

// Setup event delegation for calls table
document.addEventListener('DOMContentLoaded', () => {
    const callsTableBody = document.getElementById('calls-table-body');
    if (callsTableBody) {
        callsTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = parseInt(btn.getAttribute('data-id'));
            if (action === 'view-call') viewCall(id);
            if (action === 'edit-call') editCall(id);
            if (action === 'delete-call') deleteCall(id);
        });
    }
});

function recordCallFromRecall(name, phone, source = 'visits') {
    // Track context so we can remove the row from Smart Recall once saved
    window._recallContext = { phone, source };

    currentEditCallId = null;
    document.getElementById('call-modal-title').textContent = 'Record New Call';
    document.getElementById('call-form').reset();
    document.getElementById('c-name').value = name;
    document.getElementById('c-phone').value = phone;
    document.getElementById('c-date').valueAsDate = new Date();
    document.getElementById('c-purpose').value = 'Recall - Inactive Customer';
    document.getElementById('c-status').value = 'Pending';
    openModal('call-modal');
}

async function loadExpenses() {
    if (!window.api) return;
    const items = await window.api.getExpenses();
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    items.forEach(ex => {
        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(ex.expense_date)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${ex.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹${ex.amount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${ex.remarks || '-'}</td>
            </tr>
        `;
    });
}

async function saveExpense() {
    if (!window.api) return;
    const data = {
        date: document.getElementById('ex-date').value,
        category: document.getElementById('ex-category').value,
        amount: document.getElementById('ex-amount').value,
        remarks: document.getElementById('ex-remarks').value
    };

    if (!data.date || !data.category || !data.amount) {
        alert("Please fill required fields.");
        return;
    }

    const res = await window.api.addExpense(data);
    if (res.success) {
        alert("Expense added successfully!");
        closeModal('expense-modal');
        document.getElementById('expense-form').reset();
        document.getElementById('ex-date').valueAsDate = new Date();
        loadExpenses();
    } else {
        alert("Failed to add expense: " + res.error);
    }
}

// ========== SMART RECALL ==========

// Visits-based recall data
let recallVisitsData = [];
// Calls-based recall data
let recallCallsData = [];
// Enquiry-based recall data
let recallEnquiriesData = [];

// Helper: reload all three sources with current days filter
async function reloadAllSmartRecallSources() {
    await Promise.all([
        loadSmartRecallVisits(),
        loadSmartRecallCalls(),
        loadSmartRecallEnquiries()
    ]);
}

// ---- Visits Smart Recall ----
async function loadSmartRecallVisits() {
    if (!window.api) return;
    const daysFilter = parseInt(document.getElementById('sr-days-filter')?.value || '30');
    const items = await window.api.getSmartRecall(daysFilter);
    recallVisitsData = Array.isArray(items) ? items : [];

    const countLabel = document.getElementById('sr-visits-count');
    if (countLabel) {
        countLabel.textContent = `${recallVisitsData.length} inactive customer${recallVisitsData.length !== 1 ? 's' : ''} found`;
    }

    filterSmartRecallVisits();
}

function filterSmartRecallVisits() {
    const query = (document.getElementById('sr-search')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('recall-visits-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = recallVisitsData;
    if (query) {
        filtered = recallVisitsData.filter(c =>
            (c.name || '').toLowerCase().includes(query) ||
            (c.phone || '').includes(query)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No inactive customers found.</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.forEach(c => {
        const lastVisitDate = c.last_visit ? new Date(c.last_visit) : null;
        let daysInactive = '-';
        let urgencyClass = 'bg-orange-100 text-orange-800';

        if (lastVisitDate && !isNaN(lastVisitDate.getTime())) {
            const diffDays = Math.floor((today - lastVisitDate) / (1000 * 60 * 60 * 24));
            daysInactive = diffDays;
            urgencyClass = diffDays >= 90
                ? 'bg-red-200 text-red-900 font-bold'
                : diffDays >= 60
                    ? 'bg-red-100 text-red-800 font-semibold'
                    : 'bg-orange-100 text-orange-800';
        }

        const totalSpent = c.total_spent ? `₹${Number(c.total_spent).toLocaleString()}` : '-';
        const isGuest = c.phone && c.phone.startsWith('GUEST-');
        const displayPhone = isGuest ? '-' : (c.phone || '-');

        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${c.name}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-semibold">${formatDate(c.last_visit)}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${urgencyClass}">
                        ${daysInactive} days
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.total_visits}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600">${totalSpent}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <button class="text-primary-600 hover:text-primary-900 transition-colors cursor-pointer"
                        onclick="recordCallFromRecall('${(c.name || '').replace(/'/g, "\\'")}', '${displayPhone !== '-' ? displayPhone : ''}', 'visits')"
                        title="Log a Call">
                        <i class="fas fa-phone-alt text-lg"></i>
                    </button>
                    <button class="text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
                        onclick="openCustomerHistoryFromRecall('${(c.name || '').replace(/'/g, "\\'")}', '${displayPhone !== '-' ? displayPhone : ''}')"
                        title="View Customer History">
                        <i class="fas fa-history text-lg"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// ---- Calls Smart Recall ----
async function loadSmartRecallCalls() {
    if (!window.api) return;
    const daysFilter = parseInt(document.getElementById('sr-days-filter')?.value || '30');
    const items = await window.api.getSmartRecallCalls(daysFilter);
    recallCallsData = Array.isArray(items) ? items : [];

    const countLabel = document.getElementById('sr-calls-count');
    if (countLabel) {
        countLabel.textContent = `${recallCallsData.length} customer${recallCallsData.length !== 1 ? 's' : ''} with pending calls`;
    }

    renderSmartRecallCalls();
}

function renderSmartRecallCalls() {
    const query = (document.getElementById('sr-search')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('recall-calls-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = recallCallsData;
    if (query) {
        filtered = recallCallsData.filter(c =>
            (c.customer_name || '').toLowerCase().includes(query) ||
            (c.phone || '').includes(query)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No pending follow-up calls found.</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.forEach(c => {
        const refDateStr = c.last_follow_up || c.last_call;
        const refDate = refDateStr ? new Date(refDateStr) : null;
        let daysPending = '-';
        let urgencyClass = 'bg-orange-100 text-orange-800';

        if (refDate && !isNaN(refDate.getTime())) {
            const diffDays = Math.floor((today - refDate) / (1000 * 60 * 60 * 24));
            daysPending = diffDays;
            urgencyClass = diffDays >= 90
                ? 'bg-red-200 text-red-900 font-bold'
                : diffDays >= 60
                    ? 'bg-red-100 text-red-800 font-semibold'
                    : 'bg-orange-100 text-orange-800';
        }

        const isGuest = c.phone && c.phone.startsWith('GUEST-');
        const displayPhone = isGuest ? '-' : (c.phone || '-');

        const nextFollowUp = c.last_follow_up ? formatDate(c.last_follow_up) : '-';
        const followUpClass = c.last_follow_up && new Date(c.last_follow_up) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-500';

        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${c.customer_name}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    ${formatDate(c.last_call)}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${followUpClass}">
                    ${nextFollowUp}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${urgencyClass}">
                        ${daysPending} days
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.total_calls}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <button class="text-primary-600 hover:text-primary-900 transition-colors cursor-pointer"
                        onclick="recordCallFromRecall('${(c.customer_name || '').replace(/'/g, "\\'")}', '${displayPhone !== '-' ? displayPhone : ''}', 'calls')"
                        title="Log a Call">
                        <i class="fas fa-phone-alt text-lg"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// ---- Enquiries Smart Recall ----
async function loadSmartRecallEnquiries() {
    if (!window.api) return;
    const daysFilter = parseInt(document.getElementById('sr-days-filter')?.value || '30');
    const items = await window.api.getSmartRecallEnquiries(daysFilter);
    recallEnquiriesData = Array.isArray(items) ? items : [];

    const countLabel = document.getElementById('sr-enquiries-count');
    if (countLabel) {
        countLabel.textContent = `${recallEnquiriesData.length} customer${recallEnquiriesData.length !== 1 ? 's' : ''} with old enquiries`;
    }

    renderSmartRecallEnquiries();
}

function renderSmartRecallEnquiries() {
    const query = (document.getElementById('sr-search')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('recall-enquiries-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = recallEnquiriesData;
    if (query) {
        filtered = recallEnquiriesData.filter(c =>
            (c.customer_name || '').toLowerCase().includes(query) ||
            (c.phone || '').includes(query)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No stale enquiries found.</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.forEach(c => {
        const refDateStr = c.last_follow_up || c.last_enquiry;
        const refDate = refDateStr ? new Date(refDateStr) : null;
        let daysPending = '-';
        let urgencyClass = 'bg-orange-100 text-orange-800';

        if (refDate && !isNaN(refDate.getTime())) {
            const diffDays = Math.floor((today - refDate) / (1000 * 60 * 60 * 24));
            daysPending = diffDays;
            urgencyClass = diffDays >= 90
                ? 'bg-red-200 text-red-900 font-bold'
                : diffDays >= 60
                    ? 'bg-red-100 text-red-800 font-semibold'
                    : 'bg-orange-100 text-orange-800';
        }

        const isGuest = c.phone && c.phone.startsWith('GUEST-');
        const displayPhone = isGuest ? '-' : (c.phone || '-');

        const nextFollowUp = c.last_follow_up ? formatDate(c.last_follow_up) : '-';
        const followUpClass = c.last_follow_up && new Date(c.last_follow_up) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-500';

        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${c.customer_name}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    ${formatDate(c.last_enquiry)}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${followUpClass}">
                    ${nextFollowUp}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${urgencyClass}">
                        ${daysPending} days
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.total_enquiries}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                    <button class="text-primary-600 hover:text-primary-900 transition-colors cursor-pointer"
                        onclick="recordCallFromRecall('${(c.customer_name || '').replace(/'/g, "\\'")}', '${displayPhone !== '-' ? displayPhone : ''}', 'enquiries')"
                        title="Log a Call">
                        <i class="fas fa-phone-alt text-lg"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// ---- Smart Recall Tabs & Search ----

function setSmartRecallTab(tab) {
    const panels = {
        visits: document.getElementById('sr-panel-visits'),
        calls: document.getElementById('sr-panel-calls'),
        enquiries: document.getElementById('sr-panel-enquiries')
    };
    const tabs = {
        visits: document.getElementById('sr-tab-visits'),
        calls: document.getElementById('sr-tab-calls'),
        enquiries: document.getElementById('sr-tab-enquiries')
    };

    Object.keys(panels).forEach(key => {
        if (!panels[key] || !tabs[key]) return;
        if (key === tab) {
            panels[key].classList.remove('hidden');
            tabs[key].classList.add('border-primary-500', 'text-primary-600');
            tabs[key].classList.remove('border-transparent', 'text-gray-500');
        } else {
            panels[key].classList.add('hidden');
            tabs[key].classList.remove('border-primary-500', 'text-primary-600');
            tabs[key].classList.add('border-transparent', 'text-gray-500');
        }
    });

    // Re-apply search filter to the active tab
    filterSmartRecallCurrentTab();
}

function filterSmartRecallCurrentTab() {
    const activeVisits = !document.getElementById('sr-panel-visits')?.classList.contains('hidden');
    const activeCalls = !document.getElementById('sr-panel-calls')?.classList.contains('hidden');
    if (activeVisits) {
        filterSmartRecallVisits();
    } else if (activeCalls) {
        renderSmartRecallCalls();
    } else {
        renderSmartRecallEnquiries();
    }
}

function openCustomerHistoryFromRecall(name, phone) {
    // Navigate to Customer History view and pre-fill search
    const navItem = document.querySelector('[data-target="customer-history"]');
    if (navItem) navItem.click();
    setTimeout(() => {
        const searchInput = document.getElementById('ch-search');
        if (searchInput) {
            searchInput.value = phone || name;
            searchCustomers();
        }
    }, 100);
}

async function searchCustomers() {
    if (!window.api) return;
    const query = document.getElementById('ch-search').value.trim();
    const list = document.getElementById('ch-results-list');

    if (!query || query.length < 2) {
        list.innerHTML = '<p class="text-sm text-gray-500 italic">Enter a search query...</p>';
        return;
    }

    list.innerHTML = '<p class="text-sm text-gray-500">Searching...</p>';

    // searchCustomers uses the same live query implementation that excludes GUEST filters
    const results = await window.api.searchCustomersLive(query);
    list.innerHTML = '';
    if (results.length === 0) {
        list.innerHTML = '<p class="text-sm text-gray-500 italic">No customers found.</p>';
        return;
    }

    results.forEach(c => {
        const item = document.createElement('div');
        item.className = 'p-3 border rounded cursor-pointer hover:bg-gray-100 transition-colors';
        item.onclick = () => viewCustomerDetails(c.id);
        item.innerHTML = `
            <div class="flex justify-between items-center">
                <p class="font-medium text-gray-900">${c.name} ${c.vip_status ? '<i class="fas fa-star text-yellow-400 text-xs ml-1"></i>' : ''}</p>
            </div>
            <p class="text-sm text-gray-500">${c.phone}</p>
        `;
        list.appendChild(item);
    });
}

async function viewCustomerDetails(id) {
    if (!window.api) return;
    const { customer, visits } = await window.api.getCustomerDetails(id);

    document.getElementById('ch-details-panel').classList.remove('hidden');
    document.getElementById('ch-det-name').textContent = customer.name;
    document.getElementById('ch-det-phone').textContent = (customer.phone && customer.phone.startsWith('GUEST-')) ? 'N/A' : customer.phone;
    document.getElementById('ch-det-spent').textContent = '₹' + customer.total_spent;

    if (customer.vip_status) {
        document.getElementById('ch-det-vip').classList.remove('hidden');
    } else {
        document.getElementById('ch-det-vip').classList.add('hidden');
    }

    // Set global for merge modal reference
    window.currentViewedCustomer = customer;

    // --- Visits ---
    const tbody = document.getElementById('ch-visits-body');
    tbody.innerHTML = '';

    if (visits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-3 text-center text-sm text-gray-500">No visits recorded.</td></tr>';
    } else {
        visits.forEach(v => {
            tbody.innerHTML += `
                <tr>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(v.visit_date)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${v.therapist_name || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${v.package_name}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">₹${v.package_price}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${v.extra_services || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">₹${v.extra_amount || 0}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-bold">₹${v.paid_amount}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${v.payment_method}</td>
                    <td class="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]" title="${v.notes || ''}">${v.notes || '-'}</td>
                </tr>
            `;
        });
    }

    // --- Call History ---
    const phone = (customer.phone && customer.phone.startsWith('GUEST-')) ? null : customer.phone;
    const callsBody = document.getElementById('ch-calls-body');
    const callsSection = document.getElementById('ch-calls-section');
    if (callsBody && callsSection) {
        callsBody.innerHTML = '';
        if (phone) {
            const calls = await window.api.getCustomerCalls(phone);
            if (calls && calls.length > 0) {
                callsSection.classList.remove('hidden');
                calls.forEach(c => {
                    const statusColor = c.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        c.status === 'No Response' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800';
                    callsBody.innerHTML += `
                        <tr>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(c.call_date)}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.counselor_name || '-'}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${c.purpose || '-'}</td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${c.status}</span>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.next_follow_up ? formatDate(c.next_follow_up) : '-'}</td>
                            <td class="px-4 py-3 text-sm text-gray-500 truncate max-w-[120px]" title="${c.notes || ''}">${c.notes || '-'}</td>
                        </tr>
                    `;
                });
            } else {
                callsSection.classList.remove('hidden');
                callsBody.innerHTML = '<tr><td colspan="6" class="px-4 py-3 text-center text-sm text-gray-500">No call records found.</td></tr>';
            }
        } else {
            callsSection.classList.add('hidden');
        }
    }
}

function openMergeModal() {
    const cust = window.currentViewedCustomer;
    if (!cust) return;

    document.getElementById('m-primary-name').textContent = cust.name;
    document.getElementById('m-primary-phone').textContent = cust.phone;
    document.getElementById('m-primary-id').value = cust.id;

    document.getElementById('m-search').value = '';
    document.getElementById('m-target-details').classList.add('hidden');
    document.getElementById('m-target-id').value = '';
    document.getElementById('btn-confirm-merge').disabled = true;

    openModal('merge-modal');
}

document.addEventListener('DOMContentLoaded', () => {
    const mergeSearchInput = document.getElementById('m-search');
    if (mergeSearchInput) {
        mergeSearchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            document.getElementById('m-target-details').classList.add('hidden');
            document.getElementById('btn-confirm-merge').disabled = true;
            document.getElementById('m-target-id').value = '';

            if (query.length < 2) return;

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                if (!window.api) return;
                const results = await window.api.searchCustomersLive(query);
                const searchList = document.getElementById('m-search-list');
                const currentId = parseInt(document.getElementById('m-primary-id').value);

                if (searchList) {
                    searchList.innerHTML = '';
                    results.forEach(c => {
                        // Don't show the currently viewing customer or guests
                        if (c.id === currentId || (c.phone && c.phone.startsWith('GUEST-'))) return;

                        const optName = document.createElement('option');
                        optName.value = c.phone; // Autocomplete standardizing on phone for exact match
                        optName.textContent = `${c.name} - ${c.phone}`;
                        searchList.appendChild(optName);
                    });
                }
            }, 300);
        });

        mergeSearchInput.addEventListener('change', async (e) => {
            // When an option is selected from datalist
            const val = e.target.value;
            if (!val) return;
            // Lookup customer to confirm
            const results = await window.api.searchCustomersLive(val);
            const currentId = parseInt(document.getElementById('m-primary-id').value);
            const target = results.find(c => c.phone === val && c.id !== currentId);

            if (target) {
                document.getElementById('m-target-name').textContent = target.name;
                document.getElementById('m-target-phone').textContent = target.phone;
                document.getElementById('m-target-id').value = target.id;
                document.getElementById('m-target-details').classList.remove('hidden');
                document.getElementById('btn-confirm-merge').disabled = false;
            }
        });
    }
});

async function confirmMerge() {
    const primaryId = parseInt(document.getElementById('m-primary-id').value);
    const targetId = parseInt(document.getElementById('m-target-id').value); // ID to be deleted/merged from

    if (!primaryId || !targetId || primaryId === targetId) return;

    const confirmed = await showConfirm(
        'Are you completely sure? This will permanently delete the duplicate account and move all its visits and payments into the primary account. This cannot be undone.',
        'Confirm Merge'
    );

    if (confirmed) {
        const ok = await askPassword('Enter Password to Merge');
        if (!ok) return;

        if (!window.api) return;
        const res = await window.api.mergeCustomers(primaryId, targetId);

        if (res.success) {
            await showAlert('Customers merged successfully!', 'Success');
            closeModal('merge-modal');
            // Refresh the current customer details and history search
            viewCustomerDetails(primaryId);
            searchCustomers();
            initDashboard(document.getElementById('dash-filter')?.value || 'all'); // Refresh stats since things moved
        } else {
            await showAlert('Failed to merge: ' + res.error, 'Error');
        }
    }
}

// ==================== EXPENSE SECTION ====================

let currentExpensePage = 1;
const expenseItemsPerPage = 10;
let totalExpensePages = 1;
let currentExpenseSearchQuery = '';
let currentEditExpenseId = null;
const expenseCache = new Map();

async function loadExpenses(searchQuery = currentExpenseSearchQuery) {
    if (!window.api) return;
    const { rows, totalCount } = await window.api.getExpenses(currentExpensePage, expenseItemsPerPage, searchQuery);

    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    expenseCache.clear();

    totalExpensePages = Math.ceil(totalCount / expenseItemsPerPage) || 1;
    renderExpensePagination();

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500"><i class="fas fa-receipt text-3xl text-gray-300 mb-2 block"></i>No expenses found.</td></tr>';
        return;
    }

    rows.forEach((exp, index) => {
        expenseCache.set(exp.id, exp);
        const srNo = (currentExpensePage - 1) * expenseItemsPerPage + (index + 1);
        const formattedDate = formatDate(exp.expense_date);

        const categoryColors = {
            'Staff Salary': 'bg-blue-100 text-blue-800',
            'Oil / Products': 'bg-amber-100 text-amber-800',
            'Rent': 'bg-red-100 text-red-800',
            'Utilities': 'bg-cyan-100 text-cyan-800',
            'Marketing': 'bg-purple-100 text-purple-800',
            'Maintenance': 'bg-orange-100 text-orange-800',
            'Equipment': 'bg-indigo-100 text-indigo-800',
            'Other': 'bg-gray-100 text-gray-800'
        };
        const catColor = categoryColors[exp.category] || 'bg-gray-100 text-gray-800';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${srNo}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${formattedDate}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${catColor}">${exp.category}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-red-600">₹${Number(exp.amount).toLocaleString()}</td>
            <td class="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]" title="${exp.remarks || ''}">${exp.remarks || '-'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium space-x-2">
                <button data-action="view-exp" data-id="${exp.id}" class="text-blue-600 hover:text-blue-900 transition-colors cursor-pointer" title="View">
                    <i class="fas fa-eye text-lg"></i>
                </button>
                <button data-action="edit-exp" data-id="${exp.id}" class="text-orange-500 hover:text-orange-700 transition-colors cursor-pointer" title="Edit">
                    <i class="fas fa-edit text-lg"></i>
                </button>
                <button data-action="delete-exp" data-id="${exp.id}" class="text-red-600 hover:text-red-900 transition-colors cursor-pointer" title="Delete">
                    <i class="fas fa-trash-alt text-lg"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Load summary cards
    loadExpenseSummary();
}

function renderExpensePagination() {
    const pageNumbersContainer = document.getElementById('exp-page-numbers');
    if (!pageNumbersContainer) return;
    pageNumbersContainer.innerHTML = '';

    const prevBtn = document.getElementById('exp-prev-btn');
    const nextBtn = document.getElementById('exp-next-btn');
    const prevMobile = document.getElementById('exp-prev-mobile');
    const nextMobile = document.getElementById('exp-next-mobile');

    if (prevBtn) prevBtn.disabled = currentExpensePage === 1;
    if (nextBtn) nextBtn.disabled = currentExpensePage === totalExpensePages;
    if (prevMobile) prevMobile.disabled = currentExpensePage === 1;
    if (nextMobile) nextMobile.disabled = currentExpensePage === totalExpensePages;

    for (let i = 1; i <= totalExpensePages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.onclick = () => {
            currentExpensePage = i;
            loadExpenses();
        };
        if (i === currentExpensePage) {
            btn.className = 'z-10 bg-primary-50 border-primary-500 text-primary-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        } else {
            btn.className = 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium';
        }
        pageNumbersContainer.appendChild(btn);
    }
}

function changeExpensePage(offset) {
    const newPage = currentExpensePage + offset;
    if (newPage > 0 && newPage <= totalExpensePages) {
        currentExpensePage = newPage;
        loadExpenses();
    }
}

function searchExpenses() {
    const query = document.getElementById('exp-search').value.trim();
    currentExpenseSearchQuery = query;
    currentExpensePage = 1;
    loadExpenses();
}

function openExpenseModal(editId) {
    if (editId) {
        currentEditExpenseId = editId;
        document.getElementById('expense-modal-title').textContent = 'Edit Expense';
        const exp = expenseCache.get(editId);
        if (exp) {
            document.getElementById('ex-id').value = exp.id;
            document.getElementById('ex-date').value = exp.expense_date;
            document.getElementById('ex-category').value = exp.category;
            document.getElementById('ex-amount').value = exp.amount;
            document.getElementById('ex-remarks').value = exp.remarks || '';
        }
    } else {
        currentEditExpenseId = null;
        document.getElementById('expense-modal-title').textContent = 'Add Expense';
        document.getElementById('expense-form').reset();
        document.getElementById('ex-id').value = '';
        document.getElementById('ex-date').valueAsDate = new Date();
    }
    openModal('expense-modal');
}

async function saveExpense() {
    const date = document.getElementById('ex-date').value;
    const category = document.getElementById('ex-category').value;
    const amount = document.getElementById('ex-amount').value;
    const remarks = document.getElementById('ex-remarks').value;

    if (!date || !category || !amount) {
        await showAlert('Please fill in Date, Category and Amount.', 'Missing Fields');
        return;
    }

    if (!window.api) return;

    let result;
    if (currentEditExpenseId) {
        result = await window.api.updateExpense({
            id: currentEditExpenseId,
            date, category,
            amount: parseFloat(amount),
            remarks
        });
    } else {
        result = await window.api.addExpense({
            date, category,
            amount: parseFloat(amount),
            remarks
        });
    }

    if (result.success) {
        closeModal('expense-modal');
        loadExpenses();
        await showAlert(currentEditExpenseId ? 'Expense updated successfully!' : 'Expense added successfully!', 'Success');
    } else {
        await showAlert('Error: ' + result.error, 'Error');
    }
}

async function viewExpense(id) {
    const exp = expenseCache.get(id);
    if (!exp) return;

    document.getElementById('exv-date').value = formatDate(exp.expense_date);
    document.getElementById('exv-category').value = exp.category;
    document.getElementById('exv-amount').value = '₹' + Number(exp.amount).toLocaleString();
    document.getElementById('exv-remarks').value = exp.remarks || '-';

    openModal('expense-view-modal');
}

async function editExpense(id) {
    const ok = await askPassword('Enter Password to Edit Expense');
    if (!ok) return;
    openExpenseModal(id);
}

async function deleteExpense(id) {
    const ok = await askPassword('Enter Password to Delete Expense');
    if (!ok) return;

    const confirmed = await showConfirm('Are you sure you want to delete this expense? This cannot be undone.', 'Confirm Delete');
    if (!confirmed) return;

    if (!window.api) return;
    const result = await window.api.deleteExpense(id);
    if (result.success) {
        loadExpenses();
        await showAlert('Expense deleted successfully.', 'Deleted');
    } else {
        await showAlert('Error: ' + result.error, 'Error');
    }
}

async function loadExpenseSummary() {
    if (!window.api) return;
    try {
        const summary = await window.api.getExpenseSummary();
        document.getElementById('exp-total').textContent = '₹' + Number(summary.totalExpenses).toLocaleString();
        document.getElementById('exp-monthly').textContent = '₹' + Number(summary.monthlyExpenses).toLocaleString();

        if (summary.categoryBreakdown && summary.categoryBreakdown.length > 0) {
            document.getElementById('exp-top-cat').textContent = summary.categoryBreakdown[0].category;
        } else {
            document.getElementById('exp-top-cat').textContent = '--';
        }
    } catch(e) {
        console.error('Expense summary error:', e);
    }
}

// Event delegation for expense table action buttons
document.addEventListener('DOMContentLoaded', () => {
    const expensesTableBody = document.getElementById('expenses-table-body');
    if (expensesTableBody) {
        expensesTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = parseInt(btn.getAttribute('data-id'));
            if (action === 'view-exp') viewExpense(id);
            if (action === 'edit-exp') editExpense(id);
            if (action === 'delete-exp') deleteExpense(id);
        });
    }
});

async function exportCustomersCSV() {
    if (!window.api) return;
    
    try {
        const customers = await window.api.exportAllCustomers();
        
        if (!customers || customers.length === 0) {
            await showAlert("No valid customers found to export.", "Empty Export");
            return;
        }

        let csvContent = "Name,Phone Number\n";
        
        customers.forEach(customer => {
            // Escape names that might have commas formatting issues in CSV
            let sanitizedName = customer.name;
            if (sanitizedName.includes(',') || sanitizedName.includes('"')) {
                sanitizedName = `"${sanitizedName.replace(/"/g, '""')}"`;
            }
            csvContent += `${sanitizedName},${customer.phone}\n`;
        });

        // Trigger CSV Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        const dateString = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `customer_export_${dateString}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        await showAlert(`Successfully exported ${customers.length} unique customer numbers.`, "Export Complete");
    } catch (error) {
        console.error("Export Error:", error);
        await showAlert("Failed to export customers. " + error.message, "Export Error");
    }
}
