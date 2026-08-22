// Mint Father Frontend Application
let currentTokenFilter = 'ALL';
let currentTypeFilter = 'ALL';
let eventsList = [];

// Formatting helpers
function formatUSD(num) {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);
}

function formatCompactUSD(num, includeDollar = true) {
  if (num === undefined || num === null || isNaN(num)) return includeDollar ? '$0' : '0';
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const prefix = includeDollar ? '$' : '';

  let formatted = '';
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'B';
  } else if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'M';
  } else if (abs >= 1_000) {
    const val = abs / 1_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(val >= 100 ? 1 : 2).replace(/\.?0+$/, '')) + 'K';
  } else {
    formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  return `${isNegative ? '-' : ''}${prefix}${formatted}`;
}

function formatShortAddress(address) {
  if (!address) return 'N/A';
  if (address.length <= 14) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const icon = type === 'success' ? '✅' : (type === 'mint' ? '🟢' : (type === 'burn' ? '🔥' : '🚨'));
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
      document.getElementById('health-subs').textContent = `${data.telegramBot.activeSubscribers} active`;
      
      if (data.prices) {
        document.getElementById('health-btc-price').textContent = `$${Math.round(data.prices.BTC || 65000).toLocaleString()}`;
        document.getElementById('health-eth-price').textContent = `$${Math.round(data.prices.ETH || 2800).toLocaleString()}`;
      }

      if (data.telegramBot.username) {
        document.getElementById('tg-link-btn').href = `https://t.me/${data.telegramBot.username}`;
      }
    }

    // 2. Stats
    const statsRes = await fetch('/api/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const usdt = stats.last24Hours.USDT;
      const usdc = stats.last24Hours.USDC;
      const btc = stats.last24Hours.BTC;
      const eth = stats.last24Hours.ETH;

      // USDT
      const usdtTotal = (usdt.mint || 0) + (usdt.burn || 0);
      document.getElementById('stat-usdt-total').textContent = formatCompactUSD(usdtTotal);
      document.getElementById('stat-usdt-sub').textContent = `Mint: ${formatCompactUSD(usdt.mint)} | Burn: ${formatCompactUSD(usdt.burn)}`;

      // USDC
      const usdcTotal = (usdc.mint || 0) + (usdc.burn || 0);
      document.getElementById('stat-usdc-total').textContent = formatCompactUSD(usdcTotal);
      document.getElementById('stat-usdc-sub').textContent = `Mint: ${formatCompactUSD(usdc.mint)} | Burn: ${formatCompactUSD(usdc.burn)}`;

      // BTC
      const btcTotal = (btc.inflow || 0) + (btc.outflow || 0);
      document.getElementById('stat-btc-total').textContent = formatCompactUSD(btcTotal);
      document.getElementById('stat-btc-sub').textContent = `In: ${formatCompactUSD(btc.inflow)} | Out: ${formatCompactUSD(btc.outflow)}`;

      // ETH
      const ethTotal = (eth.inflow || 0) + (eth.outflow || 0);
      document.getElementById('stat-eth-total').textContent = formatCompactUSD(ethTotal);
      document.getElementById('stat-eth-sub').textContent = `In: ${formatCompactUSD(eth.inflow)} | Out: ${formatCompactUSD(eth.outflow)}`;
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
        <td colspan="9">
          <div class="empty-feed-box">
            <p>No major transactions (≥$100M) found matching the current filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(ev => {
    let typeBadge = '';
    if (ev.eventType === 'MINT') {
      typeBadge = `<span class="badge-mint">🟢 MINT</span>`;
    } else if (ev.eventType === 'BURN') {
      typeBadge = `<span class="badge-burn">🔥 BURN</span>`;
    } else if (ev.eventType === 'WALLET_TO_EXCHANGE') {
      typeBadge = `<span class="badge-inflow" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">📥 INFLOW</span>`;
    } else if (ev.eventType === 'EXCHANGE_TO_WALLET') {
      typeBadge = `<span class="badge-outflow" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 11px;">📤 OUTFLOW</span>`;
    } else {
      typeBadge = `<span class="badge-mint">🚨 ${ev.eventType}</span>`;
    }
    
    let tokenIcon = '🪙';
    if (ev.token === 'BTC') tokenIcon = '🟧';
    else if (ev.token === 'ETH') tokenIcon = '🔷';
    else if (ev.token === 'USDT') tokenIcon = '💵';
    else if (ev.token === 'USDC') tokenIcon = '🔵';

    const timeStr = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fromDisplay = ev.fromLabel || formatShortAddress(ev.from);
    const toDisplay = ev.toLabel || formatShortAddress(ev.to);

    const valUsd = ev.valueUsd || ev.amountFormatted;
    const amountStr = (ev.token === 'BTC' || ev.token === 'ETH')
      ? `${Number(ev.amountFormatted).toLocaleString()} ${ev.token}`
      : `${formatUSD(ev.amountFormatted)}`;

    const explorerUrl = ev.explorerUrl || (ev.network === 'Bitcoin' ? `https://mempool.space/tx/${ev.txHash}` : `https://etherscan.io/tx/${ev.txHash}`);

    return `
      <tr>
        <td>${typeBadge}</td>
        <td>
          <span class="token-pill">
            <span>${tokenIcon}</span> ${ev.token}
          </span>
        </td>
        <td class="amount-cell" title="Exact: ${formatUSD(valUsd)}">
          <span class="amount-compact" style="color: #38bdf8; font-weight: 700;">${formatCompactUSD(valUsd)}</span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">
          ${amountStr}
        </td>
        <td>
          <span class="address-tag" title="${ev.from}">
            ${fromDisplay}
          </span>
        </td>
        <td>
          <span class="address-tag" title="${ev.to}">
            ${toDisplay}
          </span>
        </td>
        <td style="font-family: var(--font-mono); color: var(--text-muted); font-size: 12px;">${ev.network || 'Ethereum'}</td>
        <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${timeStr}</td>
        <td>
          <a href="${explorerUrl}" target="_blank" class="tx-link">
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

      const val = data.valueUsd || data.amountFormatted;
      if (!val || val < 100_000_000) return;

      eventsList.unshift(data);
      if (eventsList.length > 100) eventsList.pop();

      showToast(`🚨 ${data.token} ${data.eventType}: ${formatCompactUSD(val)} on ${data.network || 'Mainnet'}!`, 'info');

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

  // 1-Minute Interval Sync
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

  // Test Alert Button (cycles through test alert types)
  const testBtn = document.getElementById('btn-test-alert');
  const testTypes = ['USDT_MINT', 'BTC_INFLOW', 'ETH_OUTFLOW', 'USDC_BURN'];
  let testIdx = 0;

  testBtn.addEventListener('click', async () => {
    const selectedType = testTypes[testIdx % testTypes.length];
    testIdx++;
    testBtn.disabled = true;
    testBtn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/test-alert', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Test ${selectedType} (≥$100M) sent to Telegram & Live Feed!`, 'success');
      } else {
        showToast('Error: ' + data.error, 'error');
      }
    } catch (e) {
      showToast('Failed to trigger test alert.', 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '🧪 Test Alert';
    }
  });

  // Database Cleanup Modal Controls
  const cleanupModal = document.getElementById('cleanup-modal');
  const btnOpenCleanup = document.getElementById('btn-open-cleanup-modal');
  const btnCloseCleanup = document.getElementById('btn-close-cleanup-modal');
  const modalDbCount = document.getElementById('modal-db-count');

  function openCleanupModal() {
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
