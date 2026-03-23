import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Send, Eye, Clock, CheckCircle2, Search, Download, RefreshCw, Pencil, Trash2, AlertTriangle, Loader2, ChevronLeft, ChevronRight, ChevronDown, GitBranch, Plus, X as XIcon, Link2, Link2Off } from "lucide-react";
import UserLayout from "./UserLayout";
import { documentApi, officeApi, userApi, Document, Office, SignatoryUser } from "../../services/api";
import { useAuth } from "../Auth/AuthContext";

const STATUS_COLOR: Record<string, string> = {
  Pending:       "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Sending": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Completed:     "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected:      "bg-destructive/10 text-destructive",
};

const statusLabel = (doc: Document, currentUserId?: number): string => {
  const sigs     = doc.signatories ?? [];
  const total    = sigs.length;
  const signed   = sigs.filter(s => s.status === "signed").length;
  const rejected = sigs.filter(s => s.status === "rejected").length;
  const isOwner  = doc.userID === currentUserId;
  const isSignatory = sigs.some(s => s.user_id === currentUserId);
  const hasSigned = sigs.some(s => s.user_id === currentUserId && s.status === "signed");

  if (doc.status === "Pending") return "For Sending";
  if (doc.status === "For Signing") {
    if (isSignatory && hasSigned) return `Signed (${signed}/${total})`;
    return `For Signing (${signed}/${total})`;
  }
  if (doc.status === "Completed") {
    if (isOwner) return `Completed (${signed}/${total})`;
    if (isSignatory && hasSigned) return `Signed (${signed}/${total})`;
    return `Signed (${signed}/${total})`;
  }
  if (doc.status === "Rejected") return `Rejected (${rejected}/${total})`;
  return doc.status;
};

const PAGE_SIZE = 8;

