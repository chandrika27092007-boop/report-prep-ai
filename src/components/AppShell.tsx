import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { LogOut, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded border px-2.5 py-1 text-xs transition-colors",
      isActive
        ? "border-border bg-muted text-foreground"
        : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground",
    );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link
            to="/"
            className="flex items-center gap-2 rounded transition-opacity hover:opacity-80"
          >
            <span className="grid size-7 place-items-center rounded border border-ok/50 bg-ok/10 text-ok">
              <TerminalSquare className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              arogyaos
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              :: report_intelligence
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1.5">
            <NavLink to="/dashboard" className={navLinkClass}>
              ~/dashboard
            </NavLink>
            <NavLink to="/reports" className={navLinkClass}>
              ~/reports
            </NavLink>
          </nav>

          <div className="flex items-center gap-2 border-l border-border pl-3">
            <span className="hidden max-w-44 truncate text-xs text-muted-foreground lg:inline">
              {user?.email ?? "guest"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 cursor-pointer"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>arogyaos@freebuff:~$ echo "medical report intelligence"</span>
          <span>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
