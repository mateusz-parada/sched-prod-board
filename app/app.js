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
  const done = acked.has(i.id);
  return `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
        <span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}">${esc(fmt(i.openedAt))}</time>
        ${done ? '<span data-testid="acked" class="acked">✓ acked</span>' : `<button type="button" data-testid="ack"${pending.has(i.id) ? ' disabled' : ''}>Ack</button>`}
      </li>`;
}

function render() {
  const sorted = [...incidents.values()].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  list.innerHTML = sorted.map(rowHtml).join('');
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
