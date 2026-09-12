// All client-side logic for Rundown: render, add/edit/delete, sort,
// hide/unhide, custom colored dropdowns, the details drawer, list settings,
// and autosave to the local server.

const STATUS_OPTIONS = ['not started', 'in progress', 'blocked', 'completed', 'cancelled'];
const PRIORITY_OPTIONS = ['critical', 'high', 'normal', 'low'];
const STATUS_SORT_ORDER = ['not started', 'in progress', 'blocked'];
const PRIORITY_SORT_ORDER = ['critical', 'high', 'normal', 'low'];
const HIDDEN_STATUSES = new Set(['completed', 'cancelled']);

const STATUS_LABELS = {
  'not started': 'Not started',
  'in progress': 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled'
};
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', normal: 'Normal', low: 'Low' };

const ICON_DETAILS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line></svg>';
const ICON_HIDE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0112 20c-5 0-9.27-3.11-11-8 .72-2.02 1.99-3.86 3.6-5.32M9.9 4.24A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8a12.7 12.7 0 01-1.67 3.19"></path><path d="M14.12 14.12a3 3 0 11-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
const ICON_SHOW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const ICON_DRAG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="8" cy="6" r="1.5"></circle><circle cx="8" cy="12" r="1.5"></circle><circle cx="8" cy="18" r="1.5"></circle><circle cx="16" cy="6" r="1.5"></circle><circle cx="16" cy="12" r="1.5"></circle><circle cx="16" cy="18" r="1.5"></circle></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
const ICON_CLOUD = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a5 5 0 01-1-9.9A6 6 0 0118 8.2 4.5 4.5 0 0117.5 19z"></path></svg>';
const ICON_CLOUD_OFF = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H8a5 5 0 01-1-9.9A6 6 0 0118 8.2 4.5 4.5 0 0117.5 19z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

const ICON_PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

// Compact status icons used on the phone instead of the text badges.
const STATUS_ICONS = {
  'not started': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle></svg>',
  'in progress': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>',
  blocked: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="4.5" y1="4.5" x2="19.5" y2="19.5"></line></svg>',
  completed: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  cancelled: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
};

let state = null;
let saveTimer = null;
let currentDrawerItem = null; // { listId, itemId }
let openMenu = null; // { el, trigger }
let draggedListId = null;
let activeListId = null; // mobile: which list the single-list view shows
let SERVER_MODE = false; // true when the local Node server (/api/data) is present

const LS_STATE_KEY = 'rundown.state';
const LS_SYNC_KEY = 'rundown.syncConfig';

const MOBILE_QUERY = window.matchMedia('(max-width: 900px)');
function isMobile() { return MOBILE_QUERY.matches; }

const container = document.getElementById('listsContainer');
const settingsBtn = document.getElementById('settingsBtn');
const drawer = document.getElementById('detailsDrawer');
const overlay = document.getElementById('overlay');
const drawerTitle = document.getElementById('drawerTitle');
const drawerEditor = document.getElementById('drawerEditor');
const drawerCloseBtn = document.getElementById('drawerCloseBtn');
const drawerAddLinkBtn = document.getElementById('drawerAddLinkBtn');

const linkModal = document.getElementById('linkModal');
const linkModalCloseBtn = document.getElementById('linkModalCloseBtn');
const linkModalForm = document.getElementById('linkModalForm');
const linkUrlInput = document.getElementById('linkUrlInput');
let pendingLinkRange = null;

const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const settingsListsList = document.getElementById('settingsListsList');
const settingsAddForm = document.getElementById('settingsAddListForm');
const settingsNewListName = document.getElementById('settingsNewListName');

const syncBtn = document.getElementById('syncBtn');
const syncStatusText = document.getElementById('syncStatusText');
const syncConfigForm = document.getElementById('syncConfigForm');
const syncRelayUrlInput = document.getElementById('syncRelayUrlInput');
const syncApiKeyInput = document.getElementById('syncApiKeyInput');
const listSwitcher = document.getElementById('listSwitcher');
const syncHelpText = document.getElementById('syncHelpText');

const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

init();

