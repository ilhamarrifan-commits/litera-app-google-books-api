// Helper yang dipakai bersama oleh beberapa halaman

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// CREATE: kirim buku ke reading list
async function addToReadingList(book, btn) {
  btn.disabled = true;
  try {
    const response = await fetch('/api/reading-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: book.id,
        title: book.title,
        authors: book.authors,
        thumbnail: book.thumbnail,
        status: 'want'
      })
    });
    const data = await response.json();

    if (response.ok) {
      btn.textContent = 'Tersimpan';
      showToast('Buku ditambahkan ke reading list.');
    } else if (response.status === 409) {
      btn.textContent = 'Sudah di reading list';
      showToast(data.message);
    } else {
      btn.disabled = false;
      showToast(data.message || 'Gagal menambahkan buku.');
    }
  } catch (error) {
    btn.disabled = false;
    showToast('Gagal terhubung ke server.');
    console.error(error);
  }
}
