import { useState, useEffect } from "react";
import { FileText, Download, Trash2, Upload, AlertTriangle, Loader2, Plus } from "lucide-react";
import { documentApi, DocumentFile, Document } from "../services/api";
import { useAuth } from "../screens/Auth/AuthContext";
import Swal from "sweetalert2";

interface DocumentFileListProps {
  document: Document;
  onFilesUpdated?: (files: DocumentFile[]) => void;
  onFileSelect?: (fileUrl: string) => void;
  selectedFileUrl?: string | null;
}

const DocumentFileList = ({ document, onFilesUpdated, onFileSelect, selectedFileUrl }: DocumentFileListProps) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<DocumentFile[]>(document.files || []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const isOwner = document.userID === user?.id;
  const mySig = document.signatories?.find(s => s.user_id === user?.id);
  const isSignatory = !!mySig;
  
  // Signatories can upload when it's their turn
  const canUpload = isOwner || (isSignatory && (mySig.status === 'pending' || mySig.status === 'signed'));

  useEffect(() => {
    if (document.files) {
      setFiles(document.files);
    }
  }, [document.files]);

  const handleFileUpload = async (filesToUpload: File[]) => {
    if (!canUpload) {
      setError("You don't have permission to upload files.");
      return;
    }

    setUploading(true);
    setError(null);

    for (const file of filesToUpload) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const newFile = await documentApi.uploadFile(document.id, fd);
        setFiles(prev => {
          const updated = [newFile, ...prev];
          onFilesUpdated?.(updated);
          return updated;
        });
      } catch (err: any) {
        setError(err?.response?.data?.detail || `Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
  };

  const handleDeleteFile = async (fileId: number) => {
    const result = await Swal.fire({
      title: "Delete file?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "hsl(var(--destructive))",
      cancelButtonColor: "hsl(var(--border))",
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
      background: "hsl(var(--card))",
      color: "hsl(var(--foreground))",
    });
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await documentApi.deleteFile(document.id, fileId);
      setFiles(prev => {
        const updated = prev.filter(f => f.id !== fileId);
        onFilesUpdated?.(updated);
        return updated;
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const getFileTypeLabel = (fileType: string) => {
    const labels: Record<string, string> = {
      original: "Original",
      signed: "Signed",
      signatory_upload: "Signatory Upload"
    };
    return labels[fileType] || fileType;
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case "original":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "signed":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "signatory_upload":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Documents ({files.length})
        </h3>
        {canUpload && (
          <button
            onClick={() => {
              const input = globalThis.document.querySelector('input[name="file-upload-doc"]') as HTMLInputElement;
              input?.click();
            }}
            disabled={uploading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload File
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-lg p-3">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading files...
        </div>
      )}

      {files.length === 0 && !loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No files yet</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {files.map((file, idx) => {
            const isSelected = selectedFileUrl === file.file_url;
            return (
            <div
              key={file.id}
              onClick={() => onFileSelect?.(file.file_url)}
              className={`flex items-center gap-3 px-4 py-3 ${idx !== 0 ? "border-t border-border" : ""} cursor-pointer transition group ${
                isSelected 
                  ? "bg-primary/10 border-l-2 border-l-primary" 
                  : "hover:bg-accent/50"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {file.file_url.split("/").pop()}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getFileTypeColor(file.file_type)}`}>
                    {getFileTypeLabel(file.file_type)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {file.uploaded_by_name} • {formatDate(file.uploaded_at)}
                  {file.remarks && ` • ${file.remarks}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                <a
                  href={file.file_url}
                  download
                  onClick={e => e.stopPropagation()}
                  title="Download"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition"
                >
                  <Download className="w-4 h-4" />
                </a>
                {(isOwner || isSignatory || file.uploaded_by === user?.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(file.id);
                    }}
                    disabled={loading}
                    title="Delete"
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {canUpload && (
        <>
          <label
            className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition group ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/30"
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragEnter={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const dropped = Array.from(e.dataTransfer.files || []).filter(f => f.type === "application/pdf");
              if (dropped.length > 0) handleFileUpload(dropped);
            }}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dragging ? "bg-primary/20" : "bg-accent group-hover:bg-primary/10"}`}>
              <Upload className={`w-4 h-4 transition ${dragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-foreground">
                {uploading ? "Uploading..." : "Drag & drop to upload"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">or click to browse</p>
            </div>
            <input
              type="file"
              name="file-upload-doc"
              accept=".pdf"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={e => {
                const newFiles = Array.from(e.target.files || []).filter(f => f.type === "application/pdf");
                if (newFiles.length > 0) handleFileUpload(newFiles);
              }}
            />
          </label>
        </>
      )}
    </div>
  );
};

export default DocumentFileList;
