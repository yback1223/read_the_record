"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookshelfLoader from "@/components/BookshelfLoader";
import ReflectionEditor from "./ReflectionEditor";

type RecordingType = "underline" | "whisper";

type Recording = {
  id: string;
  audioPath: string | null;
  mimeType: string | null;
  transcript: string;
  type: RecordingType;
  page: number | null;
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

export default function BookView({
  bookId,
  initial,
}: {
  bookId: string;
  initial: Book;
}) {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("ko");

  const [pageEditId, setPageEditId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<"underlines" | "whispers" | "reflection">("underlines");
  const tabContainerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [textSaving, setTextSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [waveform, setWaveform] = useState<number[]>(new Array(32).fill(0));

  const load = useCallback(async () => {
    const res = await fetch(`/api/books/${bookId}`, { cache: "no-store" });
    if (res.ok) setBook(await res.json());
    else setError("책을 찾을 수 없습니다.");
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

  function startWaveformLoop(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.floor(data.length / 32);
    function tick() {
      analyser.getByteFrequencyData(data);
      const bars: number[] = [];
      for (let i = 0; i < 32; i++) {
        bars.push(data[i * step] / 255);
      }
      setWaveform(bars);
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopWaveformLoop() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // fade out
    setWaveform(new Array(32).fill(0));
    analyserRef.current = null;
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;
      startWaveformLoop(analyser);

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
        stopWaveformLoop();
        audioCtx.close();
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
    form.append("type", tab === "whispers" ? "whisper" : "underline");
    try {
      const res = await fetch(`/api/books/${bookId}/recordings`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setStatus("idle");
      if (data?.id) setPageEditId(data.id);
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

  async function submitText() {
    const text = textDraft.trim();
    if (!text) return;
    setTextSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/books/${bookId}/recordings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          type: tab === "whispers" ? "whisper" : "underline",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setTextDraft("");
      if (data?.id) setPageEditId(data.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setTextSaving(false);
    }
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

      <div className="flex flex-col gap-3">
        <div ref={tabContainerRef} className="relative flex items-center rounded-full border hairline bg-[color:var(--paper-2)] p-1">
          {/* sliding indicator */}
          <div
            className="tab-indicator absolute rounded-full bg-[color:var(--ink)]"
            style={{
              width: `calc(${100 / 3}% - 2px)`,
              height: "calc(100% - 8px)",
              top: 4,
              left: `calc(${(tab === "underlines" ? 0 : tab === "whispers" ? 1 : 2) * (100 / 3)}% + 1px)`,
            }}
          />
          {([
            { key: "underlines" as const, label: "밑줄", count: book.recordings.filter(r => r.type === "underline").length },
            { key: "whispers" as const, label: "속삭임", count: book.recordings.filter(r => r.type === "whisper").length },
            { key: "reflection" as const, label: "독후감" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative z-10 flex-1 rounded-full py-2 text-[12px] tracking-wide ${
                tab === t.key
                  ? "text-[color:var(--paper)]"
                  : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              }`}
            >
              {t.label}{"count" in t ? ` · ${t.count}` : ""}
            </button>
          ))}
        </div>
        <p className="px-1 text-center text-[12px] italic leading-relaxed text-[color:var(--ink-muted)]">
          {tab === "underlines"
            ? "마음에 닿은 문장을 목소리로 스쳐 적어두는 곳"
            : tab === "whispers"
              ? "책을 읽다가 떠오른 생각을 목소리로 남기는 곳"
              : "읽고 난 뒤 밑줄과 속삭임을 모아 긴 글로 풀어두는 곳"}
        </p>
      </div>

      <div key={tab} className="tab-fade flex flex-col gap-10">
      {(tab === "underlines" || tab === "whispers") && (
      <section className="recorder-card relative overflow-hidden rounded-[18px] px-5 py-5">
        {/* warm gradient background */}
        <div className="pointer-events-none absolute inset-0 -z-10" style={{
          background: isRecording
            ? "radial-gradient(ellipse at 50% 80%, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 80%, color-mix(in oklab, var(--accent) 6%, transparent) 0%, transparent 70%)",
        }} />

        {busy && (
          <div className="fade-up absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[color:var(--paper-2)]/92 backdrop-blur-sm">
            <BookshelfLoader label="목소리를 글로 옮기는 중…" />
          </div>
        )}

        {/* record row: button + waveform + timer */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={busy}
            aria-label={isRecording ? "녹음 정지" : "녹음 시작"}
            className={`recorder-btn recorder-btn--compact relative flex shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
              isRecording ? "recorder-btn--active" : ""
            }`}
          >
            <span className={`absolute inset-0 rounded-full ${isRecording ? "recorder-glow" : ""}`} />
            <span
              className={`relative z-10 block ${isRecording ? "rounded-[3px]" : "rounded-full"}`}
              style={{
                width: isRecording ? 12 : 14,
                height: isRecording ? 12 : 14,
                background: "var(--paper)",
              }}
            />
          </button>

          {/* waveform + progress */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex h-10 items-end gap-[2px]">
              {waveform.map((v, i) => {
                const idle = !isRecording;
                const h = idle
                  ? 2 + Math.sin(i * 0.6) * 1.5
                  : Math.max(2, v * 36);
                return (
                  <div
                    key={i}
                    className="waveform-bar flex-1 rounded-full"
                    style={{
                      height: h,
                      opacity: idle ? 0.2 : 0.3 + v * 0.7,
                      background: idle
                        ? "var(--ink-soft)"
                        : `color-mix(in oklab, var(--accent) ${Math.round(50 + v * 50)}%, var(--accent-soft))`,
                    }}
                  />
                );
              })}
            </div>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-[color:var(--rule)]">
              <div
                className="waveform-bar h-full rounded-full"
                style={{
                  width: `${Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100)}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>

          {/* timer */}
          <div className={`shrink-0 serif tabular-nums text-[14px] ${isRecording ? "text-[color:var(--accent)]" : "text-[color:var(--ink-muted)]"}`}>
            {formatElapsed(elapsed)}
            <span className="text-[10px] text-[color:var(--ink-soft)]"> / {formatElapsed(MAX_RECORDING_SECONDS)}</span>
          </div>
        </div>

        {/* hint */}
        <p className="mt-2 text-center text-[11px] italic text-[color:var(--ink-muted)]">
          {busy
            ? "목소리를 글로 옮기는 중…"
            : isRecording
              ? "듣고 있어요… 다시 누르면 멈춰요"
              : tab === "underlines"
                ? "눌러서 문장을 읽어보세요"
                : "눌러서 생각을 말해보세요"}
        </p>

        {/* controls row */}
        <div className="mt-3 flex items-center gap-2">
          <select
            id="lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="언어"
            className="rounded-full border hairline bg-[color:var(--paper)]/60 px-3 py-1.5 text-[11px] text-[color:var(--ink-muted)] backdrop-blur-sm"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
          </select>
          <label className="cursor-pointer rounded-full border hairline bg-[color:var(--paper)]/60 px-3 py-1.5 text-[11px] text-[color:var(--ink-muted)] backdrop-blur-sm hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]">
            파일
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={onFilePicked}
            />
          </label>
        </div>

        {/* divider */}
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
          <span className="text-[10px] tracking-wider text-[color:var(--ink-soft)]">직접 적기</span>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
        </div>

        {/* text input */}
        <div className="flex items-start gap-3">
          <textarea
            ref={textRef}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitText();
              }
            }}
            placeholder={tab === "underlines" ? "마음에 남은 문장을 적어보세요…" : "떠오르는 생각을 적어보세요…"}
            rows={1}
            className="prose-reading min-h-[2.4rem] flex-1 resize-none rounded-xl border hairline bg-[color:var(--paper)]/60 px-3 py-2 text-[13px] leading-relaxed placeholder:italic placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)] backdrop-blur-sm"
          />
          <button
            type="button"
            onClick={submitText}
            disabled={!textDraft.trim() || textSaving}
            className="shrink-0 rounded-full px-4 py-2 text-[11px] tracking-wider text-[color:var(--paper)] disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            {textSaving ? "…" : "남기기"}
          </button>
        </div>
      </section>
      )}

      {tab === "reflection" && (
        <ReflectionEditor
          bookId={book.id}
          initial={book.reflection ?? ""}
          recordings={book.recordings}
        />
      )}

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

      {(tab === "underlines" || tab === "whispers") && (() => {
        const currentType: RecordingType = tab === "underlines" ? "underline" : "whisper";
        const filtered = book.recordings.filter((r) => r.type === currentType);
        const label = tab === "underlines" ? "밑줄" : "속삭임";
        const emptyMsg = tab === "underlines" ? "아직 남긴 문장이 없어요." : "아직 남긴 속삭임이 없어요.";
        return (
      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            {label}
          </h2>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
          <span className="text-[11px] text-[color:var(--ink-soft)]">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
            {emptyMsg}
          </p>
        )}

        <ul className="flex flex-col gap-5">
          {filtered.map((r) => (
            <RecordingCard
              key={r.id}
              recording={r}
              formattedDate={formatDate(r.createdAt)}
              autoEditPage={pageEditId === r.id}
              onPageEditConsumed={() => setPageEditId(null)}
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
        );
      })()}
      </div>
    </div>
  );
}

function RecordingCard({
  recording,
  formattedDate,
  autoEditPage,
  onPageEditConsumed,
  onDelete,
  onSaved,
}: {
  recording: Recording;
  formattedDate: string;
  autoEditPage?: boolean;
  onPageEditConsumed?: () => void;
  onDelete: () => void;
  onSaved: (r: Recording) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.transcript);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [pageEditing, setPageEditing] = useState(false);
  const [pageDraft, setPageDraft] = useState<string>(
    recording.page != null ? String(recording.page) : "",
  );
  const [savingPage, setSavingPage] = useState(false);
  const pageInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (autoEditPage) {
      setPageEditing(true);
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        pageInputRef.current?.focus();
      });
      onPageEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEditPage]);

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

  async function savePage() {
    const trimmed = pageDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setErr("페이지는 0 이상의 정수여야 해요");
      return;
    }
    setSavingPage(true);
    setErr("");
    const res = await fetch(`/api/recordings/${recording.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "저장 실패");
      setSavingPage(false);
      return;
    }
    const updated = (await res.json()) as Recording;
    onSaved(updated);
    setSavingPage(false);
    setPageEditing(false);
  }

  function onPageKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      savePage();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPageDraft(recording.page != null ? String(recording.page) : "");
      setPageEditing(false);
    }
  }

  return (
    <li ref={cardRef} className="paper-card fade-up px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <time className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
            {formattedDate}
          </time>
          {pageEditing ? (
            <span className="flex items-center gap-1 rounded-full border hairline px-2 py-0.5 text-[11px] text-[color:var(--ink-muted)]">
              <span className="text-[10px] uppercase tracking-wider">p.</span>
              <input
                ref={pageInputRef}
                type="number"
                inputMode="numeric"
                min={0}
                value={pageDraft}
                onChange={(e) => setPageDraft(e.target.value)}
                onKeyDown={onPageKey}
                onBlur={savePage}
                disabled={savingPage}
                placeholder="-"
                className="w-12 bg-transparent text-center text-[12px] text-[color:var(--ink)] outline-none"
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPageDraft(
                  recording.page != null ? String(recording.page) : "",
                );
                setPageEditing(true);
                requestAnimationFrame(() => pageInputRef.current?.focus());
              }}
              className={`rounded-full border hairline px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
                recording.page != null
                  ? "text-[color:var(--accent)] border-[color:var(--accent)]"
                  : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
              }`}
              title="페이지 적기"
            >
              {recording.page != null
                ? `p. ${recording.page}`
                : "+ 페이지"}
            </button>
          )}
        </div>
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

      {recording.audioPath && (
        <audio
          controls
          preload="none"
          src={`/api/recordings/${recording.id}/audio`}
          className="mt-4 w-full"
        />
      )}
    </li>
  );
}
