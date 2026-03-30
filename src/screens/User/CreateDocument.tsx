import { useEffect, useState, useRef, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, ChevronDown, ChevronUp, AlertTriangle, User, Briefcase,
  BookOpen, MessageSquare, X, Plus, Send, Users, Link2, Link2Off, Loader2,
} from "lucide-react";
import UserLayout from "./UserLayout";
import SendingOverlay from "@/components/ui/SendingOverlay";
import {
  documentApi, templateApi, officeApi, userApi,
  DocumentTemplate, Office, SignatoryUser,
} from "../../services/api";
import { useAuth } from "../Auth/AuthContext";

interface SignatoryEntry {
  user_id: number;
  user_email: string;
  user_name: string;
  order: number;
}

const PAGE_SIZE = 8;

const normalizeSignatoryOrders = (entries: SignatoryEntry[]): SignatoryEntry[] => {
  const normalized: SignatoryEntry[] = [];
  let currentOrder = 0;

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].order !== entries[i - 1].order) {
      currentOrder += 1;
    }
    normalized.push({ ...entries[i], order: currentOrder });
  }

  return normalized;
};

const CreateDocument = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [allUsers, setAllUsers] = useState<SignatoryUser[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    requestor: "",
    position: "",
    message: "",
    template: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [draggedFileIdx, setDraggedFileIdx] = useState<number | null>(null);

  // Move file up or down in the list
  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles(prev => {
      const arr = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return arr;
      const [file] = arr.splice(index, 1);
      arr.splice(target, 0, file);
      return arr;
    });
  };

  // Drag-and-drop handlers for file reordering
  const handleFileDragStart = (idx: number) => {
    setDraggedFileIdx(idx);
  };
  const handleFileDragOver = (idx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedFileIdx === null || draggedFileIdx === idx) return;
    setFiles(prev => {
      const arr = [...prev];
      const [file] = arr.splice(draggedFileIdx, 1);
      arr.splice(idx, 0, file);
      return arr;
    });
    setDraggedFileIdx(idx);
  };
  const handleFileDragEnd = () => {
    setDraggedFileIdx(null);
  };
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Signatory routing state ───────────────────────────────────────────────
  const [signatories, setSignatories] = useState<SignatoryEntry[]>([]);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [sigOffice, setSigOffice] = useState<string>("");
  const [sigSearch, setSigSearch] = useState<string>("");
  const [sigPage, setSigPage] = useState(0);

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      templateApi.list(ctrl.signal),
      officeApi.list(ctrl.signal),
      userApi.signatories(ctrl.signal),
    ]).then(([t, o, u]) => {
      setTemplates(t);
      setOffices(o);
      setAllUsers(u);
    }).catch((err) => {
      if (err?.code !== "ERR_CANCELED") console.error(err);
    });

    if (user) {
      setForm(f => ({
        ...f,
        requestor: `${user.first_name} ${user.last_name}`,
        position: user.position,
      }));
    }
    return () => ctrl.abort();
  }, [user]);

  // ── Form change + template auto-populate ──────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setError(null);

    if (name === "template") {
      const tmpl = value ? templates.find(t => String(t.id) === value) : undefined;
      setForm(f => ({ ...f, template: value }));
      if (value && tmpl) {
        if (tmpl.routing && tmpl.routing.length > 0) {
          setSignatories(
            normalizeSignatoryOrders(
              tmpl.routing
                .slice()
                .sort((a, b) => a.order - b.order)
                .map(step => ({
                  user_id: step.user_id,
                  user_email: step.user_email,
                  user_name: step.user_name,
                  order: step.order,
                }))
            )
          );
          setFromTemplate(true);
        } else {
          setFromTemplate(false);
        }
      } else {
        setSignatories([]);
        setFromTemplate(false);
      }
      return;
    }
    setForm(f => ({ ...f, [name]: value }));
  };

  // ── Signatory helpers ─────────────────────────────────────────────────────
  const addSignatory = (u: SignatoryUser) => {
    if (signatories.some(s => s.user_id === u.id)) return;
    setSignatories(prev => [
      ...prev,
      {
        user_id: u.id,
        user_email: u.email,
        user_name: `${u.first_name} ${u.last_name}`,
        order: prev.length === 0 ? 0 : Math.max(...prev.map(s => s.order)) + 1,
      },
    ]);
    setFromTemplate(false);
  };

  const removeSignatory = (userId: number) => {
    setSignatories(prev => normalizeSignatoryOrders(prev.filter(s => s.user_id !== userId)));
    setFromTemplate(false);
  };

  const toggleParallel = (index: number) => {
    setSignatories(prev => {
      const updated = prev.map(s => ({ ...s }));
      const above = updated[index - 1];
      const current = updated[index];
      if (current.order === above.order) {
        // Split: bump this sig and all subsequent ones at or above this order
        const threshold = current.order;
        for (let j = index; j < updated.length; j++) {
          if (updated[j].order >= threshold) updated[j].order += 1;
        }
      } else {
        // Merge: pull this sig up to the same order as the one above
        current.order = above.order;
      }
      return normalizeSignatoryOrders(updated);
    });
    setFromTemplate(false);
  };

  const moveSignatory = (index: number, direction: "up" | "down") => {
    setSignatories(prev => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = prev.map(s => ({ ...s }));
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return normalizeSignatoryOrders(updated);
    });
    setFromTemplate(false);
  };

  // Drag-and-drop for signatories
  const [draggedSigIdx, setDraggedSigIdx] = useState<number | null>(null);
  const handleSigDragStart = (idx: number) => {
    setDraggedSigIdx(idx);
  };
  const handleSigDragOver = (idx: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedSigIdx === null || draggedSigIdx === idx) return;
    setSignatories(prev => {
      const arr = [...prev];
      const [dragged] = arr.splice(draggedSigIdx, 1);
      arr.splice(idx, 0, dragged);
      // Do NOT change order property; only reorder visually
      return arr;
    });
    setDraggedSigIdx(idx);
  };
  const handleSigDragEnd = () => {
    setDraggedSigIdx(null);
  };

  const handleOfficeChange = (val: string) => {
    setSigOffice(val);
    setSigSearch("");
    setSigPage(0);
  };

  // ── Filtered / paginated user list for the picker ────────────────────────
  const filteredSigUsers = allUsers.filter(u => {
    if (!sigOffice) return false;
    if (u.office_id !== Number(sigOffice)) return false;
    if (signatories.some(s => s.user_id === u.id)) return false;
    const q = sigSearch.toLowerCase();
    if (!q) return true;
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.position.toLowerCase().includes(q)
    );
  });
  const totalSigPages = Math.ceil(filteredSigUsers.length / PAGE_SIZE);
  const pagedSigUsers = filteredSigUsers.slice(sigPage * PAGE_SIZE, (sigPage + 1) * PAGE_SIZE);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.requestor || !form.position) {
      setError("Please fill in all required fields.");
      return;
    }
    if (files.length === 0) {
      setError("Please attach at least one PDF file.");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("userID", String(user?.id ?? 0));
      const selectedTemplate = form.template ? templates.find(t => String(t.id) === form.template) : undefined;
      fd.append("title", form.title);
      fd.append("type", selectedTemplate?.name ?? "Other");
      fd.append("requestor", form.requestor);
      fd.append("position", form.position);
      fd.append("message", form.message);
      if (form.template) fd.append("template", form.template);
      // Append only the first file to document.file for backward compatibility
      if (files.length > 0) fd.append("file", files[0]);

      const doc = await documentApi.create(fd);

      // Upload additional files if there are more than one
      if (files.length > 1) {
        for (let i = 1; i < files.length; i++) {
          const fileFd = new FormData();
          fileFd.append("file", files[i]);
          try {
            await documentApi.uploadFile(doc.id, fileFd);
          } catch (err) {
            console.error(`Failed to upload file ${i + 1}:`, err);
          }
        }
      }

      // If signatories assigned → immediately route the document
      if (signatories.length > 0) {
        // Normalize signatory orders before sending
        const normalizedSignatories = normalizeSignatoryOrders(signatories);
        await documentApi.send(doc.id, { signatories: normalizedSignatories });
      }

      navigate(`/dtms/user/documents`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasSigs = signatories.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <UserLayout title="Create Document" subtitle="Fill in the details and assign signatories">
      <div className="w-full max-w-5xl">

        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-[1fr_280px] gap-5 items-start lg:grid-cols-1">

            {/* ── LEFT: form fields ────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Document Info */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Info</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    Template <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </label>
                  <div className="relative">
                    <select name="template" value={form.template} onChange={handleChange}
                      className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                      <option value="">— No template —</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    Title <span className="text-destructive">*</span>
                  </label>
                  <input name="title" value={form.title} onChange={handleChange}
                    placeholder="e.g. Request for Budget Approval"
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                </div>



                {/* Template link + instruction */}
                {(() => {
                  const tmpl = form.template ? templates.find(t => String(t.id) === form.template) : null;
                  return tmpl?.description ? (
                    <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3">
                      <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">Template Available</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          A form template is provided for this document type.{" "}
                          <a
                            href={tmpl.description}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 font-medium hover:underline inline-flex items-center gap-0.5"
                          >
                            Open template ↗
                          </a>
                          {" "}— fill it out, then upload the completed PDF in the section below.
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Requestor */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requestor</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      Name <span className="text-destructive">*</span>
                    </label>
                    <input name="requestor" value={form.requestor} onChange={handleChange}
                      placeholder="Full name"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                      Position <span className="text-destructive">*</span>
                    </label>
                    <input name="position" value={form.position} onChange={handleChange}
                      placeholder="Job title / position"
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    Message / Body
                  </label>
                  <textarea name="message" value={form.message} onChange={handleChange} rows={5}
                    placeholder="Enter the document body or message..."
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    Attach PDFs <span className="text-destructive">*</span>
                  </label>
                  <>
                    {files.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {files.map((f, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 ${draggedFileIdx === idx ? 'opacity-60' : ''}`}
                            draggable
                            onDragStart={() => handleFileDragStart(idx)}
                            onDragOver={e => handleFileDragOver(idx, e)}
                            onDragEnd={handleFileDragEnd}
                            onDrop={handleFileDragEnd}
                            style={{ cursor: 'move' }}
                          >
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Move up"
                                onClick={() => moveFile(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                title="Move down"
                                onClick={() => moveFile(idx, 'down')}
                                disabled={idx === files.length - 1}
                                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-2 rounded-lg border border-border bg-accent/50 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition"
                        >
                          <Plus className="w-4 h-4" />
                          Add more files
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-background px-4 py-8 cursor-pointer transition group ${dragging
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                          }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={e => {
                          e.preventDefault();
                          setDragging(false);
                          const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type === "application/pdf");
                          if (dropped.length > 0) setFiles(prev => [...prev, ...dropped]);
                        }}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${dragging ? "bg-primary/20" : "bg-accent group-hover:bg-primary/10"}`}>
                          <Upload className={`w-5 h-5 transition ${dragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">
                            {dragging ? "Drop your PDFs here" : "Drag & drop or click to upload"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">PDF files only (multiple allowed)</p>
                        </div>
                      </div>
                    )}
                    {/* Always render the hidden file input so the button can trigger it */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="file-upload"
                      accept=".pdf"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const newFiles = Array.from(e.target.files || []).filter(f => f.type === "application/pdf");
                        setFiles(prev => [...prev, ...newFiles]);
                      }}
                    />
                  </>
                </div>
              </div>

              {/* ── Signatories ───────────────────────────────────── */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Assign Signatories
                  <span className="text-[10px] font-normal normal-case text-muted-foreground">
                    (optional — document stays as "For Sending" until routed)
                  </span>
                  {fromTemplate && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
                      pre-filled from template
                    </span>
                  )}
                </p>

                {/* Selected signatories queue */}
                {signatories.length > 0 && (() => {
                  const sortedUniqueOrders = [...new Set(signatories.map(s => s.order))].sort((a, b) => a - b);
                  const stepNum = (order: number) => sortedUniqueOrders.indexOf(order) + 1;
                  return (
                    <div className="flex flex-col gap-0">
                      {signatories.map((s, i) => {
                        const isParallelWithAbove = i > 0 && s.order === signatories[i - 1].order;
                        return (
                          <div key={s.user_id}>
                            {i > 0 && (
                              <div className="flex items-center justify-center h-5">
                                <button
                                  type="button"
                                  title={isParallelWithAbove ? "Click to sign separately (after above)" : "Click to sign at the same time as above"}
                                  onClick={() => toggleParallel(i)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${isParallelWithAbove
                                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25"
                                    : "bg-accent text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                  {isParallelWithAbove
                                    ? <><Link2 className="w-3 h-3" /> parallel &mdash; click to separate</>
                                    : <><Link2Off className="w-3 h-3" /> sequential &mdash; click to parallelize</>}
                                </button>
                              </div>
                            )}
                            <div
                              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${isParallelWithAbove ? "bg-blue-500/5 border border-blue-500/20" : "bg-accent/50"
                                } ${draggedSigIdx === i ? 'opacity-60' : ''}`}
                              draggable
                              onDragStart={() => handleSigDragStart(i)}
                              onDragOver={e => handleSigDragOver(i, e)}
                              onDragEnd={handleSigDragEnd}
                              onDrop={handleSigDragEnd}
                              style={{ cursor: 'move' }}
                            >
                              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${isParallelWithAbove ? "bg-blue-500 text-white" : "bg-primary text-primary-foreground"
                                }`}>{stepNum(s.order)}</span>
                              <p className="text-sm font-medium text-foreground truncate flex-1">{s.user_name}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  title="Move earlier"
                                  onClick={() => moveSignatory(i, "up")}
                                  disabled={i === 0}
                                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Move later"
                                  onClick={() => moveSignatory(i, "down")}
                                  disabled={i === signatories.length - 1}
                                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Remove signatory"
                                  onClick={() => removeSignatory(s.user_id)}
                                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Add from office picker */}
                <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-background/50">
                  <p className="text-xs text-muted-foreground font-medium">Add signatory from an office</p>

                  <div className="relative">
                    <select value={sigOffice} onChange={e => handleOfficeChange(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                      <option value="">— Select office —</option>
                      {offices.map(o => (
                        <option key={o.officeID} value={o.officeID}>{o.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>

                  {sigOffice && (
                    <>
                      <input type="text" placeholder="Search by name or position..."
                        value={sigSearch}
                        onChange={e => { setSigSearch(e.target.value); setSigPage(0); }}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />

                      <div className="border border-border rounded-lg overflow-hidden">
                        {filteredSigUsers.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">
                            {sigSearch
                              ? "No users match your search"
                              : "No available users in this office"}
                          </p>
                        ) : (
                          <>
                            {pagedSigUsers.map(u => (
                              <button key={u.id} type="button" onClick={() => addSignatory(u)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent text-left border-b border-border last:border-0 transition">
                                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                  {u.first_name.slice(0, 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {u.first_name} {u.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {u.position || u.email}
                                  </p>
                                </div>
                                <Plus className="w-4 h-4 text-primary shrink-0" />
                              </button>
                            ))}

                            {totalSigPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-accent/30">
                                <span className="text-xs text-muted-foreground">
                                  {sigPage * PAGE_SIZE + 1}–{Math.min((sigPage + 1) * PAGE_SIZE, filteredSigUsers.length)} of {filteredSigUsers.length}
                                </span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => setSigPage(p => p - 1)}
                                    disabled={sigPage === 0}
                                    className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">
                                    ‹ Prev
                                  </button>
                                  <button type="button" onClick={() => setSigPage(p => p + 1)}
                                    disabled={sigPage >= totalSigPages - 1}
                                    className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">
                                    Next ›
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>{/* end LEFT */}

            {/* ── RIGHT: sticky action panel ────────────────────── */}
            <div className="sticky top-4 flex flex-col gap-4 lg:static">

              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {form.title || "New Document"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.template ? templates.find(t => String(t.id) === form.template)?.name : "No template selected"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Requestor</span>
                    <span className="text-foreground font-medium truncate max-w-[130px] text-right">
                      {form.requestor || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Position</span>
                    <span className="text-foreground font-medium truncate max-w-[130px] text-right">
                      {form.position || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Attachments</span>
                    <span className="text-foreground font-medium">{files.length} {files.length === 1 ? "file" : "files"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Signatories</span>
                    <span className={`font-medium ${hasSigs ? "text-primary" : "text-muted-foreground"}`}>
                      {hasSigs ? `${signatories.length} assigned` : "None"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Fields marked <span className="text-destructive font-semibold">*</span> are required.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {hasSigs ? "Sending…" : "Creating…"}</>
                  ) : hasSigs ? (
                    <><Send className="w-4 h-4" /> Create &amp; Send</>
                  ) : (
                    "Create Document"
                  )}
                </button>
                <button type="button" onClick={() => navigate(-1)}
                  className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition">
                  Cancel
                </button>
              </div>

            </div>{/* end RIGHT */}

          </div>
        </form>
      </div>

      {loading && <SendingOverlay hasSigs={hasSigs} />}
    </UserLayout>
  );
};

export default CreateDocument;
