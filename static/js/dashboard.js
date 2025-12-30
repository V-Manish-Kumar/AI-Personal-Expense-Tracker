// Global Charts
let trendChart = null;
let pieChart = null;

// Theme Colors
const themeColors = {
    dark: { text: '#94a3b8', grid: '#334155', bg: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] },
    light: { text: '#64748b', grid: '#e2e8f0', bg: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }
};

// Currency Logic
const currencyRates = { 'INR': 1, 'USD': 0.012, 'EUR': 0.011 }; // Approx Rates (Base INR)
const currencySymbols = { 'INR': '₹', 'USD': '$', 'EUR': '€' };

function getCurrency() {
    const selector = document.getElementById('currency-select');
    return selector ? selector.value : 'INR';
}

function formatAmount(amount) {
    const curr = getCurrency();
    const rate = currencyRates[curr];
    const converted = amount * rate;
    return `${currencySymbols[curr]}${converted.toFixed(2)}`;
}

function updateCurrency() {
    loadDashboard(); // Refetch and re-render with new currency
}

// Utils
const isLight = () => document.body.classList.contains('light-mode');
const getTheme = () => isLight() ? themeColors.light : themeColors.dark;

document.getElementById('curr-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// Init
async function loadDashboard() {
    await Promise.all([
        fetchStats(),
        fetchRecent(),
        fetchCharts()
    ]);
}

// 1. Stats
async function fetchStats() {
    const res = await fetch('/stats');
    const data = await res.json();
    document.getElementById('stat-total').innerText = formatAmount(data.total_balance);
    document.getElementById('stat-top').innerText = data.highest_category;
    document.getElementById('stat-count').innerText = data.transaction_count;
}

// 2. Recent Transactions
async function fetchRecent() {
    const res = await fetch('/recent_expenses');
    const data = await res.json();
    const tbody = document.getElementById('tx-body');
    tbody.innerHTML = '';

    data.forEach(tx => {
        const date = new Date(tx.date).toLocaleDateString();
        const tr = `
            <tr>
                <td><span style="font-weight: 500">${tx.category}</span></td>
                <td style="color: var(--text-muted)">${tx.note || '-'}</td>
                <td style="color: var(--text-muted)">${date}</td>
                <td style="font-weight: 600; color: var(--danger)">-${formatAmount(tx.amount)}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

// 3. Charts
async function fetchCharts() {
    const theme = getTheme();
    Chart.defaults.color = theme.text;
    Chart.defaults.borderColor = theme.grid;

    // Trend Data
    const trendRes = await fetch('/spending_trend');
    const trendData = await trendRes.json();
    const trendLabels = trendData.map(d => d[0]);
    // Convert values for chart
    const curr = getCurrency();
    const rate = currencyRates[curr];
    const trendValues = trendData.map(d => d[1] * rate);

    // Pie Data
    const pieRes = await fetch('/expenses');
    const pieDataRaw = await pieRes.json();
    const pieLabels = pieDataRaw.map(d => d[0]);
    const pieValues = pieDataRaw.map(d => d[1] * rate);

    // Render Trend
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();

    // Create Gradient
    const gradient = ctxTrend.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Primary color with opacity
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: `Spending (${curr})`,
                data: trendValues,
                borderColor: isLight() ? '#2563eb' : '#3b82f6',
                backgroundColor: gradient,
                fill: true,
                tension: 0.3, // Slightly sharper curves
                pointBackgroundColor: isLight() ? '#ffffff' : '#0f172a',
                pointBorderColor: isLight() ? '#2563eb' : '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 6, // Larger points
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, border: { display: false } }
            }
        }
    });

    // Render Pie
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: theme.bg,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 10 } }
            }
        }
    });

    // Render Bar Check
    const ctxBar = document.getElementById('barChart');
    if (ctxBar) {
        if (window.barChartInstance) window.barChartInstance.destroy();

        window.barChartInstance = new Chart(ctxBar.getContext('2d'), {
            type: 'bar',
            data: {
                labels: pieLabels, // Reuse category labels
                datasets: [{
                    label: `Amount (${curr})`,
                    data: pieValues, // Reuse category values
                    backgroundColor: theme.bg,
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, border: { display: false }, grid: { color: theme.grid } }
                }
            }
        });
    }
}

// Modal Logic
function openAddModal() {
    document.getElementById('addModal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
}

async function addExpense() {
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const note = document.getElementById('note').value;

    if (!amount || !category) {
        alert("Enter Amount and Category");
        return;
    }

    await fetch('/add_expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, category, note })
    });

    closeAddModal();
    // Clear
    document.getElementById('amount').value = '';
    document.getElementById('category').value = '';
    document.getElementById('note').value = '';

    // Refresh
    loadDashboard();
}

// Chat UI Logic
function toggleChat() {
    const widget = document.getElementById('chatWidget');
    const icon = document.getElementById('chatIcon');
    widget.classList.toggle('collapsed');

    if (widget.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        // Init chat if empty
        if (document.getElementById('chat-history').children.length === 0) {
            initChat();
        }
    }
}

// Reuse existing chat logic (slightly modified for DOM IDs)
async function initChat() {
    const historyDiv = document.getElementById("chat-history");
    historyDiv.innerHTML = '<div class="loading"></div>';
    try {
        const res = await fetch("/init_chat", { method: "POST" });
        const data = await res.json();
        historyDiv.innerHTML = '';
        appendMessage('bot', data.response);
    } catch (err) {
        historyDiv.innerHTML = `<div class="message bot-message">Error connecting.</div>`;
    }
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage('user', msg);
    input.value = '';

    const historyDiv = document.getElementById("chat-history");
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message bot-message";
    loadingDiv.innerHTML = '<div class="loading"></div>';
    historyDiv.appendChild(loadingDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        loadingDiv.remove();
        appendMessage('bot', data.response);
    } catch {
        loadingDiv.remove();
        appendMessage('bot', "Error.");
    }
}

function appendMessage(sender, text) {
    const div = document.createElement("div");
    div.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'}`;
    div.innerText = text;
    document.getElementById("chat-history").appendChild(div);
    document.getElementById("chat-history").scrollTop = 9999;
}

function handleKeyPress(e) {
    if (e.key === 'Enter') sendMessage();
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const icon = document.querySelector('.theme-toggle i');
    icon.classList.toggle('fa-sun');
    icon.classList.toggle('fa-moon');
    loadDashboard(); // Redraw charts
}

// Initial Load
loadDashboard();
