import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const incidents = new Map();
const acked = new Set();
const pending = new Set();

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function fmt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(d);
}

function rowHtml(i) {
  return `<span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}">${esc(fmt(i.openedAt))}</time>
        <span class="action"></span>`;
}

function actionHtml(id) {
  if (acked.has(id)) return '<span data-testid="acked" class="acked">✓ acked</span>';
  return `<button type="button" data-testid="ack"${pending.has(id) ? ' disabled' : ''}>Ack</button>`;
}

const rowEls = new Map();

// Rows are kept and updated in place: only new incidents add a row, so nothing moves under the pointer except by a new row at the top.
function render() {
  const sorted = [...incidents.values()].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  let prev = null;
  for (const i of sorted) {
    let el = rowEls.get(i.id);
    if (!el) {
      el = document.createElement('li');
      el.setAttribute('data-testid', 'incident-row');
      el.dataset.id = i.id;
      el.className = `row ${i.severity}`;
      el.innerHTML = rowHtml(i);
      rowEls.set(i.id, el);
      list.insertBefore(el, prev ? prev.nextSibling : list.firstChild);
    }
    const action = el.querySelector('.action');
    const html = actionHtml(i.id);
    if (action.dataset.state !== html) {
      action.innerHTML = html;
      action.dataset.state = html;
    }
    prev = el;
  }
  empty.hidden = sorted.length > 0;
}

const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = confirmBox.querySelector('.confirm-text');
let confirming = null;

function closeConfirm() {
  confirming = null;
  confirmBox.hidden = true;
}

// The id is captured at click time, so rows moving later cannot change which incident is acked.
list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.closest('[data-testid="incident-row"]').dataset.id;
  confirming = id;
  confirmText.textContent = `Ack incident ${id}?`;
  confirmBox.hidden = false;
});

confirmBox.querySelector('[data-testid="confirm-cancel"]').addEventListener('click', closeConfirm);

confirmBox.querySelector('[data-testid="confirm-ack"]').addEventListener('click', async () => {
  const id = confirming;
  if (!id || pending.has(id)) return;
  closeConfirm();
  pending.add(id);
  render();
  try {
    await ack(id);
    acked.add(id);
  } catch (err) {
    console.error(err);
  } finally {
    pending.delete(id);
    render();
  }
});

let loaded = false;
async function refresh() {
  try {
    const page = await fetchIncidents();
    for (const i of page.incidents) incidents.set(i.id, i);
    render();
    if (!loaded) {
      loaded = true;
      loader.remove();
    }
  } catch (err) {
    console.error(err);
  }
}

await refresh();
setInterval(refresh, 2000);
