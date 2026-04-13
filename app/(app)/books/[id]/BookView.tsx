"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookshelfLoader from "@/components/BookshelfLoader";
import ReflectionEditor from "./ReflectionEditor";

type Recording = {
  id: string;
  audioPath: string;
  mimeType: string;
  transcript: string;
  createdAt: string;
};

type Book = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  publisher: string | null;
  reflection: string;
  recordings: Recording[];
};

type Status = "idle" | "uploading" | "error";

const MAX_RECORDING_SECONDS = 60;

export default function BookView({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("ko");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/books/${bookId}`, { cache: "no-store" });
    if (res.ok) setBook(await res.json());
    else setError("책을 찾을 수 없습니다.");
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t));
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const file = new File(
          [blob],
          `recording-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`,
          { type },
        );
        await uploadRecording(file);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      setElapsed(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(sec);
        if (sec >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch (err) {
      setError(
        err instanceof Error
          ? `마이크 접근 실패: ${err.message}`
          : "마이크 접근 실패",
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function uploadRecording(file: File) {
    setStatus("uploading");
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("language", language);
    try {
      const res = await fetch(`/api/books/${bookId}/recordings`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setStatus("idle");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) await uploadRecording(f);
    e.target.value = "";
  }

  async function deleteRecording(id: string) {
    if (!confirm("이 녹음을 지울까요?")) return;
    const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function deleteBook() {
    if (!confirm("이 책을 지울까요? 녹음도 함께 사라집니다.")) return;
    const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  function formatElapsed(sec: number) {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
      " · " +
      d.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  if (!book) {
    if (error) {
      return (
        <div className="p-8 text-sm italic text-[color:var(--ink-soft)]">
          {error}
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-10">
        <BookshelfLoader label="책을 펼치는 중…" />
      </div>
    );
  }

  const busy = status === "uploading";

  return (
    <div className="fade-up mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={book.coverUrl}
                alt=""
                className="h-32 w-22 shrink-0 rounded-sm object-cover shadow-[0_8px_24px_-12px_rgba(70,50,20,0.35)]"
                style={{ width: "5.5rem" }}
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
                {book.author ?? "저자 미상"}
                {book.publisher && ` · ${book.publisher}`}
              </p>
              <h1 className="serif mt-2 text-[28px] leading-tight text-[color:var(--ink)] md:text-[34px]">
                {book.title}
              </h1>
            </div>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="더보기"
              aria-expanded={menuOpen}
              className={`flex h-9 w-9 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)] ${
                menuOpen ? "border-[color:var(--rule-strong)] text-[color:var(--ink)]" : ""
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="13" cy="8" r="1.4" />
              </svg>
            </button>
            <div
              className={`absolute right-0 top-11 z-20 w-44 origin-top-right overflow-hidden rounded-lg border hairline bg-[color:var(--paper-2)] shadow-[0_18px_40px_-20px_rgba(70,50,20,0.3)] ${
                menuOpen
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0"
              }`}
              style={{ transitionDuration: "200ms" }}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  deleteBook();
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12px] text-[color:var(--danger)] hover:bg-[color:var(--paper)]"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 4h10M6 4V2.5h4V4M5 4l.6 9.5a1 1 0 0 0 1 1h2.8a1 1 0 0 0 1-1L11 4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                책 지우기
              </button>
            </div>
          </div>
        </div>
        <div className="h-px w-full bg-[color:var(--rule)]" />
      </header>

      <section className="paper-card relative flex flex-col items-center gap-5 px-6 py-8">
        {busy && (
          <div className="fade-up absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-[color:var(--paper-2)]/92 backdrop-blur-sm">
            <BookshelfLoader label="목소리를 글로 옮기는 중…" />
          </div>
        )}
        <div className="flex flex-col items-center gap-1">
          <div className="serif text-[32px] tabular-nums tracking-wide text-[color:var(--ink)]">
            {formatElapsed(elapsed)}
            <span className="ml-2 text-[14px] text-[color:var(--ink-soft)]">
              / {formatElapsed(MAX_RECORDING_SECONDS)}
            </span>
          </div>
          <div className="h-[3px] w-40 overflow-hidden rounded-full bg-[color:var(--rule)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100)}%`,
                background: "var(--accent)",
                transitionDuration: "240ms",
              }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={busy}
          aria-label={isRecording ? "녹음 정지" : "녹음 시작"}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full border hairline bg-[color:var(--paper)] hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 ${
            isRecording ? "pulse-soft" : ""
          }`}
          style={{ transitionDuration: "300ms" }}
        >
          {isRecording ? (
            <span
              className="block h-5 w-5 rounded-[3px]"
              style={{ background: "var(--accent)" }}
            />
          ) : (
            <span
              className="block h-6 w-6 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </button>

        <p className="text-xs text-[color:var(--ink-muted)]">
          {busy
            ? "문장을 옮기는 중…"
            : isRecording
              ? `듣는 중 · 최대 ${MAX_RECORDING_SECONDS}초 · 다시 눌러 마침`
              : `눌러서 녹음 시작 · 최대 ${MAX_RECORDING_SECONDS}초`}
        </p>

        <div className="mt-2 flex w-full items-center gap-3">
          <label htmlFor="lang" className="text-[11px] text-[color:var(--ink-soft)] uppercase tracking-wider">
            언어
          </label>
          <select
            id="lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 rounded-lg border hairline bg-[color:var(--paper)] px-3 py-2 text-sm"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
          <label className="cursor-pointer rounded-lg border hairline px-3 py-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]">
            파일
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={onFilePicked}
            />
          </label>
        </div>
      </section>

      <ReflectionEditor bookId={book.id} initial={book.reflection ?? ""} />

      {error && (
        <div className="fade-up rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, transparent)",
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            남긴 문장
          </h2>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
          <span className="text-[11px] text-[color:var(--ink-soft)]">
            {book.recordings.length}
          </span>
        </div>

        {book.recordings.length === 0 && (
          <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
            아직 남긴 문장이 없어요.
          </p>
        )}

        <ul className="flex flex-col gap-5">
          {book.recordings.map((r) => (
            <RecordingCard
              key={r.id}
              recording={r}
              formattedDate={formatDate(r.createdAt)}
              onDelete={() => deleteRecording(r.id)}
              onSaved={(updated) => {
                setBook((prev) =>
                  prev
                    ? {
                        ...prev,
                        recordings: prev.recordings.map((x) =>
                          x.id === updated.id ? { ...x, ...updated } : x,
                        ),
                      }
                    : prev,
                );
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function RecordingCard({
  recording,
  formattedDate,
  onDelete,
  onSaved,
}: {
  recording: Recording;
  formattedDate: string;
  onDelete: () => void;
  onSaved: (r: Recording) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.transcript);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function startEdit() {
    setDraft(recording.transcript);
    setErr("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setErr("");
    const res = await fetch(`/api/recordings/${recording.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: draft }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "저장 실패");
      setSaving(false);
      return;
    }
    const updated = (await res.json()) as Recording;
    onSaved(updated);
    setSaving(false);
    setEditing(false);
  }

  return (
    <li className="paper-card fade-up px-6 py-6">
      <div className="flex items-center justify-between">
        <time className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
          {formattedDate}
        </time>
        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-full border hairline px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
            >
              다듬기
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border hairline px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--danger)] hover:border-[color:var(--danger)]"
          >
            지움
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(3, draft.split("\n").length + 1)}
            className="prose-reading w-full resize-y rounded-lg border hairline bg-[color:var(--paper)] p-4"
            style={{ borderLeft: "2px solid var(--accent)" }}
          />
          {err && (
            <p
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background:
                  "color-mix(in oklab, var(--danger) 10%, transparent)",
                color: "var(--danger)",
              }}
            >
              {err}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || draft === recording.transcript}
              className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <blockquote
          className="prose-reading mt-4 border-l-2 pl-4"
          style={{ borderColor: "var(--accent)" }}
        >
          {recording.transcript || (
            <span className="italic text-[color:var(--ink-soft)]">
              (비어 있음)
            </span>
          )}
        </blockquote>
      )}

      <audio
        controls
        preload="none"
        src={`/api/recordings/${recording.id}/audio`}
        className="mt-4 w-full"
      />
    </li>
  );
}
