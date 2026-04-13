import NewBookForm from "./NewBookForm";

export default function NewBookPage() {
  return (
    <div className="fade-up mx-auto flex w-full max-w-xl flex-col gap-10 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          새 책
        </p>
        <h1 className="serif text-[28px] leading-tight md:text-[34px]">
          서재에 책을 더해요
        </h1>
        <div className="h-px w-full bg-[color:var(--rule)]" />
      </header>

      <NewBookForm />
    </div>
  );
}
