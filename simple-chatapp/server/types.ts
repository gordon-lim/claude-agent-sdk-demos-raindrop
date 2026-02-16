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
  username?: string;
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

// Message content types (Anthropic API format)
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    data: string;
  };
}

export type MessageContent = string | Array<TextContent | ImageContent>;

// Message stored in database
export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: MessageContent;
  timestamp: string;
}

// WebSocket incoming messages
export interface WSChatMessage {
  type: "chat";
  content: MessageContent;
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

export interface WSInterruptMessage {
  type: "interrupt";
  chatId: string;
}

export type IncomingWSMessage = WSChatMessage | WSSubscribeMessage | WSAuthMessage | WSInterruptMessage;

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
