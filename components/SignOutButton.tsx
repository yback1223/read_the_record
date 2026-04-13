"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton({
  className,
  label = "로그아웃",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        className ??
        "rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)] disabled:opacity-50"
      }
    >
      {busy ? "…" : label}
    </button>
  );
}
