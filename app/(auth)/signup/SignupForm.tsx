"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setInfo("확인 이메일을 보냈어요. 메일함을 확인해 주세요.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
          이메일
        </span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
          비밀번호 (6자 이상)
        </span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 text-sm"
        />
      </label>

      {error && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}
      {info && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--accent) 12%, transparent)",
            color: "var(--accent)",
          }}
        >
          {info}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-2 rounded-lg bg-[color:var(--ink)] py-3 text-sm tracking-wide text-[color:var(--paper)] hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "만드는 중…" : "회원가입"}
      </button>
    </form>
  );
}
