import { useState, useEffect } from "react";
import UserLayout from "./UserLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, PlusCircle, Settings, FileSignature,
  Search, Download, MousePointer2, CheckCircle2,
  Upload, Users, Image as ImageIcon,
  Key, BookOpen, ChevronDown, ChevronRight, X, User, Briefcase, Plus, Send, RefreshCw, Printer, Trash2, Eye, LayoutGrid, Calendar, MapPin, PlayCircle, MessageSquare, ChevronUp, Link2, Archive, Unlock, Lock, Save, Type, PenLine, XCircle, ChevronLeft, Layers,
  Loader
} from "lucide-react";

// ── Shared Animation Configs ────────────────────────────────────────────────
const fadeVar = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

// ── Animated Demo Components ────────────────────────────────────────────────

const getHighlightClass = (active: boolean) => active ? "ring-[3px] ring-primary/60 ring-offset-2 ring-offset-background scale-[1.05] relative z-20 transition-all duration-300" : "transition-all duration-300";

const DemoMyDocuments = ({ activeSub }: { activeSub: string | null }) => {
  const [step, setStep] = useState(0);

  // Reset step when subsection changes
  useEffect(() => {
    if (!activeSub || activeSub === 'all') setStep(0);
    else if (activeSub === 'view') setStep(0);
    else if (activeSub === 'status') setStep(4);
    else if (activeSub === 'advanced') setStep(6);
    else if (activeSub === 'batch') setStep(9);
  }, [activeSub]);

  // Animation Loop Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => {
        if (!activeSub || activeSub === 'all') return (prev + 1) % 25;

        if (activeSub === 'view') return prev >= 4 ? 0 : prev + 1;
        if (activeSub === 'status') return prev >= 6 ? 4 : prev + 1;
        if (activeSub === 'advanced') return prev >= 9 ? 6 : prev + 1;
        if (activeSub === 'batch') return prev >= 24 ? 9 : prev + 1;

        return (prev + 1) % 25;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [activeSub]);

  // Flags for UI state based on step
  const isViewClicked = step === 2;
  const isDownloadClicked = step === 4;
  const isStatusCompleted = step >= 6 && step <= 9;
  const isAdvancedOpen = step === 8 || step === 9;
  const isRow1Checked = step >= 11;
  const isRow2Checked = step >= 13;
  const showBatchBar = isRow1Checked || isRow2Checked;
  const isBatchDownloadClicked = step === 15;
  const showDownloadProgress = step === 15 || step === 16;
  const isDriveClicked = step === 18;
  const showDriveModal = step === 18 || step === 19;
  const isPrintClicked = step === 21;
  const showPrintLoader = step >= 21 && step <= 23;

  return (
    <div className="w-full h-full md:h-auto bg-background rounded-xl flex flex-col relative overflow-hidden md:overflow-visible shadow-sm border border-border text-sm select-none p-4 gap-4">

      {/* Quick Stats Mock */}
      <div className="grid grid-cols-4 md:grid-cols-2 gap-2 relative z-10">
        {[
          { label: "For Signing", value: isStatusCompleted ? 0 : 1, icon: <Send className="w-3 h-3" />, color: "text-blue-500" },
          { label: "Completed", value: isStatusCompleted ? 1 : 0, icon: <CheckCircle2 className="w-3 h-3" />, color: "text-green-500" },
          { label: "Viewing", value: isStatusCompleted ? 0 : 1, icon: <Eye className="w-3 h-3" />, color: "text-amber-500" },
          { label: "Archived", value: 0, icon: <Archive className="w-3 h-3" />, color: "text-indigo-500" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-2 flex items-center gap-2 shadow-sm transition-all duration-300">
            <span className={`p-1.5 rounded-md bg-accent ${s.color}`}>{s.icon}</span>
            <div className="min-w-0">
              <motion.p key={s.value} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold text-foreground leading-none">{s.value}</motion.p>
              <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filters Row */}
      <div className="flex gap-2 relative z-10 items-center">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background shadow-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <div className="h-4 w-48 bg-accent rounded" />
        </div>
      </div>

      {/* Status Filter Buttons */}
      <div className="flex gap-1.5 flex-wrap">
        <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm ${getHighlightClass(step === 5 || step === 6)} ${!isStatusCompleted ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
          All
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shadow-sm ${isStatusCompleted ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}>
          Completed
        </div>
        <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-muted-foreground border border-border shadow-sm">
          For Signing
        </div>

        <div className="relative ml-auto">
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium shadow-sm ${getHighlightClass(step === 8 || step === 9)} ${isAdvancedOpen ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border text-muted-foreground'}`}>
            <Settings className="w-3.5 h-3.5" /> Advanced
          </div>
          <AnimatePresence>
            {isAdvancedOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl p-4 flex flex-col gap-4 z-50"
              >
                <div className="text-xs font-bold text-muted-foreground uppercase">Filter Options</div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center gap-2 bg-background border border-border rounded p-2"><LayoutGrid className="w-3.5 h-3.5 text-blue-500" /> Type: All</div>
                  <div className="flex items-center gap-2 bg-background border border-border rounded p-2"><Calendar className="w-3.5 h-3.5 text-green-500" /> Date: Last 30 Days</div>
                  <div className="flex items-center gap-2 bg-background border border-border rounded p-2"><MapPin className="w-3.5 h-3.5 text-red-500" /> Office: HQ</div>
                  <div className="flex items-center gap-2 bg-background border border-border rounded p-2"><Briefcase className="w-3.5 h-3.5 text-purple-500" /> Project: None</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Batch Action Bar (In Document Flow) */}
      <AnimatePresence>
        {showBatchBar && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 w-fit shadow-sm">
                <span className="text-xs text-muted-foreground">
                  Folder: <span className="font-medium text-foreground">Browser-managed downloads</span>
                </span>
                <div className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent/80">
                  Change Folder
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400 ml-2">
                  {isRow2Checked ? '2' : '1'} document{isRow2Checked ? 's' : ''} selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-white text-sm font-semibold shadow-sm ${getHighlightClass(step >= 14 && step <= 16)} ${isBatchDownloadClicked ? 'bg-emerald-700 scale-95' : 'bg-emerald-600'}`}>
                    {showDownloadProgress ? <><Loader className="w-4 h-4 animate-spin" /> Downloading...</> : <><Download className="w-4 h-4" /> Download All</>}
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border text-sm font-semibold shadow-sm ${getHighlightClass(step === 17 || step === 18)} ${isDriveClicked ? 'border-slate-300 bg-slate-100 text-slate-800 scale-95' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="w-4 h-4 grayscale opacity-50" alt="Drive" /> Send To Drive
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-white text-sm font-semibold shadow-sm ${getHighlightClass(step >= 20 && step <= 23)} ${isPrintClicked ? 'bg-slate-800 scale-95' : 'bg-slate-700'}`}>
                    {showPrintLoader ? <><Loader className="w-4 h-4 animate-spin" /> Printing...</> : <><Printer className="w-4 h-4" /> Print All</>}
                  </div>
                </div>
              </div>

              {/* Download Progress Animation */}
              {showDownloadProgress && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span className="truncate">Downloading 1 of 2 files</span>
                    </div>
                    <span className="shrink-0">{step === 15 ? '35%' : '80%'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                    Current file: Request_for_Budget.pdf
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-500/15">
                    <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-out" style={{ width: step === 15 ? '35%' : '80%' }} />
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Area */}
      <div className="bg-card border border-border rounded-xl flex flex-col flex-1 shadow-sm relative">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_2.5fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider relative z-0">
          <div className="flex items-center justify-center">
            <input type="checkbox" className="rounded border-border" readOnly checked={isRow1Checked && isRow2Checked} />
          </div>
          <div>Document</div>
          <div>Track No.</div>
          <div>Date</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col relative z-0">
          {/* Row 1 */}
          <motion.div layout className="grid grid-cols-[40px_2.5fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3.5 border-b border-border items-center transition-colors hover:bg-accent/40 bg-background">
            <div className={`flex items-center justify-center rounded p-0.5 ${getHighlightClass(step === 10 || step === 11)}`}>
              <input type="checkbox" className="rounded border-border text-primary" readOnly checked={isRow1Checked} />
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">Request for Budget Approval</p>
                <p className="text-xs text-muted-foreground truncate">Jane Doe (Finance)</p>
              </div>
            </div>
            <div className="font-mono text-xs text-foreground">TRK-2026-001</div>
            <div className="text-xs text-muted-foreground">2026-05-18</div>
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${isStatusCompleted ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                {isStatusCompleted ? 'Completed' : 'For Signing'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center ${getHighlightClass(step === 1 || step === 2)} ${isViewClicked ? 'bg-primary text-white scale-95' : 'bg-accent text-foreground hover:bg-accent/80'}`}><Eye className="w-3.5 h-3.5" /></div>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center ${getHighlightClass(step === 3 || step === 4)} ${isDownloadClicked ? 'bg-primary text-white scale-95' : 'bg-accent text-foreground hover:bg-accent/80'}`}><Download className="w-3.5 h-3.5" /></div>
            </div>
          </motion.div>

          {/* Row 2 */}
          <AnimatePresence>
            {(!isStatusCompleted) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-[40px_2.5fr_1fr_1fr_1fr_120px] gap-4 px-5 py-3.5 border-b border-border items-center transition-colors hover:bg-accent/40 bg-background"
              >
                <div className={`flex items-center justify-center rounded p-0.5 ${getHighlightClass(step === 12 || step === 13)}`}>
                  <input type="checkbox" className="rounded border-border text-primary" readOnly checked={isRow2Checked} />
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Q3 Project Report</p>
                    <p className="text-xs text-muted-foreground truncate">John Smith (Operations)</p>
                  </div>
                </div>
                <div className="font-mono text-xs text-foreground">TRK-2026-002</div>
                <div className="text-xs text-muted-foreground">2026-05-17</div>
                <div><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit bg-amber-500/10 text-amber-600 dark:text-amber-400">Viewing</span></div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-foreground hover:bg-accent/80"><Eye className="w-3.5 h-3.5" /></div>
                  <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-foreground hover:bg-accent/80"><Download className="w-3.5 h-3.5" /></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Drive Overlay Modal Animation */}
        <AnimatePresence>
          {showDriveModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-card w-[400px] rounded-xl shadow-2xl border border-border flex flex-col pointer-events-auto"
              >
                <div className="p-6 border-b border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="w-5 h-5" alt="Drive" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">Send To Drive</h3>
                    <p className="text-xs text-muted-foreground">Choose destination folder for selected files</p>
                  </div>
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <label className="text-xs font-medium text-foreground">Drive folder link or ID</label>
                  <input
                    type="text"
                    className="w-full border border-border bg-background rounded-lg px-3 py-2 text-sm text-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                    value={step === 19 ? "https://drive.google.com/drive/folders/1A2b3C..." : ""}
                    readOnly
                    placeholder="Paste folder link here"
                  />
                </div>
                <div className="p-4 bg-muted/40 border-t border-border flex gap-2 justify-end rounded-b-xl">
                  <div className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-accent">Cancel</div>
                  <div className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-medium shadow-sm">Upload Here</div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>


    </div>
  );
};

const DemoCreateDocument = ({ activeSub }: { activeSub: string | null }) => {
  const [step, setStep] = useState(0);

  // Reset step when subsection changes
  useEffect(() => {
    if (!activeSub || activeSub === 'all') setStep(0);
    else if (activeSub === 'form') setStep(0);
    else if (activeSub === 'assign') setStep(7);
    else if (activeSub === 'config') setStep(14);
    else if (activeSub === 'send') setStep(20);
  }, [activeSub]);

  // Animation Loop Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => {
        if (!activeSub || activeSub === 'all') return (prev + 1) % 25;

        if (activeSub === 'form') return prev >= 6 ? 0 : prev + 1;
        if (activeSub === 'assign') return prev >= 13 ? 7 : prev + 1;
        if (activeSub === 'config') return prev >= 19 ? 14 : prev + 1;
        if (activeSub === 'send') return prev >= 23 ? 20 : prev + 1;

        return (prev + 1) % 25;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [activeSub]);

  // Flags for UI state based on step
  const isTemplateSelected = step >= 2;
  const isFormFilled = step >= 3;
  const isFileAdded = step >= 6;
  const isSearchTabActive = step >= 7;

  const hasUser1 = step >= 9;
  const hasUser2 = step >= 11;
  const hasUser3 = step >= 13;

  const isUser2MovedUp = step >= 15;
  const isUser3Parallel = step >= 17;
  const isUser1Limited = step >= 19;
  const isUser3Viewer = step >= 13; // Added as viewer immediately
  const isSending = step >= 22;

  // Determine current order of users
  // Initial (Steps 13-14): 1. Jane (1), 2. John (2), 3. Alex (3)
  // Step 15-16: User 2 Up -> 1. John (1), 2. Jane (2), 3. Alex (3)
  // Step 17+: User 3 Parallel with Jane -> 1. John (1), 2. Jane (2) & Alex (2)
  let user1Order = 1, user2Order = 2, user3Order = 3;
  let user1Step = 1, user2Step = 2, user3Step = 3;

  if (isUser2MovedUp) {
    user2Order = 0; // John goes to top
    user1Order = 1; // Jane moves down
    user3Order = 2; // Alex moves up relatively

    user2Step = 1;
    user1Step = 2;
    user3Step = 3;
  }

  if (isUser3Parallel) {
    user3Order = 1; // Alex becomes parallel with Jane (who is index 1 now)
    user3Step = 2; // Same step number as Jane
  }

  const activeSignatories = [];
  if (hasUser1) activeSignatories.push({ id: 1, name: 'Jane Doe', role: 'signer', limit: isUser1Limited ? '1' : 'all', orderIndex: user1Order, stepNum: user1Step, isParallelWithAbove: false });
  if (hasUser2) activeSignatories.push({ id: 2, name: 'John Smith', role: 'signer', limit: 'all', orderIndex: user2Order, stepNum: user2Step, isParallelWithAbove: false });
  if (hasUser3) activeSignatories.push({ id: 3, name: 'Alex Johnson', role: isUser3Viewer ? 'viewer' : 'signer', limit: 'all', orderIndex: user3Order, stepNum: user3Step, isParallelWithAbove: isUser3Parallel });

  // Sort them for rendering
  activeSignatories.sort((a, b) => {
    if (a.orderIndex === b.orderIndex) {
      if (a.id === 3) return 1; // Keep Alex below Jane when parallel
      return 0;
    }
    return a.orderIndex - b.orderIndex;
  });

  return (
    <div className="w-full h-full md:h-auto bg-background rounded-xl flex flex-col relative overflow-hidden md:overflow-visible shadow-sm border border-border text-sm select-none p-4 gap-4">

      <div className="flex-1 grid grid-cols-[1fr_240px] md:grid-cols-1 gap-4 items-start relative z-10">

        {/* Left Column */}
        <div className="flex flex-col gap-4">

          {/* Document Info */}
          <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-3 shadow-sm">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Document Info</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <FileText className="w-3 h-3 text-muted-foreground" /> Template
              </label>
              <div className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground flex items-center justify-between">
                <span>{isTemplateSelected ? 'Budget Request Form' : '— No template —'}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-muted-foreground" /> Title
              </label>
              <div className={`w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs transition-colors ${isFormFilled ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {isFormFilled ? '2026 Q3 Marketing Budget' : 'e.g. Request for Budget Approval'}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-3 shadow-sm">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Content</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-muted-foreground" /> Message
              </label>
              <div className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-xs min-h-[60px] transition-colors ${isFormFilled ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                {isFormFilled ? 'Please review the attached budget for next quarter.' : 'Enter the document body or message...'}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <Upload className="w-3 h-3 text-muted-foreground" /> Attach PDFs
              </label>

              {!isFileAdded ? (
                <div className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 transition-all duration-300 ${step === 5 ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-accent/30'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${step === 5 ? 'bg-primary/20 text-primary' : 'bg-accent text-muted-foreground'}`}>
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium mt-1">
                    {step === 5 ? 'Drop files here' : 'Drag & drop or click'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center shrink-0">1</div>
                    <span className="text-xs text-foreground truncate flex-1 font-medium">budget_v1.pdf</span>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                    <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center shrink-0">2</div>
                    <span className="text-xs text-foreground truncate flex-1 font-medium">quotes.pdf</span>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </motion.div>
                  <div className="flex items-center justify-center gap-1 rounded-lg border border-border bg-accent/50 px-3 py-1.5 text-xs font-medium text-foreground">
                    <Plus className="w-3 h-3" /> Add more files
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">

          {/* Signatories Queue */}
          <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 shadow-sm min-h-[150px]">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3" /> Assign Signatories
            </p>

            <div className="flex flex-col gap-0 mt-1">
              <AnimatePresence mode="popLayout">
                {activeSignatories.map((sig) => (
                  <motion.div
                    layout
                    key={sig.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col"
                  >
                    {sig.isParallelWithAbove && (
                      <div className="flex items-center justify-center h-4">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-blue-500/15 text-blue-600">
                          <Link2 className="w-2.5 h-2.5" /> parallel — click to separate
                        </div>
                      </div>
                    )}
                    <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${sig.isParallelWithAbove ? "bg-blue-500/5 border border-blue-500/20" : "bg-accent/50"}`}>
                      <span className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0 ${sig.isParallelWithAbove ? "bg-blue-500 text-white" : "bg-primary text-primary-foreground"}`}>
                        {sig.stepNum}
                      </span>
                      <p className="text-[10px] font-medium text-foreground truncate flex-1">{sig.name}</p>

                      {/* Viewer Badge / Toggle */}
                      <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${sig.role === 'viewer' ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                        {sig.role === 'viewer' ? 'Viewer' : 'Signer'}
                      </span>

                      {/* Limit Input */}
                      <div className={`w-6 h-4 rounded border flex items-center justify-center text-[8px] bg-background ${step >= 19 && sig.id === 1 ? 'border-primary ring-1 ring-primary/30' : 'border-border text-muted-foreground'}`}>
                        {sig.limit}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        <X className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {activeSignatories.length === 0 && (
                <div className="text-[10px] text-muted-foreground/60 text-center py-4">No signatories added yet</div>
              )}
            </div>
          </div>

          {/* User Picker */}
          <div className="border border-border rounded-xl bg-background/50 overflow-hidden shadow-sm">
            <div className="flex border-b border-border">
              <div className={`flex-1 py-1.5 text-[10px] text-center font-semibold transition ${!isSearchTabActive ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                By Office
              </div>
              <div className={`flex-1 py-1.5 text-[10px] text-center font-semibold transition ${isSearchTabActive ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                Search
              </div>
            </div>

            <div className="p-2 flex flex-col gap-2">
              <div className="w-full rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground flex items-center gap-1">
                <Search className="w-3 h-3" />
                {isSearchTabActive ? "Search by name..." : "Search office..."}
              </div>

              <div className="border border-border rounded-md overflow-hidden flex flex-col">
                <div className={`flex items-center gap-2 w-full px-2 py-1.5 text-left border-b border-border transition-colors ${getHighlightClass(step === 8 || step === 9)} ${!hasUser1 && isSearchTabActive ? 'hover:bg-accent' : 'opacity-40 grayscale pointer-events-none'}`}>
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">J</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground truncate">Jane Doe</p>
                    <p className="text-[8px] text-muted-foreground truncate">Finance</p>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0 opacity-80">
                    <div className="text-[7px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold text-center">Signer</div>
                    <div className="text-[7px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold text-center">Viewer</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 w-full px-2 py-1.5 text-left border-b border-border transition-colors ${getHighlightClass(step === 10 || step === 11)} ${!hasUser2 && isSearchTabActive ? 'hover:bg-accent' : 'opacity-40 grayscale pointer-events-none'}`}>
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">J</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground truncate">John Smith</p>
                    <p className="text-[8px] text-muted-foreground truncate">Operations</p>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0 opacity-80">
                    <div className="text-[7px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold text-center">Signer</div>
                    <div className="text-[7px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold text-center">Viewer</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 w-full px-2 py-1.5 text-left transition-colors ${getHighlightClass(step === 12 || step === 13)} ${!hasUser3 && isSearchTabActive ? 'hover:bg-accent' : 'opacity-40 grayscale pointer-events-none'}`}>
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">A</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground truncate">Alex Johnson</p>
                    <p className="text-[8px] text-muted-foreground truncate">HR</p>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0 opacity-80">
                    <div className="text-[7px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold text-center">Signer</div>
                    <div className="text-[7px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold text-center">Viewer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Send Button */}
          <div className={`mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm transition-all duration-300 ${getHighlightClass(step === 20 || step === 21)} ${isSending ? 'bg-primary/80 scale-[0.98]' : 'bg-primary hover:bg-primary/90'}`}>
            {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSending ? 'Sending...' : 'Send Document'}
          </div>

        </div>
      </div>
    </div>
  );
};

const DemoSignatureSettings = ({ activeSub }: { activeSub: string | null }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => {
        if (activeSub === 'cert') return prev >= 4 ? 0 : prev + 1;
        if (activeSub === 'designer') return prev >= 12 ? 5 : prev + 1;
        return (prev + 1) % 13;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [activeSub]);

  // Derived state based on step
  const isTypingBr = step === 2;
  const isTypingSpace = step === 3;
  const isDraggingImg = step === 5;
  const isDraggingText = step === 6;
  const isLockingRatio = step === 9;
  const isSaving = step === 12;

  return (
    <div className="w-full h-full md:h-auto bg-background rounded-xl flex flex-col relative overflow-hidden md:overflow-visible shadow-sm border border-border text-sm select-none p-4 gap-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-purple-500" />
        <h2 className="font-bold text-lg text-foreground">Signature Settings</h2>
      </div>

      <div className="flex md:flex-col gap-4 h-full md:h-auto">
        {/* Left Column */}
        <div className="w-1/2 md:w-full flex flex-col gap-4">

          {/* Certificate Card */}
          <div className="border border-border rounded-xl p-4 bg-card shadow-sm flex flex-col gap-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5"><Key className="w-4 h-4 text-muted-foreground" /> Digital Certificate</h3>

            <div className={`flex flex-col gap-1.5 ${getHighlightClass(step === 1)} rounded-lg p-1`}>
              <div className="text-xs text-muted-foreground">P12/PFX File</div>
              <div className="border border-border rounded bg-background px-3 py-2 flex justify-between items-center text-xs">
                <span className="text-foreground font-mono">ian_nico.p12</span>
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 p-1">
              <div className="text-xs text-muted-foreground">Password</div>
              <div className="border border-border rounded bg-background px-3 py-2 text-xs">**********</div>
            </div>
          </div>

          {/* Details Card */}
          <div className="border border-border rounded-xl p-4 bg-card shadow-sm flex flex-col gap-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5"><User className="w-4 h-4 text-muted-foreground" /> Signatory Details</h3>

            <div className={`flex flex-col gap-1.5 ${getHighlightClass(step === 2)} rounded-lg p-1`}>
              <div className="text-xs text-muted-foreground flex justify-between">
                Display Name
                {isTypingBr && <span className="text-[9px] text-primary bg-primary/10 px-1 rounded animate-pulse">Typing &lt;br/&gt;...</span>}
              </div>
              <div className="border border-border rounded bg-background px-3 py-2 text-xs flex items-center">
                Ian Nico {step >= 2 ? <span className="text-blue-500 mx-1 font-mono">&lt;br/&gt;</span> : ' '} Caulin
              </div>
            </div>

            <div className={`flex flex-col gap-1.5 ${getHighlightClass(step === 3)} rounded-lg p-1`}>
              <div className="text-xs text-muted-foreground flex justify-between">
                Position / Title
                {isTypingSpace && <span className="text-[9px] text-primary bg-primary/10 px-1 rounded animate-pulse">Typing Space...</span>}
              </div>
              <div className="border border-border rounded bg-background px-3 py-2 text-xs h-8 flex items-center">
                {step >= 3 ? (step === 3 ? <span className="w-2 h-4 bg-primary/20 animate-pulse rounded" /> : null) : 'ISA III'}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 p-1">
              <label className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5 cursor-pointer">
                <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-primary" />
                <span className="text-xs font-medium">Add "Digitally Signed by:" label</span>
              </label>
            </div>

            <div className="flex flex-col gap-1.5 p-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-primary" /> Signature Image
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded border border-border w-16 h-8 bg-white flex justify-center items-center">
                  <svg viewBox="0 0 100 30" className="w-full h-full stroke-blue-900 fill-none px-2" strokeWidth="2" preserveAspectRatio="none">
                    <path d="M10,20 Q20,5 30,15 T50,15 T70,5 T90,20" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <button className="p-1 rounded border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Stamp Designer) */}
        <div className="w-1/2 md:w-full border border-border rounded-xl p-4 bg-card shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-muted-foreground" /> Stamp Designer</h3>

          <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 py-0.5 bg-primary/5 rounded-r">
            Preview is interactive. Drag elements to position them.
          </div>

          {/* Preview Box */}
          <div className={`border-2 border-dashed border-border rounded-lg h-24 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmM2YzZjMiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2YzZjNmMyI+PC9yZWN0Pgo8L3N2Zz4=')] ${getHighlightClass(step === 4 || step === 5 || step === 6)}`}>

            <motion.div
              className={`absolute flex flex-col items-center justify-center p-1 rounded border-2 ${isDraggingImg ? 'border-primary bg-primary/10 z-10' : 'border-transparent'}`}
              initial={{ top: '20%', left: '10%' }}
              animate={{
                top: isDraggingImg ? '40%' : '20%',
                left: isDraggingImg ? '30%' : '10%',
                scale: step >= 8 ? 1.25 : 1
              }}
              transition={{ type: "spring", damping: 15 }}
            >
              <div className="w-10 h-10 bg-red-500/20 rounded flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-red-500" />
              </div>
            </motion.div>

            <motion.div
              className={`absolute flex flex-col p-1 rounded border-2 ${isDraggingText ? 'border-primary bg-primary/10 z-10' : 'border-transparent'}`}
              initial={{ top: '15%', left: '50%' }}
              animate={{
                top: isDraggingText ? '30%' : '15%',
                left: isDraggingText ? '40%' : '50%',
                scale: step >= 7 ? 1.25 : 1
              }}
              transition={{ type: "spring", damping: 15 }}
            >
              <div className="text-[6px] text-blue-600 mb-0.5 leading-tight">Digitally Signed by:</div>
              <div className="font-bold text-[10px] text-blue-900 leading-tight">
                Ian Nico{step >= 2 ? <br /> : ' '}Caulin
              </div>
              <div className="text-[7px] text-blue-600 mt-0.5">{step >= 3 ? '' : 'ISA III'}</div>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto">
            {/* Dimensions */}
            <div className={`col-span-2 flex flex-col gap-3 ${getHighlightClass(step === 7 || step === 8)} rounded p-1`}>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-medium items-center">
                  <span className="text-foreground flex items-center gap-1.5"><Type className="w-3 h-3 text-blue-500" /> Text Size</span>
                  <span className="bg-blue-600 text-white rounded px-1.5 py-0.5 font-mono text-[9px]">
                    {step >= 7 ? '25%' : '18%'} of height
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">5%</span>
                  <input type="range" className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all duration-300" value={step >= 7 ? 25 : 18} min={5} max={50} readOnly />
                  <span className="text-[9px] text-muted-foreground">50%</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-medium items-center">
                  <span className="text-foreground flex items-center gap-1.5"><ImageIcon className="w-3 h-3 text-blue-500" /> Image Width</span>
                  <span className="bg-accent text-foreground rounded px-1.5 py-0.5 font-mono text-[9px]">
                    {step >= 8 ? '70%' : '55%'} of stamp
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">5%</span>
                  <input type="range" className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all duration-300" value={step >= 8 ? 70 : 55} min={5} max={100} readOnly />
                  <span className="text-[9px] text-muted-foreground">100%</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-medium items-center">
                  <span className="text-foreground">Default Stamp Width</span>
                  <span className="bg-accent text-foreground rounded px-1.5 py-0.5 font-mono text-[9px]">104 pt</span>
                </div>
                <input type="range" className="w-full h-1.5 bg-accent rounded-lg appearance-none cursor-pointer accent-blue-500" value={104} min={50} max={200} readOnly />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-medium items-center">
                  <span className="text-foreground">Default Stamp Height</span>
                  <span className="bg-accent text-foreground rounded px-1.5 py-0.5 font-mono text-[9px]">50 pt</span>
                </div>
                <input type="range" className="w-full h-1 bg-accent rounded-lg appearance-none cursor-pointer accent-blue-500" value={50} min={15} max={100} readOnly />
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <button className={`flex-1 py-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-1.5 ${getHighlightClass(step === 9)} ${isLockingRatio ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-foreground'}`}>
                {isLockingRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                Lock Aspect Ratio
              </button>
            </div>

            {/* Styling */}
            <div className={`col-span-2 grid grid-cols-3 gap-2 p-1 rounded ${getHighlightClass(step >= 10 && step <= 11)}`}>
              <div className="col-span-3 text-[10px] text-muted-foreground font-medium">Styling</div>
              <div className="border border-border rounded bg-background px-2 py-1 text-[10px] flex items-center justify-between col-span-2">
                <span>Inter, sans-serif</span>
                <ChevronDown className="w-3 h-3" />
              </div>
              <div className="flex gap-1">
                <div className="flex-1 border border-border rounded bg-background flex items-center justify-center font-bold text-[10px]">B</div>
                <div className="flex-1 border border-border rounded bg-background flex items-center justify-center italic text-[10px]">I</div>
              </div>
            </div>
          </div>

          <button className={`w-full py-2 mt-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all duration-300 ${getHighlightClass(step === 12)} ${isSaving ? 'bg-primary/80 scale-[0.98]' : 'bg-primary'}`}>
            {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div >
  );
};


const DemoSignDocument = ({ activeSub }: { activeSub: string | null }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => {
        if (activeSub === 'stamp') return prev >= 4 ? 0 : prev + 1;
        if (activeSub === 'batch') return prev >= 8 ? 5 : prev + 1;
        if (activeSub === 'uploads_comments') return prev >= 12 ? 9 : prev + 1;
        if (activeSub === 'digital_signing') return prev >= 21 ? 13 : prev + 1;
        if (activeSub === 'manual_signing') return prev >= 26 ? 22 : prev + 1;
        return (prev + 1) % 27;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [activeSub]);

  // Stamping (0-4)
  const isViewingPDF = step === 0;
  const isPlacingStampClicked = step >= 1 && step <= 4;
  const stampTop = step < 1 ? '10%' : step < 3 ? '50%' : '72%';
  const stampLeft = step < 1 ? '70%' : step < 3 ? '40%' : '60%';
  const stampScale = step >= 4 ? 1.25 : 1;
  const showResizeHandles = step >= 3 && step <= 4;

  // Batch (5-8)
  const isHighlightingByPage = step === 5;
  const isByPageClicked = step >= 6;
  const isHighlightingByFile = step === 7;
  const isByFileClicked = step >= 8;

  // Uploads & Comments (9-12)
  const isHighlightingAddFile = step === 9;
  const isAdditionalFileUploaded = step >= 10 && step <= 12;
  const isHighlightingRemarks = step === 11;
  const isCommenting = step === 12;

  // Digital Signing & Rejection (13-21)
  const isHighlightingSign = step === 13;
  const isSigningClicked = step >= 14 && step <= 16;
  const isSigningSuccess = step >= 15 && step <= 16;
  const isHighlightingDecline = step === 17;
  const isDeclineClicked = step >= 18 && step <= 21;
  const isDeclineReasonTyped = step >= 19;
  const isHighlightingConfirmDecline = step === 20;
  const isConfirmDeclineClicked = step === 21;

  // Manual Signing (22-26)
  const isHighlightingManual = step === 22;
  const isManualMode = step >= 23 && step <= 26;
  const isHighlightingManualUpload = step === 24;
  const isManualUploaded = step >= 25 && step <= 26;
  const isHighlightingSubmit = step === 26;

  return (
    <div className="w-full h-full md:h-auto flex md:flex-col rounded-xl border border-border overflow-hidden md:overflow-visible bg-background text-sm select-none shadow-sm relative">

      {/* Left Sidebar */}
      <div className="w-80 md:w-full border-r md:border-r-0 md:border-b border-border bg-card flex flex-col shrink-0 p-5 gap-5 md:overflow-y-visible z-10 relative">
        <div className="flex items-center gap-2 mb-2 border-b border-border pb-3">
          <FileSignature className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-lg text-foreground">Sign Document</h2>
        </div>

        {/* File List Mock */}
        <div className={`bg-background border border-border rounded-xl px-4 py-4 flex flex-col gap-3 ${getHighlightClass(isHighlightingByFile)}`}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Files</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between p-2 rounded bg-accent/50 text-[11px] border border-primary/20 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" /> Memorandum_2026.pdf
              </div>
              {isByFileClicked && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-700 font-bold">3p</span>}
            </div>

            {isByFileClicked && (
              <div className="flex items-center justify-between p-2 rounded bg-background text-[11px] border border-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Appendix.pdf
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-700 font-bold">1p</span>
              </div>
            )}

            {isAdditionalFileUploaded && (
              <div className="flex items-center gap-2 p-2 rounded bg-background text-[11px] border border-border">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Additional_Attachment.pdf
              </div>
            )}
          </div>
        </div>

        {/* Attach Additional File */}
        <div className={`border-2 border-dashed rounded-xl px-4 py-3 flex flex-col items-center justify-center gap-1 bg-background text-center ${getHighlightClass(isHighlightingAddFile)} border-border transition-colors`}>
          <Upload className="w-4 h-4 text-muted-foreground mb-1" />
          <span className="text-[10px] font-medium text-foreground">Attach Additional File</span>
          <span className="text-[9px] text-muted-foreground">(Optional)</span>
        </div>

        {/* Signing Controls */}
        <div className="flex flex-col gap-4 mt-auto pt-4 border-t border-border">
          <div className={`flex rounded-lg border border-border bg-accent/40 p-1 gap-1 ${getHighlightClass(isHighlightingManual)}`}>
            <button className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${!isManualMode ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:bg-card/50'}`}>
              <Key className="w-3 h-3" /> Digital
            </button>
            <button className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${isManualMode ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:bg-card/50'}`}>
              <PenLine className="w-3 h-3" /> Manual
            </button>
          </div>

          {isManualMode ? (
            <div className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition ${getHighlightClass(isHighlightingManualUpload)} ${isManualUploaded ? "border-green-500/50 bg-green-500/5" : "border-border bg-background"}`}>
              {isManualUploaded ? (
                <><CheckCircle2 className="w-5 h-5 text-green-500" /><p className="text-xs font-medium text-foreground text-center">signed_copy.pdf</p></>
              ) : (
                <><Upload className="w-5 h-5 text-muted-foreground" /><p className="text-xs text-muted-foreground text-center">Drop PDF here to upload your signed copy</p></>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Remarks <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                className={`w-full h-14 text-[11px] p-2.5 rounded-lg border border-border bg-background resize-none focus:outline-none ${getHighlightClass(isHighlightingRemarks)}`}
                placeholder="Add a note about your signature..."
                value={isCommenting ? "Please review the updated pages." : ""}
                readOnly
              />
            </div>
          )}

          {/* Progress Bar for Digital Sign */}
          {isSigningClicked && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                {isSigningSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Loader className="w-4 h-4 animate-spin" />}
                <span className="font-medium">{isSigningSuccess ? "Signed successfully" : "Signing in progress..."}</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-blue-200/70 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: isSigningSuccess ? '100%' : '35%' }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!isManualMode ? (
              <>
                <button className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-destructive/60 text-destructive text-xs font-semibold transition-all ${getHighlightClass(isHighlightingDecline)} hover:bg-destructive/10`}>
                  <XCircle className="w-3.5 h-3.5" /> Decline
                </button>
                <button className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all ${getHighlightClass(isHighlightingSign)} ${isSigningClicked ? 'opacity-80 scale-[0.98]' : ''}`}>
                  <Key className="w-3.5 h-3.5" /> Sign
                </button>
              </>
            ) : (
              <button className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition ${getHighlightClass(isHighlightingSubmit)}`}>
                <PenLine className="w-3.5 h-3.5" /> Submit Signed Copy
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Main Panel */}
      <div className="flex-1 flex flex-col relative bg-muted/20 min-w-0">

        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card z-10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-accent/50 rounded px-1 border border-border/50">
              <button className="p-1 rounded hover:bg-background text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[11px] text-muted-foreground font-mono w-8 text-center">1/3</span>
              <button className="p-1 rounded hover:bg-background text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
            </div>

            {/* Signed Page Indicator */}
            {isByPageClicked && (
              <span className="ml-2 flex items-center gap-1 text-[10px] text-green-600 font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                <CheckCircle2 className="w-3 h-3" /> signed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-colors ${step === 1 ? 'bg-blue-700 shadow-inner scale-95' : 'bg-blue-600'}`}>
              <MousePointer2 className="w-3.5 h-3.5" /> Place Signature
            </button>
            <div className="flex items-center justify-center gap-1 bg-background rounded-lg border border-border p-1 shadow-sm">
              <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${getHighlightClass(isHighlightingByPage)} ${isByPageClicked && !isByFileClicked ? 'bg-blue-600 text-white shadow' : 'text-muted-foreground hover:bg-accent'}`}>
                <Layers className="w-3.5 h-3.5" /> By Page
              </button>
              <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${getHighlightClass(isHighlightingByFile)} ${isByFileClicked ? 'bg-blue-600 text-white shadow' : 'text-muted-foreground hover:bg-accent'}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> By File
              </button>
            </div>
          </div>
        </div>

        {/* Badge Bar under Header when ByPage is clicked */}
        {isByPageClicked && (
          <div className="border-b border-border px-5 py-2 flex items-center gap-2 bg-accent/30">
            <span className="text-[10px] text-muted-foreground">Signed pages:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(p => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-green-500/15 text-green-700 border border-green-500/20 shadow-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PDF Canvas */}
        <div className="flex-1 relative flex justify-center p-6 overflow-hidden bg-gray-200">
          <div className={`w-[85%] max-w-[600px] h-[100%] bg-white rounded flex flex-col gap-3 p-8 shadow-md border border-gray-300 relative ${getHighlightClass(isViewingPDF)}`}>
            <div className="h-5 w-1/2 bg-gray-200 rounded"></div>
            <div className="h-2.5 w-full bg-gray-100 rounded mt-6"></div>
            <div className="h-2.5 w-full bg-gray-100 rounded"></div>
            <div className="h-2.5 w-3/4 bg-gray-100 rounded"></div>
            <div className="mt-auto border-t border-dashed border-gray-300 pt-4 flex justify-end">
              <div className="w-32 h-16 border-2 border-dashed border-blue-300 rounded flex items-center justify-center text-[10px] font-medium text-blue-400">
                Sign Here
              </div>
            </div>
          </div>

          {/* Stamp being dragged */}
          <motion.div
            className={`absolute border-2 border-dashed border-blue-500 bg-white/95 rounded p-1.5 flex flex-col items-center justify-center shadow-lg z-20 ${showResizeHandles ? 'cursor-move' : ''}`}
            initial={{ top: '10%', left: '70%', opacity: 0, scale: 1 }}
            animate={{
              top: stampTop,
              left: stampLeft,
              opacity: isPlacingStampClicked ? 1 : 0,
              scale: stampScale
            }}
            transition={{ type: "spring", damping: 15 }}
          >
            <div className="text-[7px] text-blue-600 mb-0.5 leading-none">Digitally Signed by:</div>
            <div className="font-bold text-[10px] text-blue-900 leading-tight text-center">Ian Nico<br />Caulin</div>
            <div className="text-[6px] text-blue-600 mt-0.5">ISA III</div>

            {/* Resize Handles */}
            {showResizeHandles && (
              <>
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm"></div>
              </>
            )}
          </motion.div>
        </div>

      </div>

      {/* Decline modal overlay */}
      {isDeclineClicked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm rounded-xl">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-[90%] max-w-sm p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Decline to Sign</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Please provide a reason so the sender understands why the document was declined.</p>
              </div>
            </div>

            <textarea rows={3} placeholder="Reason for declining (optional but recommended)..."
              value={isDeclineReasonTyped ? "The appendix is missing crucial signatures. Please update." : ""}
              readOnly
              className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none resize-none transition ${getHighlightClass(isHighlightingDecline && !isDeclineReasonTyped)}`} />

            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition">
                Cancel
              </button>
              <button className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive text-white text-xs font-semibold transition ${getHighlightClass(isHighlightingConfirmDecline)} ${isConfirmDeclineClicked ? 'scale-[0.98] opacity-90' : 'hover:opacity-90'}`}>
                {isConfirmDeclineClicked ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Declining...</> : <><XCircle className="w-3.5 h-3.5" /> Confirm Decline</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


// ── Main Layout ─────────────────────────────────────────────────────────────

interface SubSection {
  id: string;
  title: string;
  desc: React.ReactNode;
}

interface Section {
  id: string;
  title: string;
  icon: JSX.Element;
  bg: string;
  color: string;
  desc: string;
  subSections?: SubSection[];
  demo: (activeSub: string | null) => JSX.Element;
}

const SECTIONS: Section[] = [
  {
    id: "create-document",
    title: "Creating & Routing",
    icon: <PlusCircle className="w-5 h-5 text-green-500" />,
    bg: "bg-green-500/10",
    color: "text-green-500",
    desc: "The Create Document page allows you to upload new files and assign signatories.",
    subSections: [
      { id: "form", title: "Form Details & Uploading", desc: "Select a template (or leave it empty), fill in details, and drag & drop PDF files to attach them." },
      { id: "assign", title: "Assigning Signatories/Viewer", desc: "Search for users and add them to the routing list as either signatories or viewers." },
      {
        id: "config",
        title: "Configuring Routing",
        desc: (
          <div className="flex flex-col gap-2 mt-2">
            <p><strong>Setting Order:</strong> The order number determines who receives the file first. A signatory must finish signing before the system proceeds to the next person.</p>
            <p><strong>Parallel & Sequential:</strong> You can link multiple signatories on the same order number, enabling them to receive and sign the document at the same time.</p>
            <p><strong>Page/Sign Limit:</strong> Define exactly which attached files a signatory should sign depending on the file order number (e.g., typing '1' means they only sign the first file).</p>
          </div>
        )
      },
      {
        id: "send",
        title: "Sending Document",
        desc: "If everything is triple checked, click the send button to send your document to the first signatory. They will be notified via their account email. Once they have signed, we will let you know via email."
      }
    ],
    demo: (activeSub) => <DemoCreateDocument activeSub={activeSub} />
  },
  {
    id: "my-documents",
    title: "Dashboard & Management",
    icon: <FileText className="w-5 h-5 text-blue-500" />,
    bg: "bg-blue-500/10",
    color: "text-blue-500",
    desc: "The My Documents page is your central hub for tracking and managing all documents.",
    subSections: [
      { id: "view", title: "View & Download", desc: "Click the Eye icon to view details, or the Download icon to download the document." },
      { id: "status", title: "Status Filters", desc: "Use the tabs at the top (Completed, For Signing, etc.) to quickly filter documents by status." },
      { id: "advanced", title: "Advanced Filters", desc: "Click any filter pill to filter by Type, Date, Office, and Project." },
      { id: "batch", title: "Batch Actions & Export", desc: "Check multiple rows to download, print, or send them all directly to Google Drive." },
    ],
    demo: (activeSub) => <DemoMyDocuments activeSub={activeSub} />
  },

  {
    id: "signature-settings",
    title: "Signature Settings",
    icon: <Settings className="w-5 h-5 text-purple-500" />,
    bg: "bg-purple-500/10",
    color: "text-purple-500",
    desc: "Configure your digital signature appearance and credentials.",
    subSections: [
      {
        id: "cert",
        title: "Digital Certificate & Details",
        desc: <>
          Upload your <span className="font-semibold text-foreground">.p12 or .pfx</span> certificate. <br />
          In the <strong>Display Name</strong>, use <code>&lt;br/&gt;</code> to force a new line (e.g., <i>Ian Nico &lt;br/&gt; Caulin</i>).<br />
          To leave the <strong>Position / Title</strong> empty, simply type a single space character.
        </>
      },
      {
        id: "designer",
        title: "Stamp Designer Tutorial",
        desc: <>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Drag & Drop:</strong> You can drag the text and image directly inside the preview to position them.</li>
            <li><strong>Sizing Impact:</strong> Adjusting width/height changes the size on the final document, not just the preview. <i>We suggest leaving defaults unless counter-signing.</i></li>
            <li><strong>Aspect Ratio:</strong> Use the "Lock Aspect Ratio" button if you need to scale the stamp proportionally.</li>
            <li>Customize fonts and colors, then click <strong>Save</strong> when you're done!</li>
          </ul>
        </>
      }
    ],
    demo: (activeSub: string | null) => <DemoSignatureSettings activeSub={activeSub} />
  },
  {
    id: "sign-document",
    title: "Signing Documents",
    icon: <FileSignature className="w-5 h-5 text-orange-500" />,
    bg: "bg-orange-500/10",
    color: "text-orange-500",
    desc: "Open a document from the Dashboard to apply your signature.",
    subSections: [
      { id: "stamp", title: "Viewing & Placing Stamp", desc: "View the PDF and drag the signature stamp onto the document canvas." },
      { id: "batch", title: "Batch Signing", desc: "Select multiple files in the list to apply your signature to all of them simultaneously." },
      { id: "uploads_comments", title: "Uploads & Comments", desc: "Attach additional files (optional) and add routing comments for the next person." },
      { id: "digital_signing", title: "Digital Signing & Rejection", desc: "Digitally sign the document or completely reject it back to previous steps." },
      { id: "manual_signing", title: "Manual Signing", desc: "Toggle to Manual mode to upload a physically signed or scanned copy of the file." }
    ],
    demo: (activeSub: string | null) => <DemoSignDocument activeSub={activeSub} />
  }
];

const UserManual = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>(SECTIONS[0].id);
  const [activeSubSectionId, setActiveSubSectionId] = useState<string | null>(null);

  const currentSection = SECTIONS.find(s => s.id === activeSectionId)!;

  // Reset subsection when changing main section
  const handleSectionChange = (id: string) => {
    setActiveSectionId(id);
    setActiveSubSectionId(null);
  };

  return (
    <UserLayout title="User Manual" subtitle="Interactive guide to using the Document Management System">
      <div className="w-full  mx-auto flex flex-col gap-6 pb-10 min-h-screen">

        {/* Header Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
          {SECTIONS.map((section) => {
            const isActive = activeSectionId === section.id;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-t-lg'
                  }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isActive ? section.bg : 'bg-transparent'}`}>
                  {section.icon}
                </div>
                <span className="font-semibold text-sm">{section.title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 grid grid-cols-3 md:grid-cols-1 gap-6">

          {/* Left: Text & Submenus */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSectionId + "-text"}
                variants={fadeVar}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.2 }}
                className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentSection.bg}`}>
                    {currentSection.icon}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">{currentSection.title}</h2>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {currentSection.desc}
                </p>

                {/* Sub Menus (Clickable) */}
                {currentSection.subSections && (
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Animation Chapters</div>
                    {currentSection.subSections.map((sub) => {
                      const isActive = activeSubSectionId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSubSectionId(isActive ? null : sub.id)}
                          className={`text-left p-4 rounded-xl border transition-all duration-300 flex items-start gap-3 group ${isActive
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border bg-background hover:border-primary/50 hover:bg-accent/50'
                            }`}
                        >
                          <div className={`mt-0.5 rounded-full flex items-center justify-center transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}>
                            <PlayCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <div className={`font-semibold text-sm mb-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                              {sub.title}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              {sub.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {activeSubSectionId && (
                      <button
                        onClick={() => setActiveSubSectionId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 font-medium"
                      >
                        <RefreshCw className="w-3 h-3" /> Play full sequence
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Animated Demo */}
          <div className="flex flex-col col-span-2 gap-4">
            <div className="flex items-center gap-2 px-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                {activeSubSectionId ? 'Playing Chapter...' : 'Live Demo Loop'}
              </span>
            </div>

            <div className="flex-1 relative rounded-2xl bg-muted/40 border border-border p-4 min-h-[500px] md:min-h-0 shadow-inner">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSectionId + "-demo"}
                  variants={fadeVar}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="w-full h-full md:h-auto absolute inset-0 md:relative md:inset-auto p-4 md:p-0 overflow-hidden md:overflow-visible"
                >
                  {currentSection.demo(activeSubSectionId)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </UserLayout>
  );
};

export default UserManual;
