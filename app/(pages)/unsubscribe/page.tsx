"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const subscriberToken = searchParams.get("subscriberToken") || "";
  const hasParams = Boolean(token || (email && subscriberToken));

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const paramsKey = `${token}:${email}:${subscriberToken}`;
  const paramsKeyRef = useRef(paramsKey);

  useEffect(() => {
    paramsKeyRef.current = paramsKey;
    requestRef.current?.abort();
    requestRef.current = null;
    setStatus("idle");
    setMessage("");
    return () => requestRef.current?.abort();
  }, [paramsKey]);

  const runUnsubscribe = async () => {
    if (status === "loading") return;
    if (!API_BASE) {
      setMessage("Server URL is not configured");
      setStatus("error");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestParamsKey = paramsKey;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/public/marketing/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, subscriberToken }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.msg || "Unsubscribe failed");
      }
      if (requestParamsKey === paramsKeyRef.current) {
        setMessage(json.data?.message || "You have been unsubscribed.");
        setStatus("done");
      }
    } catch (e: unknown) {
      if (requestParamsKey === paramsKeyRef.current) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setMessage(aborted ? "The request timed out. Please try again." : errMessage(e, "Unsubscribe failed"));
        setStatus("error");
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Email preferences</CardTitle>
        <CardDescription>Manage Fixtract promotional email subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && !hasParams && (
          <>
            <p className="text-sm text-muted-foreground">
              Open the unsubscribe link from a campaign email, or manage preferences in your
              profile.
            </p>
            <Button asChild>
              <Link href="/profile?tab=notifications">Open notification settings</Link>
            </Button>
          </>
        )}
        {status === "idle" && hasParams && (
          <>
            <p className="text-sm text-muted-foreground">
              Confirm to stop receiving Fixtract promotional emails. Transactional booking emails
              are unaffected.
            </p>
            <Button onClick={runUnsubscribe}>Unsubscribe from promotions</Button>
          </>
        )}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Unsubscribing…
          </div>
        )}
        {status === "done" && <p className="text-sm text-emerald-700">{message}</p>}
        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-rose-600">{message}</p>
            <Button variant="outline" onClick={runUnsubscribe}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}>
        <UnsubscribeInner />
      </Suspense>
    </div>
  );
}
