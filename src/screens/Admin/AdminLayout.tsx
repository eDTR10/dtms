import { Bell, Menu } from "lucide-react";
import { ModeToggle } from "../../components/mode-toggle";
import { useAdminShell } from "./AdminShell";

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const AdminLayout = ({ title, subtitle, children }: AdminLayoutProps) => {
  const { setOpen } = useAdminShell();

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background border-b border-border px-6 py-4 flex items-center justify-between slg:px-4 sm:px-3">
        <div className="flex items-center gap-3">
          <button
            className="hidden md:flex text-muted-foreground hover:text-foreground p-1"
            onClick={() => setOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground sm:hidden">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <button className="relative p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-6 py-6 slg:px-4 sm:px-3 overflow-auto">
        {children}
      </main>
    </>
  );
};

export default AdminLayout;
