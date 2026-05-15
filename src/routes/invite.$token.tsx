import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/common/LoadingState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvitePage,
});

type InviteInfo = {
  id: string;
  role: "owner" | "manager" | "checker";
  host_name: string;
  expires_at: string;
  used_at: string | null;
};

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const { user, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_host_invite", { _token: token });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setError("Invite not found or expired.");
        return;
      }
      setInvite({
        id: row.id,
        role: row.role,
        host_name: row.host_name ?? "Host",
        expires_at: row.expires_at,
        used_at: row.used_at,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    if (!user) {
      navigate({ to: "/auth/sign-in", search: { redirect: `/invite/${token}` } });
      return;
    }
    setAccepting(true);
    const { error } = await supabase.rpc("accept_host_invite", { _token: token });
    setAccepting(false);
    if (error) {
      toast.error(toUserMessage(error));
      return;
    }
    await refreshRoles();
    toast.success("You're in!");
    navigate({ to: "/dashboard" });
  };

  if (loading || (!invite && !error)) return <LoadingState />;

  if (error || !invite) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const expired = new Date(invite.expires_at) < new Date();
  const used = !!invite.used_at;

  return (
    <div className="container mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">You're invited</h1>
      <p className="mt-2 text-muted-foreground">
        Join <span className="font-medium text-foreground">{invite.host_name}</span> as
      </p>
      <Badge className="mt-3 px-3 py-1.5 text-sm capitalize">{invite.role}</Badge>

      {used && (
        <p className="mt-6 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          This invite has already been used.
        </p>
      )}
      {expired && !used && (
        <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          This invite has expired.
        </p>
      )}

      <div className="mt-8">
        {!user ? (
          <Button onClick={accept}>Sign in to accept</Button>
        ) : (
          <Button onClick={accept} disabled={accepting || used || expired}>
            {accepting ? "Accepting…" : "Accept invite"}
          </Button>
        )}
      </div>
    </div>
  );
}