// ── Table skeleton row ────────────────────────────────────────────────────────
const TableSkeletonRow = ({ index }: { index: number }) => (
  <div
    className="grid grid-cols-[2fr_1fr_1fr_1fr_180px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center slg:grid-cols-[2fr_1fr_180px]"
    style={{ animationDelay: `${index * 60}ms` }}
  >
    {/* Document col */}
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-accent animate-pulse" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Title line — varying widths for natural look */}
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

    {/* Track no col */}
    <div className="slg:hidden">
      <div className="h-3 rounded bg-accent animate-pulse w-24" />
    </div>

    {/* Date col */}
    <div className="slg:hidden">
      <div className="h-3 rounded bg-accent animate-pulse w-20" />
    </div>

    {/* Status col */}
    <div>
      <div className="h-5 rounded-full bg-accent animate-pulse w-28" />
    </div>

    {/* Actions col */}
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map(i => (
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

const MyDocuments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docs, setDocs]     = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<string>("All");
  const [typeFilter, setTypeFilter]   = useState<string>("All");
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef                    = useRef<HTMLDivElement>(null);
  const [page, setPage]               = useState(1);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node))
        setTypeDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [downloading, setDownloading] = useState<number | null>(null);
  const [resendDoc, setResendDoc]     = useState<Document | null>(null);
  const [resending,  setResending]    = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const [editDoc,    setEditDoc]    = useState<Document | null>(null);
  const [editTitle,  setEditTitle]  = useState("");
  const [editType,   setEditType]   = useState("");
  const [editMsg,    setEditMsg]    = useState("");
  const [editFile,   setEditFile]   = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);

  interface RoutingSig { user_id: number; user_email: string; user_name: string; order: number; }
  const [routingDoc,    setRoutingDoc]    = useState<Document | null>(null);
  const [routingSigs,   setRoutingSigs]   = useState<RoutingSig[]>([]);
  const [routingOffices,setRoutingOffices]= useState<Office[]>([]);
  const [routingUsers,  setRoutingUsers]  = useState<SignatoryUser[]>([]);
  const [routingOffice, setRoutingOffice] = useState("");
  const [routingSearch, setRoutingSearch] = useState("");
  const [routingPage,   setRoutingPage]   = useState(0);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingError,  setRoutingError]  = useState<string | null>(null);

  const [deleteDoc,  setDeleteDoc]  = useState<Document | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDownload = async (doc: Document) => {
    const filesToDownload = doc.files && doc.files.length > 0
      ? doc.files
      : doc.file_url ? [{ file_url: doc.file_url, id: -1 }] : [];
    if (filesToDownload.length === 0) return;
    setDownloading(doc.id);
    try {
      const token = localStorage.getItem("auth_token");
      for (let i = 0; i < filesToDownload.length; i++) {
        const f = filesToDownload[i];
        if (!f.file_url) continue;
        const res = await fetch(f.file_url, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        const suffix = filesToDownload.length > 1 ? ` (${i + 1})` : "";
        a.download = `${doc.tracknumber} - ${doc.title}${suffix}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        if (i < filesToDownload.length - 1) await new Promise(r => setTimeout(r, 350));
      }
    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setDownloading(null);
    }
  };

  const handleResend = async () => {
    if (!resendDoc) return;
    setResending(true);
    setResendError(null);
    try {
      const payload = {
        to_office:   resendDoc.to,
        signatories: resendDoc.signatories.map(s => ({
          user_id:    s.user_id,
          user_email: s.user_email,
          user_name:  s.user_name,
          order:      s.order,
        })),
      };
      const updated = await documentApi.send(resendDoc.id, payload);
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
      setResendDoc(null);
    } catch (e: any) {
      setResendError(e?.response?.data?.detail || e?.message || "Failed to re-send document.");
    } finally {
      setResending(false);
    }
  };

  const openRouting = async (doc: Document) => {
    setRoutingDoc(doc);
    setRoutingSigs(
      (doc.signatories ?? [])
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          user_id:    s.user_id,
          user_email: s.user_email,
          user_name:  s.user_name,
          order:      s.order,
        }))
    );
    setRoutingOffice("");
    setRoutingSearch("");
    setRoutingPage(0);
    setRoutingError(null);
    try {
      const [offices, users] = await Promise.all([officeApi.list(), userApi.signatories()]);
      setRoutingOffices(offices);
      setRoutingUsers(users);
    } catch (e) { console.error(e); }
  };

  const handleRoutingSave = async () => {
    if (!routingDoc) return;
    setRoutingSaving(true);
    setRoutingError(null);
    try {
      const updated = await documentApi.send(routingDoc.id, { signatories: routingSigs });
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
      setRoutingDoc(null);
    } catch (e: any) {
      setRoutingError(e?.response?.data?.detail || e?.message || "Failed to update routing.");
    } finally {
      setRoutingSaving(false);
    }
  };

  const openEdit = (doc: Document) => {
    setEditDoc(doc);
    setEditTitle(doc.title);
    setEditType(doc.type);
    setEditMsg(doc.message || "");
    setEditFile(null);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editDoc) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const fd = new FormData();
      fd.append("title",   editTitle.trim() || editDoc.title);
      fd.append("type",    editType.trim()  || editDoc.type);
      fd.append("message", editMsg);
      if (editFile) fd.append("file", editFile);
      const updated = await documentApi.update(editDoc.id, fd);
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
      setEditDoc(null);
    } catch (e: any) {
      setEditError(e?.response?.data?.detail || e?.message || "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await documentApi.delete(deleteDoc.id);
      setDocs(prev => prev.filter(d => d.id !== deleteDoc.id));
      setDeleteDoc(null);
    } catch (e: any) {
      setDeleting(false);
      setDeleteError(e?.response?.data?.detail || e?.message || "Failed to delete document.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    documentApi.myDocs(controller.signal)
      .then(setDocs)
      .catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
      .finally(() => {


        setTimeout(() => setLoading(false), 500);
      }
      
      
      
      );
    return () => controller.abort();
  }, []);

  useEffect(() => { setPage(1); }, [search, filter, typeFilter]);

  const statuses  = ["All", "For Sending", "For Signing", "Completed", "Signed", "Rejected"];
  const docTypes  = ["All", ...Array.from(new Set(docs.map(d => d.type).filter(Boolean))).sort()];

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      d.title.toLowerCase().includes(q) ||
      d.tracknumber.toLowerCase().includes(q) ||
      (d.type ?? "").toLowerCase().includes(q) ||
      (d.requestor ?? "").toLowerCase().includes(q);

    let matchFilter = false;
    if (filter === "All") {
      matchFilter = true;
    } else if (filter === "For Sending") {
      matchFilter = d.status === "Pending";
    } else if (filter === "For Signing") {
      const isSignatory = d.signatories?.some(s => s.user_id === user?.id);
      const hasSigned = d.signatories?.some(s => s.user_id === user?.id && s.status === "signed");
      matchFilter = d.status === "For Signing" && isSignatory && !hasSigned;
    } else if (filter === "Completed") {
      matchFilter = d.status === "Completed" && d.userID === user?.id;
    } else if (filter === "Signed") {
      const isSignatory = d.signatories?.some(s => s.user_id === user?.id);
      const hasSigned = d.signatories?.some(s => s.user_id === user?.id && s.status === "signed");
      matchFilter = !!(d.status === "Completed" && d.userID !== user?.id && isSignatory && hasSigned) ||
                   !!(d.status === "For Signing" && isSignatory && hasSigned);
    } else if (filter === "Rejected") {
      matchFilter = d.status === "Rejected";
    }

    const matchType = typeFilter === "All" || d.type === typeFilter;
    return matchSearch && matchFilter && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pending    = docs.filter(d => d.status === "Pending").length;
  const forSigning = docs.filter(d => d.status === "For Signing").length;
  const completed  = docs.filter(d => d.status === "Completed" && d.userID === user?.id).length;
  const signedBySelf = docs.filter(d =>
    d.signatories.some(s => s.user_id === user?.id && s.status === "signed")
  ).length;

  const toggleParallel = (index: number) => {
    setRoutingSigs(prev => {
      const updated = prev.map(s => ({ ...s }));
      const above   = updated[index - 1];
      const current = updated[index];
      if (current.order === above.order) {
        const threshold = current.order;
        for (let j = index; j < updated.length; j++) {
          if (updated[j].order >= threshold) updated[j].order += 1;
        }
      } else {
        current.order = above.order;
      }
      return updated;
    });
  };

  return (
    <UserLayout title="My Documents" subtitle="Documents you created or are assigned to sign">

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-6 lg:grid-cols-2 sm:grid-cols-2">
        {loading
          ? [...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { label: "For Sending",  value: pending,      icon: <Clock className="w-4 h-4" />,        color: "text-yellow-500" },
              { label: "For Signing", value: forSigning,   icon: <Send className="w-4 h-4" />,          color: "text-blue-500" },
              { label: "Completed",   value: completed,    icon: <CheckCircle2 className="w-4 h-4" />,  color: "text-green-500" },
              { label: "Signed",      value: signedBySelf, icon: <Eye className="w-4 h-4" />,           color: "text-teal-500" },
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
          <div className="relative flex-1 max-w-xs sm:max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text" placeholder="Search title or track no..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            />
          </div>
          <div ref={typeDropRef} className="relative shrink-0 sm:w-full">
            <button
              onClick={() => setTypeDropOpen(o => !o)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors sm:w-full ${
                typeFilter !== "All"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-accent"
              }`}
            >
              <span className="truncate max-w-[140px]">{typeFilter === "All" ? "All Types" : typeFilter}</span>
              {typeFilter !== "All" && (
                <span
                  onClick={e => { e.stopPropagation(); setTypeFilter("All"); }}
                  className="ml-auto text-primary/70 hover:text-primary text-xs leading-none"
                  role="button" aria-label="Clear type filter"
                >
                  ✕
                </span>
              )}
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${typeDropOpen ? "rotate-180" : ""}`} />
            </button>
            {typeDropOpen && (
              <div className="absolute z-30 mt-1.5 right-0 sm:left-0 w-56 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
                <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Document Type</p>
                <div className="px-2 pb-2 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
                  {docTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => { setTypeFilter(t); setTypeDropOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        typeFilter === t
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {t === "All" ? "All Types" : t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[530px] flex flex-col">
        {/* Header — always visible */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_180px] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide slg:grid-cols-[2fr_1fr_180px]">
          <span>Document</span>
          <span className="slg:hidden">Track No.</span>
          <span className="slg:hidden">Date</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          // ── Skeleton rows ──
          [...Array(PAGE_SIZE)].map((_, i) => (
            <TableSkeletonRow key={i} index={i} />
          ))
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground flex-1 flex items-center justify-center">
            No documents found.
          </div>
        ) : (
          paginated.map(doc => (
            <div
              key={doc.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_180px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors slg:grid-cols-[2fr_1fr_180px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.type}</p>
                </div>
              </div>
              <p className="text-sm text-foreground font-mono slg:hidden">{doc.tracknumber}</p>
              <p className="text-sm text-muted-foreground slg:hidden">{doc.datesubmitted}</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_COLOR[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                {statusLabel(doc, user?.id)}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(`/dtms/sign/${doc.tracknumber}`)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {((doc.files && doc.files.length > 0) || doc.file_url) && (
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloading === doc.id}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-green-600 transition-colors disabled:opacity-50"
                    title={doc.files && doc.files.length > 1 ? `Download ${doc.files.length} files` : "Download PDF"}
                  >
                    <Download className={`w-4 h-4 ${downloading === doc.id ? "animate-bounce" : ""}`} />
                  </button>
                )}
                {doc.userID === user?.id && doc.status === "Pending" && (
                  <button
                    onClick={() => openRouting(doc)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                    title="Edit routing / signatories"
                  >
                    <GitBranch className="w-4 h-4" />
                  </button>
                )}
                {doc.userID === user?.id && doc.status === "Rejected" && (
                  <button
                    onClick={() => setResendDoc(doc)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-orange-500 transition-colors"
                    title="Re-send document"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                {doc.userID === user?.id && doc.status === "Rejected" && (
                  <button
                    onClick={() => openEdit(doc)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-amber-500 transition-colors"
                    title="Edit document"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {doc.userID === user?.id && (
                  <button
                    onClick={() => { setDeleteDoc(doc); setDeleteError(null); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && (
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "No documents"
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} document${filtered.length !== 1 ? "s" : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`min-w-[2rem] h-8 rounded-md text-xs font-medium border transition-colors ${
                    n === page
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Routing modal */}
      {routingDoc && (() => {
        const filtered = routingUsers.filter(u => {
          if (!routingOffice) return false;
          if (u.office_id !== Number(routingOffice)) return false;
          if (routingSigs.some(s => s.user_id === u.id)) return false;
          const q = routingSearch.toLowerCase();
          return !q || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.position.toLowerCase().includes(q);
        });
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const paged = filtered.slice(routingPage * PAGE_SIZE, (routingPage + 1) * PAGE_SIZE);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
              <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <GitBranch className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Edit Routing</h2>
                  <p className="text-xs text-muted-foreground font-mono truncate">{routingDoc.tracknumber} &mdash; {routingDoc.title}</p>
                </div>
                <button onClick={() => setRoutingDoc(null)} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signatory Order</p>
                  {(() => {
                    const sortedUniqueOrders = [...new Set(routingSigs.map(s => s.order))].sort((a, b) => a - b);
                    const stepNum = (order: number) => sortedUniqueOrders.indexOf(order) + 1;
                    return routingSigs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No signatories assigned yet.</p>
                    ) : (
                      routingSigs.map((s, i) => {
                        const isParallelWithAbove = i > 0 && s.order === routingSigs[i - 1].order;
                        return (
                          <div key={s.user_id}>
                            {i > 0 && (
                              <div className="flex items-center justify-center h-5">
                                <button
                                  type="button"
                                  title={isParallelWithAbove ? "Click to sign separately (after above)" : "Click to sign at the same time as above"}
                                  onClick={() => toggleParallel(i)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                    isParallelWithAbove
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25"
                                      : "bg-accent text-muted-foreground hover:bg-accent hover:text-foreground"
                                  }`}
                                >
                                  {isParallelWithAbove
                                    ? <><Link2 className="w-3 h-3" /> parallel — click to separate</>
                                    : <><Link2Off className="w-3 h-3" /> sequential — click to parallelize</>}
                                </button>
                              </div>
                            )}
                            <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
                              isParallelWithAbove ? "bg-blue-500/5 border border-blue-500/20" : "bg-accent/50"
                            }`}>
                              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                isParallelWithAbove ? "bg-blue-500 text-white" : "bg-primary text-primary-foreground"
                              }`}>{stepNum(s.order)}</span>
                              <p className="text-sm font-medium text-foreground truncate flex-1">{s.user_name}</p>
                              <p className="text-xs text-muted-foreground truncate hidden sm:block">{s.user_email}</p>
                              <button type="button" onClick={() => setRoutingSigs(prev => prev.filter(x => x.user_id !== s.user_id))}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
                <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-background/50">
                  <p className="text-xs text-muted-foreground font-medium">Add signatory from an office</p>
                  <div className="relative">
                    <select value={routingOffice} onChange={e => { setRoutingOffice(e.target.value); setRoutingSearch(""); setRoutingPage(0); }}
                      className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                      <option value="">— Select office —</option>
                      {routingOffices.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {routingOffice && (
                    <>
                      <input type="text" placeholder="Search by name or position..."
                        value={routingSearch}
                        onChange={e => { setRoutingSearch(e.target.value); setRoutingPage(0); }}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                      <div className="border border-border rounded-lg overflow-hidden">
                        {filtered.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">{routingSearch ? "No users match your search" : "No available users in this office"}</p>
                        ) : (
                          <>
                            {paged.map(u => (
                              <button key={u.id} type="button"
                                onClick={() => setRoutingSigs(prev => [...prev, { user_id: u.id, user_email: u.email, user_name: `${u.first_name} ${u.last_name}`, order: prev.length === 0 ? 0 : Math.max(...prev.map(s => s.order)) + 1 }])}
                                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent text-left border-b border-border last:border-0 transition">
                                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">{u.first_name.slice(0, 1)}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{u.position || u.email}</p>
                                </div>
                                <Plus className="w-4 h-4 text-primary shrink-0" />
                              </button>
                            ))}
                            {totalPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-accent/30">
                                <span className="text-xs text-muted-foreground">{routingPage * PAGE_SIZE + 1}–{Math.min((routingPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => setRoutingPage(p => p - 1)} disabled={routingPage === 0}
                                    className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">‹ Prev</button>
                                  <button type="button" onClick={() => setRoutingPage(p => p + 1)} disabled={routingPage >= totalPages - 1}
                                    className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">Next ›</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {routingError && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /><span>{routingError}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-border">
                <button onClick={() => setRoutingDoc(null)}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
                  Cancel
                </button>
                <button onClick={handleRoutingSave} disabled={routingSaving || routingSigs.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold transition disabled:opacity-50">
                  {routingSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                    : <><Send className="w-4 h-4" /> Save &amp; Send</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Re-send confirmation modal */}
      {resendDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Re-send Document?</h2>
                <p className="text-xs text-muted-foreground">Will be sent to the same {resendDoc.signatories.length} signator{resendDoc.signatories.length === 1 ? "y" : "ies"} and reset their status to pending.</p>
              </div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                Have you updated your document based on the feedback?
              </p>
            </div>
            {resendDoc.signatories.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Will notify</p>
                <div className="flex flex-col gap-1.5">
                  {resendDoc.signatories.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-accent text-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="font-medium text-foreground truncate">{s.user_name}</span>
                      <span className="text-muted-foreground text-xs truncate hidden sm:inline">{s.user_email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {resendError && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" /><span>{resendError}</span>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setResendDoc(null); setResendError(null); }}
                disabled={resending}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResend}
                disabled={resending}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {resending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  : <><RefreshCw className="w-4 h-4" /> Yes, Re-send</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit document modal */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground">Edit Document</h2>
                <p className="text-xs text-muted-foreground font-mono truncate">{editDoc.tracknumber}</p>
              </div>
              <button onClick={() => setEditDoc(null)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Title</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Document Type</label>
                <input value={editType} onChange={e => setEditType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">Message / Remarks</label>
                <textarea rows={3} value={editMsg} onChange={e => setEditMsg(e.target.value)}
                  placeholder="Optional message to signatories..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Replace PDF <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                {editDoc.file_url && !editFile && (
                  <p className="text-xs text-muted-foreground">
                    Current file: <span className="font-mono">{editDoc.file_url.split("/").pop()}</span>
                  </p>
                )}
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-amber-400/60 transition">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">
                    {editFile
                      ? <span className="text-foreground">{editFile.name}</span>
                      : <span className="text-muted-foreground">Click to select a new PDF file</span>}
                  </span>
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={e => setEditFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              {editError && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /><span>{editError}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditDoc(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50">
                {editSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <><Pencil className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Delete Document?</h2>
                <p className="text-sm text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <div className="bg-accent/50 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm font-medium text-foreground truncate">{deleteDoc.title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{deleteDoc.tracknumber} &middot; {deleteDoc.status}</p>
            </div>
            {deleteError && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2.5 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" /><span>{deleteError}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteDoc(null); setDeleteError(null); }} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive hover:opacity-90 text-white text-sm font-semibold transition disabled:opacity-50">
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                  : <><Trash2 className="w-4 h-4" /> Yes, Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default MyDocuments;