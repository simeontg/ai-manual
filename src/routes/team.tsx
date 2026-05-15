import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Copy, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});

type Role = "owner" | "manager" | "checker";

function TeamPage() {
  const { user, isHost, loading } = useAuth();
  const qc = useQueryClient();
  const [hostId, setHostId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Role>("checker");

  // Get the user's owned host org (auto-create one if none exists)
  const { data: hosts, isLoading: loadingHosts } = useQuery({
    queryKey: ["my-host-orgs", user?.id],
    enabled: !!user && isHost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosts")
        .select("id, name")
        .eq("owner_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user || !isHost) return;
    if (loadingHosts) return;
    if (hosts && hosts.length > 0) {
      if (!hostId) setHostId(hosts[0].id);
      return;
    }
    // Auto-provision a host org if the user has none
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = prof?.display_name ?? "My events";
      const { data, error } = await supabase
        .from("hosts")
        .insert({ name, owner_id: user.id })
        .select("id")
        .single();
      if (error) {
        toast.error(toUserMessage(error));
        return;
      }
      setHostId(data.id);
      qc.invalidateQueries({ queryKey: ["my-host-orgs"] });
    })();
  }, [user, isHost, hosts, loadingHosts, hostId, qc]);

  const { data: members } = useQuery({
    queryKey: ["host-members", hostId],
    enabled: !!hostId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_members")
        .select("id, role, user_id")
        .eq("host_id", hostId!);
      if (error) throw error;
      const ids = (data ?? []).map((m) => m.user_id);
      const profMap = new Map<string, { name: string; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        (profs ?? []).forEach((p) =>
          profMap.set(p.id, {
            name: p.display_name ?? "Member",
            email: null,
          }),
        );
      }
      return (data ?? []).map((m) => ({
        ...m,
        name: profMap.get(m.user_id)?.name ?? "Member",
        email: profMap.get(m.user_id)?.email ?? null,
      }));
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["host-invites", hostId],
    enabled: !!hostId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_invites")
        .select("id, token, role, created_at, expires_at, used_at")
        .eq("host_id", hostId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!hostId) throw new Error("No host selected");
      const { error } = await supabase.from("host_invites").insert({
        host_id: hostId,
        role: newRole,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite created");
      qc.invalidateQueries({ queryKey: ["host-invites"] });
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  const inviteUrl = (token: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${token}`
      : `/invite/${token}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — copy manually");
    }
  };

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to manage your team.</p>
        <Button asChild className="mt-4">
          <Link to="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  if (!isHost)
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Become a host to manage a team.</p>
        <Button asChild className="mt-4">
          <Link to="/host">Become a host</Link>
        </Button>
      </div>
    );

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Team"
        description="Invite members as Host or Checker via a copyable link."
      />

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Create invite link</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checker">Checker</SelectItem>
                <SelectItem value="manager">Host (manager)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !hostId}>
            <Plus className="h-4 w-4" /> {create.isPending ? "Creating…" : "Create link"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Links expire in 14 days. Each link can only be used once.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Active invites</h2>
        <div className="mt-3 space-y-3">
          {(invites ?? []).filter((i) => !i.used_at && new Date(i.expires_at) > new Date())
            .length === 0 ? (
            <p className="text-sm text-muted-foreground">No active invites.</p>
          ) : (
            (invites ?? [])
              .filter((i) => !i.used_at && new Date(i.expires_at) > new Date())
              .map((i) => (
                <div key={i.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="capitalize">{i.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Expires {new Date(i.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input readOnly value={inviteUrl(i.token)} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copy(inviteUrl(i.token))}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="mt-3">
          {!members || members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No members yet"
              description="Share an invite link to add Hosts or Checkers."
            />
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{m.name}</p>
                    {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
