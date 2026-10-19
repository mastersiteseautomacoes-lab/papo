import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname } from 'node:path'

const file = process.env.DB_FILE ?? 'data/papo.db'
mkdirSync(dirname(file), { recursive: true })

export const db = new DatabaseSync(file)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    invite_code TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS members (
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    PRIMARY KEY (server_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('text','voice')),
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
`)

const PALETTE = ['#7289ff', '#2dd4bf', '#f472b6', '#f87171', '#fbbf24', '#4ade80', '#a78bfa', '#38bdf8', '#fb923c']
export const pickColor = (seed: number) => PALETTE[seed % PALETTE.length]
export const newCode = () => randomBytes(5).toString('hex')

/** Cria o servidor padrão (com canais iniciais) para um novo dono. */
export function createServer(name: string, ownerId: number, withDefaults = true): number {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO servers (name, color, owner_id, invite_code) VALUES (?, ?, ?, ?)')
    .run(name, pickColor(ownerId + name.length), ownerId, newCode())
  const id = Number(lastInsertRowid)
  db.prepare("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, 'owner')").run(id, ownerId)
  if (withDefaults) {
    const ins = db.prepare('INSERT INTO channels (server_id, category, name, kind, position) VALUES (?, ?, ?, ?, ?)')
    ins.run(id, 'Canais de texto', 'geral', 'text', 0)
    ins.run(id, 'Canais de voz', 'Sala 1', 'voice', 1)
    ins.run(id, 'Canais de voz', 'Sala 2', 'voice', 2)
  }
  return id
}
