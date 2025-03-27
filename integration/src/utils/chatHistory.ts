// Chat history module to store recent conversations
// Stores a maximum of 10 messages per channel

// Chat message interface
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Chat history storage
const chatHistories: Record<string, ChatMessage[]> = {};

// Max number of messages to store per channel
const MAX_HISTORY_LENGTH = 10;

export const ChatHistoryService = {
  // Add a message to the chat history
  addMessage: (channelId: string, message: ChatMessage): void => {
    if (!chatHistories[channelId]) {
      chatHistories[channelId] = [];
    }

    chatHistories[channelId].push(message);

    // Trim history if it exceeds the maximum length
    if (chatHistories[channelId].length > MAX_HISTORY_LENGTH) {
      chatHistories[channelId] =
        chatHistories[channelId].slice(-MAX_HISTORY_LENGTH);
    }
  },

  // Get the chat history for a channel
  getHistory: (channelId: string): ChatMessage[] => {
    return chatHistories[channelId] || [];
  },

  // Format chat history for AI context
  formatHistoryForAI: (channelId: string): string => {
    const history = chatHistories[channelId] || [];

    // If there's only 0 or 1 message (just the current user message), there's no history to format
    if (history.length <= 1) {
      return "";
    }

    // Only include messages up to the second-to-last message
    // (excluding the most recent user message which is handled separately)
    const historyToFormat = history.slice(0, -1);

    if (historyToFormat.length === 0) {
      return "";
    }

    return historyToFormat
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n\n");
  },

  // Clear history for a channel
  clearHistory: (channelId: string): void => {
    chatHistories[channelId] = [];
  },
};
