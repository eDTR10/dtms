import { createContext, useContext, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  PlusCircle,
  Settings,
  LogOut,
  X,
  UserCircle,
} from "lucide-react";
import viteLogo from "./../../assets/logo.png";
import { useAuth } from "../Auth/AuthContext";

// ── Sidebar open/close context (shared with UserLayout header) ─────────────
interface ShellCtx { open: boolean; setOpen: (v: boolean) => void; inShell: boolean }
export const UserShellContext = createContext<ShellCtx>({ open: false, setOpen: () => { }, inShell: false });
export const useUserShell = () => useContext(UserShellContext);

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "My Documents", icon: <FileText className="w-4 h-4" />, to: "/dtms/user/documents" },
  { label: "Create", icon: <PlusCircle className="w-4 h-4" />, to: "/dtms/user/create" },
  { label: "Settings", icon: <Settings className="w-4 h-4" />, to: "/dtms/user/settings" },
  { label: "Profile", icon: <UserCircle className="w-4 h-4" />, to: "/dtms/user/profile" },
];

// ── Shell ──────────────────────────────────────────────────────────────────
const UserShell = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/dtms/login");
  };

  return (
    <UserShellContext.Provider value={{ open, setOpen, inShell: true }}>
      <div className="min-h-screen w-full bg-background flex">

        {/* Mobile overlay */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────── */}
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
                  {item.icon}{item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-border flex flex-col gap-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/50 mb-1">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase">
                {user?.first_name?.slice(0, 1) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>

        {/* ── Content area (header + page content via Outlet) ─────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </div>

      </div>
    </UserShellContext.Provider>
  );
};

export default UserShell;
