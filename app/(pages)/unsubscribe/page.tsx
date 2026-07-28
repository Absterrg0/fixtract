"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const subscriberToken = searchParams.get("subscriberToken") || "";

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const runUnsubscribe = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/public/marketing/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, subscriberToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Unsubscribe failed");
      setMessage(json.data?.message || "You have been unsubscribed.");
      setStatus("done");
    } catch (e: any) {
      setMessage(e.message || "Unsubscribe failed");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (token || (email && subscriberToken)) {
      void runUnsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Email preferences</CardTitle>
        <CardDescription>Manage Fixtract promotional email subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && !token && !(email && subscriberToken) && (
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
