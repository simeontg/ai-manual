import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue["session"]>(null);
  const [roles, setRoles] = useState<AuthContextValue["roles"]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => loadRoles(s?.user.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      loadRoles(s?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Realtime: notify the user when their RSVP gets promoted from waitlist
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const channel = supabase
      .channel(`rsvp-promotion-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rsvps",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string } | null)?.status;
          if (
            (oldStatus === "waitlisted" || oldStatus === "waitlist") &&
            (newStatus === "confirmed" || newStatus === "going")
          ) {
            toast.success("You're in! A seat just opened — your ticket is ready.", {
              duration: 8000,
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    isHost: roles.includes("host"),
    isChecker: roles.includes("checker"),
    isAdmin: roles.includes("admin"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: () => loadRoles(session?.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
