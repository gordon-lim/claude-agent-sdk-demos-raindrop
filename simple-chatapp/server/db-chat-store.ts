import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import type { Chat, ChatMessage, MessageContent } from "./types.js";

// Database-backed chat store with user scoping
class DbChatStore {
  createChat(userId: string, title?: string): Chat {
    const id = uuidv4();
    const now = new Date().toISOString();
    const chat: Chat = {
      id,
      userId,
      title: title || "New Chat",
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO chats (id, user_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, chat.title, now, now);

    return chat;
  }

  getChat(id: string, userId: string): Chat | undefined {
    const row = db
      .prepare(
        `SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt
         FROM chats
         WHERE id = ? AND user_id = ?`
      )
      .get(id, userId) as Chat | undefined;

    return row;
  }

  getAllChats(userId: string): Chat[] {
    const rows = db
      .prepare(
        `SELECT id, user_id as userId, title, created_at as createdAt, updated_at as updatedAt
         FROM chats
         WHERE user_id = ?
         ORDER BY updated_at DESC`
      )
      .all(userId) as Chat[];

    return rows;
  }

  updateChatTitle(id: string, userId: string, title: string): Chat | undefined {
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `UPDATE chats
         SET title = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(title, now, id, userId);

    if (result.changes === 0) {
      return undefined;
    }

    return this.getChat(id, userId);
  }

  deleteChat(id: string, userId: string): boolean {
    const result = db
      .prepare(`DELETE FROM chats WHERE id = ? AND user_id = ?`)
      .run(id, userId);

    return result.changes > 0;
  }

  addMessage(
    chatId: string,
    message: Omit<ChatMessage, "id" | "chatId" | "timestamp">
  ): ChatMessage {
    // Verify chat exists (we don't need userId here as messages are scoped by chatId)
    const chat = db
      .prepare(`SELECT id, user_id, title FROM chats WHERE id = ?`)
      .get(chatId) as { id: string; user_id: string; title: string } | undefined;

    if (!chat) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const newMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      timestamp: new Date().toISOString(),
      ...message,
    };

    // Determine if content should be stored as JSON
    const isJsonContent = Array.isArray(message.content);
    const contentToStore = isJsonContent
      ? JSON.stringify(message.content)
      : message.content;
    const contentType = isJsonContent ? "json" : "text";

    // Insert message
    db.prepare(
      `INSERT INTO messages (id, chat_id, role, content, content_type, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      newMessage.id,
      chatId,
      newMessage.role,
      contentToStore,
      contentType,
      newMessage.timestamp
    );

    // Update chat's updatedAt
    db.prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`).run(
      newMessage.timestamp,
      chatId
    );

    // Auto-generate title from first user message if still "New Chat"
    if (chat.title === "New Chat" && message.role === "user") {
      const contentText = typeof message.content === "string"
        ? message.content
        : message.content.find(c => c.type === "text")?.text || "New Chat";
      const newTitle =
        contentText.slice(0, 50) +
        (contentText.length > 50 ? "..." : "");
      db.prepare(`UPDATE chats SET title = ? WHERE id = ?`).run(newTitle, chatId);
    }

    return newMessage;
  }

  getMessages(chatId: string): ChatMessage[] {
    const rows = db
      .prepare(
        `SELECT id, chat_id as chatId, role, content, content_type as contentType, timestamp
         FROM messages
         WHERE chat_id = ?
         ORDER BY timestamp ASC`
      )
      .all(chatId) as Array<{
        id: string;
        chatId: string;
        role: string;
        content: string;
        contentType?: string;
        timestamp: string;
      }>;

    // Parse JSON content back to objects
    return rows.map(row => ({
      id: row.id,
      chatId: row.chatId,
      role: row.role as "user" | "assistant",
      content: row.contentType === "json" ? JSON.parse(row.content) : row.content,
      timestamp: row.timestamp,
    }));
  }
}

// Singleton instance
export const chatStore = new DbChatStore();
