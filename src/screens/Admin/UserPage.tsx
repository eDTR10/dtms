import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Pencil, X, ChevronDown, ChevronUp, ChevronsUpDown, Network, LayoutList, ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { TableSkeleton } from "./Skeleton";
import { userApi, officeApi, UserProfile, Office } from "../../services/api";

const DEFAULT_PASSWORD = "@user322w";

const ACC_LEVELS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Super Admin" },
  { value: 1, label: "Admin" },
  { value: 2, label: "Manager" },
  { value: 3, label: "Signatory" },
  { value: 4, label: "Staff" },
];

// ── Sort helpers ──────────────────────────────────────────────────────────────
type SortKey = "name" | "office" | "acc_lvl" | "is_active";
type SortDir = "asc" | "desc";

// ── User Modal ────────────────────────────────────────────────────────────────
const UserModal = ({
  initial,
  offices,
  onSave,
  onClose,
}: {
  initial?: UserProfile;
  offices: Office[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) => {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    email: initial?.email ?? "",
    position: initial?.position ?? "",
    office: String(initial?.office ?? ""),
    acc_lvl: String(initial?.acc_lvl ?? 4),
    is_active: initial?.is_active ?? true,
    password: isEdit ? "" : DEFAULT_PASSWORD,
    re_password: isEdit ? "" : DEFAULT_PASSWORD,
  });
  const [selectedProjects, setSelectedProjects] = useState<number[]>(initial?.projects ?? []);
  const [projectSelection, setProjectSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      setError("First name, last name and email are required.");
      return;
    }
    if (!isEdit && (!form.password || form.password !== form.re_password)) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        position: form.position,
        office: Number(form.office),
        acc_lvl: Number(form.acc_lvl),
        is_active: form.is_active,
        projects: selectedProjects,
      };
      if (form.password) {
        payload.password = form.password;
        payload.re_password = form.re_password;
      }
      await onSave(payload);
      onClose();
    } catch (err: any) {
      const d = err?.response?.data;
      setError(d?.email?.[0] || d?.detail || JSON.stringify(d) || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProjectNames = offices
    .filter(o => selectedProjects.includes(o.officeID))
    .map(o => o.name);

  const availableProjects = offices.filter(o => !selectedProjects.includes(o.officeID));

  const handleProjectSelect = (value: string) => {
    setProjectSelection(value);
    if (!value) return;

    const projectId = Number(value);
    setSelectedProjects(prev => prev.includes(projectId) ? prev : [...prev, projectId]);
    setProjectSelection("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit User" : "Add User"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
          {([
            { name: "first_name", label: "First Name" },
            { name: "last_name", label: "Last Name" },
            { name: "email", label: "Email", type: "email" },
            { name: "position", label: "Position" },
          ] as Array<{ name: string; label: string; type?: string }>).map(f => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{f.label}</label>
              <input name={f.name} type={f.type ?? "text"} value={(form as any)[f.name]}
                onChange={change}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>
          ))}

          {/* Office */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Office</label>
            <div className="relative">
              <select name="office" value={form.office} onChange={change}
                className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                <option value="">— Select —</option>
                {offices.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Account Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Account Level</label>
            <div className="relative">
              <select name="acc_lvl" value={form.acc_lvl} onChange={change}
                className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
                {ACC_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Projects dropdown */}
        <div className="flex flex-col gap-1.5 mt-4">
          <label className="text-sm font-medium text-foreground">Projects</label>
          {offices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No offices available.</p>
          ) : (
            <div className="relative">
              <select
                value={projectSelection}
                onChange={e => handleProjectSelect(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              >
                <option value="">Select project</option>
                {availableProjects.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          )}
          {selectedProjectNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProjects.map(projectId => (
                <span
                  key={projectId}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {offices.find(o => o.officeID === projectId)?.name ?? `Office ${projectId}`}
                  <button
                    type="button"
                    onClick={() => setSelectedProjects(prev => prev.filter(id => id !== projectId))}
                    className="rounded-full text-primary/80 transition hover:text-primary"
                    aria-label={`Remove project ${projectId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 mt-0">

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Password{" "}
              {isEdit && <span className="text-muted-foreground font-normal">(leave blank to keep)</span>}
            </label>            <input name="password" type="password" value={form.password} onChange={change}
              placeholder={isEdit ? "Leave blank to keep current" : "Password"}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <input name="re_password" type="password" value={form.re_password} onChange={change}
              placeholder="Re-enter password"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
        </div>{/* end password grid */}

        {/* Is Active */}
        <label className="flex items-center gap-3 mt-4 cursor-pointer">
          <input type="checkbox" name="is_active" checked={form.is_active}
            onChange={change}
            className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-sm text-foreground">Active account</span>
        </label>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Saving..." : "Save User"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ACC_LABEL_MAP: Record<number, string> = Object.fromEntries(ACC_LEVELS.map(l => [l.value, l.label]));

// ── Sort icon ─────────────────────────────────────────────────────────────────
const SortIcon = ({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 ml-1" />
    : <ChevronDown className="w-3 h-3 ml-1" />;
};

// ── Org Chart ─────────────────────────────────────────────────────────────────

const LEVEL_BORDER: Record<number, string> = {
  0: "border-violet-500",
  1: "border-blue-500",
  2: "border-emerald-500",
  3: "border-amber-500",
  4: "border-slate-400",
};

const LEVEL_BG: Record<number, string> = {
  0: "bg-violet-500/5",
  1: "bg-blue-500/5",
  2: "bg-emerald-500/5",
  3: "bg-amber-500/5",
  4: "bg-slate-500/5",
};



/** A single person card in the org chart */
const PersonCard = ({ u, small, onEdit }: { u: UserProfile; small?: boolean; onEdit?: (u: UserProfile) => void }) => {
  const borderColor = LEVEL_BORDER[u.acc_lvl] ?? "border-slate-400";
  const bgColor = LEVEL_BG[u.acc_lvl] ?? "bg-slate-500/5";
  const clickRef = useRef({ x: 0, y: 0 });
  return (
    <div
      className={`flex flex-col items-center text-center px-3 py-2 rounded-lg border-2 ${borderColor} ${bgColor} ${small ? "min-w-[140px] max-w-[160px]" : "min-w-[160px] max-w-[200px]"} transition-all hover:shadow-md hover:scale-[1.02] ${onEdit ? "cursor-pointer" : ""}`}
      onPointerDown={e => { clickRef.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={e => {
        const dx = Math.abs(e.clientX - clickRef.current.x);
        const dy = Math.abs(e.clientY - clickRef.current.y);
        if (dx < 5 && dy < 5 && onEdit) { e.stopPropagation(); onEdit(u); }
      }}
    >
      <p className={`font-semibold text-foreground leading-tight ${small ? "text-[11px]" : "text-xs"}`}>
        {u.first_name.toUpperCase()} {u.last_name.toUpperCase()}
      </p>
      <p className={`text-muted-foreground leading-tight mt-0.5 ${small ? "text-[9px]" : "text-[10px]"}`}>
        {u.position || ACC_LABEL_MAP[u.acc_lvl] || "Staff"}
      </p>
      {!u.is_active && (
        <span className="text-[8px] text-destructive font-bold mt-0.5">INACTIVE</span>
      )}
    </div>
  );
};

/** Connector line styles */
const CONNECTOR = "bg-border dark:bg-border";

const OrgChart = ({ users, offices, onEdit }: { users: UserProfile[]; offices: Office[]; onEdit: (u: UserProfile) => void }) => {
  const officeMap = Object.fromEntries(offices.map(o => [o.officeID, o.name]));

  // Group users by project
  const projectGroups = useMemo(() => {
    const groups = new Map<number, UserProfile[]>();
    users.forEach(u => {
      (u.projects ?? []).forEach(pid => {
        if (!groups.has(pid)) groups.set(pid, []);
        groups.get(pid)!.push(u);
      });
    });
    groups.forEach(members => members.sort((a, b) => a.acc_lvl - b.acc_lvl));
    return groups;
  }, [users]);

  const unassigned = useMemo(() => users.filter(u => (u.projects ?? []).length === 0), [users]);
  const projectEntries = Array.from(projectGroups.entries());

  // ── Pan & Zoom state ──────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const pinchStart = useRef<number | null>(null);
  const pinchScaleStart = useRef(1);

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 2;

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale(prev => clampScale(prev + delta));
  }, []);

  // Pointer drag start
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // left-click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [translate]);

  // Pointer drag move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  }, [isDragging]);

  // Pointer drag end
  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch pinch-to-zoom
  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = getTouchDist(e.touches);
      pinchScaleStart.current = scale;
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current !== null) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const ratio = dist / pinchStart.current;
      setScale(clampScale(pinchScaleStart.current * ratio));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchStart.current = null;
  }, []);

  const resetView = () => { setScale(0.75); setTranslate({ x: 0, y: 0 }); };
  const zoomIn = () => setScale(prev => clampScale(prev + 0.15));
  const zoomOut = () => setScale(prev => clampScale(prev - 0.15));

  return (
    <div className="space-y-4">
      {/* Legend + Zoom Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap gap-3">
          {ACC_LEVELS.map(l => (
            <span key={l.value} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-3 h-2 rounded-sm border-2 ${LEVEL_BORDER[l.value]}`} />
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground mr-2">
            <span className="font-semibold text-foreground">{projectGroups.size}</span> projects · <span className="font-semibold text-foreground">{users.length}</span> personnel
          </p>
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={zoomOut} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-muted-foreground min-w-[40px] text-center border-x border-border">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l border-border" title="Reset View">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Pan & Zoom Canvas */}
      <div
        ref={containerRef}
        className={`rounded-2xl border border-border bg-card overflow-hidden relative ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ height: "70vh", touchAction: "none" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag hint */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground/50 pointer-events-none select-none">
          <Move className="w-3 h-3" /> Drag to pan · Scroll to zoom
        </div>

        <div
          className="origin-top-left transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            minWidth: "fit-content",
            padding: "48px",
          }}
        >
          {/* Top-level: all projects side by side */}
          <div className="flex justify-center gap-0">
            <div className="flex flex-col items-center">

              {/* Organization header */}
              <div className="flex flex-col items-center mb-2">
                <div className="px-6 py-3 rounded-xl bg-primary/10 border-2 border-primary text-center">
                  <p className="text-sm font-bold text-primary tracking-wide">ORGANIZATIONAL CHART</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Based on Project Assignments</p>
                </div>
              </div>

              {/* Vertical line down from org header */}
              {projectEntries.length > 0 && (
                <div className={`w-px h-8 ${CONNECTOR}`} />
              )}

              {/* Horizontal rail connecting all project columns */}
              {projectEntries.length > 1 && (
                <div className="relative w-full flex justify-center">
                  <div className={`h-px ${CONNECTOR}`} style={{ width: `${Math.max(100, (projectEntries.length - 1) * 240)}px` }} />
                </div>
              )}

              {/* Project columns */}
              <div className="flex gap-6 items-start">
                {projectEntries.map(([pid, members]) => {
                  const projectName = officeMap[pid] ?? `Project ${pid}`;
                  const head = members[0];
                  const rest = members.slice(1);

                  return (
                    <div key={pid} className="flex flex-col items-center">
                      {projectEntries.length > 1 && (
                        <div className={`w-px h-6 ${CONNECTOR}`} />
                      )}
                      <div className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-center min-w-[180px] max-w-[220px]">
                        <p className="text-xs font-bold uppercase tracking-wide leading-tight">{projectName}</p>
                        <p className="text-[10px] opacity-75 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
                      </div>
                      {head && <div className={`w-px h-4 ${CONNECTOR}`} />}
                      {head && <PersonCard u={head} onEdit={onEdit} />}
                      {rest.map(u => (
                        <div key={u.id} className="flex flex-col items-center">
                          <div className={`w-px h-3 ${CONNECTOR}`} />
                          <PersonCard u={u} small onEdit={onEdit} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Unassigned users section */}
          {unassigned.length > 0 && (
            <div className="mt-10 pt-6 border-t border-dashed border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 text-center">
                Unassigned Personnel ({unassigned.length})
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {unassigned.map(u => (
                  <PersonCard key={u.id} u={u} small onEdit={onEdit} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const UserPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; item?: UserProfile }>({ open: false });
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterOffice, setFilterOffice] = useState<string>("");
  const [filterAccLvl, setFilterAccLvl] = useState<string>("");
  const [filterProject, setFilterProject] = useState<string>("");
  const [view, setView] = useState<"table" | "chart">("table");

  const load = (signal?: AbortSignal) => {
    setLoading(true);
    Promise.all([userApi.list(signal), officeApi.list(signal)])
      .then(([u, o]) => { setUsers(u); setOffices(o); })
      .catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSave = async (data: any) => {
    if (modal.item) {
      await userApi.update(modal.item.id, data);
    } else {
      await userApi.create(data);
    }
    load();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const officeMap = Object.fromEntries(offices.map(o => [o.officeID, o.name]));

  const activeFilterCount = [filterOffice, filterAccLvl, filterProject].filter(Boolean).length;

  const filtered = users
    .filter(u => {
      const matchesSearch =
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesOffice = filterOffice === "" || String(u.office) === filterOffice;
      const matchesAccLvl = filterAccLvl === "" || String(u.acc_lvl) === filterAccLvl;
      const matchesProject = filterProject === "" || (u.projects ?? []).map(String).includes(filterProject);
      return matchesSearch && matchesOffice && matchesAccLvl && matchesProject;
    })
    .sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortKey === "name") {
        valA = `${a.first_name} ${a.last_name}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sortKey === "office") {
        const officeA = a.office ?? '';
        const officeB = b.office ?? '';
        valA = (officeMap[String(officeA)] ?? "").toLowerCase();
        valB = (officeMap[String(officeB)] ?? "").toLowerCase();
      } else if (sortKey === "acc_lvl") {
        valA = a.acc_lvl;
        valB = b.acc_lvl;
      } else if (sortKey === "is_active") {
        valA = a.is_active ? 0 : 1;
        valB = b.is_active ? 0 : 1;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const thClass = "flex items-center gap-0.5 cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <AdminLayout title="Users" subtitle="Manage system users">

      {modal.open && (
        <UserModal
          initial={modal.item}
          offices={offices}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      <div className="flex flex-col gap-3 mb-5">
        {/* Row 1: search + add */}
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch">
          <div className="relative flex-1 max-w-xs sm:max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search users..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <button onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Row 2: view toggle + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden mr-2">
            <button onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              <LayoutList className="w-3.5 h-3.5" /> Table
            </button>
            <button onClick={() => setView("chart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${view === "chart" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              <Network className="w-3.5 h-3.5" /> Org Chart
            </button>
          </div>
          {/* Office filter */}
          <div className="relative">
            <select
              value={filterOffice}
              onChange={e => setFilterOffice(e.target.value)}
              style={filterOffice ? { backgroundColor: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary))" } : {}}
              className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition data-[active=true]:font-medium"
              data-active={!!filterOffice}>
              <option value="">All Offices</option>
              {offices.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Account Level filter */}
          <div className="relative">
            <select
              value={filterAccLvl}
              onChange={e => setFilterAccLvl(e.target.value)}
              style={filterAccLvl ? { backgroundColor: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary))" } : {}}
              className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              data-active={!!filterAccLvl}>
              <option value="">All Levels</option>
              {ACC_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Project filter */}
          <div className="relative">
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              style={filterProject ? { backgroundColor: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary))" } : {}}
              className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              data-active={!!filterProject}>
              <option value="">All Projects</option>
              {offices.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterOffice(""); setFilterAccLvl(""); setFilterProject(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition">
              <X className="w-3 h-3" /> Clear filters
              <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {view === "chart" ? (
        loading ? <TableSkeleton rows={6} /> : <OrgChart users={filtered} offices={offices} onEdit={(u) => setModal({ open: true, item: u })} />
      ) : (
        loading ? <TableSkeleton rows={6} /> : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide slg:grid-cols-[2fr_1fr_auto]">
              <button className={thClass} onClick={() => toggleSort("name")}>
                User <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </button>
              <button className={`${thClass} slg:hidden`} onClick={() => toggleSort("office")}>
                Office <SortIcon col="office" sortKey={sortKey} sortDir={sortDir} />
              </button>
              <span className="slg:hidden text-left">Projects</span>
              <button className={`${thClass} slg:hidden`} onClick={() => toggleSort("acc_lvl")}>
                Level <SortIcon col="acc_lvl" sortKey={sortKey} sortDir={sortDir} />
              </button>
              <button className={thClass} onClick={() => toggleSort("is_active")}>
                Status <SortIcon col="is_active" sortKey={sortKey} sortDir={sortDir} />
              </button>
              <span>Actions</span>
            </div>

            {/* Body */}
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">No users found.</div>
            ) : (
              filtered.map(u => (
                <div key={u.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors slg:grid-cols-[2fr_1fr_auto]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold uppercase">
                      {u.first_name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground truncate slg:hidden">{u.office ? (officeMap[u.office] ?? `Office ${u.office}`) : '—'}</p>
                  <div className="slg:hidden flex flex-wrap gap-1 min-w-0">
                    {(u.projects ?? []).length === 0
                      ? <span className="text-sm text-muted-foreground">—</span>
                      : (u.projects ?? []).map(pid => (
                        <span key={pid} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary truncate max-w-[120px]">
                          {officeMap[pid] ?? `Office ${pid}`}
                        </span>
                      ))
                    }
                  </div>
                  <span className="text-sm text-foreground slg:hidden">{ACC_LABEL_MAP[u.acc_lvl] ?? `Level ${u.acc_lvl}`}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${u.is_active ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
                    }`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setModal({ open: true, item: u })}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}

      {!loading && <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {users.length}</p>}
    </AdminLayout>
  );
};

export default UserPage;