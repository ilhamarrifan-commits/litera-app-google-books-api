const express = require('express');
const axios = require('axios');
const path = require('path');
const db = require('./db');

const app = express();
// Azure App Service menyediakan port lewat process.env.PORT
const PORT = process.env.PORT || 3000;

const VALID_STATUS = ['want', 'reading', 'done'];

// Middleware untuk file statis
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route halaman utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route halaman detail
app.get('/detail', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'detail.html'));
});

// Route halaman reading list (BARU)
app.get('/reading-list', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reading-list.html'));
});

// API pencarian buku
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        message: 'Judul buku tidak boleh kosong'
      });
    }

    const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: {
        q: query,
        maxResults: 10
      }
    });

    const items = response.data.items || [];

    const books = items.map(item => ({
      id: item.id,
      title: item.volumeInfo.title || 'Judul tidak tersedia',
      authors: item.volumeInfo.authors || ['Penulis tidak tersedia'],
      publisher: item.volumeInfo.publisher || 'Penerbit tidak tersedia',
      publishedDate: item.volumeInfo.publishedDate || 'Tanggal tidak tersedia',
      description: item.volumeInfo.description || 'Deskripsi tidak tersedia',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
    }));

    res.json(books);
  } catch (error) {
    console.error('Error saat mencari buku:', error.message);
    res.status(500).json({
      message: 'Terjadi kesalahan saat mengambil data buku'
    });
  }
});

// API detail buku
app.get('/api/book/:id', async (req, res) => {
  try {
    const bookId = req.params.id;

    const response = await axios.get(`https://www.googleapis.com/books/v1/volumes/${bookId}`);

    const item = response.data;

    const book = {
      id: item.id,
      title: item.volumeInfo.title || 'Judul tidak tersedia',
      authors: item.volumeInfo.authors || ['Penulis tidak tersedia'],
      publisher: item.volumeInfo.publisher || 'Penerbit tidak tersedia',
      publishedDate: item.volumeInfo.publishedDate || 'Tanggal tidak tersedia',
      description: item.volumeInfo.description || 'Deskripsi tidak tersedia',
      categories: item.volumeInfo.categories || ['Kategori tidak tersedia'],
      pageCount: item.volumeInfo.pageCount || 'Jumlah halaman tidak tersedia',
      thumbnail: item.volumeInfo.imageLinks?.thumbnail || '',
      previewLink: item.volumeInfo.previewLink || '#'
    };

    res.json(book);
  } catch (error) {
    console.error('Error saat mengambil detail buku:', error.message);
    res.status(500).json({
      message: 'Terjadi kesalahan saat mengambil detail buku'
    });
  }
});

/* =========================================================
   CRUD READING LIST (BARU) - disimpan di SQLite
   ========================================================= */

// READ - semua buku (opsional filter ?status=want|reading|done)
app.get('/api/reading-list', (req, res) => {
  const { status } = req.query;
  if (status && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }
  res.json(db.list(status));
});

// READ - satu buku
app.get('/api/reading-list/:id', (req, res) => {
  const item = db.get(Number(req.params.id));
  if (!item) return res.status(404).json({ message: 'Buku tidak ditemukan di reading list' });
  res.json(item);
});

// CREATE - tambah buku ke reading list
app.post('/api/reading-list', (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const googleId = String(body.googleId || '').trim();

  if (!googleId || !title) {
    return res.status(400).json({ message: 'googleId dan title wajib diisi' });
  }

  const status = body.status || 'want';
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  const authors = Array.isArray(body.authors) ? body.authors.join(', ') : String(body.authors || '');
  // Google Books sering mengirim thumbnail http:// -> ubah ke https:// agar tidak diblokir browser
  const thumbnail = String(body.thumbnail || '').replace(/^http:/, 'https:');

  try {
    const created = db.create({
      google_id: googleId,
      title,
      authors,
      thumbnail,
      status
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Buku ini sudah ada di reading list' });
    }
    console.error('Error saat menambah reading list:', error.message);
    res.status(500).json({ message: 'Gagal menambahkan buku' });
  }
});

// UPDATE - ubah status, rating, dan catatan
app.put('/api/reading-list/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.get(id);
  if (!existing) return res.status(404).json({ message: 'Buku tidak ditemukan di reading list' });

  const body = req.body || {};
  const status = body.status ?? existing.status;
  const rating = body.rating !== undefined ? Number(body.rating) : existing.rating;
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;

  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    return res.status(400).json({ message: 'Rating harus angka bulat 0-5' });
  }
  if (notes.length > 1000) {
    return res.status(400).json({ message: 'Catatan maksimal 1000 karakter' });
  }

  res.json(db.update(id, { status, rating, notes }));
});

// DELETE - hapus dari reading list
app.delete('/api/reading-list/:id', (req, res) => {
  const deleted = db.remove(Number(req.params.id));
  if (!deleted) return res.status(404).json({ message: 'Buku tidak ditemukan di reading list' });
  res.json({ message: 'Buku berhasil dihapus dari reading list' });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
