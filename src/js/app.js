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
                    if (target === 'dashboard') initDashboard('monthly');
                    if (target === 'visit-entry') loadRecentVisits();
                    if (target === 'enquiries') loadEnquiries();
                    if (target === 'calls') loadCalls();
                    if (target === 'expenses') loadExpenses();
                    if (target === 'smart-recall') loadSmartRecall();
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
    initDashboard('monthly');
});

let therapistChartInstance = null;

async function initDashboard(filter) {
    try {
        if (!window.api) return; // For browser testing fallback
        const stats = await window.api.getDashboardStats(filter);
        document.querySelector('.border-primary-500 .text-2xl').textContent = stats.totalCustomers;
        document.querySelector('.border-green-500 .text-2xl').textContent = `₹${stats.revenue.toLocaleString()}`;
        document.getElementById('dash-avg').textContent = `₹${stats.avgSpending}`;

        const tStats = await window.api.getTherapistStats(filter);
        renderTherapistChart(tStats);

        const topCustomers = await window.api.getTopCustomers();
        renderTopCustomers(topCustomers);
    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
}

function renderTherapistChart(data) {
    const ctx = document.getElementById('therapistChart');
    if (!ctx) return;

    if (therapistChartInstance) {
        therapistChartInstance.destroy();
    }

    therapistChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Revenue (₹)',
                data: data.map(d => d.revenue || 0),
                backgroundColor: '#3b82f6',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderTopCustomers(data) {
    const tbody = document.getElementById('top-customers-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${c.name} ${c.vip_status ? '<i class="fas fa-star text-yellow-400 text-xs"></i>' : ''}</div>
                <div class="text-xs text-gray-500">${c.phone}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${c.visits}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">₹${c.total_spent.toLocaleString()}</td>
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

    // Event delegation for enquiries table action buttons
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
        const dateObj = new Date(v.visit_date);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;

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
        // Format Date to dd-mm-yyyy
        const dateObj = new Date(v.visit_date);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;

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

        // Format Date to dd-mm-yyyy
        const dateObj = new Date(e.enquiry_date);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;

        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${displayName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${e.service_interested || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${e.status}</span>
                </td>
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

async function loadCalls() {
    if (!window.api) return;
    const items = await window.api.getCalls();
    const tbody = document.getElementById('calls-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    items.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(c.call_date).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${c.customer_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.purpose}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.next_follow_up ? new Date(c.next_follow_up).toLocaleDateString() : '-'}</td>
            </tr>
        `;
    });
}

async function saveCall() {
    if (!window.api) return;
    const data = {
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        date: document.getElementById('c-date').value,
        counselor: document.getElementById('c-counselor').value,
        purpose: document.getElementById('c-purpose').value,
        follow: document.getElementById('c-follow').value,
        notes: document.getElementById('c-notes').value
    };

    if (!data.name || !data.phone || !data.date || !data.counselor) {
        await showAlert("Please fill required fields.", "Missing Info");
        return;
    }

    const res = await window.api.addCall(data);
    if (res.success) {
        await showAlert("Call recorded successfully!", "Success");
        closeModal('call-modal');
        document.getElementById('call-form').reset();
        document.getElementById('c-date').valueAsDate = new Date();
        loadCalls();
    } else {
        await showAlert("Failed to record call: " + res.error, "Error");
    }
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
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(ex.expense_date).toLocaleDateString()}</td>
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

async function loadSmartRecall() {
    if (!window.api) return;
    const items = await window.api.getSmartRecall();
    const tbody = document.getElementById('recall-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No overdue customers found.</td></tr>';
        return;
    }

    items.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${c.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-semibold">${new Date(c.last_visit).toLocaleDateString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.total_visits}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button class="btn-primary text-xs" onclick="recordCallFromRecall('${c.name}', '${c.phone}')">
                        <i class="fas fa-phone"></i> Call
                    </button>
                </td>
            </tr>
        `;
    });
}

function recordCallFromRecall(name, phone) {
    // Open call modal and pre-fill data
    openModal('call-modal');
    document.getElementById('c-name').value = name;
    document.getElementById('c-phone').value = phone;
    document.getElementById('c-date').valueAsDate = new Date();
    document.getElementById('c-purpose').value = 'Other';
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

    const tbody = document.getElementById('ch-visits-body');
    tbody.innerHTML = '';

    if (visits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-3 text-center text-sm text-gray-500">No visits recorded.</td></tr>';
        return;
    }

    visits.forEach(v => {
        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${new Date(v.visit_date).toLocaleDateString()}</td>
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
            initDashboard('monthly'); // Refresh stats since things moved
        } else {
            await showAlert('Failed to merge: ' + res.error, 'Error');
        }
    }
}
