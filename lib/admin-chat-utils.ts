import { authFetch } from "@/lib/utils"
import { toast } from "sonner"

export async function startAdminSupportChat(
  targetUserId: string,
  setChattingId: (id: string | null) => void
): Promise<void> {
  setChattingId(targetUserId)
  const w = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null
  if (w) {
    try {
      w.document.write(
        "<p style='font-family:sans-serif;padding:24px;color:#475569'>Opening support chat…</p>"
      )
    } catch {
      // ignore: writing the placeholder is best-effort
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/chat/start-support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, initialMessage: "Hello from Fixera support." }),
      signal: controller.signal,
    })
    const json = await res.json().catch(() => null)
    const conversationId = json?.data?.conversationId
    if (res.ok && json?.success && conversationId) {
      const url = `/admin/chat?conversationId=${conversationId}`
      if (w) w.location.href = url
      else window.open(url, "_blank")
    } else {
      w?.close()
      toast.error(json?.msg || "Failed to start chat")
    }
  } catch (err: unknown) {
    w?.close()
    toast.error(err instanceof DOMException && err.name === "AbortError" ? "Starting chat timed out" : "Failed to start chat")
  } finally {
    clearTimeout(timeout)
    setChattingId(null)
  }
}