async function init() {
  state = await loadState();
  if (!SERVER_MODE && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(() => {
      // A newly-deployed service worker takes control of the open page via
      // skipWaiting + clients.claim; reload once so the fresh app shell
      // actually runs. A standalone PWA has no address bar to refresh from,
      // so this is the only way updates can apply themselves.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }).catch(() => {});
  }
  render();

  updateClock();
  setInterval(updateClock, 1000);

  settingsBtn.addEventListener('click', openSettings);
  settingsCloseBtn.addEventListener('click', closeSettings);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', () => {
    if (!confirmModal.classList.contains('hidden')) { confirmCancelBtn.click(); return; }
    if (!linkModal.classList.contains('hidden')) { closeLinkModal(); return; }
    closeDrawer();
    closeSettings();
  });

  drawerEditor.addEventListener('input', onDrawerEditorInput);
  drawerEditor.addEventListener('paste', onDrawerPaste);
  drawerEditor.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') linkifyTypedWord();
  });
  drawerEditor.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    window.open(a.href, '_blank', 'noopener,noreferrer');
  });
  drawerAddLinkBtn.addEventListener('click', onAddLinkToSelection);
  linkModalCloseBtn.addEventListener('click', closeLinkModal);
  linkModalForm.addEventListener('submit', onLinkModalSubmit);

  document.querySelector('.drawer-toolbar').addEventListener('click', e => {
    const btn = e.target.closest('.toolbar-btn[data-command]');
    if (!btn) return;
    drawerEditor.focus();
    document.execCommand(btn.dataset.command);
    onDrawerEditorInput();
    updateToolbarActiveState();
  });
  document.addEventListener('selectionchange', updateToolbarActiveState);

  settingsListsList.addEventListener('click', onSettingsListsClick);
  settingsAddForm.addEventListener('submit', onSettingsAddList);
  syncBtn.addEventListener('click', onSyncPull);
  syncConfigForm.addEventListener('submit', onSyncConfigSubmit);
  settingsListsList.addEventListener('dragstart', onSettingsRowDragStart);
  settingsListsList.addEventListener('dragend', onSettingsRowDragEnd);
  settingsListsList.addEventListener('dragover', onSettingsRowDragOver);
  settingsListsList.addEventListener('dragleave', onSettingsRowDragLeave);
  settingsListsList.addEventListener('drop', onSettingsRowDrop);

  listSwitcher.addEventListener('click', e => {
    const pill = e.target.closest('.list-switcher-pill');
    if (!pill) return;
    activeListId = pill.dataset.listId;
    render();
  });

  if (syncHelpText) {
    syncHelpText.textContent = SERVER_MODE
      ? 'Lists are local-only by default. Click the cloud icon next to a list above to turn sync on for it — from then on, every local save pushes that list automatically. Use the sync button in the header to pull the latest synced lists onto this device (local-only lists are never affected).'
      : 'Every list on this device syncs automatically. Enter your relay URL and API key below, then use the sync button in the header to pull your lists from other devices.';
  }

  document.addEventListener('click', e => {
    if (openMenu && !e.target.closest('.dropdown-menu') && !e.target.closest('.badge-dropdown') && !e.target.closest('.field-dropdown') && !e.target.closest('.mobile-status-btn') && !e.target.closest('.mobile-priority-btn')) {
      closeOpenMenu();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!confirmModal.classList.contains('hidden')) { confirmCancelBtn.click(); return; }
      if (!linkModal.classList.contains('hidden')) { closeLinkModal(); return; }
      closeOpenMenu();
      closeDrawer();
      closeSettings();
    }
  });
}

// ---------- persistence ----------

// Loads state from the local Node server when present (the Electron desktop
// app), and falls back to browser localStorage for the hosted PWA. The PWA
// has no server, so /api/data 404s and the fallback takes over.
async function loadState() {
  try {
    const res = await fetch('/api/data');
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      SERVER_MODE = true;
      return await res.json();
    }
  } catch (e) { /* no server — fall through to localStorage */ }
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* localStorage unavailable */ }
  return { lists: [] };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

function saveNow() {
  if (SERVER_MODE) {
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    return;
  }
  try { localStorage.setItem(LS_STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  syncPush();
}

// ---------- lookups ----------

function findList(listId) {
  return state.lists.find(l => l.id === listId);
}

function findItem(list, itemId) {
  return list.items.find(i => i.id === itemId);
}

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 10000);
}

// ---------- sorting ----------

function sortItems(items, sort) {
  if (!sort || !sort.by || sort.by === 'none') return items.slice();
  const order = sort.by === 'priority' ? PRIORITY_SORT_ORDER : STATUS_SORT_ORDER;
  const withIndex = items.map((item, idx) => ({ item, idx }));
  withIndex.sort((a, b) => {
    const cmp = order.indexOf(a.item[sort.by]) - order.indexOf(b.item[sort.by]);
    if (cmp !== 0) return sort.dir === 'desc' ? -cmp : cmp;
    return a.idx - b.idx; // stable tie-break, preserves manual order within a group
  });
  return withIndex.map(x => x.item);
}

function visibleSortedItems(list) {
  return sortItems(list.items.filter(i => !HIDDEN_STATUSES.has(i.status)), list.sort);
}

function hiddenItemsOf(list) {
  return list.items.filter(i => HIDDEN_STATUSES.has(i.status));
}

function sortIndicator(list, field) {
  if (!list.sort || list.sort.by !== field) return '';
  return list.sort.dir === 'desc' ? ' ▼' : ' ▲';
}

// ---------- rendering ----------

function render() {
  // If the drawer is open for an item that no longer exists (deleted, or its
  // list was removed), close it before re-rendering.
  if (currentDrawerItem) {
    const list = findList(currentDrawerItem.listId);
    const item = list && findItem(list, currentDrawerItem.itemId);
    if (!item) closeDrawer();
  }
  closeOpenMenu();

  if (isMobile()) {
    renderMobile();
    return;
  }

  container.innerHTML = '';
  const visibleLists = state.lists.filter(l => !l.hidden);

  if (visibleLists.length === 0) {
    container.innerHTML = emptyStateHtml();
    return;
  }

  if (visibleLists.length === 1) {
    const panel = renderListPanel(visibleLists[0]);
    panel.classList.add('full-width');
    container.appendChild(panel);
    return;
  }

  // Two independent columns: odd lists (1st, 3rd, …) stack down the left,
  // even lists (2nd, 4th, …) down the right. Each column lays out on its
  // own, so a tall list on one side never pushes the next list on the other
  // side down past a gap.
  const columns = [el('<div class="list-column"></div>'), el('<div class="list-column"></div>')];
  visibleLists.forEach((list, i) => {
    columns[i % 2].appendChild(renderListPanel(list));
  });
  columns.forEach(col => container.appendChild(col));
}

