import { Menu } from "lucide-react";
import { ModeToggle } from "../../components/mode-toggle";
import { useUserShell } from "./UserShell";

interface UserLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const UserLayout = ({ title, subtitle, children }: UserLayoutProps) => {
  const { setOpen, inShell } = useUserShell();

  const header = (
    <header className="sticky top-0 z-20 bg-background border-b border-border flex items-center gap-4 px-6 py-4">
      <button
        className="hidden md:flex text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <ModeToggle />
    </header>
  );

  // Used standalone (e.g. SignDocument outside the UserShell parent route)
  if (!inShell) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col">
        {header}
        <main className="flex-1 p-6 md:p-4">{children}</main>
      </div>
    );
  }

  // Used inside UserShell — just header + main, shell provides the outer wrapper
  return (
    <>
      {header}
      <main className="flex-1 p-6 md:p-4">{children}</main>
    </>
  );
};

export default UserLayout;


