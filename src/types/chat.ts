export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts?: number; // epoch ms
}

export interface ChatRequestBody {
  sessionId: string;
  message: string;
  history?: ChatMessage[];
}

export interface ChatSuccessResponse {
  message: string;
  meta?: {
    tokensIn?: number;
    tokensOut?: number;
    truncation?: boolean;
    latencyMs?: number;
  };
}

export type ChatErrorResponse = {
  error: 'bad_request' | 'rate_limited' | 'filtered' | 'server_error' | 'not_found';
  message: string;
  retryAfter?: number;
};

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse;
