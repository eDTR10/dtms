import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Plus, ChevronDown, Send } from "lucide-react";
import UserLayout from "./UserLayout";
import { documentApi, officeApi, userApi, templateApi, Office, SignatoryUser, Document } from "../../services/api";

interface SignatoryEntry {
  user_id: number;
  user_email: string;
  user_name: string;
  order: number;
}

const ACC_LEVEL_LABELS: Record<number, string> = {
  0: "Super Admin",
  1: "Admin",
  2: "Manager",
  3: "Signatory",
  4: "Staff",
};

const SendDocument = () => {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();

  const [doc, setDoc]           = useState<Document | null>(null);
  const [offices, setOffices]   = useState<Office[]>([]);
  const [users, setUsers]       = useState<SignatoryUser[]>([]);
  const [toOffice, setToOffice] = useState<string>("");
  const [userPage, setUserPage]   = useState(0);
  const PAGE_SIZE = 8;
  const handleOfficeChange = (val: string) => {
    setToOffice(val);
    setUserSearch("");   // clear search when office changes
    setUserPage(0);
  };
  const [signatories, setSignatories] = useState<SignatoryEntry[]>([]);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [userSearch, setUserSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      documentApi.get(Number(id), controller.signal),
      officeApi.list(controller.signal),
      userApi.signatories(controller.signal),
    ]).then(([d, o, u]) => {
      setDoc(d);
      setOffices(o);
      setUsers(u);
      // Pre-populate signatories from template routing
      if (d.template) {
        templateApi.get(d.template, controller.signal).then(tmpl => {
          if (tmpl.routing && tmpl.routing.length > 0) {
            setSignatories(
              tmpl.routing.map((step, i) => ({
                user_id:    step.user_id,
                user_email: step.user_email,
                user_name:  step.user_name,
                order:      i,
              }))
            );
            setFromTemplate(true);
          }
        }).catch(() => {});
      }
    }).catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  const addSignatory = (user: SignatoryUser) => {
    if (signatories.some(s => s.user_id === user.id)) return;
    setSignatories(prev => [
      ...prev,
      {
        user_id:    user.id,
        user_email: user.email,
        user_name:  `${user.first_name} ${user.last_name}`,
        order:      prev.length,
      },
    ]);
  };

  const removeSignatory = (userId: number) => {
    setSignatories(prev =>
      prev.filter(s => s.user_id !== userId)
          .map((s, i) => ({ ...s, order: i }))
    );
  };

  const handleSend = async () => {
    if (signatories.length === 0) { setError("Please add at least one signatory."); return; }
    setSending(true);
    try {
      await documentApi.send(Number(id), {
        ...(toOffice ? { to_office: Number(toOffice) } : {}),
        signatories,
      });
      navigate("/dtms/user/documents");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!toOffice) return false;
    if (u.office_id !== Number(toOffice)) return false;
    if (signatories.some(s => s.user_id === u.id)) return false;
    const q = userSearch.toLowerCase();
    if (!q) return true;
    return (
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
      u.position.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });
  const totalPages  = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const pagedUsers  = filteredUsers.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);
  // reset page when search changes
  const handleUserSearch = (q: string) => { setUserSearch(q); setUserPage(0); };

  if (loading) return (
    <UserLayout title="Send Document">
      <div className="space-y-3 max-w-2xl">
        {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-accent/40 animate-pulse" />)}
      </div>
    </UserLayout>
  );

  return (
    <UserLayout title="Send Document" subtitle={`Route "${doc?.title}" to an office for signing`}>
      <div className="max-w-2xl space-y-5">

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* Document info card */}
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{doc?.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{doc?.tracknumber} · {doc?.type}</p>
          </div>
        </div>

        {/* Destination office */}
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Destination Office</h3>
          <div className="relative">
            <select value={toOffice} onChange={e => handleOfficeChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition">
              <option value="">— Select office —</option>
              {offices.map(o => <option key={o.officeID} value={o.officeID}>{o.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Signatories */}
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Assign Signatories
            {fromTemplate && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                pre-filled from template
              </span>
            )}
          </h3>

          {/* Search users */}
          <input type="text" placeholder={toOffice ? "Search by name, position..." : "Select an office first"}
            value={userSearch} onChange={e => handleUserSearch(e.target.value)}
            disabled={!toOffice}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed" />

          {/* User list */}
          {toOffice && (
            <div className="border border-border rounded-lg overflow-hidden">
              {filteredUsers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {userSearch ? "No users match your search" : "No available users in this office"}
                </p>
              ) : (
                <>
                  {pagedUsers.map(u => (
                    <button key={u.id} onClick={() => addSignatory(u)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-accent text-left border-b border-border last:border-0 transition">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                        {u.first_name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.position || u.email} · {ACC_LEVEL_LABELS[u.acc_lvl] ?? `Level ${u.acc_lvl}`}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-accent/30">
                      <span className="text-xs text-muted-foreground">
                        {userPage * PAGE_SIZE + 1}–{Math.min((userPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setUserPage(p => p - 1)}
                          disabled={userPage === 0}
                          className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition">
                          ‹ Prev
                        </button>
                        <button
                          onClick={() => setUserPage(p => p + 1)}
                          disabled={userPage >= totalPages - 1}
                          className="px-2.5 py-1 rounded text-xs border border-border bg-background hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition">
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Selected signatories */}
          {signatories.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected ({signatories.length})</p>
              {signatories.map((s, i) => (
                <div key={s.user_id} className="flex items-center gap-3 bg-accent/50 rounded-lg px-4 py-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.user_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.user_email}</p>
                  </div>
                  <button onClick={() => removeSignatory(s.user_id)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            <Send className="w-4 h-4" />
            {sending ? "Sending..." : "Send for Signing"}
          </button>
        </div>
      </div>
    </UserLayout>
  );
};

export default SendDocument;
