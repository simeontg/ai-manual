import { Outlet, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fileToDataUrl } from "@/lib/image";

export const Route = createFileRoute("/host")({
  component: HostLandingPage,
});

function HostLandingPage() {
  const { user, isHost, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [contactEmail, setContactEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !isHost) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("contact_email, display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setContactEmail(data?.contact_email ?? "");
      setDisplayName(data?.display_name ?? "");
      setBio(data?.bio ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setLoaded(true);
    })();
  }, [user, isHost]);

  const becomeHost = async () => {
    if (!user) return navigate({ to: "/auth/sign-up" });
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "host" });
    if (error && !error.message.includes("duplicate")) return toast.error(toUserMessage(error));
    await supabase.from("profiles").update({ is_host: true }).eq("id", user.id);
    await refreshRoles();
    toast.success("You're a host now!");
    navigate({ to: "/dashboard" });
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        contact_email: contactEmail || null,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(toUserMessage(error));
    toast.success("Host profile updated");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <PageHeader
        title="Host on Gather"
        description="Publish free events, manage RSVPs, and check guests in with QR codes."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          "Free, no fees ever for free events",
          "Public or unlisted events",
          "Capacity controls + waitlist (soon)",
          "QR check-in with checker role",
        ].map((b) => (
          <div
            key={b}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-sm">{b}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        {isHost ? (
          <>
            <Button asChild size="lg">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/host/analytics">View analytics</Link>
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={becomeHost}>
            {user ? "Become a host" : "Sign up to host"}
          </Button>
        )}
      </div>

      {user && isHost && loaded && (
        <section className="mt-12 rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Your public host profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This information appears on your public host page that attendees see.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                placeholder="Your name or organization"
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="contact_email">Contact email</Label>
              <Input
                id="contact_email"
                type="email"
                value={contactEmail}
                placeholder="hello@yourorg.com"
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="avatar_url">Logo / avatar</Label>
              <div className="mt-1 flex items-start gap-3">
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    className="h-16 w-16 rounded-full border border-border object-cover"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <Input
                    id="avatar_url"
                    value={avatarUrl}
                    placeholder="https://…/logo.png or upload below"
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUrl = await fileToDataUrl(f, { maxDim: 512 });
                        setAvatarUrl(dataUrl);
                      } catch (err) {
                        toast.error(toUserMessage(err));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea
                id="bio"
                value={bio}
                rows={4}
                placeholder="A few sentences about you or your community…"
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/hosts/$hostId" params={{ hostId: user.id }}>
                View public page
              </Link>
            </Button>
          </div>
        </section>
      )}
      <Outlet />
    </div>
  );
}
