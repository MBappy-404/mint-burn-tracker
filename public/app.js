// Mint Father Frontend Application
let currentTokenFilter = 'ALL';
let currentTypeFilter = 'ALL';
let eventsList = [];

// Formatting helpers
function formatUSD(num) {
  if (num === undefined || num === null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);
}

function formatShortAddress(address) {
  if (!address) return 'N/A';
  if (address.length <= 12) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icon = type === 'success' ? '✅' : (type === 'mint' ? '🟢' : (type === 'burn' ? '🔥' : 'ℹ️'));
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Fetch System Status & Stats
async function fetchStatusAndStats() {
  try {
    // 1. Status
    const statusRes = await fetch('/api/status');
    if (statusRes.ok) {
      const data = await statusRes.json();
      document.getElementById('health-block').textContent = `Block #${data.blockchain.lastProcessedBlock?.toLocaleString() || 'Syncing'}`;
      document.getElementById('health-db').textContent = data.database.connected ? 'MongoDB Connected' : 'DB Disconnected';
      document.getElementById('health-subs').textContent = `${data.telegramBot.activeSubscribers} active`;
      document.getElementById('health-events').textContent = (data.totalEventsRecorded || 0).toLocaleString();

      if (data.telegramBot.username) {
        document.getElementById('tg-link-btn').href = `https://t.me/${data.telegramBot.username}`;
      }
    }

    // 2. Stats
    const statsRes = await fetch('/api/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const usdt24 = stats.last24Hours.USDT;
      const usdc24 = stats.last24Hours.USDC;

      document.getElementById('stat-usdt-mint').textContent = formatUSD(usdt24.mint);
      document.getElementById('stat-usdt-mint-count').textContent = `${usdt24.mintCount} txs (24h)`;

      document.getElementById('stat-usdt-burn').textContent = formatUSD(usdt24.burn);
      document.getElementById('stat-usdt-burn-count').textContent = `${usdt24.burnCount} txs (24h)`;

      document.getElementById('stat-usdc-mint').textContent = formatUSD(usdc24.mint);
      document.getElementById('stat-usdc-mint-count').textContent = `${usdc24.mintCount} txs (24h)`;

      document.getElementById('stat-usdc-burn').textContent = formatUSD(usdc24.burn);
      document.getElementById('stat-usdc-burn-count').textContent = `${usdc24.burnCount} txs (24h)`;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

// Fetch Events List
async function fetchEvents() {
  try {
    let url = '/api/events?limit=50';
    if (currentTokenFilter !== 'ALL') url += `&token=${currentTokenFilter}`;
    if (currentTypeFilter !== 'ALL') url += `&type=${currentTypeFilter}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      eventsList = data.events || [];
      renderEventsTable(eventsList);
    }
  } catch (err) {
    console.error('Error fetching events:', err);
  }
}

// Render Table Rows
function renderEventsTable(events) {
  const tbody = document.getElementById('events-tbody');
  
  if (!events || events.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-state">
        <td colspan="8">
          <div class="empty-feed-box">
            <p>No mint or burn transactions found matching the current filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(ev => {
    const isMint = ev.eventType === 'MINT';
    const typeBadge = isMint 
      ? `<span class="badge-mint">🟢 MINT</span>` 
      : `<span class="badge-burn">🔥 BURN</span>`;
    
    const tokenIcon = ev.token === 'USDT' ? '💵' : '🔵';
    const timeStr = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fromDisplay = ev.fromLabel || formatShortAddress(ev.from);
    const toDisplay = ev.toLabel || formatShortAddress(ev.to);

    return `
      <tr>
        <td>${typeBadge}</td>
        <td>
          <span class="token-pill">
            <span>${tokenIcon}</span> ${ev.token}
          </span>
        </td>
        <td class="amount-cell">${formatUSD(ev.amountFormatted)}</td>
        <td>
          <a href="https://etherscan.io/address/${ev.from}" target="_blank" class="address-tag" title="${ev.from}">
            ${fromDisplay}
          </a>
        </td>
        <td>
          <a href="https://etherscan.io/address/${ev.to}" target="_blank" class="address-tag" title="${ev.to}">
            ${toDisplay}
          </a>
        </td>
        <td style="font-family: var(--font-mono); color: var(--text-muted);">#${ev.blockNumber?.toLocaleString() || 'N/A'}</td>
        <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${timeStr}</td>
        <td>
          <a href="${ev.explorerUrl || `https://etherscan.io/tx/${ev.txHash}`}" target="_blank" class="tx-link">
            <span>${ev.txHash.substring(0, 6)}...</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// Connect to Server-Sent Events (SSE) Live Feed
function setupSSE() {
  const eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'CONNECTED') return;

      // New event received in real-time
      eventsList.unshift(data);
      if (eventsList.length > 100) eventsList.pop();

      // Show toast notification
      const icon = data.eventType === 'MINT' ? '🟢 MINT' : '🔥 BURN';
      showToast(`${icon}: ${formatUSD(data.amountFormatted)} ${data.token} detected!`, data.eventType.toLowerCase());

      renderEventsTable(eventsList);
      fetchStatusAndStats();
    } catch (e) {
      console.error('Error parsing SSE:', e);
    }
  };

  eventSource.onerror = () => {
    setTimeout(setupSSE, 5000);
  };
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchStatusAndStats();
  fetchEvents();
  setupSSE();

  // Polling fallback for status updates
  setInterval(fetchStatusAndStats, 10000);

  // Token filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTokenFilter = btn.getAttribute('data-filter');
      fetchEvents();
    });
  });

  // Type filters
  document.querySelectorAll('.filter-btn-type').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTypeFilter = btn.getAttribute('data-type');
      fetchEvents();
    });
  });

  // Test Alert Button
  const testBtn = document.getElementById('btn-test-alert');
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/test-alert', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Test alert sent to Telegram & Live Feed!', 'success');
      } else {
        showToast('Error: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Failed to trigger test alert.', 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '🧪 Trigger Test Alert';
    }
  });
});
