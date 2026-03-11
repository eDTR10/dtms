import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Users, Building2, LayoutTemplate,
  Clock, Send, CheckCircle2, XCircle,
  TrendingUp, ArrowRight, RefreshCw, Loader2,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { documentApi, userApi, officeApi, templateApi, Document, UserProfile, Office, DocumentTemplate } from "../../services/api";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (str: string) =>
  new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const STATUS_COLOR: Record<string, string> = {
  Pending:       "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Completed:     "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected:      "bg-destructive/10 text-destructive",
};

const STATUS_BAR: Record<string, string> = {
  Pending:       "bg-yellow-500",
  "For Signing": "bg-blue-500",
  Completed:     "bg-green-500",
  Rejected:      "bg-destructive",
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [docs,       setDocs]       = useState<Document[]>([]);
  const [users,      setUsers]      = useState<UserProfile[]>([]);
  const [offices,    setOffices]    = useState<Office[]>([]);
  const [templates,  setTemplates]  = useState<DocumentTemplate[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [d, u, o, t] = await Promise.all([
        documentApi.list(),
        userApi.list(),
        officeApi.list(),
        templateApi.list(),
      ]);
      setDocs(d);
      setUsers(u);
      setOffices(o);
      setTemplates(t);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── derived stats ──────────────────────────────────────────────────────────
  const total       = docs.length;
  const pending     = docs.filter(d => d.status === "Pending").length;
  const forSigning  = docs.filter(d => d.status === "For Signing").length;
  const completed   = docs.filter(d => d.status === "Completed").length;
  const rejected    = docs.filter(d => d.status === "Rejected").length;
  const activeUsers = users.filter(u => u.is_active).length;

  const statuses = ["Pending", "For Signing", "Completed", "Rejected"] as const;

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const officeDocCount = offices.map(o => ({
    name:  o.name,
    count: docs.filter(d => d.to === o.officeID).length,
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxOfficeCount = Math.max(1, ...officeDocCount.map(o => o.count));

  if (loading) return (
    <AdminLayout title="Dashboard" subtitle="Loading...">
      <div className="grid grid-cols-4 gap-4 mb-6 lg:grid-cols-2 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-accent/40 animate-pulse" />)}
      </div>
      <div className="grid grid-cols-[1fr_320px] gap-4 lg:grid-cols-1">
        <div className="h-64 rounded-xl bg-accent/40 animate-pulse" />
        <div className="h-64 rounded-xl bg-accent/40 animate-pulse" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Dashboard" subtitle="Document Processing System overview">

      {/* ── Welcome banner ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary/10 border border-primary/20 px-6 py-5 mb-6 flex items-center justify-between sm:flex-col sm:items-start sm:gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Good day, Admin!</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} total document{total !== 1 ? "s" : ""} &mdash;&nbsp;
            {pending + forSigning} awaiting action &mdash;&nbsp;
            {activeUsers} active user{activeUsers !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* ── Top stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6 lg:grid-cols-2 sm:grid-cols-2">
        {[
          { label: "Total Documents", value: total,           icon: <FileText className="w-5 h-5" />,      color: "text-primary",     bg: "bg-primary/10" },
          { label: "Active Users",    value: activeUsers,     icon: <Users className="w-5 h-5" />,         color: "text-teal-500",    bg: "bg-teal-500/10" },
          { label: "Offices",         value: offices.length,  icon: <Building2 className="w-5 h-5" />,     color: "text-violet-500",  bg: "bg-violet-500/10" },
          { label: "Templates",       value: templates.length,icon: <LayoutTemplate className="w-5 h-5" />,color: "text-orange-500",  bg: "bg-orange-500/10" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <span className={`p-2 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Document status breakdown ──────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Document Status Breakdown
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-5 sm:grid-cols-2">
          {[
            { label: "For Sending", value: pending,    icon: <Clock className="w-4 h-4" />,        color: "text-yellow-500", bg: "bg-yellow-500/10" },
            { label: "For Signing", value: forSigning, icon: <Send className="w-4 h-4" />,         color: "text-blue-500",   bg: "bg-blue-500/10" },
            { label: "Completed",   value: completed,  icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-500",  bg: "bg-green-500/10" },
            { label: "Rejected",    value: rejected,   icon: <XCircle className="w-4 h-4" />,      color: "text-destructive",bg: "bg-destructive/10" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-border px-4 py-3 flex items-center gap-3 ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Stacked progress bar */}
        {total > 0 && (
          <>
            <div className="flex rounded-full overflow-hidden h-3 gap-px">
              {statuses.map(s => {
                const count = docs.filter(d => d.status === s).length;
                const pct   = (count / total) * 100;
                return pct > 0 ? (
                  <div key={s} title={`${s}: ${count}`}
                    className={`${STATUS_BAR[s]} transition-all`}
                    style={{ width: `${pct}%` }} />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {statuses.map(s => {
                const count = docs.filter(d => d.status === s).length;
                return count > 0 ? (
                  <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_BAR[s]}`} />
                    {s === "Pending" ? "For Sending" : s} ({Math.round((count / total) * 100)}%)
                  </span>
                ) : null;
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Two-column section ─────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_300px] gap-4 lg:grid-cols-1">

        {/* Recent Documents */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent Documents</h3>
            <button
              onClick={() => navigate("/dtms/admin/documents")}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-border flex-1">
            {recentDocs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No documents yet.</p>
            ) : recentDocs.map(doc => (
              <div key={doc.id}
                onClick={() => navigate(`/dtms/sign/${doc.tracknumber}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40 cursor-pointer transition-colors">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{doc.tracknumber} · {doc.requestor}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                    {doc.status === "Pending" ? "For Sending" : doc.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(doc.datesubmitted)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground mb-1">Quick Actions</h3>
            {[
              { label: "Manage Users",     icon: <Users className="w-4 h-4" />,          path: "/dtms/admin/users" },
              { label: "Manage Offices",   icon: <Building2 className="w-4 h-4" />,      path: "/dtms/admin/offices" },
              { label: "Manage Templates", icon: <LayoutTemplate className="w-4 h-4" />, path: "/dtms/admin/templates" },
              { label: "All Documents",    icon: <FileText className="w-4 h-4" />,       path: "/dtms/admin/documents" },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border border-border hover:bg-accent hover:border-primary/40 text-sm text-foreground transition-colors">
                <span className="text-primary">{a.icon}</span>
                {a.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* Documents per office bar chart */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Documents by Office</h3>
            {officeDocCount.filter(o => o.count > 0).length === 0 ? (
              <p className="text-xs text-muted-foreground">No routing data yet.</p>
            ) : officeDocCount.filter(o => o.count > 0).map(o => (
              <div key={o.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate max-w-[180px]" title={o.name}>{o.name}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">{o.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(o.count / maxOfficeCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
