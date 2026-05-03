import { useEffect, useState } from "react";
import { suggestionApi, Suggestion } from "../../services/api";
import { MessageSquare, Image as ImageIcon,  Check, X, GripVertical } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const [status, setStatus] = useState<Suggestion["status"]>("Pending");
  const [comment, setComment] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const data = await suggestionApi.list();
      setSuggestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (s: Suggestion) => {
    setSelectedSuggestion(s);
    setStatus(s.status);
    setComment(s.admin_comment || "");
  };

  const handleUpdate = async () => {
    if (!selectedSuggestion) return;
    setUpdating(true);
    try {
      await suggestionApi.update(selectedSuggestion.id, {
        status,
        admin_comment: comment,
      });
      setSelectedSuggestion(null);
      fetchSuggestions();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  // ── Kanban Drag and Drop Handlers ──────────────────────────────────────────

  const [dragOverStatus, setDragOverStatus] = useState<Suggestion["status"] | null>(null);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData("suggestionId", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: Suggestion["status"]) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Suggestion["status"]) => {
    e.preventDefault();
    setDragOverStatus(null);
    const id = parseInt(e.dataTransfer.getData("suggestionId"), 10);
    if (!id) return;

    const item = suggestions.find((s) => s.id === id);
    if (!item || item.status === newStatus) return;

    // Optimistic UI update
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));

    try {
      await suggestionApi.update(id, { status: newStatus });
      // optionally fetchSuggestions() again to ensure sync, but optimistic is usually fine
    } catch (err) {
      console.error(err);
      fetchSuggestions(); // Revert on error
    }
  };

  // ── Rendering Columns ──────────────────────────────────────────────────────
  const COLUMNS: { title: string; status: Suggestion["status"]; color: string }[] = [
    { title: "Pending", status: "Pending", color: "bg-yellow-500/10 border-yellow-500/20 text-yellow-600" },
    { title: "In Progress", status: "In Progress", color: "bg-blue-500/10 border-blue-500/20 text-blue-600" },
    { title: "Implemented", status: "Implemented", color: "bg-green-500/10 border-green-500/20 text-green-600" },
    { title: "Rejected", status: "Rejected", color: "bg-red-500/10 border-red-500/20 text-red-600" },
  ];

  return (
    <AdminLayout title="Suggestions & Concerns" subtitle="Review, respond, and drag-and-drop feedback across stages.">
      <div className="w-full h-[calc(100vh-120px)] flex flex-col gap-6 max-w-[1400px] mx-auto text-accent-foreground">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" />
            Suggestions & Concerns
          </h1>
          <p className="text-muted-foreground mt-1">Review, respond, and drag-and-drop feedback across stages.</p>
        </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading suggestions...</div>
      ) : (
        <div className="flex-1 overflow-hidden grid grid-cols-4 slg:grid-cols-2 md:grid-cols-1 gap-6">
          {COLUMNS.map((col) => {
            const columnItems = suggestions.filter((s) => s.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.status)}
                className={`flex flex-col h-full max-h-full overflow-hidden border rounded-2xl transition-all duration-200 ${
                  dragOverStatus === col.status
                    ? "bg-primary/5 border-primary border-2 shadow-inner"
                    : "bg-muted/30 border-border/50 shadow-inner hover:bg-muted/40"
                }`}
              >
                <div className={`p-4 border-b border-border/50 ${col.color} flex items-center justify-between sticky top-0 z-10 backdrop-blur-md`}>
                  <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    {col.title}
                  </h3>
                  <span className="bg-background/50 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                    {columnItems.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-border">
                  {columnItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onClick={() => openModal(item)}
                      className="group bg-card border border-border shadow-sm rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold uppercase shrink-0">
                            {item.user_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.user_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{new Date(item.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-foreground line-clamp-3 leading-relaxed">
                        {item.text}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.image && <ImageIcon className="w-3.5 h-3.5 text-primary" />}
                          {item.admin_comment && <MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                        </div>
                        <span className="text-[10px] font-medium text-primary uppercase tracking-widest group-hover:underline">Review</span>
                      </div>
                    </div>
                  ))}
                  {columnItems.length === 0 && (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl p-8 text-center text-sm text-muted-foreground">
                      Drop items here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSuggestion && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 border border-border/50">
            {/* Premium Header */}
            <div className="relative p-6 border-b border-border/50 overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Review Suggestion</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold uppercase">
                      {selectedSuggestion.user_name.charAt(0)}
                    </div>
                    <p className="text-sm font-medium text-foreground">{selectedSuggestion.user_name}</p>
                    <p className="text-xs text-muted-foreground ml-1">({selectedSuggestion.user_email})</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSuggestion(null)} 
                  className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {/* Message Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Message
                </h3>
                <div className="bg-accent/30 border border-border/50 rounded-xl p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap shadow-inner">
                  {selectedSuggestion.text}
                </div>
              </div>

              {/* Attachment Section */}
              {selectedSuggestion.image && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Attachment
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-border shadow-sm max-w-max">
                    <img 
                      src={selectedSuggestion.image} 
                      alt="Attachment" 
                      className="max-h-[300px] object-cover hover:scale-[1.02] transition-transform duration-300" 
                    />
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="pt-6 border-t border-border/50">
                <h3 className="text-lg font-bold text-foreground mb-4">Admin Response</h3>
                <div className="grid grid-cols-3 md:grid-cols-1 gap-6">
                  
                  <div className="space-y-2 col-span-1 md:col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full appearance-none bg-background border border-input rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm cursor-pointer"
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="In Progress">🚀 In Progress</option>
                        <option value="Implemented">✅ Implemented</option>
                        <option value="Rejected">❌ Rejected</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 px-1">Auto-emails user on save.</p>
                  </div>
                  
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comment (Optional)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Write your response to the user here..."
                      className="w-full bg-background border border-input rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[120px] resize-y"
                    />
                  </div>
                  
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-border bg-accent/20 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-6 py-2.5 bg-primary text-primary-foreground flex items-center gap-2 text-sm font-bold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {updating ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save Response
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
