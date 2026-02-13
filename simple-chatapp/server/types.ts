import type { WebSocket } from "ws";

// User stored in database
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// WebSocket client with session data
export interface WSClient extends WebSocket {
  sessionId?: string;
  userId?: string;
  isAuthenticated?: boolean;
  isAlive?: boolean;
}

// Chat stored in database
export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// Message stored in memory
export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// WebSocket incoming messages
export interface WSChatMessage {
  type: "chat";
  content: string;
  chatId: string;
}

export interface WSSubscribeMessage {
  type: "subscribe";
  chatId: string;
}

export interface WSAuthMessage {
  type: "auth";
  token: string;
}

export type IncomingWSMessage = WSChatMessage | WSSubscribeMessage | WSAuthMessage;

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
