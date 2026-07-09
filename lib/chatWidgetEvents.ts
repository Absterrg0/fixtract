export const CHAT_WIDGET_OPEN_EVENT = "fixtract:chat-widget-open";
export const PENDING_CHAT_START_KEY = "fixtract:pending-chat-start";
export const LEGACY_PENDING_CHAT_START_KEY = "fixera:pending-chat-start";

export interface ChatWidgetOpenDetail {
  open?: boolean;
  professionalId?: string;
  customerId?: string;
  conversationId?: string;
}

export const emitChatWidgetOpen = (detail: ChatWidgetOpenDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatWidgetOpenDetail>(CHAT_WIDGET_OPEN_EVENT, { detail })
  );
};
