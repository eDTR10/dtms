import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Eye, Download, Loader2,
  ChevronLeft, ChevronRight, RefreshCw, Clock, Send, CheckCircle2, AlertTriangle, FileSymlink
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { documentApi, officeApi, Document, Office } from "../../services/api";

const PAGE_SIZE = 8; // Match MyDocuments

const STATUS_COLOR: Record<string, string> = {
  Pending:       "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Sending": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Completed:     "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected:      "bg-destructive/10 text-destructive",
};

/** Derive effective status from signatory data (excludes viewers) */
const getEffectiveStatus = (doc: Document): string => {
  const sigs = doc.signatories ?? [];
  const signers = sigs.filter(s => s.role !== "viewer");
  const total = signers.length;
  const signed = signers.filter(s => s.status === "signed").length;
  const rejected = signers.filter(s => s.status === "rejected").length;

  if (doc.status === "Pending") return "For Sending";
  if (rejected > 0) return "Rejected";
  if (total > 0 && signed === total) return "Completed";
  if (doc.status === "For Signing") return "For Signing";
  return doc.status;
};

const statusLabel = (doc: Document) => {
  const eff = getEffectiveStatus(doc);
  const sigs = doc.signatories ?? [];
  const signers = sigs.filter(s => s.role !== "viewer");
  const total = signers.length;
  const signed = signers.filter(s => s.status === "signed").length;
  if (["For Signing", "Completed", "Rejected"].includes(eff) && total > 0)
    return `${eff} (${signed}/${total})`;
  return eff;
};

const statusLabelShort = (doc: Document) => {
  const eff = getEffectiveStatus(doc);
  const sigs = doc.signatories ?? [];
  const signers = sigs.filter(s => s.role !== "viewer");
  const total = signers.length;
  const signed = signers.filter(s => s.status === "signed").length;
  if (["For Signing", "Completed", "Rejected"].includes(eff) && total > 0)
    return `(${signed}/${total})`;
  if (eff === "For Sending") return "Send";
  return eff;
};

const statusBadgeClass = (doc: Document) => {
  const eff = getEffectiveStatus(doc);
  return STATUS_COLOR[eff] ?? "bg-muted text-muted-foreground";
};

const fmtDate = (str: string) =>
  new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// ── Table skeleton row ────────────────────────────────────────────────────────
