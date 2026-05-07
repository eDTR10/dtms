import { useEffect, useState } from "react";
import {
    Search, Plus, Pencil, Trash2, X, CheckCircle2,
    GitBranch, Link2, Link2Off, GripVertical,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
    templateApi, templateRoutingApi,
    officeApi, userApi,
    DocumentTemplate, TemplateRouting, Office, SignatoryUser,
} from "../../services/api";
import { TableSkeleton } from "./Skeleton";

// ── Details modal ─────────────────────────────────────────────────────────────
const DetailsModal = ({
    initial,
    onSave,
    onClose,
}: {
    initial?: DocumentTemplate;
    onSave: (name: string, description: string) => Promise<void>;
    onClose: () => void;
}) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [desc, setDesc] = useState(initial?.description ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!name.trim()) { setError("Name is required."); return; }
        setSaving(true);
        try {
            await onSave(name.trim(), desc.trim());
            onClose();
        } catch (err: any) {
            setError(err?.response?.data?.name?.[0] || "Failed to save template.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-foreground">
                        {initial ? "Edit Template" : "New Template"}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Name <span className="text-destructive">*</span>
                        </label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="Template name"
                            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-foreground">Template URL</label>
                        <textarea
                            value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                            placeholder="Optional: URL or description for this template"
                            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
                        {saving ? "Saving..." : "Save Template"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── reorderSteps ──────────────────────────────────────────────────────────────
// Moves the step at fromIdx (and any parallel siblings) to the position of
// toIdx, preserving all other parallel groupings.
// Returns a new array with order values renumbered 0, 1, 2, ...
function reorderSteps(
    steps: TemplateRouting[],
    fromIdx: number,
    toIdx: number,
): TemplateRouting[] {
    if (fromIdx === toIdx) return steps;

    // 1. Group consecutive same-order rows into "slots".
    const slots: TemplateRouting[][] = [];
    for (const s of steps) {
        const last = slots[slots.length - 1];
        if (last && last[0].order === s.order) {
            last.push(s);
        } else {
            slots.push([s]);
        }
    }

    // 2. Build flat-row-index -> slot-index map.
    const rowToSlot: number[] = [];
    slots.forEach((slot, si) => slot.forEach(() => rowToSlot.push(si)));

    const fromSlot = rowToSlot[fromIdx];
    const toSlot = rowToSlot[toIdx];

    // Same slot = no move needed.
    if (fromSlot === toSlot) return steps;

    // 3. Remove the dragged slot.
    const rest = slots.filter((_, i) => i !== fromSlot);

    // After removing fromSlot, all indices above it shift down by 1.
    const adjustedTo = toSlot > fromSlot ? toSlot - 1 : toSlot;

    // Insert before or after the target slot.
    const insertAt = toIdx > fromIdx
        ? adjustedTo + 1  // dragged downward: place after target slot
        : adjustedTo;     // dragged upward:   place before target slot

    rest.splice(Math.max(0, Math.min(insertAt, rest.length)), 0, slots[fromSlot]);

    // 4. Renumber: each slot gets its index as the order value.
    const result: TemplateRouting[] = [];
    rest.forEach((slot, slotIdx) => {
        slot.forEach(s => result.push({ ...s, order: slotIdx }));
    });

    return result;
}

// ── Routing modal ─────────────────────────────────────────────────────────────
const RoutingModal = ({
    template,
    onClose,
}: {
    template: DocumentTemplate;
    onClose: () => void;
}) => {
    const [steps, setSteps] = useState<TemplateRouting[]>(template.routing ?? []);
    const [offices, setOffices] = useState<Office[]>([]);
    const [allUsers, setAllUsers] = useState<SignatoryUser[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [pickerMode, setPickerMode] = useState<"project" | "search">("project");
    const [addProject, setAddProject] = useState<string>("");
    const [projectSearch, setProjectSearch] = useState<string>("");
    const [addSearch, setAddSearch] = useState<string>("");
    const [addPage, setAddPage] = useState(0);
    const [addFilesToSign, setAddFilesToSign] = useState<string>("all");
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    // Visual-only drag state. The actual fromIdx travels in dataTransfer.
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    useEffect(() => {
        const ctrl = new AbortController();
        Promise.all([
            officeApi.list(ctrl.signal),
            userApi.signatories(ctrl.signal),
        ]).then(([o, u]) => {
            setOffices(o);
            setAllUsers(u);
        }).catch(() => { }).finally(() => setLoadingMeta(false));
        return () => ctrl.abort();
    }, []);

    const filteredUsers = allUsers.filter(u => {
        if (steps.some(s => s.user_id === u.id)) return false;
        if (pickerMode === "project") {
            if (!addProject) return false;
            const selectedId = Number(addProject);
            return u.project_ids?.includes(selectedId) || u.office_id === selectedId;
        }
        const q = addSearch.toLowerCase();
        if (!q) return true;
        return (
            `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
            u.position.toLowerCase().includes(q) ||
            (u.office_name || "").toLowerCase().includes(q)
        );
    });

    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
    const pagedUsers = filteredUsers.slice(addPage * PAGE_SIZE, (addPage + 1) * PAGE_SIZE);

    const handleAdd = async (user: SignatoryUser, role: "signer" | "viewer") => {
        const officeName = user.office_name || "Unknown Office";
        const officeId = user.office_id || 0;
        setAdding(true);
        try {
            const nextOrder = steps.length === 0 ? 0 : Math.max(...steps.map(s => s.order)) + 1;
            const step = await templateRoutingApi.add(template.id, {
                order: nextOrder,
                role: role,
                office_id: officeId,
                office_name: officeName,
                user_id: user.id,
                user_name: `${user.first_name} ${user.last_name}`,
                user_email: user.email,
                user_position: user.position,
                files_to_sign: addFilesToSign,
            });
            setSteps(prev => [...prev, step]);
            setAddFilesToSign("all");
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (step: TemplateRouting) => {
        await templateRoutingApi.remove(template.id, step.id);
        setSteps(prev => prev.filter(s => s.id !== step.id));
    };

    const toggleParallel = async (index: number) => {
        const next = steps.map(s => ({ ...s }));
        const above = next[index - 1];
        const curr = next[index];
        const updates: { id: number; order: number }[] = [];
        if (curr.order === above.order) {
            for (let j = index; j < next.length; j++) {
                if (next[j].order >= curr.order) {
                    next[j].order += 1;
                    updates.push({ id: next[j].id, order: next[j].order });
                }
            }
        } else {
            const diff = curr.order - above.order;
            for (let j = index; j < next.length; j++) {
                next[j].order -= diff;
                updates.push({ id: next[j].id, order: next[j].order });
            }
        }
        setSteps(next);
        await Promise.all(updates.map(u => templateRoutingApi.reorder(template.id, u.id, u.order)));
    };

    // ── Drag handlers ────────────────────────────────────────────────────────
    // fromIdx is carried in dataTransfer so it survives across event boundaries.
    // onDragEnd fires after onDrop in all major browsers, so we must NOT rely on
    // a ref that onDragEnd clears before onDrop reads it.

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
        setDraggingIdx(idx);
        // Off-screen ghost so the browser does not render a default copy.
        const ghost = document.createElement("div");
        ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        requestAnimationFrame(() => ghost.remove());
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverIdx !== idx) setDragOverIdx(idx);
    };

    const handleDragEnd = () => {
        setDraggingIdx(null);
        setDragOverIdx(null);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>, toIdx: number) => {
        e.preventDefault();
        e.stopPropagation();

        // Read fromIdx from the payload — always available here even if
        // handleDragEnd already fired.
        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);

        setDraggingIdx(null);
        setDragOverIdx(null);

        if (isNaN(fromIdx) || fromIdx === toIdx) return;

        const prevSteps = steps;
        const newSteps = reorderSteps(steps, fromIdx, toIdx);

        // reorderSteps returns the original reference when nothing changed.
        if (newSteps === prevSteps) return;

        // Optimistic UI update.
        setSteps(newSteps);

        // Persist only the steps whose order value actually changed.
        setSaving(true);
        try {
            const prevMap = new Map(prevSteps.map(s => [s.id, s.order]));
            const changed = newSteps.filter(s => s.order !== prevMap.get(s.id));
            await Promise.all(
                changed.map(s => templateRoutingApi.reorder(template.id, s.id, s.order))
            );
        } finally {
            setSaving(false);
        }
    };

    // Derived display helpers.
    const uniqueOrders = [...new Set(steps.map(s => s.order))].sort((a, b) => a - b);
    const stepNum = (order: number) => uniqueOrders.indexOf(order) + 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">
                            Routing Steps
                            {saving && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal animate-pulse">
                                    Saving...
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{template.name}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Steps list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-0">
                    {steps.length === 0 ? (
                        <div className="text-center py-10">
                            <GitBranch className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No routing steps yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">Add steps below to define the signing queue.</p>
                        </div>
                    ) : (
                        steps.map((step, i) => {
                            const isParallelWithAbove = i > 0 && step.order === steps[i - 1].order;
                            const isBeingDragged = draggingIdx === i;
                            const isDropTarget = dragOverIdx === i && draggingIdx !== i;

                            return (
                                <div key={step.id}>
                                    {/* Parallel / sequential pill between rows */}
                                    {i > 0 && (
                                        <div className="flex items-center justify-center h-6">
                                            <button
                                                type="button"
                                                title={
                                                    isParallelWithAbove
                                                        ? "Click to sign separately (after above)"
                                                        : "Click to sign at the same time as above"
                                                }
                                                onClick={() => toggleParallel(i)}
                                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${isParallelWithAbove
                                                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25"
                                                        : "bg-accent text-muted-foreground hover:text-foreground"
                                                    }`}
                                            >
                                                {isParallelWithAbove
                                                    ? <><Link2 className="w-3 h-3" /> parallel &mdash; click to separate</>
                                                    : <><Link2Off className="w-3 h-3" /> sequential &mdash; click to parallelize</>
                                                }
                                            </button>
                                        </div>
                                    )}

                                    {/* Step row */}
                                    <div
                                        draggable
                                        onDragStart={e => handleDragStart(e, i)}
                                        onDragOver={e => handleDragOver(e, i)}
                                        onDragEnd={handleDragEnd}
                                        onDrop={e => handleDrop(e, i)}
                                        className={[
                                            "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all select-none",
                                            isBeingDragged
                                                ? "opacity-30 scale-[0.98] border-dashed border-primary/50 bg-primary/5"
                                                : isDropTarget
                                                    ? "border-primary bg-primary/10 shadow-md scale-[1.01]"
                                                    : isParallelWithAbove
                                                        ? "border-blue-500/30 bg-blue-500/5"
                                                        : "border-border bg-background",
                                        ].join(" ")}
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />

                                        <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${isParallelWithAbove ? "bg-blue-500 text-white" : "bg-primary/10 text-primary"
                                            }`}>
                                            {stepNum(step.order)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{step.user_name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {step.office_name}{step.user_position ? ` · ${step.user_position}` : ""}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-1 items-end shrink-0">
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${step.role === "viewer"
                                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                                    : "bg-primary/10 text-primary"
                                                }`}>
                                                {step.role === "viewer" ? "Viewer" : "Signer"}
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="Files (e.g. all or 1,2)"
                                                value={step.files_to_sign || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, files_to_sign: val } : s));
                                                }}
                                                onBlur={async (e) => {
                                                    const finalVal = e.target.value || "all";
                                                    setSteps(prev => prev.map(s => s.id === step.id ? { ...s, files_to_sign: finalVal } : s));
                                                    await templateRoutingApi.update(template.id, step.id, { files_to_sign: finalVal });
                                                }}
                                                className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        <button
                                            onClick={() => handleRemove(step)}
                                            className="p-1 rounded text-muted-foreground hover:text-destructive transition shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Add step form */}
                <div className="px-6 pb-5 pt-3 border-t border-border shrink-0 overflow-y-auto max-h-[50vh]">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Add a Step</p>
                    {loadingMeta ? (
                        <p className="text-xs text-muted-foreground">Loading offices &amp; users...</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Files to Sign */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground flex items-center gap-2">
                                    Files to assign to next signatory
                                    <span className="text-[10px] text-muted-foreground font-normal normal-case">(default: all)</span>
                                </label>
                                <input
                                    value={addFilesToSign} onChange={e => setAddFilesToSign(e.target.value)}
                                    placeholder="e.g. all or 1,2"
                                    className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                                />
                            </div>

                            {/* Signatory picker — dual mode */}
                            <div className="border border-border rounded-xl bg-background/50 mt-1">
                                {/* Mode tabs */}
                                <div className="flex border-b border-border rounded-t-xl overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => { setPickerMode("project"); setAddPage(0); }}
                                        className={`flex-1 py-2 text-xs font-semibold transition ${pickerMode === "project"
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent"
                                            }`}
                                    >
                                        Browse by Office/Project
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPickerMode("search"); setAddPage(0); }}
                                        className={`flex-1 py-2 text-xs font-semibold transition ${pickerMode === "search"
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent"
                                            }`}
                                    >
                                        Search by Name
                                    </button>
                                </div>

                                <div className="p-4 flex flex-col gap-3">
                                    {/* Filter control */}
                                    {pickerMode === "project" ? (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Search office/project..."
                                                value={projectSearch}
                                                onChange={e => {
                                                    setProjectSearch(e.target.value);
                                                    setAddProject("");
                                                    setAddPage(0);
                                                }}
                                                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                                            />

                                            {/* Office/Project list */}
                                            {!addProject && (
                                                <div className="border border-border rounded-lg overflow-hidden max-h-[160px] overflow-y-auto">
                                                    {(() => {
                                                        const filtered = offices.filter(o =>
                                                            !projectSearch || o.name.toLowerCase().includes(projectSearch.toLowerCase())
                                                        );
                                                        return filtered.length === 0 ? (
                                                            <p className="px-4 py-3 text-sm text-muted-foreground">No offices/projects match</p>
                                                        ) : filtered.map(o => (
                                                            <button
                                                                key={o.officeID}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAddProject(String(o.officeID));
                                                                    setProjectSearch(o.name);
                                                                    setAddPage(0);
                                                                }}
                                                                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent text-left border-b border-border last:border-0 transition"
                                                            >
                                                                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                                                    {o.name.slice(0, 1)}
                                                                </div>
                                                                <span className="text-sm text-foreground">{o.name}</span>
                                                            </button>
                                                        ));
                                                    })()}
                                                </div>
                                            )}

                                            {/* Clear selection chip */}
                                            {addProject && (
                                                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                                                    <span className="text-xs font-medium text-primary truncate">{projectSearch}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setAddProject(""); setProjectSearch(""); setAddPage(0); }}
                                                        className="ml-2 p-0.5 rounded text-muted-foreground hover:text-destructive transition shrink-0"
                                                        title="Clear project"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Search by name, position, or office..."
                                            value={addSearch}
                                            onChange={e => { setAddSearch(e.target.value); setAddPage(0); }}
                                            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                                        />
                                    )}

                                    {/* User list */}
                                    <div className="border border-border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                                        {pickerMode === "project" && !addProject ? (
                                            <p className="px-4 py-3 text-sm text-muted-foreground">Select an office/project above to see its members</p>
                                        ) : filteredUsers.length === 0 ? (
                                            <p className="px-4 py-3 text-sm text-muted-foreground">
                                                {pickerMode === "search" && addSearch
                                                    ? "No users match your search"
                                                    : "No available users to assign"}
                                            </p>
                                        ) : (
                                            <>
                                                {pagedUsers.map(u => (
                                                    <div key={u.id} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent text-left border-b border-border last:border-0 transition">
                                                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                                            {u.first_name.slice(0, 1)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{u.position || u.email}</p>
                                                            {u.office_name && (
                                                                <p className="text-[11px] text-muted-foreground/80 truncate">
                                                                    {u.office_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                disabled={adding}
                                                                title="Add as Signer"
                                                                onClick={() => handleAdd(u, "signer")}
                                                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50"
                                                            >
                                                                <Plus className="w-3 h-3" /> Signer
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={adding}
                                                                title="Add as Viewer"
                                                                onClick={() => handleAdd(u, "viewer")}
                                                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-50"
                                                            >
                                                                <Plus className="w-3 h-3" /> Viewer
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {totalPages > 1 && (
                                                    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-accent/30">
                                                        <span className="text-xs text-muted-foreground">{addPage * PAGE_SIZE + 1}–{Math.min((addPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</span>
                                                        <div className="flex gap-1">
                                                            <button type="button" onClick={() => setAddPage(p => p - 1)} disabled={addPage === 0}
                                                                className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">‹ Prev</button>
                                                            <button type="button" onClick={() => setAddPage(p => p + 1)} disabled={addPage >= totalPages - 1}
                                                                className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 transition">Next ›</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const TemplatesPage = () => {
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleted, setDeleted] = useState<number | null>(null);

    const [detailsModal, setDetailsModal] = useState<{ open: boolean; item?: DocumentTemplate }>({ open: false });
    const [routingModal, setRoutingModal] = useState<DocumentTemplate | null>(null);

    const load = (signal?: AbortSignal) => {
        setLoading(true);
        templateApi.list(signal)
            .then(setTemplates)
            .catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, []);

    const handleSave = async (name: string, description: string) => {
        if (detailsModal.item) {
            await templateApi.update(detailsModal.item.id, { name, description });
        } else {
            await templateApi.create({ name, description });
        }
        load();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Delete this template and all its routing steps?")) return;
        await templateApi.delete(id);
        setDeleted(id);
        setTimeout(() => setDeleted(null), 1500);
        load();
    };

    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AdminLayout title="Templates" subtitle="Manage document templates and their signing routes">

            {detailsModal.open && (
                <DetailsModal
                    initial={detailsModal.item}
                    onSave={handleSave}
                    onClose={() => setDetailsModal({ open: false })}
                />
            )}

            {routingModal && (
                <RoutingModal
                    template={routingModal}
                    onClose={() => { setRoutingModal(null); load(); }}
                />
            )}

            <div className="flex items-center gap-3 mb-5 sm:flex-col sm:items-stretch">
                <div className="relative flex-1 max-w-xs sm:max-w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="Search templates..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
                </div>
                <button onClick={() => setDetailsModal({ open: true })}
                    className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition ml-auto sm:ml-0">
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            {loading ? <TableSkeleton rows={5} /> : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[2fr_80px_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <span>Template</span>
                        <span className="text-center">Steps</span>
                        <span className="md:hidden">Created</span>
                        <span>Actions</span>
                    </div>
                    {filtered.length === 0 ? (
                        <div className="px-5 py-12 text-center text-sm text-muted-foreground">No templates found.</div>
                    ) : (
                        filtered.map(t => (
                            <div key={t.id}
                                className="grid grid-cols-[2fr_80px_1fr_auto] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                                </div>

                                <div className="flex justify-center">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${(t.routing?.length ?? 0) > 0
                                            ? "bg-primary/10 text-primary"
                                            : "bg-muted text-muted-foreground"
                                        }`}>
                                        <GitBranch className="w-3 h-3" />
                                        {t.routing?.length ?? 0}
                                    </span>
                                </div>

                                <p className="text-sm text-muted-foreground md:hidden">
                                    {new Date(t.created_at).toLocaleDateString()}
                                </p>

                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => setRoutingModal(t)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors" title="Edit routing steps">
                                        <GitBranch className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setDetailsModal({ open: true, item: t })}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Edit details">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors" title="Delete">
                                        {deleted === t.id ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {!loading && <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {templates.length}</p>}
        </AdminLayout>
    );
};

export default TemplatesPage;