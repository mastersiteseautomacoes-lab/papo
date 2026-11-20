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
  -- (As tabelas "channels" e "messages" do chat antigo não são mais criadas nem usadas. Bancos que já as têm
  -- continuam funcionando: nada é apagado nem alterado.)
  -- Sessões por link (fase 2): sala temporária, aberta a quem tem o código, criada por uma conta.
  CREATE TABLE IF NOT EXISTS link_sessions (
    code TEXT PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    ended_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_link_sessions_creator ON link_sessions(creator_id);
`)

const PALETTE = ['#7289ff', '#2dd4bf', '#f472b6', '#f87171', '#fbbf24', '#4ade80', '#a78bfa', '#38bdf8', '#fb923c']
export const pickColor = (seed: number) => PALETTE[seed % PALETTE.length]
export const newCode = () => randomBytes(5).toString('hex')

/**
 * Cria o registro do dono. Ele existe só para guardar o código de convite que o dono passa a quem vai criar contas
 * (o nome "servidor" vem do chat antigo, de onde as tabelas foram aproveitadas).
 */
export function createServer(name: string, ownerId: number): number {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO servers (name, color, owner_id, invite_code) VALUES (?, ?, ?, ?)')
    .run(name, pickColor(ownerId + name.length), ownerId, newCode())
  const id = Number(lastInsertRowid)
  db.prepare("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, 'owner')").run(id, ownerId)
  return id
}
