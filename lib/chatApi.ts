import { getAuthToken } from "@/lib/utils";
import { ApiRequestError, apiErrorFromBody } from "@/lib/apiErrors";
import type { ChatAttachment, ChatConversation, ConversationListResponse, MessageListResponse, ChatMessage, ConversationInfoStats, ChatFilter } from "@/types/chat";

const getAuthHeaders = (headers?: Record<string, string>) => {
  const token = getAuthToken();
  const merged: Record<string, string> = { ...(headers || {}) };
  if (token) {
    merged.Authorization = `Bearer ${token}`;
  }
  return merged;
};

const parseJson = async <T,>(response: Response): Promise<T | null> => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const toErrorMessage = async (response: Response, fallback: string) => {
  const data = await parseJson<{ msg?: string; message?: string; code?: string }>(response);
  return apiErrorFromBody(data, fallback, { status: response.status });
};

const API_BASE = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chat`;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const errorFromResponse = (response: Response, data: unknown, fallback: string): Error =>
  apiErrorFromBody(data, fallback, { status: response.status });

export const PROFESSIONALS_LIMIT = 20;

export interface ProfessionalOption {
  _id: string;
  name?: string;
  username?: string;
  businessInfo?: { companyName?: string; city?: string; country?: string };
}

export const fetchProfessionals = async (limit = PROFESSIONALS_LIMIT): Promise<ProfessionalOption[]> => {
  const response = await fetch(`${BACKEND_URL}/api/professionals`, {
    credentials: "include",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await toErrorMessage(response, 'Failed to load professionals');
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? data.slice(0, limit) : [];
};

export const createOrGetConversation = async (payload: {
  professionalId?: string;
  customerId?: string;
}) => {
  if (!payload.professionalId && !payload.customerId) {
    throw new ApiRequestError('Unable to start the conversation. Please try again.', { kind: 'validation' });
  }

  const response = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ success?: boolean; conversation?: ChatConversation; msg?: string }>(response);
  if (!response.ok || !data?.success || !data.conversation) {
    throw errorFromResponse(response, data, `Failed to start chat`);
  }

  return data.conversation;
};

export const fetchConversations = async (params?: { page?: number; limit?: number; filter?: ChatFilter }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.filter && params.filter !== "all") query.set("filter", params.filter);

  const response = await fetch(`${API_BASE}/conversations${query.toString() ? `?${query.toString()}` : ""}`, {
    method: "GET",
    credentials: "include",
    headers: getAuthHeaders(),
  });

  const data = await parseJson<ConversationListResponse>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `Failed to load conversations`);
  }

  return data.data;
};

export const fetchUnreadConversationCount = async (): Promise<number> => {
  const response = await fetch(`${API_BASE}/conversations/unread-count`, {
    method: "GET",
    credentials: "include",
    headers: getAuthHeaders(),
  });

  const data = await parseJson<{ success?: boolean; data?: { count?: number }; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to load unread conversations`);
  }

  const count = Number(data.data?.count);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

export const fetchConversationMessages = async (
  conversationId: string,
  params?: { before?: string; limit?: number }
) => {
  const query = new URLSearchParams();
  if (params?.before) query.set("before", params.before);
  if (params?.limit) query.set("limit", String(params.limit));

  const response = await fetch(
    `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages${query.toString() ? `?${query.toString()}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    }
  );

  const data = await parseJson<MessageListResponse>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `Failed to load messages`);
  }

  return data.data;
};

export const sendConversationMessage = async (
  conversationId: string,
  payload: { text?: string; images?: string[]; attachments?: ChatAttachment[]; replyTo?: string }
) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ success?: boolean; message?: ChatMessage; msg?: string }>(response);
  if (!response.ok || !data?.success || !data.message) {
    throw errorFromResponse(response, data, `Failed to send message`);
  }

  return data.message;
};

export const markConversationAsRead = async (conversationId: string) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "PATCH",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
  });

  if (!response.ok) {
    throw await toErrorMessage(response, 'Failed to mark conversation as read');
  }
};

export const uploadChatImage = async (file: File, conversationId?: string) => {
  const formData = new FormData();
  formData.append("image", file);
  if (conversationId) {
    formData.append("conversationId", conversationId);
  }

  const response = await fetch(`${API_BASE}/upload-image`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await parseJson<{ success?: boolean; data?: { url: string; key: string }; msg?: string }>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `Image upload failed`);
  }

  return data.data;
};

export const uploadChatFile = async (file: File, conversationId?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  if (conversationId) {
    formData.append("conversationId", conversationId);
  }

  const response = await fetch(`${API_BASE}/upload-file`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await parseJson<{
    success?: boolean;
    data?: { url: string; key: string; fileName: string; fileType: "image" | "document" | "video"; mimeType: string; fileSize: number };
    msg?: string;
  }>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `File upload failed`);
  }

  return data.data;
};

export const fetchConversationInfo = async (conversationId: string) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/info`, {
    method: "GET",
    credentials: "include",
    headers: getAuthHeaders(),
  });

  const data = await parseJson<{
    success?: boolean;
    data?: { conversation: ChatConversation; stats: ConversationInfoStats };
    msg?: string;
  }>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `Failed to load conversation info`);
  }

  return data.data;
};

export const toggleConversationStar = async (conversationId: string) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/star`, {
    method: "PATCH",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
  });

  const data = await parseJson<{ success?: boolean; starred?: boolean; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to toggle star`);
  }
  return data.starred ?? false;
};

export const toggleConversationArchive = async (conversationId: string) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/archive`, {
    method: "PATCH",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
  });

  const data = await parseJson<{ success?: boolean; archived?: boolean; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to toggle archive`);
  }
  return data.archived ?? false;
};

export const addConversationLabel = async (conversationId: string, label: string, color?: string) => {
  const response = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/label`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ label, color }),
  });

  const data = await parseJson<{ success?: boolean; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to add label`);
  }
};

export const removeConversationLabel = async (conversationId: string, label: string) => {
  const response = await fetch(
    `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/label/${encodeURIComponent(label)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getAuthHeaders(),
    }
  );

  const data = await parseJson<{ success?: boolean; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to remove label`);
  }
};

export const reportChatMessage = async (messageId: string, reason: string, description?: string) => {
  const response = await fetch(`${API_BASE}/messages/${encodeURIComponent(messageId)}/report`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason, description }),
  });

  const data = await parseJson<{ success?: boolean; msg?: string }>(response);
  if (!response.ok || !data?.success) {
    throw errorFromResponse(response, data, `Failed to report message`);
  }
};

export const searchChatMessages = async (conversationId: string, query: string) => {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(
    `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages/search?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    }
  );

  const data = await parseJson<{ success?: boolean; data?: { results: ChatMessage[]; total: number }; msg?: string }>(response);
  if (!response.ok || !data?.success || !data.data) {
    throw errorFromResponse(response, data, `Search failed`);
  }
  return data.data;
};
