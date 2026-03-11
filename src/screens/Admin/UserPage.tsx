import { useEffect, useState } from "react";
import { Search, Plus, Pencil, X, ChevronDown } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { TableSkeleton } from "./Skeleton";
import { userApi, officeApi, UserProfile, Office } from "../../services/api";

const ACC_LEVELS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Super Admin" },
  { value: 1, label: "Admin" },
  { value: 2, label: "Manager" },
  { value: 3, label: "Signatory" },
  { value: 4, label: "Staff" },
];

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
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name:  initial?.last_name  ?? "",
    email:      initial?.email      ?? "",
    position:   initial?.position   ?? "",
    office:     String(initial?.office ?? ""),
    acc_lvl:    String(initial?.acc_lvl ?? 4),
    is_active:  initial?.is_active  ?? true,
    password:   "",
    re_password:"",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

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
    if (!initial && (!form.password || form.password !== form.re_password)) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        first_name: form.first_name,
        last_name:  form.last_name,
        email:      form.email,
        position:   form.position,
        office:     Number(form.office),
        acc_lvl:    Number(form.acc_lvl),
        is_active:  form.is_active,
      };
      if (form.password) {
        payload.password    = form.password;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{initial ? "Edit User" : "Add User"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
          {([
            { name: "first_name", label: "First Name" },
            { name: "last_name",  label: "Last Name" },
            { name: "email",      label: "Email", type: "email" },
            { name: "position",   label: "Position" },
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

          {/* Password (required for create) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Password {initial && <span className="text-muted-foreground font-normal">(leave blank to keep)</span>}</label>
            <input name="password" type="password" value={form.password} onChange={change}
              placeholder={initial ? "Leave blank to keep current" : "Password"}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <input name="re_password" type="password" value={form.re_password} onChange={change}
              placeholder="Re-enter password"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
          </div>
        </div>

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

// ── Main Page ─────────────────────────────────────────────────────────────────
const UserPage = () => {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [offices, setOffices]   = useState<Office[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [modal, setModal]       = useState<{ open: boolean; item?: UserProfile }>({ open: false });

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

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const officeMap = Object.fromEntries(offices.map(o => [o.officeID, o.name]));

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

      <div className="flex items-center justify-between gap-3 mb-5 sm:flex-col sm:items-stretch">
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

      {loading ? <TableSkeleton rows={6} /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide slg:grid-cols-[2fr_1fr_auto]">
            <span>User</span>
            <span className="slg:hidden">Office</span>
            <span className="slg:hidden">Level</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            filtered.map(u => (
              <div key={u.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors slg:grid-cols-[2fr_1fr_auto]">
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
                <span className="text-sm text-foreground slg:hidden">{ACC_LABEL_MAP[u.acc_lvl] ?? `Level ${u.acc_lvl}`}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${
                  u.is_active ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
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
      )}

      {!loading && <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {users.length}</p>}
    </AdminLayout>
  );
};

export default UserPage;
