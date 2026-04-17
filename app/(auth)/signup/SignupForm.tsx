"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import FullscreenLoader from "@/components/FullscreenLoader";

export default function SignupForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (!nickname.trim()) return "닉네임을 입력해 주세요.";
    if (nickname.trim().length < 2) return "닉네임은 2자 이상이어야 해요.";
    if (nickname.trim().length > 24) return "닉네임은 24자 이하로 적어주세요.";
    if (!email.trim()) return "이메일을 입력해 주세요.";
    if (password.length < 6) return "비밀번호는 6자 이상이어야 해요.";
    if (password !== passwordConfirm) return "비밀번호가 일치하지 않아요.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nickname: nickname.trim(),
        },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data.session) {
      try {
        await fetch("/api/auth/log-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "signup" }),
        });
      } catch {
        // non-blocking
      }
      router.replace("/");
      router.refresh();
    } else {
      setInfo("확인 이메일을 보냈어요. 메일함을 확인해 주세요.");
      setBusy(false);
    }
  }

  return (
    <>
    <FullscreenLoader show={busy} label="서재를 여는 중…" />
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field
        id="nickname"
        label="닉네임"
        type="text"
        autoComplete="nickname"
        value={nickname}
        onChange={setNickname}
        placeholder="서재에서 불릴 이름"
      />
      <Field
        id="email"
        label="이메일"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <Field
        id="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint="6자 이상"
      />
      <Field
        id="passwordConfirm"
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        value={passwordConfirm}
        onChange={setPasswordConfirm}
        error={
          passwordConfirm.length > 0 && password !== passwordConfirm
            ? "비밀번호가 일치하지 않아요"
            : undefined
        }
      />

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
    </>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
        <span>{label}</span>
        {hint && (
          <span className="normal-case tracking-normal text-[10px] italic">
            {hint}
          </span>
        )}
      </span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 text-sm placeholder:text-[color:var(--ink-soft)]"
      />
      {error && (
        <span className="text-[10px] text-[color:var(--danger)]">{error}</span>
      )}
    </label>
  );
}
