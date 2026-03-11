import { useEffect, useState } from "react";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { officeApi, Office } from "../../services/api";
import { TableSkeleton } from "./Skeleton";

const OfficeModal = ({
  initial,
  onSave,
  onClose,
}: {
  initial?: Office;
  onSave: (data: Partial<Office>) => Promise<void>;
  onClose: () => void;
}) => {
  const blank: Partial<Office> = {
    name: "", officeMail: "", street: "", city: "", province: "", region: "",
  };
  const [form, setForm] = useState<Partial<Office>>(initial ?? blank);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const change = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name?.trim()) { setError("Office name is required."); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.name?.[0] || "Failed to save office.");
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof Office; label: string; type?: string }> = [
    { key: "name",       label: "Office Name" },
    { key: "officeMail", label: "Email",   type: "email" },
    { key: "street",     label: "Street" },
    { key: "city",       label: "City" },
    { key: "province",   label: "Province" },
    { key: "region",     label: "Region" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{initial ? "Edit Office" : "New Office"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
          {fields.map(f => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{f.label}</label>
              <input name={f.key} type={f.type ?? "text"} value={(form as any)[f.key] ?? ""}
                onChange={change}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {saving ? "Saving..." : "Save Office"}
          </button>
        </div>
      </div>
    </div>
  );
};

const OfficesPage = () => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState<{ open: boolean; item?: Office }>({ open: false });

  const load = (signal?: AbortSignal) => {
    setLoading(true);
    officeApi.list(signal)
      .then(setOffices)
      .catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSave = async (data: Partial<Office>) => {
    if (modal.item) {
      await officeApi.update(modal.item.officeID, data);
    } else {
      await officeApi.create(data);
    }
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this office?")) return;
    await officeApi.delete(id);
    load();
  };

  const filtered = offices.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Offices" subtitle="Manage system offices">

      {modal.open && (
        <OfficeModal
          initial={modal.item}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      )}

      <div className="flex items-center gap-3 mb-5 sm:flex-col sm:items-stretch">
        <div className="relative flex-1 max-w-xs sm:max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search offices..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition" />
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition ml-auto sm:ml-0">
          <Plus className="w-4 h-4" /> Add Office
        </button>
      </div>

      {loading ? <TableSkeleton rows={6} /> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide md:grid-cols-[2fr_1fr_auto]">
            <span>Office</span>
            <span className="md:hidden">Region</span>
            <span>Email</span>
            <span>Actions</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">No offices found.</div>
          ) : (
            filtered.map(o => (
              <div key={o.officeID}
                className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors md:grid-cols-[2fr_1fr_auto]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.city}, {o.province}</p>
                </div>
                <p className="text-sm text-muted-foreground truncate md:hidden">{o.region}</p>
                <p className="text-sm text-muted-foreground truncate">{o.officeMail}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setModal({ open: true, item: o })}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(o.officeID)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {!loading && <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {offices.length}</p>}
    </AdminLayout>
  );
};

export default OfficesPage;