const TableSkeletonRow = ({ index }: { index: number }) => (
  <div
    className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center slg:grid-cols-[2fr_1fr_120px] sm:grid-cols-[2fr_1fr_80px]"
    style={{ animationDelay: `${index * 60}ms` }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-accent animate-pulse" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div
          className="h-3.5 rounded bg-accent animate-pulse"
          style={{ width: `${55 + (index % 4) * 10}%` }}
        />
        <div
          className="h-2.5 rounded bg-accent/70 animate-pulse"
          style={{ width: `${30 + (index % 3) * 8}%` }}
        />
      </div>
    </div>
    <div className="slg:hidden">
      <div className="h-3 rounded bg-accent animate-pulse w-24" />
    </div>
    <div className="slg:hidden">
      <div className="h-3 rounded bg-accent animate-pulse w-20" />
    </div>
    <div>
      <div className="h-5 rounded-full bg-accent animate-pulse w-24" />
    </div>
    <div className="flex items-center gap-1.5">
      {[1, 2].map(i => (
        <div key={i} className="w-7 h-7 rounded-md bg-accent animate-pulse" />
      ))}
    </div>
  </div>
);

// ── Stat card skeleton ────────────────────────────────────────────────────────
const StatCardSkeleton = () => (
  <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
    <div className="w-9 h-9 rounded-lg bg-accent animate-pulse shrink-0" />
    <div className="flex flex-col gap-2">
      <div className="h-6 w-8 rounded bg-accent animate-pulse" />
      <div className="h-2.5 w-20 rounded bg-accent/70 animate-pulse" />
    </div>
  </div>
);

const DocumentPage = () => {
  const navigate = useNavigate();

  const [docs,        setDocs]        = useState<Document[]>([]);
  const [offices,     setOffices]     = useState<Office[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("All");
  const [filterOffice, setFilterOffice] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [page,        setPage]        = useState(1);
  const [downloading, setDownloading] = useState<number | null>(null);

  // Prevent double fetch in React 18 StrictMode
  const didFetch = useRef(false);
  const fetchDocs = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [data, officeData] = await Promise.all([
        documentApi.list(),
        officeApi.list()
      ]);
      setDocs(data);
      setOffices(officeData);
    } catch (e) {
      console.error("Failed to fetch documents", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!didFetch.current) {
      fetchDocs();
      didFetch.current = true;
    }
  }, []);
  useEffect(() => { setPage(1); }, [search, filter, filterOffice, filterProject]);

  const statuses = ["All", "For Sending", "For Signing", "Completed", "Rejected"];

  const filtered = docs.filter(d => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      d.title.toLowerCase().includes(q) ||
      d.tracknumber.toLowerCase().includes(q) ||
      d.requestor.toLowerCase().includes(q) ||
      (d.type ?? "").toLowerCase().includes(q);
    const eff = getEffectiveStatus(d);
    const matchFilter =
      filter === "All" ||
      (filter === "For Sending" ? eff === "For Sending" : eff === filter);
    
    const matchOffice = filterOffice === "" || String(d.office) === filterOffice || String(d.to) === filterOffice;
    const matchProject = filterProject === "" || (d.projects ?? []).map(String).includes(filterProject);

    return matchSearch && matchFilter && matchOffice && matchProject;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDownload = async (doc: Document) => {
    if (!doc.file_url) return;
    setDownloading(doc.id);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(doc.file_url, {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${doc.tracknumber} - ${doc.title}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { console.error("Download failed"); }
    finally { setDownloading(null); }
  };

  const statCounts = {
    total: filtered.length,
    pending: filtered.filter(d => getEffectiveStatus(d) === "For Sending").length,
    forSigning: filtered.filter(d => getEffectiveStatus(d) === "For Signing").length,
    completed: filtered.filter(d => getEffectiveStatus(d) === "Completed").length,
    rejected: filtered.filter(d => getEffectiveStatus(d) === "Rejected").length,
  };

  return (
    <AdminLayout title="All Documents" subtitle={`${docs.length} total document${docs.length !== 1 ? "s" : ""} in the system`}>
      
      {/* Quick stats */}
      <div className="grid grid-cols-5 gap-4 mb-6 xl:grid-cols-4 lg:grid-cols-3 sm:grid-cols-2">
        {loading
          ? [...Array(5)].map((_, i) => <StatCardSkeleton key={i} />)
          : [
            { label: "Total", value: statCounts.total, icon: <FileSymlink className="w-4 h-4" />, color: "text-indigo-500" },
            { label: "For Sending", value: statCounts.pending, icon: <Clock className="w-4 h-4" />, color: "text-yellow-500" },
            { label: "For Signing", value: statCounts.forSigning, icon: <Send className="w-4 h-4" />, color: "text-blue-500" },
            { label: "Completed", value: statCounts.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-500" },
            { label: "Rejected", value: statCounts.rejected, icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-500" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4">
              <span className={`p-2 rounded-lg bg-accent ${s.color}`}>{s.icon}</span>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))
        }
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-3 sm:flex-col sm:items-stretch">
          <div className="relative flex-1 max-w-sm sm:max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" placeholder="Search title, track no., requestor..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </div>
          <button
            onClick={() => fetchDocs(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50 sm:w-full sm:justify-center"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-between items-center w-full">
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === s ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                }`}>{s}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={filterOffice} onChange={e => setFilterOffice(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-accent text-foreground text-xs font-medium border-0 focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">All Offices</option>
              {offices.map(o => (
                <option key={o.officeID} value={o.officeID}>{o.name}</option>
              ))}
            </select>
            <select
              value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-accent text-foreground text-xs font-medium border-0 focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">All Projects</option>
              {offices.map(o => (
                <option key={o.officeID} value={o.officeID}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[530px] flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide slg:grid-cols-[2fr_1fr_120px] sm:grid-cols-[2fr_1fr_80px]">
          <span>Document</span>
          <span className="slg:hidden">Track No.</span>
          <span className="slg:hidden">Date</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          [...Array(PAGE_SIZE)].map((_, i) => <TableSkeletonRow key={i} index={i} />)
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
            No documents found.
          </div>
        ) : (
          paginated.map(doc => (
            <div key={doc.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors slg:grid-cols-[2fr_1fr_120px] sm:grid-cols-[2fr_1fr_80px]">
              
              {/* Document */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="sm:hidden w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.requestor} ({doc.type})</p>
                </div>
              </div>
              
              {/* Track no */}
              <p className="text-sm text-foreground font-mono truncate slg:hidden">{doc.tracknumber}</p>
              
              {/* Date */}
              <p className="text-sm text-muted-foreground slg:hidden">{fmtDate(doc.datesubmitted)}</p>
              
              {/* Status */}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${statusBadgeClass(doc)}`}>
                <span className="sm:hidden">
                  {statusLabel(doc)}
                </span>
                <span className="hidden sm:inline">
                  {statusLabelShort(doc)}
                </span>
              </span>
              
              {/* Actions */}
              <div className="flex items-center sm:items-end gap-1.5 w-full">
                <button
                  onClick={() => navigate(`/dtms/sign/${doc.tracknumber}`)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                  title="View document">
                  <Eye className="w-4 h-4" />
                </button>
                {doc.file_url && (
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloading === doc.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-green-600 transition-colors disabled:opacity-50"
                    title="Download PDF">
                    <Download className={`w-4 h-4 ${downloading === doc.id ? "animate-bounce" : ""}`} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "No documents"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} document${filtered.length !== 1 ? "s" : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {(() => {
                const getPageNumbers = () => {
                  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
                  if (page <= 3) return [1, 2, 3, 4, '...', totalPages - 1, totalPages];
                  if (page >= totalPages - 2) return [1, 2, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
                  return [1, '...', page - 1, page, page + 1, '...', totalPages];
                };

                return getPageNumbers().map((n, i) => (
                  n === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <button key={n} onClick={() => setPage(n as number)}
                      className={`min-w-[2rem] h-8 rounded-md text-xs font-medium border transition-colors ${
                        n === page
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}>{n}</button>
                  )
                ));
              })()}

              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};

export default DocumentPage;
