import * as vscode from 'vscode';
import BetterSqlite3, { Database } from 'better-sqlite3';
import * as path from 'path';

interface StorageOptions {
    filename: string;
}

interface ConversationRecord {
    id: number;
    content: string;
    timestamp: string;
}

interface SettingRecord {
    key: string;
    value: string;
}

export class Storage {
    private db: Database;

    constructor(private context: vscode.ExtensionContext, options: StorageOptions) {
        const dbPath = path.join(context.globalStorageUri.fsPath, options.filename);
        this.db = new BetterSqlite3(dbPath);
        this.initialize();
    }

    private initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                content TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);
    }

    async saveConversation(content: string): Promise<number> {
        const stmt = this.db.prepare('INSERT INTO conversations (content) VALUES (?)');
        const result = stmt.run(content);
        return result.lastInsertRowid as number;
    }

    async getConversation(id: number): Promise<string | null> {
        const stmt = this.db.prepare('SELECT content FROM conversations WHERE id = ?');
        const result = stmt.get(id) as ConversationRecord | undefined;
        return result ? result.content : null;
    }

    async getRecentConversations(limit: number = 10): Promise<ConversationRecord[]> {
        const stmt = this.db.prepare(
            'SELECT id, content, timestamp FROM conversations ORDER BY timestamp DESC LIMIT ?'
        );
        return stmt.all(limit) as ConversationRecord[];
    }

    async setSetting(key: string, value: string): Promise<void> {
        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
        );
        stmt.run(key, value);
    }

    async getSetting(key: string): Promise<string | null> {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = stmt.get(key) as SettingRecord | undefined;
        return result ? result.value : null;
    }

    async deleteSetting(key: string): Promise<void> {
        const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
        stmt.run(key);
    }

    async clearConversations(): Promise<void> {
        this.db.prepare('DELETE FROM conversations').run();
    }

    async clearSettings(): Promise<void> {
        this.db.prepare('DELETE FROM settings').run();
    }

    close(): void {
        this.db.close();
    }
}