"use client";
// app/global-error.tsx
// The last resort, for when the frame round every screen breaks (app/error.tsx
// handles a single screen). It replaces the whole page, so it brings its own
// <html> and plain styles.

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const btn = { minHeight: 44, padding: "8px 16px", background: "#5a3b1c", color: "#ffe9b0", border: "3px solid #1d1209", fontSize: 16 };
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0b0c11", color: "#f1d9a0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, maxWidth: 360, textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Something broke</h2>
          <p style={{ margin: 0, color: "#c9bfa6" }}>Your progress is saved.</p>
          <button style={btn} onClick={() => window.location.reload()}>Reload</button>
          <button style={btn} onClick={() => { window.location.href = "/"; }}>Back to the Den</button>
          <p style={{ margin: 0, color: "#6f6858", fontSize: 11, wordBreak: "break-word" }}>{error.message}</p>
        </div>
      </body>
    </html>
  );
}
