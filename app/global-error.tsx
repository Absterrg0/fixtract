"use client";

/**
 * Last-resort fallback when the root layout itself fails. Kept dependency-free
 * and English-only because the i18n provider is not available at this level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#f8fafc",
            color: "#111827",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              padding: "24px",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              background: "#ffffff",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "18px", margin: 0 }}>Something went wrong</h1>
            <p style={{ fontSize: "14px", color: "#4b5563", marginTop: "8px" }}>
              The page could not be loaded. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "20px",
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                background: "#4032f7",
                color: "#ffffff",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {error.digest ? (
              <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "16px" }}>
                Reference: {error.digest}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
