import { createContext, useContext, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  X,
  UserCircle,
  LayoutTemplate,
  Building2,
  FolderKanban,
} from "lucide-react";
import viteLogo from "./../../assets/logo.png";
import { authApi } from "../../services/api";

// ── Shell context (shared with AdminLayout header) ─────────────────────────
interface ShellCtx { open: boolean; setOpen: (v: boolean) => void }
export const AdminShellContext = createContext<ShellCtx>({ open: false, setOpen: () => { } });
export const useAdminShell = () => useContext(AdminShellContext);

// ── Nav config ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, to: "/dtms/admin/dashboard" },
  { label: "Users", icon: <Users className="w-4 h-4" />, to: "/dtms/admin/users" },
  { label: "Documents", icon: <FileText className="w-4 h-4" />, to: "/dtms/admin/documents" },
  { label: "Templates", icon: <LayoutTemplate className="w-4 h-4" />, to: "/dtms/admin/templates" },
  { label: "Offices", icon: <Building2 className="w-4 h-4" />, to: "/dtms/admin/offices" },
  { label: "Projects", icon: <FolderKanban className="w-4 h-4" />, to: "/dtms/admin/projects" },
  { label: "Settings", icon: <Settings className="w-4 h-4" />, to: "/dtms/admin/settings" },
  { label: "Profile", icon: <UserCircle className="w-4 h-4" />, to: "/dtms/admin/profile" },
];

// ── Shell ──────────────────────────────────────────────────────────────────
const AdminShell = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    navigate("/dtms/login");
  };

  return (
    <AdminShellContext.Provider value={{ open, setOpen }}>
      <div className="min-h-screen w-full bg-background flex">

        {/* Mobile overlay */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setOpen(false)}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside
          className={`
            relative z-40 w-60 shrink-0 bg-card border-r border-border flex flex-col
            md:fixed md:top-0 md:left-0 md:h-full md:transition-transform md:duration-300
            ${open ? "md:translate-x-0" : "md:-translate-x-full"}
          `}
        >
          <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
            <div className="flex gap-[.8] items-center">
              <img src={viteLogo} alt="Logo" className="w-5 h-5" />
              <span className="text-foreground text-[30px] font-extrabold tracking-wide uppercase">DTMS</span>
            </div>
            <button
              className="ml-auto hidden md:flex text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 pb-5 border-t border-border pt-4 flex flex-col gap-2">
            <Link
              to="/dtms/admin/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase">
                Ad
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Admin</p>
                <p className="text-xs text-muted-foreground truncate">admin@example.com</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* ── Content area (header + page content via Outlet) ─────── */}
        <div className="flex-1 flex flex-col min-w-0 md:ml-0">
          <Outlet />
        </div>

      </div>
    </AdminShellContext.Provider>
  );
};

export default AdminShell;
