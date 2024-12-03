import * as vscode from 'vscode';
import * as sqlite3 from 'sqlite3';
import { Message, Conversation } from '../types';
import * as path from 'path';

export class StorageService {
    private db: sqlite3.Database;
    private ready: Promise<void>;

    constructor(context: vscode.ExtensionContext) {
        const dbPath = path.join(context.globalStorageUri.fsPath, 'claude.db');
        this.db = new sqlite3.Database(dbPath);
        this.ready = this.initializeDatabase();
    }

    private async initializeDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Create conversations table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        created INTEGER NOT NULL,
                        lastUpdated INTEGER NOT NULL
                    )
                `);

                // Create messages table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversationId TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        metadata TEXT,
                        FOREIGN KEY(conversationId) REFERENCES conversations(id)
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    public async saveMessage(conversationId: string, message: Message): Promise<void> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (id, conversationId, role, content, timestamp, metadata)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    message.id,
                    conversationId,
                    message.role,
                    message.content,
                    message.timestamp,
                    message.metadata ? JSON.stringify(message.metadata) : null
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    public async getConversation(id: string): Promise<Conversation | null> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM conversations WHERE id = ?`,
                [id],
                async (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!row) {
                        resolve(null);
                        return;
                    }

                    const messages = await this.getMessages(id);
                    resolve({
                        id: row.id,
                        title: row.title,
                        created: row.created,
                        lastUpdated: row.lastUpdated,
                        messages
                    });
                }
            );
        });
    }

    private async getMessages(conversationId: string): Promise<Message[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC`,
                [conversationId],
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows.map(row => ({
                        id: row.id,
                        role: row.role as 'user' | 'assistant',
                        content: row.content,
                        timestamp: row.timestamp,
                        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
                    })));
                }
            );
        });
    }

    public async createConversation(conversation: Conversation): Promise<void> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO conversations (id, title, created, lastUpdated)
                 VALUES (?, ?, ?, ?)`,
                [
                    conversation.id,
                    conversation.title,
                    conversation.created,
                    conversation.lastUpdated
                ],
                async (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Save all messages
                    try {
                        for (const message of conversation.messages) {
                            await this.saveMessage(conversation.id, message);
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    }

    public async updateConversation(conversation: Conversation): Promise<void> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE conversations 
                 SET title = ?, lastUpdated = ?
                 WHERE id = ?`,
                [
                    conversation.title,
                    conversation.lastUpdated,
                    conversation.id
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    public async getAllConversations(): Promise<Conversation[]> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM conversations ORDER BY lastUpdated DESC`,
                async (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    try {
                        const conversations = await Promise.all(
                            rows.map(row => this.getConversation(row.id))
                        );
                        resolve(conversations.filter((c): c is Conversation => c !== null));
                    } catch (err) {
                        reject(err);
                    }
                }
            );
        });
    }

    public async deleteConversation(id: string): Promise<void> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM messages WHERE conversationId = ?`,
                [id],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    this.db.run(
                        `DELETE FROM conversations WHERE id = ?`,
                        [id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                }
            );
        });
    }
}