function emptyStateHtml() {
  return state.lists.length === 0
    ? '<p class="empty-state">No lists yet. Open Settings to add one, or set up sync and pull your lists.</p>'
    : '<p class="empty-state">All lists are hidden. Open Settings to show one.</p>';
}

// ---------- mobile single-list rendering ----------

function getActiveListId() {
  const visible = state.lists.filter(l => !l.hidden);
  if (!visible.length) return null;
  if (activeListId && visible.some(l => l.id === activeListId)) return activeListId;
  return visible[0].id;
}

function renderListSwitcher() {
  const activeId = getActiveListId();
  listSwitcher.innerHTML = state.lists.filter(l => !l.hidden).map(l => `
    <button type="button" class="list-switcher-pill${l.id === activeId ? ' active' : ''}" data-list-id="${l.id}">${escapeAttr(l.name)}</button>
  `).join('');
}

function renderMobile() {
  renderListSwitcher();
  const activeId = getActiveListId();
  const active = activeId ? findList(activeId) : null;
  container.innerHTML = '';
  if (!active) {
    container.innerHTML = emptyStateHtml();
    return;
  }
  container.appendChild(renderMobileListPanel(active));
}

function renderMobileItemRow(item) {
  return `
    <div class="mobile-item-row" data-item-id="${item.id}">
      <button type="button" class="mobile-status-btn status-${slug(item.status)}" data-kind="status" aria-label="${STATUS_LABELS[item.status]}" title="${STATUS_LABELS[item.status]}">${STATUS_ICONS[item.status]}</button>
      <input class="mobile-item-input" value="${escapeAttr(item.item)}" placeholder="Item" aria-label="Item">
      <button type="button" class="mobile-priority-btn priority-${slug(item.priority)}" data-kind="priority" aria-label="${PRIORITY_LABELS[item.priority]}" title="${PRIORITY_LABELS[item.priority]}"><span class="dot"></span></button>
      <button class="details-btn${item.details ? ' has-content' : ''}" title="View/edit details" aria-label="View or edit details">${ICON_DETAILS}</button>
    </div>
  `;
}

function renderMobileListPanel(list) {
  const visible = visibleSortedItems(list);
  const hidden = hiddenItemsOf(list);

  const panel = el(`
    <section class="list-panel mobile-list-panel" data-list-id="${list.id}">
      <div class="panel-header">
        <input class="list-name-input" value="${escapeAttr(list.name)}" aria-label="List name">
      </div>

      <form class="add-item-form mobile-add-form">
        <input class="add-item-text" placeholder="Add a new item…" required>
        <button type="submit" class="add-item-btn" aria-label="Add item">${ICON_PLUS}</button>
      </form>

      <div class="mobile-items">
        ${visible.map(renderMobileItemRow).join('') || '<p class="empty-state">No items yet.</p>'}
      </div>

      ${hidden.length ? `
        <div class="hidden-section">
          <button class="hidden-toggle" aria-expanded="false">Show hidden (${hidden.length})</button>
          <div class="mobile-items hidden-table hidden">
            ${hidden.map(renderMobileItemRow).join('')}
          </div>
        </div>` : ''}
    </section>
  `);

  bindMobilePanelEvents(panel, list);
  return panel;
}

function bindMobilePanelEvents(panel, list) {
  panel.querySelector('.list-name-input').addEventListener('input', e => {
    list.name = e.target.value;
    scheduleSave();
  });

  const addForm = panel.querySelector('.add-item-form');
  const addTextInput = panel.querySelector('.add-item-text');
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = addTextInput.value.trim();
    if (!text) return;
    list.items.unshift({
      id: genId('i'),
      item: text,
      status: 'not started',
      priority: 'normal',
      details: ''
    });
    scheduleSave();
    render();
  });

  const hiddenToggle = panel.querySelector('.hidden-toggle');
  if (hiddenToggle) {
    hiddenToggle.addEventListener('click', e => {
      const table = panel.querySelector('.hidden-table');
      const nowVisible = table.classList.contains('hidden');
      table.classList.toggle('hidden');
      e.currentTarget.setAttribute('aria-expanded', String(nowVisible));
    });
  }

  panel.querySelectorAll('.mobile-item-row').forEach(row => {
    const item = findItem(list, row.dataset.itemId);
    if (!item) return;
    const input = row.querySelector('.mobile-item-input');
    const statusBtn = row.querySelector('.mobile-status-btn');
    const priorityBtn = row.querySelector('.mobile-priority-btn');
    const detailsBtn = row.querySelector('.details-btn');

    input.addEventListener('input', () => {
      item.item = input.value;
      scheduleSave();
    });

    statusBtn.addEventListener('click', () => {
      openDropdownMenu(statusBtn, 'status', item.status, value => {
        item.status = value;
        scheduleSave();
        render();
      });
    });

    priorityBtn.addEventListener('click', () => {
      openDropdownMenu(priorityBtn, 'priority', item.priority, value => {
        item.priority = value;
        scheduleSave();
        render();
      });
    });

    detailsBtn.addEventListener('click', () => openDrawer(list, item));

    attachLongPress(row, async () => {
      const ok = await showConfirm(`Delete "${item.item}"?`, { danger: true, okText: 'Delete' });
      if (!ok) return;
      list.items = list.items.filter(i => i.id !== item.id);
      scheduleSave();
      render();
    });
  });
}

