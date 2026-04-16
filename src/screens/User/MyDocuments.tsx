import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Send, Eye, Clock, CheckCircle2, Search, Download, RefreshCw, Pencil, Trash2, AlertTriangle, Loader2, ChevronLeft, ChevronRight, ChevronDown, GitBranch, Plus, X as XIcon, Link2, Link2Off, PenLine, Printer } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import Swal from "sweetalert2";
import UserLayout from "./UserLayout";
import { documentApi, officeApi, userApi, Document, Office, SignatoryUser } from "../../services/api";
import { useAuth } from "../Auth/AuthContext";

type WritableFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob | BufferSource | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type DirectoryHandle = {
  name?: string;
  requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<WritableFileHandle>;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  expires_in?: number;
  token_type?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    }) => Promise<DirectoryHandle>;
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const GOOGLE_DRIVE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || "").trim();
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const GoogleDriveIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
    <path d="M9.2 3.2h5.55l5.84 10.14h-5.54L9.2 3.2Z" fill="#0F9D58" />
    <path d="M7.82 5.6 10.6 10.4 4.95 20.2 2.17 15.4 7.82 5.6Z" fill="#FFC107" />
    <path d="M13.4 10.4h5.55l2.88 4.98H10.52l2.88-4.98Z" fill="#4285F4" />
  </svg>
);

const STATUS_COLOR: Record<string, string> = {
  Pending:       "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Sending": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Viewing:       "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Viewed:        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Completed:     "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected:      "bg-destructive/10 text-destructive",
};

const statusLabel = (doc: Document, currentUserId?: number): string => {
  const sigs     = doc.signatories ?? [];
  const mySig    = sigs.find(s => s.user_id === currentUserId);
  const isViewer = mySig?.role === "viewer";
  const signers  = sigs.filter(s => s.role !== "viewer");
  const total    = signers.length;
  const signed   = signers.filter(s => s.status === "signed").length;
  const rejected = signers.filter(s => s.status === "rejected").length;
  const isOwner  = doc.userID === currentUserId;
  const isSignatory = sigs.some(s => s.user_id === currentUserId);
  const hasSigned = sigs.some(s => s.user_id === currentUserId && s.status === "signed");
  const allSigned = total > 0 && signed === total;

  if (isViewer) {
    return mySig?.status === "viewed" ? "Viewed (0/0)" : "Viewing (0/0)";
  }

  if (doc.status === "Pending") return "For Sending";
  if (doc.status === "Rejected") return `Rejected (${rejected}/${total})`;
  if (allSigned || doc.status === "Completed") {
    if (isOwner) return `Completed (${signed}/${total})`;
    if (isSignatory && hasSigned) return `Signed (${signed}/${total})`;
    return `Completed (${signed}/${total})`;
  }
  if (doc.status === "For Signing") {
    if (isSignatory && hasSigned) return `Signed (${signed}/${total})`;
    return `For Signing (${signed}/${total})`;
  }
  return doc.status;
};

const statusLabelShort = (doc: Document, currentUserId?: number): string => {
  const full = statusLabel(doc, currentUserId);
  const match = full.match(/\(\d+\/\d+\)/);
  if (match) return match[0];
  if (full === "For Sending") return "Send";
  return full;
};

