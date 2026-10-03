"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveButton({ url, confirmText, label = "Remove", body, redirectTo }: { url: string; confirmText: string; label?: string; body?: unknown; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="link-btn danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm(confirmText)) return;
        setBusy(true);
        const res = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        setBusy(false);
        if (!res.ok) return alert((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
