import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Eye, Download, Loader2,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { documentApi, Document } from "../../services/api";

const PAGE_SIZE = 12;

const STATUS_COLOR: Record<string, string> = {
  Pending:       "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Completed:     "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected:      "bg-destructive/10 text-destructive",
};

const statusLabel = (status: string) =>
  status === "Pending" ? "For Sending" : status;

const fmtDate = (str: string) =>
  new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const DocumentPage = () => {
  const navigate = useNavigate();

  const [docs,        setDocs]        = useState<Document[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("All");
  const [page,        setPage]        = useState(1);
  const [downloading, setDownloading] = useState<number | null>(null);

  // Prevent double fetch in React 18 StrictMode
  const didFetch = useRef(false);
  const fetchDocs = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await documentApi.list();
      setDocs(data);
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
  useEffect(() => { setPage(1); }, [search, filter]);

  const statuses = ["All", "For Sending", "For Signing", "Completed", "Rejected"];

  const filtered = docs.filter(d => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      d.title.toLowerCase().includes(q) ||
      d.tracknumber.toLowerCase().includes(q) ||
      d.requestor.toLowerCase().includes(q) ||
      (d.type ?? "").toLowerCase().includes(q);
    const matchFilter =
      filter === "All" ||
      (filter === "For Sending" ? d.status === "Pending" : d.status === filter);
    return matchSearch && matchFilter;
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

  return (
    <AdminLayout title="All Documents" subtitle={`${docs.length} total document${docs.length !== 1 ? "s" : ""} in the system`}>

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
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-accent/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[500px] flex flex-col">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Document</span>
            <span>Track No.</span>
            <span>Requestor</span>
            <span>Date</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No documents found.</div>
          ) : paginated.map(doc => (
            <div key={doc.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors">
              {/* Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.type}</p>
                </div>
              </div>
              {/* Track no */}
              <p className="text-sm font-mono text-foreground truncate">{doc.tracknumber}</p>
              {/* Requestor */}
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{doc.requestor}</p>
                {doc.position && <p className="text-xs text-muted-foreground truncate">{doc.position}</p>}
              </div>
              {/* Date */}
              <p className="text-sm text-muted-foreground">{fmtDate(doc.datesubmitted)}</p>
              {/* Status */}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_COLOR[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                {statusLabel(doc.status)}
                {doc.status === "For Signing" && doc.total_signatories > 0 &&
                  ` (${doc.signed_count}/${doc.total_signatories})`}
              </span>
              {/* Actions */}
              <div className="flex items-center gap-1">
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
          ))}
        </div>
      )}

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
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`min-w-[2rem] h-8 rounded-md text-xs font-medium border transition-colors ${
                    n === page
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
