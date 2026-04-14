"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

type Row = {
  userId: string;
  email: string;
  nickname: string | null;
  status: "pending" | "approved" | "rejected";
  role: "user" | "super_admin";
  active: boolean;
  createdAt: string;
  approvedAt: string | null;
  bookCount: number;
  recordingCount: number;
  lastLoginAt: string | null;
};

type Action = "approve" | "reject" | "activate" | "deactivate";

type Filter = "all" | "pending" | "active" | "inactive";

export default function UsersClient({
  initial,
  myUserId,
}: {
  initial: Row[];
  myUserId: string;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  async function act(userId: string, action: Action) {
    setErr("");
    const res = await fetch(`/api/admin/profiles/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error ?? "처리 실패");
      return;
    }
    const updated = await res.json();
    setRows((prev) =>
      prev.map((r) =>
        r.userId === userId
          ? {
              ...r,
              status: updated.status,
              active: updated.active,
              role: updated.role,
              approvedAt: updated.approvedAt,
            }
          : r,
      ),
    );
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "pending" && r.status !== "pending") return false;
      if (
        filter === "active" &&
        !(r.status === "approved" && r.active)
      )
        return false;
      if (
        filter === "inactive" &&
        !(r.status === "rejected" || !r.active)
      )
        return false;
      if (!needle) return true;
      return (
        r.email.toLowerCase().includes(needle) ||
        (r.nickname && r.nickname.toLowerCase().includes(needle))
      );
    });
  }, [rows, q, filter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      active: rows.filter((r) => r.status === "approved" && r.active).length,
      inactive: rows.filter(
        (r) => r.status === "rejected" || !r.active,
      ).length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      {err && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {err}
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center rounded-full border hairline p-0.5 text-[11px] uppercase tracking-wider">
          {(
            [
              { k: "all", label: `전체 ${counts.all}` },
              { k: "pending", label: `대기 ${counts.pending}` },
              { k: "active", label: `활성 ${counts.active}` },
              { k: "inactive", label: `비활성 ${counts.inactive}` },
            ] as const
          ).map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k)}
              className={`rounded-full px-3 py-1 ${
                filter === f.k
                  ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
                  : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative md:w-64">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이메일·닉네임 검색"
            className="w-full rounded-lg border hairline bg-[color:var(--paper-2)] py-2 pl-9 pr-3 text-sm placeholder:text-[color:var(--ink-soft)]"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="7"
              cy="7"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="m11 11 3 3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <li className="py-8 text-center text-sm italic text-[color:var(--ink-soft)]">
            조건에 맞는 사용자가 없어요.
          </li>
        )}
        {filtered.map((r) => {
          const self = r.userId === myUserId;
          return (
            <li
              key={r.userId}
              className="paper-card flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-4"
            >
              <Link
                href={`/admin/users/${r.userId}`}
                className="min-w-0 flex-1"
              >
                <p className="serif flex items-center gap-2 truncate text-[15px]">
                  {r.nickname || r.email}
                  {r.role === "super_admin" && <Tag>관리자</Tag>}
                  {self && <Tag>나</Tag>}
                  {r.status === "pending" && <Tag tone="warn">대기</Tag>}
                  {r.status === "rejected" && <Tag tone="danger">반려</Tag>}
                  {r.status === "approved" && !r.active && (
                    <Tag tone="muted">비활성</Tag>
                  )}
                </p>
                <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
                  {r.email}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                  <span>책 {r.bookCount}</span>
                  <span>녹음 {r.recordingCount}</span>
                  <span>
                    마지막 로그인{" "}
                    {r.lastLoginAt
                      ? formatRelative(new Date(r.lastLoginAt))
                      : "—"}
                  </span>
                </div>
              </Link>

              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {r.status === "pending" && (
                  <>
                    <Primary
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => void act(r.userId, "approve"))
                      }
                    >
                      승인
                    </Primary>
                    <Ghost
                      danger
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => void act(r.userId, "reject"))
                      }
                    >
                      반려
                    </Ghost>
                  </>
                )}
                {r.status === "approved" &&
                  r.active &&
                  !self &&
                  r.role !== "super_admin" && (
                    <Ghost
                      danger
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          void act(r.userId, "deactivate"),
                        )
                      }
                    >
                      비활성화
                    </Ghost>
                  )}
                {r.status === "approved" && !r.active && (
                  <Primary
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => void act(r.userId, "activate"))
                    }
                  >
                    활성화
                  </Primary>
                )}
                {r.status === "rejected" && (
                  <Primary
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => void act(r.userId, "approve"))
                    }
                  >
                    승인
                  </Primary>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tag({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "danger" | "warn";
}) {
  const styles =
    tone === "danger"
      ? {
          color: "var(--danger)",
          background:
            "color-mix(in oklab, var(--danger) 14%, transparent)",
        }
      : tone === "muted"
        ? {
            color: "var(--ink-soft)",
            background:
              "color-mix(in oklab, var(--ink-soft) 14%, transparent)",
          }
        : tone === "warn"
          ? {
              color: "var(--accent)",
              background:
                "color-mix(in oklab, var(--accent) 14%, transparent)",
            }
          : {
              color: "var(--accent)",
              background:
                "color-mix(in oklab, var(--accent) 14%, transparent)",
            };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider"
      style={styles}
    >
      {children}
    </span>
  );
}

function Primary({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
      style={{ background: "var(--accent)" }}
    >
      {children}
    </button>
  );
}

function Ghost({
  children,
  danger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider disabled:opacity-50 ${
        danger
          ? "text-[color:var(--ink-muted)] hover:text-[color:var(--danger)] hover:border-[color:var(--danger)]"
          : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "방금";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}
