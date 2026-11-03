const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Di lokal: ./data/litera.db
// Di Azure : set App Setting DB_PATH=/home/data/litera.db (folder /home bersifat persisten)
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'litera.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
// Catatan: sengaja tidak memakai journal_mode WAL karena /home di Azure
// adalah network storage yang kurang cocok dengan WAL.

db.exec(`
  CREATE TABLE IF NOT EXISTS reading_list (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id  TEXT    NOT NULL UNIQUE,
    title      TEXT    NOT NULL,
    authors    TEXT    NOT NULL DEFAULT '',
    thumbnail  TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'want'
               CHECK (status IN ('want', 'reading', 'done')),
    rating     INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    notes      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

const stmt = {
  all: db.prepare('SELECT * FROM reading_list ORDER BY created_at DESC, id DESC'),
  byStatus: db.prepare('SELECT * FROM reading_list WHERE status = ? ORDER BY created_at DESC, id DESC'),
  get: db.prepare('SELECT * FROM reading_list WHERE id = ?'),
  insert: db.prepare(`
    INSERT INTO reading_list (google_id, title, authors, thumbnail, status)
    VALUES (@google_id, @title, @authors, @thumbnail, @status)
  `),
  update: db.prepare(`
    UPDATE reading_list
    SET status = @status, rating = @rating, notes = @notes, updated_at = datetime('now')
    WHERE id = @id
  `),
  remove: db.prepare('DELETE FROM reading_list WHERE id = ?')
};

module.exports = {
  list(status) {
    return status ? stmt.byStatus.all(status) : stmt.all.all();
  },
  get(id) {
    return stmt.get.get(id);
  },
  create(data) {
    const info = stmt.insert.run(data);
    return stmt.get.get(info.lastInsertRowid);
  },
  update(id, data) {
    stmt.update.run({ ...data, id });
    return stmt.get.get(id);
  },
  remove(id) {
    return stmt.remove.run(id).changes > 0;
  }
};
