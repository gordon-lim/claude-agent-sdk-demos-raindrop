import React, { useState, useRef, useEffect } from "react";

interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

type MessageContent = string | Array<TextContent | ImageContent>;

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: MessageContent;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
}

interface ChatWindowProps {
  chatId: string | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  onSendMessage: (content: MessageContent) => void;
  onInterrupt: () => void;
}

function ToolUseBlock({ message }: { message: Message }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolSummary = () => {
    const input = message.toolInput || {};
    switch (message.toolName) {
      case "Read":
        return input.file_path;
      case "Write":
      case "Edit":
        return input.file_path;
      case "Bash":
        return input.command?.slice(0, 60) + (input.command?.length > 60 ? "..." : "");
      case "Grep":
        return `"${input.pattern}" in ${input.path || "."}`;
      case "Glob":
        return input.pattern;
      case "WebSearch":
        return input.query;
      case "WebFetch":
        return input.url;
      default:
        return JSON.stringify(input).slice(0, 50);
    }
  };

  return (
    <div className="my-2 border border-gray-200 bg-gray-50 rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 flex items-center justify-between text-left hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase">
            {message.toolName}
          </span>
          <span className="text-xs text-gray-500 truncate max-w-md">
            {getToolSummary()}
          </span>
        </div>
        <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="p-2 border-t border-gray-200">
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const content = message.content;

  const renderContent = () => {
    if (typeof content === "string") {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    // Array of content blocks
    return (
      <div className="space-y-2">
        {content.map((block, idx) => {
          if (block.type === "text") {
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {block.text}
              </p>
            );
          } else if (block.type === "image") {
            return (
              <img
                key={idx}
                src={`data:${block.source.media_type};base64,${block.source.data}`}
                alt="Attachment"
                className="max-w-full rounded"
              />
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export function ChatWindow({
  chatId,
  messages,
  isConnected,
  isLoading,
  onSendMessage,
  onInterrupt,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<ImageContent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageContent[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      // Convert to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      newImages.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as any,
          data: base64Data,
        },
      });
    }

    setAttachedImages([...attachedImages, ...newImages]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(attachedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachedImages.length === 0) || !chatId || isLoading || !isConnected) return;

    // Build content
    let content: MessageContent;
    if (attachedImages.length === 0) {
      // Text only
      content = input.trim();
    } else {
      // Multi-part content
      const blocks: Array<TextContent | ImageContent> = [];
      if (input.trim()) {
        blocks.push({ type: "text", text: input.trim() });
      }
      blocks.push(...attachedImages);
      content = blocks;
    }

    onSendMessage(content);
    setInput("");
    setAttachedImages([]);
  };

  const handleInterrupt = () => {
    console.log('[FRONTEND] Stop button clicked', { chatId, isLoading });
    if (chatId && isLoading) {
      console.log('[FRONTEND] Calling onInterrupt for chatId:', chatId);
      onInterrupt();
    } else {
      console.log('[FRONTEND] Not calling interrupt - conditions not met');
    }
  };

  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Welcome to Simple Chat</p>
          <p className="text-sm mt-2">Select a chat or create a new one to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Chat</h2>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-xs text-green-600">● Connected</span>
          ) : (
            <span className="text-xs text-red-600">○ Disconnected</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation</p>
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "tool_use" ? (
                <ToolUseBlock key={msg.id} message={msg} />
              ) : (
                <MessageBubble key={msg.id} message={msg} />
              )
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="animate-pulse">●</span>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        {/* Image Previews */}
        {attachedImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={`data:${img.source.media_type};base64,${img.source.data}`}
                  alt={`Attachment ${idx + 1}`}
                  className="h-20 w-20 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || isLoading}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Attach image"
          >
            📎
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleInterrupt}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && attachedImages.length === 0) || !isConnected}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
