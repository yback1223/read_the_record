import { Suspense } from "react";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import NavigationOverlay from "@/components/NavigationOverlay";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const profile = await ensureProfile(user.id, user.email);
  if (profile.status !== "approved" || !profile.active) redirect("/pending");

  return (
    <Shell
      userEmail={user.email}
      isSuperAdmin={profile.role === "super_admin"}
    >
      <Suspense fallback={null}>
        <NavigationOverlay />
      </Suspense>
      {children}
    </Shell>
  );
}
