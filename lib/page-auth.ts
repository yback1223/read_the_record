export { ensureProfile } from "@/lib/auth";
import { getCurrentUser } from "@/lib/supabase/server";

export async function getCurrentUserOrNull() {
  return getCurrentUser();
}
