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

// Connect to Server-Sent Events (SSE) Live Feed for real-time major events
function setupSSE() {
  const eventSource = new EventSource('/api/stream');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'CONNECTED') return;

      // Only real data >= $10,000 USD
      if (!data.amountFormatted || data.amountFormatted < 10000) return;

      // New verified event received
      eventsList.unshift(data);
      if (eventsList.length > 100) eventsList.pop();

      // Show clean toast for real institutional transactions
      const icon = data.eventType === 'MINT' ? '🟢 MINT' : '🔥 BURN';
      showToast(`${icon}: ${formatUSD(data.amountFormatted)} ${data.token} verified on-chain!`, data.eventType.toLowerCase());

      renderEventsTable(eventsList);
      fetchStatusAndStats();
    } catch (e) {
      console.error('Error parsing SSE:', e);
    }
  };

  eventSource.onerror = () => {
    setTimeout(setupSSE, 10000);
  };
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchStatusAndStats();
  fetchEvents();
  setupSSE();

  // 1-Minute Interval Sync (Exactly every 60 seconds)
  setInterval(() => {
    fetchStatusAndStats();
    fetchEvents();
  }, 60000);

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

  // Database Cleanup Modal Controls
  const cleanupModal = document.getElementById('cleanup-modal');
  const btnOpenCleanup = document.getElementById('btn-open-cleanup-modal');
  const btnCloseCleanup = document.getElementById('btn-close-cleanup-modal');
  const modalDbCount = document.getElementById('modal-db-count');

  function openCleanupModal() {
    modalDbCount.textContent = document.getElementById('health-events').textContent;
    cleanupModal.classList.add('active');
  }

  function closeCleanupModal() {
    cleanupModal.classList.remove('active');
  }

  if (btnOpenCleanup) btnOpenCleanup.addEventListener('click', openCleanupModal);
  if (btnCloseCleanup) btnCloseCleanup.addEventListener('click', closeCleanupModal);
  if (cleanupModal) {
    cleanupModal.addEventListener('click', (e) => {
      if (e.target === cleanupModal) closeCleanupModal();
    });
  }

  // Execute Cleanup API Request
  async function executeCleanup(payload, confirmMessage) {
    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch('/api/events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        showToast(`🗑️ ${result.message}`, 'success');
        modalDbCount.textContent = result.remainingCount.toLocaleString();
        document.getElementById('health-events').textContent = result.remainingCount.toLocaleString();
        
        // Refresh table & stats
        fetchEvents();
        fetchStatusAndStats();
      } else {
        showToast(`❌ Cleanup Failed: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ Network error during cleanup request.', 'error');
    }
  }

  // Preset buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      const hours = btn.getAttribute('data-hours');
      const days = btn.getAttribute('data-days');

      let label = 'selected time period';
      if (hours) label = `older than ${hours} hours`;
      if (days) label = `older than ${days} days`;

      executeCleanup(
        { mode, hours, olderThanDays: days },
        `Are you sure you want to delete all transaction records ${label}?`
      );
    });
  });

  // Date Range Button
  const btnDeleteRange = document.getElementById('btn-delete-range');
  if (btnDeleteRange) {
    btnDeleteRange.addEventListener('click', () => {
      const fromVal = document.getElementById('cleanup-from-date').value;
      const toVal = document.getElementById('cleanup-to-date').value;

      if (!fromVal || !toVal) {
        showToast('⚠️ Please select both Start Date and End Date.', 'error');
        return;
      }

      if (new Date(fromVal) > new Date(toVal)) {
        showToast('⚠️ Start Date cannot be after End Date.', 'error');
        return;
      }

      executeCleanup(
        { mode: 'RANGE', fromDate: fromVal, toDate: toVal },
        `Are you sure you want to delete all records between ${new Date(fromVal).toLocaleString()} and ${new Date(toVal).toLocaleString()}?`
      );
    });
  }

  // Delete ALL Button
  const btnDeleteAll = document.getElementById('btn-delete-all');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', () => {
      executeCleanup(
        { mode: 'ALL' },
        '🚨 WARNING: Are you sure you want to DELETE ALL transaction records from the database? This action is permanent and cannot be undone!'
      );
    });
  }
});
