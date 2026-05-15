import { Link, useNavigate } from "@tanstack/react-router";
import {
  Calendar,
  Flag,
  LogOut,
  Menu,
  Plus,
  ScanLine,
  Settings,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/useAuth";

export function SiteHeader() {
  const { user, isHost, isChecker, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/explore", label: "Explore" },
    { to: "/host", label: "For hosts" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <Calendar className="h-4 w-4" />
            </span>
            <span>Gather</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "text-foreground bg-accent" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isHost && (
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/events/new">
                    <Plus className="h-4 w-4" /> Create event
                  </Link>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => navigate({ to: "/my/tickets" })}>
                    <Ticket className="h-4 w-4" /> My tickets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/my/events" })}>
                    <Calendar className="h-4 w-4" /> My events
                  </DropdownMenuItem>
                  {isHost && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                      Host dashboard
                    </DropdownMenuItem>
                  )}
                  {isHost && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/host" })}>
                      <Settings className="h-4 w-4" /> Edit host profile
                    </DropdownMenuItem>
                  )}
                  {isHost && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/team" })}>
                      <Users className="h-4 w-4" /> Team & invites
                    </DropdownMenuItem>
                  )}
                  {isHost && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/reports" })}>
                      <Flag className="h-4 w-4" /> Reports
                    </DropdownMenuItem>
                  )}
                  {(isChecker || isHost) && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/check-in" })}>
                      <ScanLine className="h-4 w-4" /> Check-in
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut().then(() => navigate({ to: "/" }))}>
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth/sign-up">Get started</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