function attachLongPress(el, onLongPress) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    clear();
    timer = setTimeout(() => { timer = null; onLongPress(); }, 500);
  });
  el.addEventListener('pointermove', e => {
    if (timer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) clear();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => el.addEventListener(type, clear));
  el.addEventListener('contextmenu', e => e.preventDefault());
}

function renderListPanel(list) {
  const visible = visibleSortedItems(list);
  const hidden = hiddenItemsOf(list);

  const panel = el(`
    <section class="list-panel" data-list-id="${list.id}">
      <div class="panel-header">
        <input class="list-name-input" value="${escapeAttr(list.name)}" aria-label="List name">
      </div>

      <form class="add-item-form">
        <input class="add-item-text" placeholder="Add a new item…" required>
        <button type="button" class="field-dropdown add-item-status-btn" data-kind="status" data-value="not started">${STATUS_LABELS['not started']}</button>
        <button type="button" class="field-dropdown add-item-priority-btn" data-kind="priority" data-value="normal">${PRIORITY_LABELS['normal']}</button>
        <button type="submit" class="add-item-btn" aria-label="Add item">${ICON_PLUS}</button>
      </form>

      <table class="items-table main-table">
        <thead>
          <tr>
            <th class="col-num">#</th>
            <th>Item</th>
            <th class="col-status sortable-th" data-sort-field="status">Status${sortIndicator(list, 'status')}</th>
            <th class="col-priority sortable-th" data-sort-field="priority">Priority${sortIndicator(list, 'priority')}</th>
            <th class="col-details"></th>
            <th class="col-delete"></th>
          </tr>
        </thead>
        <tbody class="items-tbody">
          ${visible.map((item, idx) => renderRow(item, idx + 1)).join('') ||
            '<tr class="empty-row"><td colspan="6">No items yet.</td></tr>'}
        </tbody>
      </table>

      <div class="hidden-section">
        <button class="hidden-toggle" aria-expanded="false">Show hidden (${hidden.length})</button>
        <table class="items-table hidden-table hidden">
          <thead>
            <tr><th class="col-num">#</th><th>Item</th><th class="col-status">Status</th><th class="col-priority">Priority</th><th class="col-details"></th><th class="col-delete"></th></tr>
          </thead>
          <tbody class="hidden-tbody">
            ${hidden.map((item, idx) => renderRow(item, idx + 1)).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `);

  bindPanelEvents(panel, list);
  return panel;
}

function renderRow(item, num) {
  return `
    <tr data-item-id="${item.id}">
      <td class="col-num">${num}</td>
      <td><input class="item-text-input" value="${escapeAttr(item.item)}"></td>
      <td class="col-status"><button type="button" class="badge-dropdown status-${slug(item.status)}" data-kind="status">${STATUS_LABELS[item.status]}</button></td>
      <td class="col-priority"><button type="button" class="badge-dropdown priority-${slug(item.priority)}" data-kind="priority">${PRIORITY_LABELS[item.priority]}</button></td>
      <td class="col-details"><button class="details-btn${item.details ? ' has-content' : ''}" title="View/edit details" aria-label="View or edit details">${ICON_DETAILS}</button></td>
      <td class="col-delete"><button class="delete-btn" title="Delete item" aria-label="Delete item">${ICON_TRASH}</button></td>
    </tr>
  `;
}

// ---------- event binding ----------

