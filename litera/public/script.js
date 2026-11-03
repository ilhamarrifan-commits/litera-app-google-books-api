const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const bookList = document.getElementById('bookList');
const message = document.getElementById('message');

async function searchBooks() {
  const query = searchInput.value.trim();

  bookList.innerHTML = '';
  message.textContent = '';

  if (!query) {
    message.textContent = 'Silakan masukkan judul buku.';
    return;
  }

  try {
    message.textContent = 'Sedang mencari buku...';

    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const books = await response.json();

    if (!response.ok) {
      message.textContent = books.message || 'Terjadi kesalahan.';
      return;
    }

    if (books.length === 0) {
      message.textContent = 'Buku tidak ditemukan.';
      return;
    }

    message.textContent = `Ditemukan ${books.length} buku.`;

    books.forEach(book => {
      const bookCard = document.createElement('div');
      bookCard.classList.add('book-card');

      bookCard.innerHTML = `
        <img src="${book.thumbnail || 'https://via.placeholder.com/128x190?text=No+Image'}" alt="${book.title}">
        <h3>${book.title}</h3>
        <p><strong>Penulis:</strong> ${book.authors.join(', ')}</p>
        <p><strong>Penerbit:</strong> ${book.publisher}</p>
        <p><strong>Tahun:</strong> ${book.publishedDate}</p>
        <div class="card-actions">
          <a href="/detail?id=${book.id}" class="detail-btn">Lihat Detail</a>
          <button type="button" class="add-btn">+ Reading List</button>
        </div>
      `;

      const addBtn = bookCard.querySelector('.add-btn');
      addBtn.addEventListener('click', () => addToReadingList(book, addBtn));

      bookList.appendChild(bookCard);
    });
  } catch (error) {
    message.textContent = 'Gagal mengambil data buku.';
    console.error(error);
  }
}

searchBtn.addEventListener('click', searchBooks);

searchInput.addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    searchBooks();
  }
});
