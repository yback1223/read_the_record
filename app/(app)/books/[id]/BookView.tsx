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
  const [pageModalDraft, setPageModalDraft] = useState("");
  const [pageModalSaving, setPageModalSaving] = useState(false);
  const [pageModalClosing, setPageModalClosing] = useState(false);
  const pageModalRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<"underlines" | "whispers" | "reflection">("underlines");
  const tabContainerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [textDraft, setTextDraft] = useState("");
  const [textSaving, setTextSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

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
    // Defensively clear any leftover timer/recorder from a previous session
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
    // Stop the timer FIRST — independent of MediaRecorder state
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    // Then stop the recorder; onstop will flush and upload
    try {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
    } catch {
      // swallow — already stopped
    }
    mediaRecorderRef.current = null;

    // Release mic immediately so the red indicator disappears on iOS
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    stopWaveformLoop();
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

  async function deleteRecording(id: string) {
    if (!confirm("이 녹음을 지울까요?")) return;
    setDeletingIds((s) => new Set(s).add(id));
    await new Promise((r) => setTimeout(r, 350));
    const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    setDeletingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function deleteBook() {
    if (!confirm("이 책을 지울까요? 녹음도 함께 사라집니다.")) return;
    const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  async function savePageModal() {
    if (!pageEditId) return;
    const trimmed = pageModalDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 0)) return;
    setPageModalSaving(true);
    const res = await fetch(`/api/recordings/${pageEditId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: value }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBook((prev) =>
        prev
          ? { ...prev, recordings: prev.recordings.map((x) => x.id === updated.id ? { ...x, ...updated } : x) }
          : prev,
      );
    }
    setPageModalSaving(false);
    closePageModal();
  }

  function closePageModal() {
    setPageModalClosing(true);
    setTimeout(() => {
      setPageEditId(null);
      setPageModalDraft("");
      setPageModalClosing(false);
    }, 250);
  }

  // Focus page modal input when it opens
  useEffect(() => {
    if (pageEditId) {
      setPageModalDraft("");
      requestAnimationFrame(() => pageModalRef.current?.focus());
    }
  }, [pageEditId]);

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
      <section className="recorder-card relative overflow-hidden rounded-[18px]">
        {/* warm gradient background — transitions smoothly */}
        <div className="composer-glow pointer-events-none absolute inset-0 -z-10" style={{
          opacity: isRecording ? 1 : 0.4,
          background: "radial-gradient(ellipse at 50% 80%, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)",
        }} />

        {busy && (
          <div className="fade-up absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[color:var(--paper-2)]/92 backdrop-blur-sm">
            <BookshelfLoader label="목소리를 글로 옮기는 중…" />
          </div>
        )}

        {/* Only one UI rendered at a time — no layer overlap, no iOS hit-test ambiguity */}
        {isRecording ? (
          <div className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 whitespace-nowrap text-[13px] text-[color:var(--accent)]"
                style={{
                  fontFamily:
                    "'SF Mono', ui-monospace, 'Menlo', 'Consolas', monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatElapsed(elapsed)}
                <span className="text-[10px] text-[color:var(--ink-soft)]">
                  {" "}
                  / {formatElapsed(MAX_RECORDING_SECONDS)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex h-10 items-end gap-[2px]">
                  {waveform.map((v, i) => (
                    <div
                      key={i}
                      className="waveform-bar flex-1 rounded-full"
                      style={{
                        height: Math.max(2, v * 36),
                        opacity: 0.3 + v * 0.7,
                        background: `color-mix(in oklab, var(--accent) ${Math.round(50 + v * 50)}%, var(--accent-soft))`,
                      }}
                    />
                  ))}
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

              <button
                type="button"
                onClick={stopRecording}
                disabled={busy}
                aria-label="녹음 정지"
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent) 100%)",
                  boxShadow:
                    "0 4px 20px -4px color-mix(in oklab, var(--accent) 40%, transparent)",
                }}
              >
                <span className="recorder-glow pointer-events-none absolute inset-0 rounded-full" />
                <span
                  className="relative z-10 block rounded-[3px]"
                  style={{ width: 10, height: 10, background: "var(--paper)" }}
                />
              </button>
            </div>
            <p className="text-center text-[11px] italic text-[color:var(--ink-muted)]">
              듣고 있어요… 다시 누르면 멈춰요
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-4">
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
              placeholder={
                tab === "underlines"
                  ? "책 속 한 문장을 남겨보세요"
                  : "책을 덮고 남은 생각을 적어보세요"
              }
              rows={1}
              className="composer-textarea prose-reading min-h-[2.6rem] max-h-32 flex-1 resize-none rounded-2xl border hairline bg-[color:var(--paper)]/60 px-4 py-2.5 text-[13px] leading-relaxed placeholder:italic placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--accent)] backdrop-blur-sm"
            />

            {textDraft.trim() ? (
              <button
                type="button"
                onClick={submitText}
                disabled={textSaving}
                aria-label="남기기"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[color:var(--paper)] disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {textSaving ? (
                  <span className="block h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--paper)] border-t-transparent" />
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2 L2 8.5 L6.5 10 L14 2Z" />
                    <path d="M6.5 10 L8 14.5 L14 2" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={busy}
                aria-label="녹음 시작"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent) 0%, var(--accent-soft) 100%)",
                  boxShadow:
                    "0 4px 20px -4px color-mix(in oklab, var(--accent) 40%, transparent)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="var(--paper)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
                  <path d="M3.5 7a4.5 4.5 0 0 0 9 0M8 12.5v2" />
                </svg>
              </button>
            )}
          </div>
        )}
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
              deleting={deletingIds.has(r.id)}
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

      {/* page number modal */}
      {pageEditId && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${pageModalClosing ? "modal-backdrop-out" : "modal-backdrop-in"}`}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePageModal} />
          <div className={`relative z-10 mx-6 flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl border hairline bg-[color:var(--paper-2)] px-8 py-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] ${pageModalClosing ? "page-modal-out" : "page-modal"}`}>
            <p className="serif text-center text-[18px] leading-snug text-[color:var(--ink)]">
              몇 페이지에서<br />남기셨나요?
            </p>
            <input
              ref={pageModalRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageModalDraft}
              onChange={(e) => setPageModalDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); savePageModal(); }
                if (e.key === "Escape") { e.preventDefault(); closePageModal(); }
              }}
              placeholder="페이지 번호"
              className="w-full rounded-xl border hairline bg-[color:var(--paper)] px-4 py-3 text-center text-[16px] tabular-nums text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]"
            />
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={closePageModal}
                className="flex-1 rounded-full border hairline py-2.5 text-[12px] tracking-wide text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              >
                건너뛰기
              </button>
              <button
                type="button"
                onClick={savePageModal}
                disabled={pageModalSaving}
                className="flex-1 rounded-full py-2.5 text-[12px] tracking-wide text-[color:var(--paper)] disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {pageModalSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordingCard({
  recording,
  formattedDate,
  deleting,
  onDelete,
  onSaved,
}: {
  recording: Recording;
  formattedDate: string;
  deleting?: boolean;
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
    <li ref={cardRef} className={`paper-card fade-up px-6 py-6 ${deleting ? "card-exit" : ""}`}>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageDraft}
                onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ""))}
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
        <div className="fade-up mt-4 flex flex-col gap-3">
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
        <AudioPlayer src={`/api/recordings/${recording.id}/audio`} />
      )}
    </li>
  );
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }

  function fmt(sec: number) {
    if (!sec || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-3 flex items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (!el) return;
          const d = el.duration;
          // WebM from MediaRecorder reports Infinity/NaN — force the
          // browser to scan the file by seeking to the end.
          if (!isFinite(d) || isNaN(d) || d === 0) {
            const onTimeUpdate = () => {
              el.removeEventListener("timeupdate", onTimeUpdate);
              const real = el.duration;
              el.currentTime = 0;
              if (isFinite(real) && real > 0) {
                setDuration(real);
                setLoaded(true);
              }
            };
            el.addEventListener("timeupdate", onTimeUpdate);
            try {
              el.currentTime = 1e101;
            } catch {
              // ignore
            }
            return;
          }
          setDuration(d);
          setLoaded(true);
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* play/pause */}
      <button
        type="button"
        onClick={toggle}
        disabled={!loaded}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border hairline text-[color:var(--accent)] hover:bg-[color:var(--paper)] disabled:opacity-40"
        aria-label={playing ? "일시정지" : "재생"}
      >
        <span className="relative h-3 w-3">
          <svg className="composer-layer absolute inset-0" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: playing ? 1 : 0, transform: playing ? "scale(1)" : "scale(0.6)" }}>
            <rect x="1.5" y="1" width="3" height="10" rx="0.8" />
            <rect x="7.5" y="1" width="3" height="10" rx="0.8" />
          </svg>
          <svg className="composer-layer absolute inset-0" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: playing ? 0 : 1, transform: playing ? "scale(0.6)" : "scale(1)" }}>
            <path d="M2.5 1.2 L10.5 6 L2.5 10.8Z" />
          </svg>
        </span>
      </button>

      {/* progress bar */}
      <div
        className="group relative flex h-8 flex-1 cursor-pointer items-center"
        onClick={seek}
      >
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--rule)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: "var(--accent)",
              transition: "width 100ms linear",
            }}
          />
        </div>
        {/* thumb */}
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100"
          style={{
            left: `calc(${progress}% - 5px)`,
            background: "var(--accent)",
            transition: "left 100ms linear, opacity 160ms",
          }}
        />
      </div>

      {/* time */}
      <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--ink-soft)]">
        {fmt(currentTime)}/{fmt(duration || 0)}
      </span>
    </div>
  );
}