function bindPanelEvents(panel, list) {
  panel.querySelector('.list-name-input').addEventListener('input', e => {
    list.name = e.target.value;
    scheduleSave();
  });

  panel.querySelector('.main-table thead').addEventListener('click', e => {
    const th = e.target.closest('.sortable-th');
    if (!th) return;
    const field = th.dataset.sortField;
    list.sort = list.sort || {};
    if (list.sort.by === field) {
      list.sort.dir = list.sort.dir === 'desc' ? 'asc' : 'desc';
    } else {
      list.sort.by = field;
      list.sort.dir = 'asc';
    }
    scheduleSave();
    render();
  });

  const addForm = panel.querySelector('.add-item-form');
  const addTextInput = panel.querySelector('.add-item-text');
  const addStatusBtn = panel.querySelector('.add-item-status-btn');
  const addPriorityBtn = panel.querySelector('.add-item-priority-btn');

  addStatusBtn.addEventListener('click', () => {
    openDropdownMenu(addStatusBtn, 'status', addStatusBtn.dataset.value, value => {
      addStatusBtn.dataset.value = value;
      addStatusBtn.textContent = STATUS_LABELS[value];
    }, { neutral: true, optionsFilter: s => !HIDDEN_STATUSES.has(s) });
  });

  addPriorityBtn.addEventListener('click', () => {
    openDropdownMenu(addPriorityBtn, 'priority', addPriorityBtn.dataset.value, value => {
      addPriorityBtn.dataset.value = value;
      addPriorityBtn.textContent = PRIORITY_LABELS[value];
    }, { neutral: true });
  });

  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const text = addTextInput.value.trim();
    if (!text) return;
    list.items.unshift({
      id: genId('i'),
      item: text,
      status: addStatusBtn.dataset.value,
      priority: addPriorityBtn.dataset.value,
      details: ''
    });
    scheduleSave();
    render();
  });

  panel.querySelector('.hidden-toggle').addEventListener('click', e => {
    const table = panel.querySelector('.hidden-table');
    const nowVisible = table.classList.contains('hidden'); // about to become visible
    table.classList.toggle('hidden');
    e.currentTarget.setAttribute('aria-expanded', String(nowVisible));
  });

  panel.querySelectorAll('.items-tbody, .hidden-tbody').forEach(tbody => {
    tbody.addEventListener('input', e => {
      if (!e.target.classList.contains('item-text-input')) return;
      const item = findItem(list, e.target.closest('tr').dataset.itemId);
      item.item = e.target.value;
      scheduleSave();
    });

    tbody.addEventListener('click', async e => {
      const row = e.target.closest('tr');
      if (!row) return;
      const item = findItem(list, row.dataset.itemId);
      if (!item) return;

      const badgeTrigger = e.target.closest('.badge-dropdown');
      if (badgeTrigger) {
        const kind = badgeTrigger.dataset.kind;
        const current = kind === 'status' ? item.status : item.priority;
        openDropdownMenu(badgeTrigger, kind, current, value => {
          if (kind === 'status') item.status = value;
          else item.priority = value;
          scheduleSave();
          render();
        });
        return;
      }

      if (e.target.closest('.details-btn')) {
        openDrawer(list, item);
      } else if (e.target.closest('.delete-btn')) {
        const ok = await showConfirm(`Delete "${item.item}"?`, { danger: true, okText: 'Delete' });
        if (!ok) return;
        list.items = list.items.filter(i => i.id !== item.id);
        scheduleSave();
        render();
      }
    });
  });
}

// ---------- custom colored dropdown menu (used for status/priority) ----------

function closeOpenMenu() {
  if (openMenu) {
    openMenu.el.remove();
    openMenu.trigger.classList.remove('dropdown-open');
    openMenu = null;
  }
}

function openDropdownMenu(trigger, kind, currentValue, onSelect, opts = {}) {
  if (openMenu && openMenu.trigger === trigger) {
    closeOpenMenu();
    return;
  }
  closeOpenMenu();

  let options = kind === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS;
  if (opts.optionsFilter) options = options.filter(opts.optionsFilter);
  const labels = kind === 'status' ? STATUS_LABELS : PRIORITY_LABELS;
  const neutral = !!opts.neutral;

  const menu = el(`
    <div class="dropdown-menu${neutral ? ' neutral' : ''}">
      ${options.map(o => `<div class="dropdown-option ${neutral ? '' : kind + '-' + slug(o)} ${o === currentValue ? 'active' : ''}" data-value="${o}">${labels[o]}</div>`).join('')}
    </div>
  `);
  document.body.appendChild(menu);

  const rect = trigger.getBoundingClientRect();
  if (neutral) menu.style.minWidth = rect.width + 'px';
  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + 6;
  let left = rect.left;
  if (left + menuRect.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuRect.width - 8);
  if (top + menuRect.height > window.innerHeight - 8) top = rect.top - menuRect.height - 6;
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';

  menu.addEventListener('click', e => {
    const opt = e.target.closest('.dropdown-option');
    if (!opt) return;
    onSelect(opt.dataset.value);
    closeOpenMenu();
  });

  trigger.classList.add('dropdown-open');
  openMenu = { el: menu, trigger };
}

// ---------- details drawer ----------

function openDrawer(list, item) {
  currentDrawerItem = { listId: list.id, itemId: item.id };
  drawerTitle.textContent = item.item;
  drawerEditor.innerHTML = item.details || '';
  linkifyEditorContent(drawerEditor); // migrate any legacy plain-text URLs
  drawer.classList.remove('hidden');
  syncOverlay();
  drawerEditor.focus();
  saveDrawerContent();
  updateToolbarActiveState();
}

function updateToolbarActiveState() {
  const sel = window.getSelection();
  const insideEditor = !drawer.classList.contains('hidden') &&
    sel && sel.anchorNode && drawerEditor.contains(sel.anchorNode);
  document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
    const isActive = insideEditor && document.queryCommandState(btn.dataset.command);
    btn.classList.toggle('active', !!isActive);
  });
}

function closeDrawer() {
  if (currentDrawerItem) {
    linkifyTypedWord(); // catch a URL typed right at the end with no trailing space
    linkifyEditorContent(drawerEditor);
    saveDrawerContent();
  }
  drawer.classList.add('hidden');
  currentDrawerItem = null;
  syncOverlay();
}

function onDrawerEditorInput() {
  if (drawerEditor.textContent.trim() === '') drawerEditor.innerHTML = '';
  saveDrawerContent();
}

function saveDrawerContent() {
  if (!currentDrawerItem) return;
  const list = findList(currentDrawerItem.listId);
  const item = list && findItem(list, currentDrawerItem.itemId);
  if (!item) return;
  item.details = drawerEditor.innerHTML;
  scheduleSave();
  const btn = container.querySelector(`tr[data-item-id="${item.id}"] .details-btn`);
  if (btn) btn.classList.toggle('has-content', !!item.details);
}

function onDrawerPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (!text) return;
  e.preventDefault();
  insertLinkifiedText(text);
  onDrawerEditorInput();
}

function onAddLinkToSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !drawerEditor.contains(sel.anchorNode)) {
    showConfirm('Select some text in the details first, then click "Add link".', { okOnly: true });
    return;
  }
  pendingLinkRange = sel.getRangeAt(0).cloneRange();
  linkUrlInput.value = 'https://';
  linkModal.classList.remove('hidden');
  syncOverlay();
  linkUrlInput.focus();
  linkUrlInput.select();
}

function closeLinkModal() {
  linkModal.classList.add('hidden');
  pendingLinkRange = null;
  syncOverlay();
}

function onLinkModalSubmit(e) {
  e.preventDefault();
  const url = linkUrlInput.value.trim();
  const range = pendingLinkRange;
  if (!url || !range) {
    closeLinkModal();
    return;
  }

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.appendChild(range.extractContents());
  range.insertNode(a);

  closeLinkModal();
  onDrawerEditorInput();
}

// ---------- link detection / auto-linkify ----------

function urlRegexGlobal() {
  return /(https?:\/\/[^\s]+)/gi;
}

function trimTrailingPunctuation(url) {
  let trimmedLength = 0;
  while (url.length && /[.,;:!?'")\]}]/.test(url[url.length - 1])) {
    url = url.slice(0, -1);
    trimmedLength++;
  }
  return { url, trimmedLength };
}

function makeLinkEl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = url;
  return a;
}

// Inserts pasted plain text at the current cursor, turning any URLs in it
// into real links.
function insertLinkifiedText(text) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();

  const frag = document.createDocumentFragment();
  const re = urlRegexGlobal();
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    const { url, trimmedLength } = trimTrailingPunctuation(match[1]);
    if (url) frag.appendChild(makeLinkEl(url));
    if (trimmedLength) frag.appendChild(document.createTextNode(match[1].slice(-trimmedLength)));
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

  const lastNode = frag.lastChild;
  range.insertNode(frag);
  if (lastNode) {
    const after = document.createRange();
    after.setStartAfter(lastNode);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

// Called right after the user types a space/newline: if the word just
// finished is a bare URL, turn it into a link and put the cursor back where
// they left it.
function linkifyTypedWord() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const cursorOffset = range.startOffset;
  const text = node.textContent;
  const hasTrigger = cursorOffset > 0 && /[\s]/.test(text[cursorOffset - 1]);
  const boundary = hasTrigger ? cursorOffset - 1 : cursorOffset;
  if (boundary <= 0) return;

  const match = text.slice(0, boundary).match(/(https?:\/\/\S+)$/i);
  if (!match) return;

  const { url, trimmedLength } = trimTrailingPunctuation(match[1]);
  if (!url) return;

  const end = boundary - trimmedLength;
  const start = end - url.length;
  if (start < 0) return;

  const linkRange = document.createRange();
  linkRange.setStart(node, start);
  linkRange.setEnd(node, end);
  const a = makeLinkEl(url);
  linkRange.deleteContents();
  linkRange.insertNode(a);

  const tailNode = a.nextSibling;
  const caret = document.createRange();
  if (hasTrigger && tailNode && tailNode.nodeType === Node.TEXT_NODE) {
    caret.setStart(tailNode, Math.min(trimmedLength + 1, tailNode.textContent.length));
  } else {
    caret.setStartAfter(a);
  }
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);

  onDrawerEditorInput();
}

