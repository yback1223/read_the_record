import { toast } from "sonner";

/**
 * Warm, book-themed toast messages for user feedback.
 */
export const notify = {
  success(message: string) {
    toast.success(message, {
      style: { borderLeft: "3px solid var(--accent)" },
    });
  },

  error(message: string) {
    toast.error(message, {
      style: { borderLeft: "3px solid var(--danger)" },
    });
  },

  info(message: string) {
    toast(message, {
      style: { borderLeft: "3px solid var(--ink-soft)" },
    });
  },

  promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) {
    return toast.promise(promise, msgs);
  },
};

/**
 * Standard user-facing error messages (감성 있는 한국어).
 * Maps technical situations to friendly copy.
 */
export const msg = {
  networkError: "연결이 흔들렸어요. 잠시 후 다시 해볼까요?",
  serverError: "서재에 작은 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  notFound: "찾으시는 것이 서가에 없는 것 같아요.",
  unauthorized: "문이 잠겨 있어요. 다시 로그인해 주세요.",
  forbidden: "이 방에는 들어갈 수 없어요.",
  saveFailed: "글이 바람에 날아갔어요. 다시 저장해 볼게요.",
  uploadFailed: "목소리를 담는 데 어려움이 있었어요.",
  deleteFailed: "지우는 데 문제가 있었어요.",
  searchFailed: "서가를 뒤지다 길을 잃었어요.",
  copied: "복사했어요.",
  saved: "조용히 보관했어요.",
  deleted: "서가에서 내려놓았어요.",
  recorded: "목소리가 글이 되었어요.",
  bookAdded: "서재에 새 책이 놓였어요.",
};
