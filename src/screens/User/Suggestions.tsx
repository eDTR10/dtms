import { useEffect, useState } from "react";
import { suggestionApi, Suggestion } from "../../services/api";
import { Plus, X, Upload, MessageSquare, ImageIcon, Eye, Loader2, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import UserLayout from "./UserLayout";

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [viewSuggestion, setViewSuggestion] = useState<Suggestion | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append("text", newText);
    if (newImage) formData.append("image", newImage);

    try {
      await suggestionApi.create(formData);
      setIsModalOpen(false);
      setNewText("");
      setNewImage(null);
      fetchSuggestions();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you really want to delete this suggestion? This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
    });

    if (result.isConfirmed) {
      try {
        await suggestionApi.delete(id);
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to delete the suggestion.", "error");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "In Progress": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "Implemented": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "Rejected": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <UserLayout title="Suggestions" subtitle="Submit your feedback and view admin responses.">
      <div className="w-full text-accent-foreground max-w-6xl mx-auto z-0 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-4 md:flex-col md:items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              My Suggestions
            </h1>
            <p className="text-muted-foreground mt-1">Track your feedback and view responses from the eDTMS Dev team.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            <Plus className="w-4 h-4" />
            Submit Feedback
          </button>
        </div>

        {/* Table Content */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Loading your suggestions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <th className="p-5 w-1/2">Message Preview</th>
                    <th className="p-5">Submitted Date</th>
                    <th className="p-5 text-center">Status</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {suggestions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                          <p className="text-muted-foreground">You haven't submitted any suggestions yet.</p>
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-sm font-medium text-primary hover:underline mt-2"
                          >
                            Click here to submit your first one.
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    suggestions.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 border border-border/50">
                                <ImageIcon className="w-4 h-4 text-primary" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 border border-border/50">
                                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground line-clamp-1 font-medium group-hover:text-primary transition-colors">
                                {item.text}
                              </p>
                              {item.admin_comment && (
                                <p className="text-[11px] text-green-600 font-semibold mt-1 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Admin replied
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-5 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="p-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap inline-block shadow-sm ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewSuggestion(item)}
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg"
                            >
                              <Eye className="w-4 h-4" /> View
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex items-center gap-1.5 text-sm font-bold text-destructive hover:text-destructive/80 transition-colors bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* View Details Modal */}
        {viewSuggestion && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 border border-border/50">
              <div className="relative p-6 border-b border-border/50 overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Suggestion Details</h2>
                    <p className="text-xs text-muted-foreground mt-1">Submitted on {new Date(viewSuggestion.created_at).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => setViewSuggestion(null)}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Current Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getStatusColor(viewSuggestion.status)}`}>
                    {viewSuggestion.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Your Message
                  </h3>
                  <div className="bg-background border border-border/50 rounded-xl p-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap shadow-sm">
                    {viewSuggestion.text}
                  </div>
                </div>

                {viewSuggestion.image && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Attachment
                    </h3>
                    <div className="rounded-xl overflow-hidden border border-border shadow-sm max-w-max">
                      <img
                        src={viewSuggestion.image}
                        alt="Attachment"
                        className="max-h-[300px] object-cover"
                      />
                    </div>
                  </div>
                )}

                {viewSuggestion.admin_comment && (
                  <div className="space-y-3 pt-6 border-t border-border/50">
                    <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Admin Response
                    </h3>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 text-sm leading-relaxed text-blue-900 dark:text-blue-200 whitespace-pre-wrap shadow-sm">
                      {viewSuggestion.admin_comment}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border bg-accent/20 flex justify-end rounded-b-2xl">
                <button
                  onClick={() => setViewSuggestion(null)}
                  className="px-6 py-2.5 bg-background border border-border text-foreground flex items-center gap-2 text-sm font-bold rounded-xl hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Suggestion Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-border/50">
              <div className="relative p-6 border-b border-border/50 overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="flex items-center justify-between relative z-10">
                  <h2 className="text-xl font-bold text-foreground">Submit a Suggestion</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted p-2 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Message</label>
                  <textarea
                    required
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="w-full bg-background border border-input rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[140px] resize-y"
                    placeholder="Describe your suggestion, concern, or feedback here..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Attach an Image (Optional)</label>
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-input rounded-xl cursor-pointer bg-accent/30 hover:bg-accent/60 transition-colors group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      <p className="mb-2 text-sm text-muted-foreground text-center px-4">
                        <span className="font-bold text-primary">Click to upload</span> or drag and drop
                      </p>
                      {newImage && <p className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{newImage.name}</p>}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setNewImage(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !newText.trim()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2"
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Submitting...</>
                    ) : (
                      "Submit Suggestion"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
