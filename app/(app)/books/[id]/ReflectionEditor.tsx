"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/react";

type SaveState = "idle" | "saving" | "saved" | "error";

type RecordingRef = {
  id: string;
  transcript: string;
  type: "underline" | "whisper";
  page: number | null;
  createdAt: string;
};

export default function ReflectionEditor({
  bookId,
  initial,
  recordings,
}: {
  bookId: string;
  initial: string;
  recordings: RecordingRef[];
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const lastSavedRef = useRef(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  // slash menu state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashCommand, setSlashCommand] = useState<"밑줄" | "속삭임" | null>(null);
  const [slashPos, setSlashPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [slashIdx, setSlashIdx] = useState(0);
  const slashAnchorRef = useRef<{ from: number; to: number } | null>(null);

  const doSave = useCallback(
    async (html: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState("saving");
      setErrorMsg("");
      try {
        const res = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflection: html }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "저장 실패");
        }
        lastSavedRef.current = html;
        setDirty(false);
        setState("saved");
        setTimeout(() => {
          setState((s) => (s === "saved" ? "idle" : s));
        }, 1800);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "저장 실패");
        setState("error");
      } finally {
        inFlightRef.current = false;
      }
    },
    [bookId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "이 책을 읽으며 떠오른 생각을 적어보세요. /밑줄, /속삭임으로 불러올 수 있어요.",
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: initial || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-reading tiptap-reflection focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setDirty(html !== lastSavedRef.current);

      // detect slash command
      detectSlash(editor);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        doSave(html);
      }, 1200);
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function detectSlash(ed: Editor) {
    const { from } = ed.state.selection;
    const text = ed.state.doc.textBetween(Math.max(0, from - 30), from, "\n");
    // Match /밑줄 or /속삭임 optionally followed by a search query
    const match = text.match(/(?:^|\s)(\/(밑줄|속삭임)(\s+[^\n]*)?)$/);
    if (match) {
      const matched = match[1];
      const cmd = match[2] as "밑줄" | "속삭임";
      const query = (match[3] ?? "").trim();
      const start = from - matched.length;
      slashAnchorRef.current = { from: start, to: from };
      setSlashCommand(cmd);
      setSlashQuery(query);
      setSlashIdx(0);

      // Position menu near the slash
      try {
        const coords = ed.view.coordsAtPos(from);
        const containerRect =
          (ed.options.element as HTMLElement).getBoundingClientRect();
        setSlashPos({
          top: coords.bottom - containerRect.top + 4,
          left: coords.left - containerRect.left,
        });
      } catch {
        // ignore
      }
      setSlashOpen(true);
    } else {
      // Also detect bare "/" to show command hints
      const bareMatch = text.match(/(?:^|\s)(\/(밑?|속?)?)$/);
      if (bareMatch) {
        const matched = bareMatch[1];
        const start = from - matched.length;
        slashAnchorRef.current = { from: start, to: from };
        setSlashCommand(null);
        setSlashQuery("");
        setSlashIdx(0);

        try {
          const coords = ed.view.coordsAtPos(from);
          const containerRect =
            (ed.options.element as HTMLElement).getBoundingClientRect();
          setSlashPos({
            top: coords.bottom - containerRect.top + 4,
            left: coords.left - containerRect.left,
          });
        } catch {
          // ignore
        }
        setSlashOpen(true);
      } else {
        setSlashOpen(false);
        slashAnchorRef.current = null;
        setSlashCommand(null);
      }
    }
  }

  const filteredRecordings = recordings.filter((r) => {
    if (!slashCommand) return false;
    const targetType = slashCommand === "밑줄" ? "underline" : "whisper";
    if (r.type !== targetType) return false;
    if (!slashQuery) return true;
    const q = slashQuery.toLowerCase();
    return (
      r.transcript.toLowerCase().includes(q) ||
      (r.page != null && String(r.page).includes(q))
    );
  });

  function insertRecording(r: RecordingRef) {
    if (!editor || !slashAnchorRef.current) return;
    const { from, to } = slashAnchorRef.current;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: r.transcript || " " }],
          },
        ],
      })
      .run();
    setSlashOpen(false);
    slashAnchorRef.current = null;
  }

  function insertSlashCommand(cmd: "밑줄" | "속삭임") {
    if (!editor || !slashAnchorRef.current) return;
    const { from, to } = slashAnchorRef.current;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent(`/${cmd}`)
      .run();
  }

  const slashMenuItems = slashCommand ? filteredRecordings : [];
  const commandHints = [
    { cmd: "밑줄" as const, desc: "밑줄 불러오기" },
    { cmd: "속삭임" as const, desc: "속삭임 불러오기" },
  ];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Cmd/Ctrl+S manual save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      manualSave();
      return;
    }
    if (!slashOpen) return;

    // When showing command hints (no command selected yet)
    if (!slashCommand) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % commandHints.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + commandHints.length) % commandHints.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertSlashCommand(commandHints[slashIdx].cmd);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
      }
      return;
    }

    if (slashMenuItems.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSlashIdx((i) => (i + 1) % slashMenuItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSlashIdx(
        (i) => (i - 1 + slashMenuItems.length) % slashMenuItems.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      insertRecording(slashMenuItems[slashIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSlashOpen(false);
    }
  }

  function manualSave() {
    if (!editor) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(editor.getHTML());
  }

  const text = editor?.getText() ?? "";
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <section className="paper-card relative flex flex-col gap-3 px-6 py-6">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          독후감
        </h2>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <SaveBadge state={state} error={errorMsg} dirty={dirty} />
      </div>

      {editor && <Toolbar editor={editor} />}

      <div className="relative" onKeyDown={onKeyDown}>
        <EditorContent editor={editor} />

        {slashOpen && (
          <div
            className="slash-menu absolute z-30 flex w-72 flex-col overflow-hidden rounded-lg border hairline bg-[color:var(--paper-2)] shadow-[0_18px_40px_-20px_rgba(70,50,20,0.35)]"
            style={{ top: slashPos.top, left: slashPos.left }}
          >
            {!slashCommand ? (
              <>
                <div className="border-b hairline px-3 py-2 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                  불러오기
                </div>
                <ul>
                  {commandHints.map((h, idx) => (
                    <li key={h.cmd}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertSlashCommand(h.cmd);
                        }}
                        onMouseEnter={() => setSlashIdx(idx)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left ${
                          idx === slashIdx
                            ? "bg-[color:var(--paper)]"
                            : "hover:bg-[color:var(--paper)]"
                        }`}
                      >
                        <span className="text-[12px] font-medium text-[color:var(--ink)]">/{h.cmd}</span>
                        <span className="text-[11px] text-[color:var(--ink-soft)]">{h.desc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="border-b hairline px-3 py-2 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                  {slashCommand === "밑줄" ? "밑줄 불러오기" : "속삭임 불러오기"}{slashQuery && ` · "${slashQuery}"`}
                </div>
                {slashMenuItems.length === 0 ? (
                  <div className="px-3 py-3 text-[12px] italic text-[color:var(--ink-soft)]">
                    결과가 없어요
                  </div>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {slashMenuItems.map((r, idx) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertRecording(r);
                          }}
                          onMouseEnter={() => setSlashIdx(idx)}
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                            idx === slashIdx
                              ? "bg-[color:var(--paper)]"
                              : "hover:bg-[color:var(--paper)]"
                          }`}
                        >
                          <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                            {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                            {r.page != null ? ` · p. ${r.page}` : ""}
                          </span>
                          <span className="line-clamp-2 text-[12px] text-[color:var(--ink)]">
                            {r.transcript || "(비어 있음)"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <span>
          {wordCount}단어 · {charCount}자
        </span>
        <div className="flex items-center gap-3">
          <span className="italic normal-case tracking-normal">
            /밑줄 · /속삭임 불러오기 · ⌘S / Ctrl+S 저장
          </span>
          <button
            type="button"
            onClick={manualSave}
            disabled={!dirty || state === "saving"}
            className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {state === "saving" ? "저장 중…" : dirty ? "저장" : "저장됨"}
          </button>
        </div>
      </div>

      <style>{`
        .tiptap-reflection {
          min-height: 12rem;
          padding: 0.5rem;
          line-height: 1.85;
        }
        .tiptap-reflection p {
          margin: 0 0 0.75em 0;
        }
        .tiptap-reflection h2 {
          font-family: var(--font-serif-book), serif;
          font-size: 1.4em;
          margin: 1em 0 0.4em;
        }
        .tiptap-reflection h3 {
          font-family: var(--font-serif-book), serif;
          font-size: 1.15em;
          margin: 0.9em 0 0.3em;
        }
        .tiptap-reflection blockquote {
          border-left: 2px solid var(--accent);
          padding-left: 1em;
          margin: 0.8em 0;
          color: var(--ink);
          font-style: italic;
        }
        .tiptap-reflection ul, .tiptap-reflection ol {
          padding-left: 1.4em;
          margin: 0.5em 0;
        }
        .tiptap-reflection li {
          margin: 0.15em 0;
        }
        .tiptap-reflection code {
          background: color-mix(in oklab, var(--accent) 10%, transparent);
          padding: 0.1em 0.35em;
          border-radius: 3px;
          font-size: 0.95em;
        }
        .tiptap-reflection p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--ink-soft);
          font-style: italic;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </section>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-[12px] ${
        active
          ? "bg-[color:var(--ink)] text-[color:var(--paper)]"
          : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--paper)]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border hairline bg-[color:var(--paper)] p-1">
      <Btn
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        title="제목"
      >
        H
      </Btn>
      <Btn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="굵게"
      >
        <strong>B</strong>
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="기울임"
      >
        <em>I</em>
      </Btn>
      <Btn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="취소선"
      >
        <span style={{ textDecoration: "line-through" }}>S</span>
      </Btn>
      <div className="mx-1 h-4 w-px bg-[color:var(--rule)]" />
      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="목록"
      >
        •
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="번호 목록"
      >
        1.
      </Btn>
      <Btn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="인용"
      >
        ❞
      </Btn>
      <Btn
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="코드"
      >
        {"<>"}
      </Btn>
    </div>
  );
}

function SaveBadge({
  state,
  error,
  dirty,
}: {
  state: SaveState;
  error: string;
  dirty: boolean;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <Dot pulse /> 저장 중…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--danger)]">
        {error || "저장 실패"}
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]">
        <Dot color="var(--ink-muted)" /> 변경됨
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--accent)]">
      <Dot color="var(--accent)" /> 저장됨
    </span>
  );
}

function Dot({ pulse, color }: { pulse?: boolean; color?: string }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color ?? "var(--ink-soft)" }}
    />
  );
}