// Full-content safety net: catches URLs that were already saved as plain
// text (e.g. from before this feature existed) without disturbing existing
// links. Only ever called at drawer open/close, never mid-typing, so there's
// no live cursor to preserve.
function linkifyEditorContent(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      return n.parentNode && n.parentNode.closest && n.parentNode.closest('a')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const re = urlRegexGlobal();
    if (!re.test(text)) return;

    const frag = document.createDocumentFragment();
    const re2 = urlRegexGlobal();
    let lastIndex = 0;
    let match;
    while ((match = re2.exec(text)) !== null) {
      if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      const { url, trimmedLength } = trimTrailingPunctuation(match[1]);
      if (url) frag.appendChild(makeLinkEl(url));
      if (trimmedLength) frag.appendChild(document.createTextNode(match[1].slice(-trimmedLength)));
      lastIndex = re2.lastIndex;
    }
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

// ---------- settings (list management) ----------

function syncOverlay() {
  const anyOpen = !drawer.classList.contains('hidden') ||
    !settingsModal.classList.contains('hidden') ||
    !linkModal.classList.contains('hidden') ||
    !confirmModal.classList.contains('hidden');
  overlay.classList.toggle('hidden', !anyOpen);
}

// ---------- themed confirm/alert dialog (replaces native confirm()/alert()) ----------

function showConfirm(message, opts = {}) {
  return new Promise(resolve => {
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = opts.okText || 'OK';
    confirmOkBtn.classList.toggle('danger-btn', !!opts.danger);
    confirmCancelBtn.classList.toggle('hidden', !!opts.okOnly);

    confirmModal.classList.remove('hidden');
    syncOverlay();

    function cleanup(result) {
      confirmModal.classList.add('hidden');
      syncOverlay();
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

function openSettings() {
  renderSettingsLists();
  refreshSyncStatus();
  settingsModal.classList.remove('hidden');
  syncOverlay();
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  syncOverlay();
}

function renderSettingsLists() {
  settingsListsList.innerHTML = state.lists.map(l => `
    <div class="settings-list-row" draggable="true" data-list-id="${l.id}">
      <span class="drag-handle" title="Drag to reorder">${ICON_DRAG}</span>
      <span class="settings-list-name">${escapeAttr(l.name)}</span>
      ${SERVER_MODE ? `<button type="button" class="settings-sync-btn" data-list-id="${l.id}" title="${l.syncEnabled ? 'Synced to the cloud — click to make local-only' : 'Local-only — click to sync this list to the cloud'}">${l.syncEnabled ? ICON_CLOUD : ICON_CLOUD_OFF}</button>` : ''}
      <button type="button" class="settings-visibility-btn" data-list-id="${l.id}" title="${l.hidden ? 'Show this list' : 'Hide this list'}">${l.hidden ? ICON_SHOW : ICON_HIDE}</button>
      <button type="button" class="settings-delete-list-btn" data-list-id="${l.id}">Delete</button>
    </div>
  `).join('');
}

async function onSettingsListsClick(e) {
  const syncToggleBtn = e.target.closest('.settings-sync-btn');
  if (syncToggleBtn) {
    const list = findList(syncToggleBtn.dataset.listId);
    if (list) {
      if (!list.syncEnabled) {
        // Turning sync ON — check the server's live status rather than a
        // cached value, since a stale "configured" flag would silently
        // enable sync for a list that never actually gets pushed anywhere.
        const res = await fetch('/api/sync/status');
        const { configured } = await res.json();
        if (!configured) {
          showConfirm(
            'Cloud sync isn\'t set up yet. Scroll down to "Cloud sync" below and paste your MongoDB connection string first.',
            { okOnly: true }
          );
          return;
        }
      }
      list.syncEnabled = !list.syncEnabled;
      scheduleSave();
      renderSettingsLists();
    }
    return;
  }

  const visBtn = e.target.closest('.settings-visibility-btn');
  if (visBtn) {
    const list = findList(visBtn.dataset.listId);
    if (list) {
      list.hidden = !list.hidden;
      scheduleSave();
      render();
      renderSettingsLists();
    }
    return;
  }

  const delBtn = e.target.closest('.settings-delete-list-btn');
  if (!delBtn) return;
  const list = findList(delBtn.dataset.listId);
  if (!list) return;
  if (state.lists.length <= 1) {
    showConfirm('You must keep at least one list.', { okOnly: true });
    return;
  }
  const ok = await showConfirm(
    `Delete list "${list.name}" and all ${list.items.length} of its items? This cannot be undone.`,
    { danger: true, okText: 'Delete' }
  );
  if (!ok) return;

  let alsoDeleteFromCloud = false;
  if (!SERVER_MODE) {
    // PWA: every list is synced, so deleting removes it everywhere.
    alsoDeleteFromCloud = true;
  } else if (list.syncEnabled) {
    alsoDeleteFromCloud = await showConfirm(
      `"${list.name}" is synced to the cloud. Also delete it from the cloud (and other devices, on their next pull)?`,
      { danger: true, okText: 'Delete from cloud too' }
    );
  }

  state.lists = state.lists.filter(l => l.id !== list.id);
  scheduleSave();
  if (alsoDeleteFromCloud) {
    try {
      await syncDelete(list.id);
    } catch (err) {
      showConfirm(`Deleted locally, but couldn't delete from the cloud: ${err.message}`, { okOnly: true });
    }
  }
  render();
  renderSettingsLists();
}

function onSettingsAddList(e) {
  e.preventDefault();
  const name = settingsNewListName.value.trim();
  if (!name) return;
  state.lists.push({
    id: genId('l'),
    name,
    sort: { by: 'priority', dir: 'asc' },
    hidden: false,
    syncEnabled: SERVER_MODE ? false : true,
    items: []
  });
  settingsNewListName.value = '';
  scheduleSave();
  render();
  renderSettingsLists();
}

// ---------- settings: drag to reorder lists ----------

function onSettingsRowDragStart(e) {
  const row = e.target.closest('.settings-list-row');
  if (!row) return;
  draggedListId = row.dataset.listId;
  e.dataTransfer.effectAllowed = 'move';
  row.classList.add('dragging');
}

function onSettingsRowDragEnd(e) {
  const row = e.target.closest('.settings-list-row');
  if (row) row.classList.remove('dragging');
  draggedListId = null;
  settingsListsList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onSettingsRowDragOver(e) {
  const row = e.target.closest('.settings-list-row');
  if (!row || !draggedListId) return;
  e.preventDefault();
  if (row.dataset.listId === draggedListId) return;
  row.classList.add('drag-over');
}

function onSettingsRowDragLeave(e) {
  const row = e.target.closest('.settings-list-row');
  if (row) row.classList.remove('drag-over');
}

function onSettingsRowDrop(e) {
  const row = e.target.closest('.settings-list-row');
  if (!row || !draggedListId) return;
  e.preventDefault();
  row.classList.remove('drag-over');
  const targetId = row.dataset.listId;
  if (targetId === draggedListId) return;

  const fromIndex = state.lists.findIndex(l => l.id === draggedListId);
  const toIndex = state.lists.findIndex(l => l.id === targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = state.lists.splice(fromIndex, 1);
  state.lists.splice(toIndex, 0, moved);

  scheduleSave();
  render();
  renderSettingsLists();
}

// ---------- cloud sync ----------
// Local-first: /api/data saves already push to the cloud automatically in
// the background (see server.js). This section only handles the explicit
// pull (Sync button) and the connection-string form in settings.
//
// On the desktop the server holds the relay URL + API key and proxies sync
// via /api/sync/*. In the PWA there is no server, so the same calls go
// straight to the relay from the browser, with the relay URL + API key stored
// in localStorage.

function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(LS_SYNC_KEY) || 'null'); }
  catch (e) { return null; }
}

function setSyncConfig(config) {
  localStorage.setItem(LS_SYNC_KEY, JSON.stringify(config));
}

async function relayCall(action, extra = {}) {
  const cfg = getSyncConfig();
  if (!cfg || !cfg.relayUrl || !cfg.apiKey) throw new Error('Cloud sync is not configured yet.');
  const res = await fetch(cfg.relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey },
    body: JSON.stringify({ action, ...extra })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Relay returned ${res.status}`);
  return body;
}

async function syncPush() {
  if (SERVER_MODE) return; // the server already pushes on every /api/data POST
  const cfg = getSyncConfig();
  if (!cfg || !cfg.relayUrl || !cfg.apiKey) return;
  try {
    await relayCall('push', { lists: state.lists });
  } catch (e) {
    console.error('Cloud sync push failed:', e.message);
  }
}

async function syncDelete(listId) {
  if (SERVER_MODE) {
    const res = await fetch('/api/sync/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId })
    });
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  await relayCall('delete', { listId });
}

async function refreshSyncStatus() {
  if (SERVER_MODE) {
    try {
      const res = await fetch('/api/sync/status');
      const { configured } = await res.json();
      syncStatusText.textContent = configured
        ? 'Cloud sync is configured. Local edits push automatically.'
        : 'Not configured. Enter your relay URL and API key below to enable cloud sync.';
    } catch {
      syncStatusText.textContent = 'Could not check cloud sync status.';
    }
    return;
  }
  const cfg = getSyncConfig();
  syncStatusText.textContent = (cfg && cfg.relayUrl && cfg.apiKey)
    ? 'Cloud sync is configured. Every list on this device syncs automatically.'
    : 'Not configured. Enter your relay URL and API key below to enable cloud sync.';
}

async function onSyncConfigSubmit(e) {
  e.preventDefault();
  const relayUrl = syncRelayUrlInput.value.trim();
  const apiKey = syncApiKeyInput.value.trim();
  if (!relayUrl || !apiKey) return;
  if (SERVER_MODE) {
    try {
      const res = await fetch('/api/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relayUrl, apiKey })
      });
      if (!res.ok) throw new Error(await res.text());
      syncRelayUrlInput.value = '';
      syncApiKeyInput.value = '';
      await refreshSyncStatus();
    } catch (err) {
      showConfirm(`Couldn't save cloud sync settings: ${err.message}`, { okOnly: true });
    }
    return;
  }
  setSyncConfig({ relayUrl, apiKey });
  syncRelayUrlInput.value = '';
  syncApiKeyInput.value = '';
  await refreshSyncStatus();
}

async function onSyncPull() {
  if (syncBtn.classList.contains('syncing')) return;
  syncBtn.classList.add('syncing');
  try {
    if (SERVER_MODE) {
      const res = await fetch('/api/sync/pull', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      state = await res.json();
    } else {
      // Pull first, then merge: the cloud is the source of truth for the
      // pulled lists (remote wins per list id, so edits from other devices
      // come through). Do NOT flush a push first — that would overwrite the
      // cloud with this device's stale copy before reading it, clobbering
      // the other device's item changes. Local edits already went up on
      // save (saveNow() pushes), so there's nothing to flush here anyway.
      const remote = await relayCall('pull');
      const remoteLists = (remote && remote.lists) || [];
      const remoteById = new Map(remoteLists.map(l => [l.id, l]));
      const lists = [];
      const seen = new Set();
      for (const l of state.lists) {
        const r = remoteById.get(l.id);
        if (r) { lists.push(r); seen.add(l.id); }
        // a local list the cloud no longer has is dropped (deletes propagate)
      }
      for (const r of remoteLists) {
        if (!seen.has(r.id)) lists.push(r);
      }
      state = { lists };
      saveNow();
    }
    render();
    renderSettingsLists();
  } catch (err) {
    showConfirm(`Sync failed: ${err.message}`, { okOnly: true });
  } finally {
    syncBtn.classList.remove('syncing');
  }
}

// ---------- small helpers ----------

function el(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slug(str) {
  return String(str).replace(/\s+/g, '-');
}

const CLOCK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CLOCK_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function updateClock() {
  const el = document.getElementById('navClock');
  if (!el) return;
  const now = new Date();
  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `${CLOCK_DAYS[now.getDay()]} ${CLOCK_MONTHS[now.getMonth()]} ${now.getDate()} ${hours}:${minutes} ${ampm}`;
}