const statusBadgeClass = (doc: Document, currentUserId?: number): string => {
  const mySig = (doc.signatories ?? []).find(s => s.user_id === currentUserId);
  if (mySig?.role === "viewer") {
    return mySig.status === "viewed" ? STATUS_COLOR["Viewed"] : STATUS_COLOR["Viewing"];
  }
  if (doc.status === "Rejected") return STATUS_COLOR["Rejected"];
  if (doc.status === "Pending")  return STATUS_COLOR["For Sending"];
  const signers  = (doc.signatories ?? []).filter(s => s.role !== "viewer");
  const allSigned = signers.length > 0 && signers.every(s => s.status === "signed");
  if (allSigned || doc.status === "Completed") return STATUS_COLOR["Completed"];
  return STATUS_COLOR[doc.status] ?? "bg-muted text-muted-foreground";
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

const normalizeDateValue = (value?: string | null): string => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const MyDocuments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docs, setDocs]     = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<string>("All");
  const [typeFilter, setTypeFilter]   = useState<string>("All");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [officeSelection, setOfficeSelection] = useState("");
  const [projectSelection, setProjectSelection] = useState("");
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef                    = useRef<HTMLDivElement>(null);
  const [page, setPage]               = useState(1);
  const isIdleRef                      = useRef(true);
  const idleTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target as Node))
        setTypeDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onMove = () => {
      isIdleRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => { isIdleRef.current = true; }, 2000);
    };
    document.addEventListener("mousemove", onMove);
    return () => {
      document.removeEventListener("mousemove", onMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
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
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [batchDownloadCompleted, setBatchDownloadCompleted] = useState(0);
  const [batchDownloadTotal, setBatchDownloadTotal] = useState(0);
  const [currentDownloadingFile, setCurrentDownloadingFile] = useState<string>("");
  const [driveUploadCompleted, setDriveUploadCompleted] = useState(0);
  const [driveUploadTotal, setDriveUploadTotal] = useState(0);
  const [currentDriveUploadFile, setCurrentDriveUploadFile] = useState<string>("");
  const [downloadDirectoryHandle, setDownloadDirectoryHandle] = useState<DirectoryHandle | null>(null);
  const [downloadDirectoryName, setDownloadDirectoryName] = useState<string>("Default browser downloads");
  const googleTokenRef = useRef<string>("");
  const googleTokenClientRef = useRef<GoogleTokenClient | null>(null);
  const googleIdentityScriptPromiseRef = useRef<Promise<void> | null>(null);

  // ── Batch signing state ──
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const toggleSelect = (track: string) => {
    setSelectedTracks(prev => prev.includes(track) ? prev.filter(t => t !== track) : [...prev, track]);
  };
  const toggleSelectAll = () => {
    const visibleTracks = visibleDocs.map(d => d.tracknumber);
    const allVisibleSelected = visibleTracks.every(t => selectedTracks.includes(t));
    if (allVisibleSelected) {
      setSelectedTracks(prev => prev.filter(t => !visibleTracks.includes(t)));
    } else {
      setSelectedTracks(prev => Array.from(new Set([...prev, ...visibleTracks])));
    }
  };
  const selectAllFiltered = () => {
    setSelectedTracks(filtered.map(d => d.tracknumber));
  };

const handleDownload = async (doc: Document) => {
  const filesToDownload = doc.files && doc.files.length > 0
    ? doc.files
    : doc.file_url ? [{ file_url: doc.file_url, id: -1 }] : [];

  if (filesToDownload.length === 0) return;
  
  setDownloading(doc.id);

  try {
    for (let i = 0; i < filesToDownload.length; i++) {
      const f = filesToDownload[i];
      if (!f.file_url) continue;

      const blob = await fetchFileBlob(f.file_url);
      const originalName = f.file_url.split('/').pop()?.split('?')[0];
      downloadBlob(blob, originalName || "document.pdf");

      // Delay to prevent the browser from blocking multiple simultaneous downloads
      if (i < filesToDownload.length - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }
  } catch (e) {
    console.error("Download failed", e);
  } finally {
    setDownloading(null);
  }
};

  const getDocumentFiles = (doc: Document) => (
    doc.files && doc.files.length > 0
      ? doc.files
      : doc.file_url ? [{ file_url: doc.file_url, id: -1 }] : []
  );

  const fetchFileBytes = async (fileUrl: string) => {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(fileUrl, {
      headers: token ? { Authorization: `Token ${token}` } : {},
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  };

  const fetchFileBlob = async (fileUrl: string) => {
    const bytes = await fetchFileBytes(fileUrl);
    return new Blob([bytes], { type: "application/pdf" });
  };

  const getDirectoryPicker = () => {
    const picker = window.showDirectoryPicker ?? (globalThis as any).showDirectoryPicker;
    return typeof picker === "function" ? picker : null;
  };

  const supportsDirectorySave = () => getDirectoryPicker() !== null;

  const sanitizeFilename = (filename: string) => filename.replace(/[\\/:*?"<>|]/g, "_");

  const getDownloadFilename = (doc: Document, fileUrl: string, index: number) => {
    const originalName = fileUrl.split('/').pop()?.split('?')[0];
    return sanitizeFilename(originalName || `${doc.tracknumber}-${index + 1}.pdf`);
  };

  const countDownloadFiles = (selectedDocs: Document[]) => (
    selectedDocs.reduce((total, doc) => total + getDocumentFiles(doc).filter(file => !!file.file_url).length, 0)
  );

  const updateBatchDownloadProgress = (filename: string, completed: number, total: number) => {
    setCurrentDownloadingFile(filename);
    setBatchDownloadCompleted(completed);
    setBatchDownloadTotal(total);
  };

  const updateDriveUploadProgress = (filename: string, completed: number, total: number) => {
    setCurrentDriveUploadFile(filename);
    setDriveUploadCompleted(completed);
    setDriveUploadTotal(total);
  };

  const loadGoogleIdentityScript = () => {
    if (window.google?.accounts?.oauth2) {
      return Promise.resolve();
    }

    if (googleIdentityScriptPromiseRef.current) {
      return googleIdentityScriptPromiseRef.current;
    }

    googleIdentityScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
      document.head.appendChild(script);
    });

    return googleIdentityScriptPromiseRef.current;
  };

  const getGoogleAccessToken = async () => {
    if (googleTokenRef.current) {
      return googleTokenRef.current;
    }

    if (!GOOGLE_DRIVE_CLIENT_ID) {
      throw new Error("Missing VITE_GOOGLE_DRIVE_CLIENT_ID in the frontend environment.");
    }

    await loadGoogleIdentityScript();

    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services is not available.");
    }

    const googleOauth2 = window.google.accounts.oauth2;

    return new Promise<string>((resolve, reject) => {
      const tokenClient = googleOauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            if (response.error === "access_denied") {
              reject(new Error("Google blocked sign-in for this app. Add your Google account as a Test user in the Google Cloud OAuth consent screen, or publish the app."));
              return;
            }

            reject(new Error(response.error || "Failed to get Google access token."));
            return;
          }

          googleTokenRef.current = response.access_token;
          resolve(response.access_token);
        },
        error_callback: () => reject(new Error("Google sign-in was cancelled.")),
      });

      googleTokenClientRef.current = tokenClient;

      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  };

  const extractDriveFolderId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];

    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];

    if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
    return "";
  };

  const promptDriveFolderLink = async () => {
    const result = await Swal.fire({
      title: "Send To Drive",
      html: `
        <div class="drive-folder-modal__hero">
          <div class="drive-folder-modal__panel">
            <div class="drive-folder-modal__badge">Google Drive</div>
            <p class="drive-folder-modal__copy">Choose the destination folder for the selected PDF files.</p>
          </div>
        </div>
      `,
      input: "text",
      inputLabel: "Drive folder link or ID",
      inputPlaceholder: "Paste a Google Drive folder link or folder ID",
      showCancelButton: true,
      confirmButtonText: "Upload Here",
      cancelButtonText: "Cancel",
      customClass: {
        popup: "drive-folder-modal",
        title: "drive-folder-modal__title",
        htmlContainer: "drive-folder-modal__body",
        input: "drive-folder-modal__input",
        actions: "drive-folder-modal__actions",
        confirmButton: "drive-folder-modal__confirm",
        cancelButton: "drive-folder-modal__cancel",
        validationMessage: "drive-folder-modal__validation",
      },
      buttonsStyling: false,
      width: 560,
      inputValidator: (value) => {
        if (!extractDriveFolderId(value || "")) {
          return "Enter a valid Google Drive folder link or folder ID.";
        }
        return undefined;
      },
    });

    if (!result.isConfirmed || !result.value) {
      return null;
    }

    return {
      folderId: extractDriveFolderId(result.value),
      folderLink: result.value,
    };
  };

  const uploadFileToDrive = async (accessToken: string, folderId: string, filename: string, fileBytes: ArrayBuffer) => {
    const metadata = {
      name: filename,
      parents: [folderId],
      mimeType: "application/pdf",
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", new Blob([fileBytes], { type: "application/pdf" }), filename);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Drive upload failed with status ${response.status}.`);
    }

    return response.json();
  };

  const sendDocumentsToDrive = async (selectedDocs: Document[], folderId: string, accessToken: string) => {
    const totalFiles = countDownloadFiles(selectedDocs);
    let completedFiles = 0;

    for (const doc of selectedDocs) {
      const files = getDocumentFiles(doc);

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file.file_url) continue;

        const filename = getDownloadFilename(doc, file.file_url, index);
        updateDriveUploadProgress(filename, completedFiles, totalFiles);
        const fileBytes = await fetchFileBytes(file.file_url);
        await uploadFileToDrive(accessToken, folderId, filename, fileBytes);
        completedFiles += 1;
        updateDriveUploadProgress(filename, completedFiles, totalFiles);
      }
    }
  };

  const pickDownloadDirectory = async () => {
    const directoryPicker = getDirectoryPicker();
    if (!directoryPicker) {
      throw new Error("Directory save is not supported in this browser.");
    }

    const directoryHandle = await directoryPicker({
      id: "dtms-download-all",
      mode: "readwrite",
      startIn: "downloads",
    });

    if (directoryHandle.requestPermission) {
      const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
      if (permission === "denied") {
        throw new Error("Directory access was denied.");
      }
    }

    setDownloadDirectoryHandle(directoryHandle);
    setDownloadDirectoryName(directoryHandle.name || "Chosen folder");
    return directoryHandle;
  };

  const saveDocumentsToDirectory = async (selectedDocs: Document[]) => {
    const directoryHandle = downloadDirectoryHandle ?? await pickDownloadDirectory();
    const totalFiles = countDownloadFiles(selectedDocs);
    let completedFiles = 0;

    for (const doc of selectedDocs) {
      const files = getDocumentFiles(doc);

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file.file_url) continue;

        const filename = getDownloadFilename(doc, file.file_url, index);
        updateBatchDownloadProgress(filename, completedFiles, totalFiles);
        const fileBytes = await fetchFileBytes(file.file_url);
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fileBytes);
        await writable.close();
        completedFiles += 1;
        updateBatchDownloadProgress(filename, completedFiles, totalFiles);
      }
    }
  };

  const downloadDocumentsSequentially = async (selectedDocs: Document[]) => {
    const totalFiles = countDownloadFiles(selectedDocs);
    let completedFiles = 0;

    for (const doc of selectedDocs) {
      const files = getDocumentFiles(doc);

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file.file_url) continue;

        const filename = getDownloadFilename(doc, file.file_url, index);
        updateBatchDownloadProgress(filename, completedFiles, totalFiles);
        const blob = await fetchFileBlob(file.file_url);
        downloadBlob(blob, filename);
        completedFiles += 1;
        updateBatchDownloadProgress(filename, completedFiles, totalFiles);

        await new Promise(resolve => window.setTimeout(resolve, 900));
      }
    }
  };

  const buildMergedPdf = async (selectedDocs: Document[]) => {
    const mergedPdf = await PDFDocument.create();
    let importedPageCount = 0;

    for (const doc of selectedDocs) {
      const files = getDocumentFiles(doc);

      for (const file of files) {
        if (!file.file_url) continue;

        const sourceBytes = await fetchFileBytes(file.file_url);
        const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
          importedPageCount += 1;
        });
      }
    }

    if (importedPageCount === 0) {
      throw new Error("No PDF pages were available to merge.");
    }

    const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
    const mergedBuffer = Uint8Array.from(mergedBytes).buffer;
    return new Blob([mergedBuffer], { type: "application/pdf" });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();

    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const isEdgeBrowser = () => /Edg\//.test(window.navigator.userAgent);

  const printBlob = (blob: Blob) => new Promise<void>((resolve, reject) => {
    const blobUrl = URL.createObjectURL(blob);

    if (isEdgeBrowser()) {
      const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

      if (!printWindow) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to open print preview window."));
        return;
      }

      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          window.setTimeout(() => {
            printWindow.close();
            URL.revokeObjectURL(blobUrl);
            resolve();
          }, 1500);
        } catch (error) {
          URL.revokeObjectURL(blobUrl);
          reject(error);
        }
      }, 1200);

      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    const cleanup = () => {
      URL.revokeObjectURL(blobUrl);
      iframe.remove();
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1000);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Failed to load printable document."));
    };

    iframe.src = blobUrl;
    document.body.appendChild(iframe);
  });

  const getSelectedDocs = () => filtered.filter(doc => selectedTracks.includes(doc.tracknumber));

  const handleDownloadSelected = async () => {
    const selectedDocs = getSelectedDocs();
    if (selectedDocs.length === 0) return;

    setBatchDownloading(true);
    setBatchDownloadCompleted(0);
    setBatchDownloadTotal(countDownloadFiles(selectedDocs));
    setCurrentDownloadingFile("");
    try {
      if (supportsDirectorySave()) {
        await saveDocumentsToDirectory(selectedDocs);
      } else {
        await downloadDocumentsSequentially(selectedDocs);
      }

      const totalFiles = countDownloadFiles(selectedDocs);
      await Swal.fire({
        icon: "success",
        title: "Download complete",
        text: `${totalFiles} file${totalFiles === 1 ? "" : "s"} downloaded successfully.`,
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Batch download failed", error);
    } finally {
      setBatchDownloading(false);
      setCurrentDownloadingFile("");
    }
  };

  const handlePrintSelected = async () => {
    const selectedDocs = getSelectedDocs();
    if (selectedDocs.length === 0) return;

    setBatchPrinting(true);
    try {
      const mergedBlob = await buildMergedPdf(selectedDocs);
      await printBlob(mergedBlob);
    } catch (error) {
      console.error("Batch print failed", error);
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleSendToDrive = async () => {
    const selectedDocs = getSelectedDocs();
    if (selectedDocs.length === 0) return;

    setDriveUploading(true);
    setDriveUploadCompleted(0);
    setDriveUploadTotal(countDownloadFiles(selectedDocs));
    setCurrentDriveUploadFile("");

    try {
      const driveTarget = await promptDriveFolderLink();
      if (!driveTarget) return;

      const accessToken = await getGoogleAccessToken();
      await sendDocumentsToDrive(selectedDocs, driveTarget.folderId, accessToken);

      const totalFiles = countDownloadFiles(selectedDocs);
      await Swal.fire({
        icon: "success",
        title: "Drive upload complete",
        text: `${totalFiles} file${totalFiles === 1 ? "" : "s"} uploaded to Google Drive successfully.`,
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Drive upload failed", error);
      await Swal.fire({
        icon: "error",
        title: "Drive upload failed",
        text: error instanceof Error ? error.message : "Failed to upload files to Google Drive.",
        confirmButtonText: "OK",
      });
    } finally {
      setDriveUploading(false);
      setCurrentDriveUploadFile("");
    }
  };

  const handleChooseDownloadFolder = async () => {
    if (!supportsDirectorySave()) {
      console.error("Directory save is not supported in this browser.");
      return;
    }

    try {
      await pickDownloadDirectory();
    } catch (error) {
      console.error("Failed to choose download folder", error);
    }
  };
  const batchDownloadProgressPercent = batchDownloadTotal > 0
    ? Math.min(100, Math.round((batchDownloadCompleted / batchDownloadTotal) * 100))
    : 0;
  const driveUploadProgressPercent = driveUploadTotal > 0
    ? Math.min(100, Math.round((driveUploadCompleted / driveUploadTotal) * 100))
    : 0;
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
    let tid: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    documentApi.myDocs(controller.signal)
      .then(setDocs)
      .catch((err) => { if (err?.code !== "ERR_CANCELED") console.error(err); })
      .finally(() => {
        // Skip if this request was aborted (component unmounted / StrictMode re-run)
        // so the stale timer never clobbers a subsequent setLoading(true).
        if (!controller.signal.aborted) {
          tid = setTimeout(() => setLoading(false), 500);
        }
      });
    return () => {
      controller.abort();
      if (tid !== null) clearTimeout(tid);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isIdleRef.current) return;
      documentApi.myDocs()
        .then(setDocs)
        .catch(err => { if (err?.code !== "ERR_CANCELED") console.error(err); });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setPage(1); }, [search, filter, typeFilter, dateFromFilter, dateToFilter, selectedOffices, selectedProjects]);

  const statuses  = ["All", "For Sending", "For Signing", "Viewing", "Viewed", "Completed", "Signed", "Rejected"];
  const docTypes  = ["All", ...Array.from(new Set(docs.map(d => d.type).filter(Boolean))).sort()];
  const officeOptions = Array.from(
    new Map(
      docs
        .filter(d => d.office != null && d.office_name)
        .map(d => [String(d.office), d.office_name as string])
    ).entries()
  ).map(([value, label]) => ({ value, label }));
  const projectOptions = Array.from(
    new Map(
      docs.flatMap(d => {
        const projectIds = d.projects ?? [];
        const projectNames = d.project_names ?? [];
        return projectIds.map((projectId, index) => [String(projectId), projectNames[index] ?? `Project ${projectId}`] as const);
      })
    ).entries()
  ).map(([value, label]) => ({ value, label }));
  const availableOfficeOptions = officeOptions.filter(option => !selectedOffices.includes(option.value));
  const availableProjectOptions = projectOptions.filter(option => !selectedProjects.includes(option.value));
  const activeFilterCount =
    (typeFilter !== "All" ? 1 : 0) +
    (dateFromFilter ? 1 : 0) +
    (dateToFilter ? 1 : 0) +
    selectedOffices.length +
    selectedProjects.length;

  const handleOfficeSelect = (value: string) => {
    setOfficeSelection(value);
    if (!value) return;
    setSelectedOffices(prev => prev.includes(value) ? prev : [...prev, value]);
    setOfficeSelection("");
  };

  const handleProjectSelect = (value: string) => {
    setProjectSelection(value);
    if (!value) return;
    setSelectedProjects(prev => prev.includes(value) ? prev : [...prev, value]);
    setProjectSelection("");
  };

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
      const myRoute = d.signatories?.find(s => s.user_id === user?.id);
      const isViewerRoute = myRoute?.role === "viewer";
      const hasSigned = myRoute?.status === "signed";
      matchFilter = d.status === "For Signing" && !!myRoute && !isViewerRoute && !hasSigned;
    } else if (filter === "Completed") {
      matchFilter = d.status === "Completed" && d.userID === user?.id;
    } else if (filter === "Signed") {
      const myRoute = d.signatories?.find(s => s.user_id === user?.id);
      const isViewerRoute = myRoute?.role === "viewer";
      const hasSigned = myRoute?.status === "signed";
      matchFilter = !!(d.status === "Completed" && d.userID !== user?.id && !!myRoute && !isViewerRoute && hasSigned) ||
                   !!(d.status === "For Signing" && !!myRoute && !isViewerRoute && hasSigned);
    } else if (filter === "Viewing") {
      const myRoute = d.signatories?.find(s => s.user_id === user?.id);
      matchFilter = !!myRoute && myRoute.role === "viewer" && myRoute.status !== "viewed";
    } else if (filter === "Viewed") {
      const myRoute = d.signatories?.find(s => s.user_id === user?.id);
      matchFilter = !!myRoute && myRoute.role === "viewer" && myRoute.status === "viewed";
    } else if (filter === "Rejected") {
      matchFilter = d.status === "Rejected";
    }

    const matchType = typeFilter === "All" || d.type === typeFilter;
    const documentDate = normalizeDateValue(d.datesubmitted);
    const matchDateFrom = !dateFromFilter || (documentDate !== "" && documentDate >= dateFromFilter);
    const matchDateTo = !dateToFilter || (documentDate !== "" && documentDate <= dateToFilter);
    const matchOffice = selectedOffices.length === 0 || selectedOffices.includes(String(d.office));
    const matchProject = selectedProjects.length === 0 || (d.projects ?? []).map(String).some(projectId => selectedProjects.includes(projectId));
    return matchSearch && matchFilter && matchType && matchDateFrom && matchDateTo && matchOffice && matchProject;
  });

  const hasActiveFilters =
    search.trim() !== "" ||
    filter !== "All" ||
    typeFilter !== "All" ||
    dateFromFilter !== "" ||
    dateToFilter !== "" ||
    selectedOffices.length > 0 ||
    selectedProjects.length > 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleDocs = hasActiveFilters ? filtered : paginated;

  const pending    = filtered.filter(d => d.status === "Pending").length;
  const forSigning = filtered.filter(d => {
    if (d.status !== "For Signing") return false;
    const myRoute = d.signatories?.find(s => s.user_id === user?.id);
    return !!myRoute && myRoute.role !== "viewer" && myRoute.status !== "signed";
  }).length;
  const completed  = filtered.filter(d => d.status === "Completed" && d.userID === user?.id).length;
  const signedBySelf = filtered.filter(d =>
    d.signatories.some(s => s.user_id === user?.id && s.status === "signed" && s.role !== "viewer")
  ).length;
  const viewingCount = filtered.filter(d => {
    const myRoute = d.signatories?.find(s => s.user_id === user?.id);
    if (!myRoute || myRoute.role !== "viewer") return false;
    return myRoute.status !== "viewed";
  }).length;
  const viewedCount = filtered.filter(d =>
    d.signatories.some(s => s.user_id === user?.id && s.role === "viewer" && s.status === "viewed")
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
      <div className="grid grid-cols-6 gap-4 mb-6 lg:grid-cols-3 sm:grid-cols-2">
        {loading
          ? [...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)
          : [
              { label: "For Sending",  value: pending,      icon: <Clock className="w-4 h-4" />,        color: "text-yellow-500" },
              { label: "For Signing", value: forSigning,   icon: <Send className="w-4 h-4" />,          color: "text-blue-500" },
              { label: "Viewing",     value: viewingCount, icon: <Eye className="w-4 h-4" />,           color: "text-amber-500" },
              { label: "Viewed",      value: viewedCount,  icon: <Eye className="w-4 h-4" />,           color: "text-cyan-500" },
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
          <div className="relative shrink-0 sm:w-full">
            <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 sm:w-full">
                <span className="text-xs font-medium text-muted-foreground shrink-0">From</span>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={e => setDateFromFilter(e.target.value)}
                  className="min-w-[140px] bg-transparent text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none sm:min-w-0 sm:w-full"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 sm:w-full">
                <span className="text-xs font-medium text-muted-foreground shrink-0">To</span>
                <input
                  type="date"
                  value={dateToFilter}
                  min={dateFromFilter || undefined}
                  onChange={e => setDateToFilter(e.target.value)}
                  className="min-w-[140px] bg-transparent text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none sm:min-w-0 sm:w-full"
                />
              </div>
            </div>
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

        <div className="flex items-center gap-2 flex-wrap">
          {selectedTracks.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                Folder: <span className="font-medium text-foreground">{supportsDirectorySave() ? downloadDirectoryName : "Browser-managed downloads"}</span>
              </span>
              <button
                type="button"
                onClick={handleChooseDownloadFolder}
                disabled={!supportsDirectorySave()}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
                title={supportsDirectorySave() ? "Choose download folder" : "Folder selection is not supported in this browser/session"}
              >
                Change Folder
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <select
                value={officeSelection}
                onChange={e => handleOfficeSelect(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition min-w-[180px]"
              >
                <option value="">Add office filter</option>
                {availableOfficeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {selectedOffices.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedOffices.map(officeValue => {
                  const officeLabel = officeOptions.find(option => option.value === officeValue)?.label ?? officeValue;
                  return (
                    <span key={officeValue} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {officeLabel}
                      <button
                        type="button"
                        onClick={() => setSelectedOffices(prev => prev.filter(value => value !== officeValue))}
                        className="rounded-full text-primary/80 transition hover:text-primary"
                        aria-label={`Remove office ${officeLabel}`}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <select
                value={projectSelection}
                onChange={e => handleProjectSelect(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition min-w-[180px]"
              >
                <option value="">Add project filter</option>
                {availableProjectOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
            {selectedProjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProjects.map(projectValue => {
                  const projectLabel = projectOptions.find(option => option.value === projectValue)?.label ?? projectValue;
                  return (
                    <span key={projectValue} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {projectLabel}
                      <button
                        type="button"
                        onClick={() => setSelectedProjects(prev => prev.filter(value => value !== projectValue))}
                        className="rounded-full text-primary/80 transition hover:text-primary"
                        aria-label={`Remove project ${projectLabel}`}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTypeFilter("All"); setDateFromFilter(""); setDateToFilter(""); setSelectedOffices([]); setSelectedProjects([]); setOfficeSelection(""); setProjectSelection(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition"
            >
              <XIcon className="w-3 h-3" /> Clear filters
              <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            </button>
          )}
        </div>

        {selectedTracks.length > 0 && (
          <div className="flex flex-col gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400 ml-2">
                {selectedTracks.length} document{selectedTracks.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={handleDownloadSelected}
                disabled={batchDownloading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
              >
                {batchDownloading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                  : <><Download className="w-4 h-4" /> Download All</>}
              </button>
              <button
                onClick={handleSendToDrive}
                disabled={driveUploading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-white dark:text-slate-800 dark:hover:bg-slate-100"
              >
                {driveUploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  : <> <GoogleDriveIcon className="w-4 h-4" /> Send To Drive</>}
              </button>
              <button
                onClick={handlePrintSelected}
                disabled={batchPrinting}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
              >
                {batchPrinting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Printing...</>
                  : <><Printer className="w-4 h-4" /> Print All</>}
              </button>
              <button
                onClick={() => navigate(`/dtms/sign/batch?tracks=${selectedTracks.join(",")}`)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
              >
                <PenLine className="w-4 h-4" /> Batch Sign Selected
              </button>
              <button
                onClick={() => setSelectedTracks([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
            {batchDownloading && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="truncate">
                      Downloading {batchDownloadCompleted} of {batchDownloadTotal} file{batchDownloadTotal === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="shrink-0">{batchDownloadProgressPercent}%</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                  {currentDownloadingFile ? `Current file: ${currentDownloadingFile}` : "Preparing files..."}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-500/15">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${batchDownloadProgressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {driveUploading && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-sky-700 dark:text-sky-400">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="truncate">
                      Uploading {driveUploadCompleted} of {driveUploadTotal} file{driveUploadTotal === 1 ? "" : "s"} to Google Drive
                    </span>
                  </div>
                  <span className="shrink-0">{driveUploadProgressPercent}%</span>
                </div>
                <div className="mt-1 text-[11px] text-sky-700/80 dark:text-sky-400/80 truncate">
                  {currentDriveUploadFile ? `Current file: ${currentDriveUploadFile}` : "Preparing files for Google Drive..."}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-500/15">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${driveUploadProgressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {selectedTracks.length < filtered.length && (
              <p className="text-[11px] text-blue-600/80 px-2">
                Selected from current view. <button onClick={selectAllFiltered} className="font-bold underline hover:text-blue-800">Select all {filtered.length} documents</button> instead?
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden min-h-[530px] flex flex-col">
        {/* Header — always visible */}
        <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_180px] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide slg:grid-cols-[40px_2fr_1fr_180px] sm:grid-cols-[40px_2fr_1fr_80px]">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                checked={visibleDocs.length > 0 && visibleDocs.every(d => selectedTracks.includes(d.tracknumber))}
              onChange={toggleSelectAll}
            />
          </div>
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
          visibleDocs.map(doc => (
            <div
              key={doc.id}
              className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_180px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center hover:bg-accent/40 transition-colors slg:grid-cols-[40px_2fr_1fr_180px] sm:grid-cols-[40px_2fr_1fr_80px]"
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="rounded border-border text-primary focus:ring-primary/50"
                  checked={selectedTracks.includes(doc.tracknumber)}
                  onChange={() => toggleSelect(doc.tracknumber)}
                />
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <div className=" sm:hidden w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.requestor} ({doc.type})</p>
                  {(() => {
                    if (!doc.files || doc.files.length <= 1) return null;
                    const mySig = doc.signatories?.find(s => s.user_id === user?.id);
                    if (!mySig || mySig.role === "viewer") return null;
                    if (mySig.status === "pending") {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="sm:hidden">{doc.files.length} files — sign all of them</span>
                          <span className="hidden sm:inline">Sign all {doc.files.length} files</span>
                        </span>
                      );
                    }
                    if (mySig.status === "signed" && doc.files.some(f => f.file_type === "original")) {
                      const unsignedCount = doc.files.filter(f => f.file_type === "original").length;
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="sm:hidden">{unsignedCount} file{unsignedCount !== 1 ? "s" : ""} may be unsigned — open to verify</span>
                          <span className="hidden sm:inline">{unsignedCount} unsigned</span>
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
              <p className="text-sm text-foreground font-mono slg:hidden">{doc.tracknumber}</p>
              <p className="text-sm text-muted-foreground slg:hidden">{doc.datesubmitted}</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${statusBadgeClass(doc, user?.id)}`}>
                <span className="sm:hidden">{statusLabel(doc, user?.id)}</span>
                <span className="hidden sm:inline">{statusLabelShort(doc, user?.id)}</span>
              </span>
              <div className="flex items-center sm:items-end gap-1.5 w-full">
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
          {!hasActiveFilters && totalPages > 1 && (
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