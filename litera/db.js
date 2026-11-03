const fs = require('fs');
const path = require('path');

// Menentukan lokasi penyimpanan file JSON (di lokal atau di Azure /home)
const dataDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, 'data');
const jsonPath = process.env.DB_PATH ? process.env.DB_PATH.replace('.db', '.json') : path.join(dataDir, 'litera.json');

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

function readData() {
  if (!fs.existsSync(jsonPath)) {
    return [];
  }
  try {
    const fileData = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(fileData);
  } catch (e) {
    return [];
  }
}

function writeData(rows) {
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
}

module.exports = {
  list(status) {
    const rows = readData();
    const filtered = status ? rows.filter(r => r.status === status) : rows;
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  },
  
  get(id) {
    const rows = readData();
    return rows.find(r => r.id === id) || null;
  },
  
  create(data) {
    const rows = readData();
    
    // Validasi unique google_id (meniru constraint UNIQUE SQLite)
    if (rows.some(r => r.google_id === data.google_id)) {
      const err = new Error('Buku ini sudah ada di reading list');
      err.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw err;
    }
    
    const maxId = rows.reduce((max, r) => Math.max(max, r.id || 0), 0);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const newRow = {
      id: maxId + 1,
      google_id: data.google_id,
      title: data.title,
      authors: data.authors || '',
      thumbnail: data.thumbnail || '',
      status: data.status || 'want',
      rating: 0,
      notes: '',
      created_at: now,
      updated_at: now
    };
    
    rows.push(newRow);
    writeData(rows);
    return newRow;
  },
  
  update(id, data) {
    const rows = readData();
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    rows[index] = {
      ...rows[index],
      status: data.status ?? rows[index].status,
      rating: data.rating !== undefined ? Number(data.rating) : rows[index].rating,
      notes: data.notes !== undefined ? String(data.notes).trim() : rows[index].notes,
      updated_at: now
    };
    
    writeData(rows);
    return rows[index];
  },
  
  remove(id) {
    const rows = readData();
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    rows.splice(index, 1);
    writeData(rows);
    return true;
  }
};