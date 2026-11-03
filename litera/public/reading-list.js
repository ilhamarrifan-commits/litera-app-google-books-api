const STATUS_LABEL = {
  want: 'Ingin dibaca',
  reading: 'Sedang dibaca',
  done: 'Selesai'
};

const listEl = document.getElementById('readingList');
const messageEl = document.getElementById('message');
const filterEl = document.getElementById('statusFilter');
const dialog = document.getElementById('editDialog');
const form = document.getElementById('editForm');

let items = [];
let editingId = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function stars(rating) {
  return rating > 0 ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : 'Belum dinilai';
}

// READ
async function loadList() {
  try {
    const status = filterEl.value;
    const response = await fetch('/api/reading-list' + (status ? `?status=${status}` : ''));
    items = await response.json();
    render();
  } catch (error) {
    messageEl.textContent = 'Gagal memuat reading list.';
    console.error(error);
  }
}

function render() {
  listEl.innerHTML = '';

  if (items.length === 0) {
    messageEl.innerHTML = filterEl.value
      ? 'Tidak ada buku dengan status ini.'
      : 'Reading list masih kosong. <a href="/">Cari buku</a> lalu tekan "+ Reading List".';
    return;
  }

  messageEl.textContent = `${items.length} buku di reading list.`;

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      ${item.thumbnail
        ? `<img src="${esc(item.thumbnail)}" alt="${esc(item.title)}">`
        : '<div class="no-cover">Tanpa sampul</div>'}
      <h3>${esc(item.title)}</h3>
      <p><strong>Penulis:</strong> ${esc(item.authors) || '-'}</p>
      <p><span class="badge badge-${esc(item.status)}">${esc(STATUS_LABEL[item.status])}</span></p>
      <p class="rating" aria-label="Rating">${stars(item.rating)}</p>
      ${item.notes ? `<p class="note">${esc(item.notes)}</p>` : '<p class="note muted">Belum ada catatan.</p>'}
      <div class="card-actions">
        <a href="/detail?id=${encodeURIComponent(item.google_id)}" class="detail-btn">Detail</a>
        <button type="button" class="edit-btn" data-action="edit" data-id="${item.id}">Edit</button>
        <button type="button" class="delete-btn" data-action="delete" data-id="${item.id}">Hapus</button>
      </div>
    `;
    listEl.appendChild(card);
  });
}

// UPDATE: buka form edit
function openEdit(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('editTitle').textContent = item.title;
  document.getElementById('editStatus').value = item.status;
  document.getElementById('editRating').value = String(item.rating);
  document.getElementById('editNotes').value = item.notes;
  dialog.showModal();
}

// UPDATE: kirim perubahan
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const response = await fetch(`/api/reading-list/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: document.getElementById('editStatus').value,
        rating: Number(document.getElementById('editRating').value),
        notes: document.getElementById('editNotes').value
      })
    });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Gagal menyimpan perubahan.');
      return;
    }
    dialog.close();
    showToast('Perubahan disimpan.');
    loadList();
  } catch (error) {
    showToast('Gagal terhubung ke server.');
    console.error(error);
  }
});

document.getElementById('cancelEdit').addEventListener('click', () => dialog.close());

// DELETE
async function deleteItem(id) {
  const item = items.find(i => i.id === id);
  if (!item || !confirm(`Hapus "${item.title}" dari reading list?`)) return;

  try {
    const response = await fetch(`/api/reading-list/${id}`, { method: 'DELETE' });
    const data = await response.json();
    showToast(data.message);
    if (response.ok) loadList();
  } catch (error) {
    showToast('Gagal terhubung ke server.');
    console.error(error);
  }
}

listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === 'edit') openEdit(id);
  if (btn.dataset.action === 'delete') deleteItem(id);
});

filterEl.addEventListener('change', loadList);

loadList();
