"use client";

import { useMemo, useState, useTransition } from "react";

type Profile = {
  userId: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  role: "user" | "super_admin";
  active: boolean;
  createdAt: string;
  approvedAt: string | null;
};

type Action = "approve" | "reject" | "activate" | "deactivate";

export default function AdminTable({
  initial,
  myUserId,
}: {
  initial: Profile[];
  myUserId: string;
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function act(userId: string, action: Action) {
    setError("");
    const res = await fetch(`/api/admin/profiles/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "처리 실패");
      return;
    }
    const updated = await res.json();
    setProfiles((prev) =>
      prev.map((p) =>
        p.userId === userId
          ? {
              ...p,
              ...updated,
              createdAt: p.createdAt,
              approvedAt: updated.approvedAt
                ? new Date(updated.approvedAt).toISOString()
                : null,
            }
          : p,
      ),
    );
  }

  const groups = useMemo(() => {
    const pendingList = profiles.filter((p) => p.status === "pending");
    const active = profiles.filter(
      (p) => p.status === "approved" && p.active,
    );
    const inactive = profiles.filter(
      (p) => p.status !== "pending" && (!p.active || p.status === "rejected"),
    );
    return { pendingList, active, inactive };
  }, [profiles]);

  const total = profiles.length;

  return (
    <div className="flex flex-col gap-12">
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

      <Stats
        items={[
          { label: "전체", value: total },
          { label: "대기", value: groups.pendingList.length },
          { label: "활성", value: groups.active.length },
          { label: "비활성", value: groups.inactive.length },
        ]}
      />

      <Section
        title="승인 대기"
        count={groups.pendingList.length}
        empty="대기 중인 신청이 없어요."
      >
        <ul className="flex flex-col gap-3">
          {groups.pendingList.map((p) => (
            <Row key={p.userId} profile={p} self={p.userId === myUserId}>
              <PrimaryButton
                disabled={pending}
                onClick={() => startTransition(() => void act(p.userId, "approve"))}
              >
                승인
              </PrimaryButton>
              <GhostButton
                disabled={pending}
                danger
                onClick={() => startTransition(() => void act(p.userId, "reject"))}
              >
                반려
              </GhostButton>
            </Row>
          ))}
        </ul>
      </Section>

      <Section
        title="활성 사용자"
        count={groups.active.length}
        empty="활성 사용자가 없어요."
      >
        <ul className="flex flex-col gap-3">
          {groups.active.map((p) => (
            <Row key={p.userId} profile={p} self={p.userId === myUserId}>
              {p.userId !== myUserId && p.role !== "super_admin" && (
                <GhostButton
                  disabled={pending}
                  danger
                  onClick={() =>
                    startTransition(() => void act(p.userId, "deactivate"))
                  }
                >
                  비활성화
                </GhostButton>
              )}
            </Row>
          ))}
        </ul>
      </Section>

      <Section
        title="비활성 / 반려"
        count={groups.inactive.length}
        empty="없어요."
      >
        <ul className="flex flex-col gap-3">
          {groups.inactive.map((p) => (
            <Row key={p.userId} profile={p} self={p.userId === myUserId}>
              {p.status === "rejected" ? (
                <PrimaryButton
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void act(p.userId, "approve"))
                  }
                >
                  승인
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => void act(p.userId, "activate"))
                  }
                >
                  활성화
                </PrimaryButton>
              )}
            </Row>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Stats({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="paper-card flex flex-col items-center gap-1 px-2 py-4"
        >
          <span className="serif text-2xl text-[color:var(--ink)]">
            {it.value}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          {title}
        </h2>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <span className="text-[11px] text-[color:var(--ink-soft)]">{count}</span>
      </div>
      {count === 0 ? (
        <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function Row({
  profile,
  self,
  children,
}: {
  profile: Profile;
  self: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="paper-card fade-up flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="serif flex items-center gap-2 truncate text-[15px] text-[color:var(--ink)]">
          {profile.email}
          {profile.role === "super_admin" && <Tag>관리자</Tag>}
          {self && <Tag>나</Tag>}
          {!profile.active && profile.status === "approved" && (
            <Tag tone="muted">비활성</Tag>
          )}
          {profile.status === "rejected" && <Tag tone="danger">반려</Tag>}
        </p>
        <p className="text-[11px] text-[color:var(--ink-soft)]">
          가입 {new Date(profile.createdAt).toLocaleDateString("ko-KR")}
          {profile.approvedAt &&
            ` · 승인 ${new Date(profile.approvedAt).toLocaleDateString("ko-KR")}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

function Tag({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "danger";
}) {
  const styles =
    tone === "danger"
      ? {
          color: "var(--danger)",
          background:
            "color-mix(in oklab, var(--danger) 12%, transparent)",
        }
      : tone === "muted"
        ? {
            color: "var(--ink-soft)",
            background:
              "color-mix(in oklab, var(--ink-soft) 14%, transparent)",
          }
        : {
            color: "var(--accent)",
            background:
              "color-mix(in oklab, var(--accent) 12%, transparent)",
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

function PrimaryButton({
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

function GhostButton({
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
