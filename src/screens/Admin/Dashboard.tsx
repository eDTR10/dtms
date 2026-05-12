import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Users, Building2, LayoutTemplate,
  Clock, Send, CheckCircle2, XCircle,
  TrendingUp, ArrowRight, RefreshCw, Loader2,
  Activity, AlertTriangle, BarChart3, Zap, Flame, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import AdminLayout from "./AdminLayout";
import { documentApi, userApi, officeApi, templateApi, Document, UserProfile, Office, DocumentTemplate } from "../../services/api";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (str: string) =>
  new Date(str).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const fmtShortMonth = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short" });

const pct = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const daysSince = (dateString: string) => {
  const timestamp = new Date(dateString).getTime();

  if (Number.isNaN(timestamp)) return 0;

  const diff = Date.now() - timestamp;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

/** Derive effective status from signatory data (excludes viewers) */
const getEffectiveStatus = (doc: Document): string => {
  const sigs = doc.signatories ?? [];
  const signers = sigs.filter(s => s.role !== "viewer");
  const total = signers.length;
  const signed = signers.filter(s => s.status === "signed").length;
  const rejected = signers.filter(s => s.status === "rejected").length;

  if (doc.status === "Pending") return "Pending";
  if (rejected > 0) return "Rejected";
  if (total > 0 && signed === total) return "Completed";
  if (doc.status === "For Signing") return "For Signing";
  return doc.status;
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "For Signing": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  Rejected: "bg-destructive/10 text-destructive",
};

const STATUS_BAR: Record<string, string> = {
  Pending: "bg-yellow-500",
  "For Signing": "bg-blue-500",
  Completed: "bg-green-500",
  Rejected: "bg-destructive",
};

const TREND_METRICS = ["All", "Pending", "For Signing", "Completed", "Rejected"] as const;
type TrendMetric = (typeof TREND_METRICS)[number];

const Dashboard = () => {
  const navigate = useNavigate();

  const [docs, setDocs] = useState<Document[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendWindow, setTrendWindow] = useState<6 | 12>(6);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("All");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredSegmentStatus, setHoveredSegmentStatus] = useState<string | null>(null);

  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [d, u, o, t] = await Promise.all([
        documentApi.list(),
        userApi.list(),
        officeApi.list(),
        templateApi.list(),
      ]);
      setDocs(d);
      setUsers(u);
      setOffices(o);
      setTemplates(t);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Prevent double fetch in React 18 StrictMode
  const didFetch = useRef(false);
  useEffect(() => {
    if (!didFetch.current) {
      fetchAll();
      didFetch.current = true;
    }
  }, []);

  // ── derived stats ──────────────────────────────────────────────────────────
  const total = docs.length;
  const pending = docs.filter(d => getEffectiveStatus(d) === "Pending").length;
  const forSigning = docs.filter(d => getEffectiveStatus(d) === "For Signing").length;
  const completed = docs.filter(d => getEffectiveStatus(d) === "Completed").length;
  const rejected = docs.filter(d => getEffectiveStatus(d) === "Rejected").length;
  const activeUsers = users.filter(u => u.is_active).length;

  const statuses = ["Pending", "For Signing", "Completed", "Rejected"] as const;

  const statusCounts = {
    Pending: pending,
    "For Signing": forSigning,
    Completed: completed,
    Rejected: rejected,
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const completionRate = pct(completed, total);
  const rejectionRate = pct(rejected, total);

  const routedDocs = docs.filter(doc => doc.total_signatories > 0);
  const averageSignatories = total > 0
    ? (docs.reduce((sum, doc) => sum + doc.total_signatories, 0) / total).toFixed(1)
    : "0.0";
  const averageWorkflowProgress = routedDocs.length > 0
    ? Math.round(
      routedDocs.reduce((sum, doc) => sum + (doc.signed_count / doc.total_signatories) * 100, 0) / routedDocs.length,
    )
    : 0;

  const actionableDocs = docs.filter(doc => { const eff = getEffectiveStatus(doc); return eff === "Pending" || eff === "For Signing"; });
  const stalledDocs = actionableDocs.filter(doc => daysSince(doc.updatedAt || doc.datesubmitted) >= 7).length;
  const avgDocumentAge = actionableDocs.length > 0
    ? Math.round(
      actionableDocs.reduce((sum, doc) => sum + daysSince(doc.updatedAt || doc.datesubmitted), 0) / actionableDocs.length,
    )
    : 0;

  const recentDocs = [...docs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  // ── new analytics ──────────────────────────────────────────────────────────
  // Velocity: docs completed in last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const completedLast7 = docs.filter(d => getEffectiveStatus(d) === "Completed" && new Date(d.updatedAt).getTime() >= sevenDaysAgo).length;
  const velocityPerDay = completedLast7 > 0 ? (completedLast7 / 7).toFixed(1) : "0.0";

  // Health score (0-100)
  const healthScore = useMemo(() => {
    if (total === 0) return 100;
    const completionW = completionRate * 0.4;
    const stalledW = Math.max(0, 100 - stalledDocs * 10) * 0.3;
    const rejW = Math.max(0, 100 - rejectionRate * 2) * 0.3;
    return Math.round(completionW + stalledW + rejW);
  }, [total, completionRate, stalledDocs, rejectionRate]);

  const healthColor = healthScore >= 75 ? "#22c55e" : healthScore >= 50 ? "#eab308" : "#ef4444";
  const healthLabel = healthScore >= 75 ? "Excellent" : healthScore >= 50 ? "Fair" : "Needs Attention";

  // Weekly heatmap (last 4 weeks, Mon-Sun)
  const weeklyHeatmap = useMemo(() => {
    const weeks: number[][] = [];
    const today = new Date();
    for (let w = 3; w >= 0; w--) {
      const week: number[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (w * 7 + (6 - d)));
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        week.push(docs.filter(doc => {
          const t = new Date(doc.datesubmitted).getTime();
          return t >= dayStart && t < dayEnd;
        }).length);
      }
      weeks.push(week);
    }
    return weeks;
  }, [docs]);
  const maxHeat = Math.max(1, ...weeklyHeatmap.flat());

  const officeDocCount = offices.map(o => ({
    name: o.name,
    count: docs.filter(d => d.to === o.officeID).length,
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxOfficeCount = Math.max(1, ...officeDocCount.map(o => o.count));

  const monthlyTrend = Array.from({ length: trendWindow }, (_, index) => {
    const date = new Date(currentYear, currentMonth - (trendWindow - 1 - index), 1);
    const count = docs.filter(doc => {
      const submittedAt = new Date(doc.datesubmitted);
      const inMonth = submittedAt.getMonth() === date.getMonth() && submittedAt.getFullYear() === date.getFullYear();
      if (!inMonth) return false;

      if (trendMetric === "All") return true;
      return getEffectiveStatus(doc) === trendMetric;
    }).length;

    return {
      label: fmtShortMonth(date),
      fullLabel: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      count,
    };
  });

  const trendThisMonth = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0;
  const trendLastMonth = monthlyTrend[monthlyTrend.length - 2]?.count ?? 0;
  const monthlyDelta = trendLastMonth > 0
    ? Math.round(((trendThisMonth - trendLastMonth) / trendLastMonth) * 100)
    : trendThisMonth > 0 ? 100 : 0;

  const maxMonthlyCount = Math.max(1, ...monthlyTrend.map(item => item.count));

  const chartWidth = 640;
  const chartHeight = 260;
  const chartPaddingX = 28;
  const chartPaddingTop = 26;
  const chartPaddingBottom = 34;
  const usableChartHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const chartStepX = monthlyTrend.length > 1
    ? (chartWidth - chartPaddingX * 2) / (monthlyTrend.length - 1)
    : 0;

  const chartPoints = monthlyTrend.map((item, index) => {
    const x = chartPaddingX + chartStepX * index;
    const y = chartPaddingTop + (usableChartHeight - (item.count / maxMonthlyCount) * usableChartHeight);

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = chartPoints.length > 0
    ? [
      `M ${chartPoints[0].x} ${chartHeight - chartPaddingBottom}`,
      ...chartPoints.map(point => `L ${point.x} ${point.y}`),
      `L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - chartPaddingBottom}`,
      "Z",
    ].join(" ")
    : "";

  const statusSegments = statuses
    .map(status => ({
      status,
      count: statusCounts[status],
      color: status === "Pending"
        ? "#eab308"
        : status === "For Signing"
          ? "#3b82f6"
          : status === "Completed"
            ? "#22c55e"
            : "#ef4444",
    }))
    .filter(segment => segment.count > 0);

  const statusSegmentsWithAngles = statusSegments.map((segment, index) => {
    const prevDegrees = statusSegments
      .slice(0, index)
      .reduce((sum, prev) => sum + (total > 0 ? (prev.count / total) * 360 : 0), 0);
    const degrees = total > 0 ? (segment.count / total) * 360 : 0;

    return {
      ...segment,
      startAngle: prevDegrees,
      endAngle: prevDegrees + degrees,
      percentage: pct(segment.count, total),
    };
  });

  const hoveredPoint = hoveredPointIndex !== null ? chartPoints[hoveredPointIndex] : null;
  const hoveredSegment = statusSegmentsWithAngles.find(segment => segment.status === hoveredSegmentStatus) ?? null;

  const donutBackground = statusSegments.length === 0
    ? "conic-gradient(#e5e7eb 0deg 360deg)"
    : (() => {
      let cursor = 0;
      const stops = statusSegments.map(segment => {
        const degrees = (segment.count / total) * 360;
        const stop = `${segment.color} ${cursor}deg ${cursor + degrees}deg`;
        cursor += degrees;
        return stop;
      });

      return `conic-gradient(${stops.join(", ")})`;
    })();

  const ageBuckets = [
    { label: "0-3d", min: 0, max: 3 },
    { label: "4-7d", min: 4, max: 7 },
    { label: "8-14d", min: 8, max: 14 },
    { label: "15d+", min: 15, max: Number.POSITIVE_INFINITY },
  ].map(bucket => ({
    label: bucket.label,
    count: actionableDocs.filter(doc => {
      const age = daysSince(doc.updatedAt || doc.datesubmitted);
      return age >= bucket.min && age <= bucket.max;
    }).length,
  }));

  const maxAgeBucketCount = Math.max(1, ...ageBuckets.map(bucket => bucket.count));

  const templateUsage = templates.map(template => ({
    id: template.id,
    name: template.name,
    count: docs.filter(doc => doc.template === template.id).length,
  }))
    .filter(template => template.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxTemplateUsage = Math.max(1, ...templateUsage.map(template => template.count));

  const requestorMap = docs.reduce<Record<string, number>>((acc, doc) => {
    const key = doc.requestor?.trim() || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topRequestors = Object.entries(requestorMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);



  // ── recharts data ────────────────────────────────────────────────────────────
  const stackedMonthly = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(currentYear, currentMonth - (5 - i), 1);
      const label = fmtShortMonth(date);
      const inMonth = (d: Document) => {
        const s = new Date(d.datesubmitted);
        return s.getMonth() === date.getMonth() && s.getFullYear() === date.getFullYear();
      };
      return {
        month: label,
        Pending: docs.filter(d => inMonth(d) && getEffectiveStatus(d) === "Pending").length,
        "For Signing": docs.filter(d => inMonth(d) && getEffectiveStatus(d) === "For Signing").length,
        Completed: docs.filter(d => inMonth(d) && getEffectiveStatus(d) === "Completed").length,
        Rejected: docs.filter(d => inMonth(d) && getEffectiveStatus(d) === "Rejected").length,
      };
    });
  }, [docs, currentMonth, currentYear]);

  const radarData = useMemo(() => [
    { metric: "Completion", value: completionRate, fullMark: 100 },
    { metric: "Velocity", value: Math.min(100, parseFloat(velocityPerDay) * 20), fullMark: 100 },
    { metric: "Health", value: healthScore, fullMark: 100 },
    { metric: "Routing", value: Math.min(100, pct(routedDocs.length, total)), fullMark: 100 },
    { metric: "Freshness", value: Math.max(0, 100 - avgDocumentAge * 5), fullMark: 100 },
  ], [completionRate, velocityPerDay, healthScore, routedDocs.length, total, avgDocumentAge]);

  if (loading) return (
    <AdminLayout title="Dashboard" subtitle="Loading...">
      <div className="grid grid-cols-4 gap-4 mb-6 lg:grid-cols-2 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-accent/40 animate-pulse" />)}
      </div>
      <div className="grid grid-cols-[1fr_320px] gap-4 lg:grid-cols-1">
        <div className="h-64 rounded-xl bg-accent/40 animate-pulse" />
        <div className="h-64 rounded-xl bg-accent/40 animate-pulse" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Dashboard" subtitle="Document Processing System overview">

      {/* ── Welcome banner ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary/10 border border-primary/20 px-6 py-5 mb-6 flex items-center justify-between sm:flex-col sm:items-start sm:gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Good day, Admin!</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} total document{total !== 1 ? "s" : ""} &mdash;&nbsp;
            {pending + forSigning} awaiting action &mdash;&nbsp;
            {activeUsers} active user{activeUsers !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:bg-accent transition disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* ── Top stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6 lg:grid-cols-2 sm:grid-cols-2">
        {[
          { label: "Total Documents", value: total, icon: <FileText className="w-5 h-5" />, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active Users", value: activeUsers, icon: <Users className="w-5 h-5" />, color: "text-teal-500", bg: "bg-teal-500/10" },
          { label: "Offices", value: offices.length, icon: <Building2 className="w-5 h-5" />, color: "text-violet-500", bg: "bg-violet-500/10" },
          { label: "Templates", value: templates.length, icon: <LayoutTemplate className="w-5 h-5" />, color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <span className={`p-2 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Document status breakdown ──────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Document Status Breakdown
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-5 sm:grid-cols-2">
          {[
            { label: "For Sending", value: pending, icon: <Clock className="w-4 h-4" />, color: "text-yellow-500", bg: "bg-yellow-500/10" },
            { label: "For Signing", value: forSigning, icon: <Send className="w-4 h-4" />, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Completed", value: completed, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Rejected", value: rejected, icon: <XCircle className="w-4 h-4" />, color: "text-destructive", bg: "bg-destructive/10" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-border px-4 py-3 flex items-center gap-3 ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Stacked progress bar */}
        {total > 0 && (
          <>
            <div className="flex rounded-full overflow-hidden h-3 gap-px">
              {statuses.map(s => {
                const count = statusCounts[s];
                const pct = (count / total) * 100;
                return pct > 0 ? (
                  <div key={s} title={`${s}: ${count}`}
                    className={`${STATUS_BAR[s]} transition-all`}
                    style={{ width: `${pct}%` }} />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {statuses.map(s => {
                const count = statusCounts[s];
                return count > 0 ? (
                  <span key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_BAR[s]}`} />
                    {s === "Pending" ? "For Sending" : s} ({Math.round((count / total) * 100)}%)
                  </span>
                ) : null;
              })}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] gap-4 mb-6 lg:grid-cols-1">
        <div className="rounded-[28px] border border-border bg-card p-5 md:p-6 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/10 via-sky-500/10 to-emerald-500/10 pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Operations Pulse
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">A six-month view of submission volume with live workflow context layered in.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-full border border-border bg-background/80 p-1">
                {[6, 12].map(windowSize => (
                  <button
                    key={windowSize}
                    onClick={() => {
                      setTrendWindow(windowSize as 6 | 12);
                      setHoveredPointIndex(null);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${trendWindow === windowSize ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {windowSize}M
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-full border border-border bg-background/80 p-1 max-w-full overflow-x-auto">
                {TREND_METRICS.map(metric => (
                  <button
                    key={metric}
                    onClick={() => {
                      setTrendMetric(metric);
                      setHoveredPointIndex(null);
                    }}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${trendMetric === metric ? "bg-sky-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {metric === "All" ? "All Status" : metric}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs text-sky-700">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {trendThisMonth} this month
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {monthlyDelta >= 0 ? "+" : ""}{monthlyDelta}% vs last month
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-5 md:grid-cols-1">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Submission Volume</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {monthlyTrend.reduce((sum, item) => sum + item.count, 0)}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">documents</span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak</p>
                    <p className="text-lg font-bold text-primary">{maxMonthlyCount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg</p>
                    <p className="text-lg font-bold text-foreground">{monthlyTrend.length > 0 ? Math.round(monthlyTrend.reduce((s, i) => s + i.count, 0) / monthlyTrend.length) : 0}</p>
                  </div>
                </div>
              </div>

              <div className="relative h-[320px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-primary/[0.03] to-transparent px-2 pt-4 sm:h-[260px]">
                {/* Y-axis labels */}
                <div className="pointer-events-none absolute left-1 top-4 bottom-8 flex flex-col justify-between z-20">
                  {[maxMonthlyCount, Math.round(maxMonthlyCount * 0.75), Math.round(maxMonthlyCount * 0.5), Math.round(maxMonthlyCount * 0.25), 0].map((val, i) => (
                    <span key={i} className="text-[9px] font-mono text-muted-foreground/60 leading-none">{val}</span>
                  ))}
                </div>

                {/* Grid lines */}
                <div className="pointer-events-none absolute inset-0">
                  {[0, 1, 2, 3, 4].map(row => (
                    <div
                      key={row}
                      className="absolute left-8 right-0 border-t border-border/30"
                      style={{ top: `${12 + row * 19}%` }}
                    />
                  ))}
                </div>

                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="relative z-10 h-full w-full overflow-visible">
                  <defs>
                    <linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="40%" stopColor="#0ea5e9" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="dashboardLineStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="50%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="barFillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.06" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>

                  {/* Vertical guides */}
                  {chartPoints.map(point => (
                    <line
                      key={`guide-${point.fullLabel}`}
                      x1={point.x} y1={chartPaddingTop} x2={point.x} y2={chartHeight - chartPaddingBottom}
                      stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="2 6"
                    />
                  ))}

                  {/* Bar chart underneath */}
                  {chartPoints.map((point, i) => {
                    const barW = Math.max(18, (chartWidth - 80) / chartPoints.length * 0.5);
                    const barH = (chartHeight - chartPaddingBottom) - point.y;
                    return (
                      <rect
                        key={`bar-${i}`}
                        x={point.x - barW / 2}
                        y={point.y}
                        width={barW}
                        height={Math.max(0, barH)}
                        rx={4}
                        fill="url(#barFillGrad)"
                        className="transition-all duration-300"
                      />
                    );
                  })}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#dashboardAreaFill)" />

                  {/* Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#dashboardLineStroke)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />

                  {/* Data points */}
                  {chartPoints.map((point, pointIndex) => {
                    const isHovered = hoveredPointIndex === pointIndex;
                    return (
                      <g
                        key={point.fullLabel}
                        onMouseEnter={() => setHoveredPointIndex(pointIndex)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                        className="transition-transform duration-150"
                      >
                        {/* Hover highlight column */}
                        {isHovered && (
                          <rect
                            x={point.x - 24} y={chartPaddingTop}
                            width={48} height={chartHeight - chartPaddingTop - chartPaddingBottom}
                            fill="rgba(14, 165, 233, 0.04)" rx={8}
                          />
                        )}
                        {/* Outer glow */}
                        <circle cx={point.x} cy={point.y} r={isHovered ? 14 : 8} fill="rgba(14, 165, 233, 0.15)" className="transition-all duration-200" />
                        {/* Dot */}
                        <circle cx={point.x} cy={point.y} r={isHovered ? 7 : 5} fill="#0ea5e9" stroke="#ffffff" strokeWidth="2.5" className="transition-all duration-200" />
                        {/* Hit area */}
                        <circle cx={point.x} cy={point.y} r="18" fill="transparent" />
                        {/* Value label */}
                        <text x={point.x} y={point.y - (isHovered ? 22 : 16)} textAnchor="middle" className={`fill-foreground font-semibold transition-all ${isHovered ? "text-[14px]" : "text-[11px]"}`}>
                          {point.count}
                        </text>
                      </g>
                    );
                  })}

                  {/* Hover tooltip */}
                  {hoveredPoint && (
                    <g>
                      <rect
                        x={Math.max(8, Math.min(chartWidth - 180, hoveredPoint.x - 90))}
                        y={Math.max(8, hoveredPoint.y - 72)}
                        width="180" height="52" rx="12"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke="rgba(99, 102, 241, 0.4)"
                        strokeWidth="1"
                      />
                      <text
                        x={Math.max(18, Math.min(chartWidth - 170, hoveredPoint.x - 80))}
                        y={Math.max(28, hoveredPoint.y - 50)}
                        className="fill-slate-300 text-[11px]"
                      >
                        {hoveredPoint.fullLabel}
                      </text>
                      <text
                        x={Math.max(18, Math.min(chartWidth - 170, hoveredPoint.x - 80))}
                        y={Math.max(46, hoveredPoint.y - 32)}
                        className="fill-sky-300 text-[13px] font-bold"
                      >
                        {hoveredPoint.count} document{hoveredPoint.count !== 1 ? "s" : ""} submitted
                      </text>
                    </g>
                  )}
                </svg>

                {/* Month labels */}
                <div className={`relative z-10 mt-2 grid gap-2 px-2 text-center text-[10px] font-medium text-muted-foreground ${trendWindow === 12 ? "grid-cols-12 sm:grid-cols-6" : "grid-cols-6"}`}>
                  {monthlyTrend.map(item => (
                    <span key={item.fullLabel} title={item.fullLabel} className="uppercase tracking-wider">{item.label}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 content-start">
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  Workflow signal
                </div>
                <p className="mt-2 text-3xl font-bold text-foreground">{averageWorkflowProgress}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Average progress across routed documents.</p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Active queue
                </div>
                <p className="mt-2 text-3xl font-bold text-foreground">{pending + forSigning}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stalledDocs} stalled and {avgDocumentAge}d average age.</p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <p className="text-sm font-medium text-foreground">Routing density</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{averageSignatories}</p>
                <p className="mt-1 text-xs text-muted-foreground">Average signatories attached per document.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-card p-5 md:p-6 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-rose-500/10 pointer-events-none" />
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Status Orbit
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">A radial view of where documents are sitting in the pipeline right now.</p>
          </div>
          <div className="relative z-10 flex flex-col items-center rounded-3xl border border-border/70 bg-background/60 px-5 py-6">
            <div
              className="relative grid h-56 w-56 place-items-center rounded-full"
              style={{ background: donutBackground }}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = event.clientX - centerX;
                const dy = event.clientY - centerY;
                const radius = Math.sqrt(dx * dx + dy * dy);

                const outerRadius = rect.width / 2;
                const innerRadius = outerRadius * (36 / 56);

                if (radius < innerRadius || radius > outerRadius || total === 0) {
                  setHoveredSegmentStatus(null);
                  return;
                }

                const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
                const activeSegment = statusSegmentsWithAngles.find(segment => angle >= segment.startAngle && angle < segment.endAngle);

                setHoveredSegmentStatus(activeSegment?.status ?? null);
              }}
              onMouseLeave={() => setHoveredSegmentStatus(null)}
            >
              <div className="grid h-36 w-36 place-items-center rounded-full border border-border/70 bg-card/95 text-center shadow-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{hoveredSegment ? (hoveredSegment.status === "Pending" ? "For Sending" : hoveredSegment.status) : "Completion"}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{hoveredSegment ? `${hoveredSegment.percentage}%` : `${completionRate}%`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{hoveredSegment ? `${hoveredSegment.count} documents` : `${completed} closed`}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 w-full space-y-3">
              {statusSegmentsWithAngles.map(segment => (
                <div
                  key={segment.status}
                  onMouseEnter={() => setHoveredSegmentStatus(segment.status)}
                  onMouseLeave={() => setHoveredSegmentStatus(null)}
                  className={`rounded-2xl border bg-card/80 p-3 transition-colors ${hoveredSegmentStatus === segment.status ? "border-primary/50" : "border-border/70"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                      <span className="truncate text-sm text-foreground">{segment.status === "Pending" ? "For Sending" : segment.status}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{segment.count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(8, segment.percentage)}%`, backgroundColor: segment.color }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{segment.percentage}% of all documents</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid w-full grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rejected</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{rejectionRate}%</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Routed</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{pct(routedDocs.length, total)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Monthly Status Breakdown (below Operations Pulse) ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mt-6 mb-6 relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-yellow-500 via-blue-500  to-red-500" />
        <div className="p-5 sm:p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Monthly Status Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Stacked view of document statuses over the last 6 months.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "For Sending", color: "#eab308" },
                { label: "For Signing", color: "#3b82f6" },
                { label: "Completed", color: "#22c55e" },
                { label: "Rejected", color: "#ef4444" },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stackedMonthly} margin={{ top: 10, right: 10, left: -15, bottom: 5 }} barCategoryGap="20%">
              <defs>
                <linearGradient id="barPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#eab308" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="barSigning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="barCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="barRejected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 12, color: "#f1f5f9", fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                itemStyle={{ color: "#f1f5f9" }}
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
              />
              <Bar dataKey="Pending" name="For Sending" stackId="a" fill="url(#barPending)" radius={[0, 0, 0, 0]} animationDuration={800} />
              <Bar dataKey="For Signing" stackId="a" fill="url(#barSigning)" animationDuration={800} animationBegin={100} />
              <Bar dataKey="Completed" stackId="a" fill="url(#barCompleted)" animationDuration={800} animationBegin={200} />
              <Bar dataKey="Rejected" stackId="a" fill="url(#barRejected)" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={300} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* ── Two-column section ─────────────────────────────────── */}
      {/* ── Health / Velocity / Heatmap row ──────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6 md:grid-cols-1">
        {/* Health Gauge */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4 self-start">
            <Target className="w-4 h-4 text-primary" /> System Health
          </div>
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" className="text-accent" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={healthColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${healthScore * 3.14} 314`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{healthScore}</span>
              <span className="text-[10px] text-muted-foreground">{healthLabel}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">Based on completion, stalled docs &amp; rejection rates.</p>
        </div>

        {/* Velocity */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Zap className="w-4 h-4 text-amber-500" /> Processing Velocity
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 7 days</span>
          </div>

          {/* Big velocity number */}
          <div className="flex items-end gap-2 mb-1">
            <p className="text-5xl font-black text-foreground leading-none">{velocityPerDay}</p>
            <p className="text-sm text-muted-foreground pb-1">docs/day</p>
          </div>

          {/* Sparkline: daily completions over last 7 days */}
          {(() => {
            const dailyCounts: number[] = [];
            for (let i = 6; i >= 0; i--) {
              const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart.setDate(dayStart.getDate() - i);
              const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
              dailyCounts.push(docs.filter(d => getEffectiveStatus(d) === "Completed" && new Date(d.updatedAt).getTime() >= dayStart.getTime() && new Date(d.updatedAt).getTime() < dayEnd.getTime()).length);
            }
            const maxD = Math.max(1, ...dailyCounts);
            const sparkW = 200, sparkH = 60, padX = 8, padY = 6;
            const pts = dailyCounts.map((c, i) => ({
              x: padX + (i / 6) * (sparkW - padX * 2),
              y: padY + (1 - c / maxD) * (sparkH - padY * 2),
              v: c,
            }));
            const sparkLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            const sparkArea = pts.length > 0 ? `M ${pts[0].x} ${sparkH} ${pts.map(p => `L ${p.x} ${p.y}`).join(" ")} L ${pts[pts.length - 1].x} ${sparkH} Z` : "";
            const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            const today = new Date().getDay();
            const orderedLabels = Array.from({ length: 7 }, (_, i) => dayLabels[(today - 6 + i + 7) % 7]);

            return (
              <div className="mt-3 mb-4">
                <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-full h-16">
                  <defs>
                    <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={sparkArea} fill="url(#sparkArea)" />
                  <path d={sparkLine} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1.5" />
                      <text x={p.x} y={p.y - 7} textAnchor="middle" className="fill-foreground text-[7px] font-bold">{p.v}</text>
                    </g>
                  ))}
                </svg>
                <div className="flex justify-between px-1 mt-1">
                  {orderedLabels.map((d, i) => (
                    <span key={i} className="text-[8px] text-muted-foreground/60 uppercase">{d}</span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Stats row */}
          <div className="mt-auto grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Completed</p>
              <p className="text-lg font-bold text-foreground">{completedLast7}</p>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg Sign.</p>
              <p className="text-lg font-bold text-foreground">{averageSignatories}</p>
            </div>
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 px-3 py-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Rate</p>
              <p className="text-lg font-bold text-foreground">{completionRate}%</p>
            </div>
          </div>
        </div>

        {/* Weekly Heatmap */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Flame className="w-4 h-4 text-orange-500" /> Submission Heatmap
          </div>
          <p className="text-xs text-muted-foreground mb-3">Last 4 weeks · Mon–Sun</p>
          <div className="flex flex-col gap-1.5">
            {weeklyHeatmap.map((week, wi) => (
              <div key={wi} className="flex gap-1.5">
                {week.map((count, di) => (
                  <div key={di} title={`${count} doc${count !== 1 ? "s" : ""}`}
                    className="flex-1 aspect-square rounded-md transition-colors"
                    style={{ backgroundColor: count === 0 ? "var(--accent)" : `rgba(14,165,233,${Math.max(0.15, count / maxHeat)})` }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">Mon</span>
            <span className="text-[10px] text-muted-foreground">Sun</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-4 md:grid-cols-1">

        {/* Recent Documents */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent Documents</h3>
            <button
              onClick={() => navigate("/dtms/admin/documents")}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-border flex-1">
            {recentDocs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No documents yet.</p>
            ) : recentDocs.map(doc => (
              <div key={doc.id}
                onClick={() => navigate(`/dtms/sign/${doc.tracknumber}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40 cursor-pointer transition-colors">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-accent flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{doc.tracknumber} · {doc.requestor}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLOR[getEffectiveStatus(doc)] ?? "bg-muted text-muted-foreground"}`}>
                    {getEffectiveStatus(doc) === "Pending" ? "For Sending" : getEffectiveStatus(doc)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(doc.datesubmitted)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground mb-1">Quick Actions</h3>
            {[
              { label: "Manage Users", icon: <Users className="w-4 h-4" />, path: "/dtms/admin/users" },
              { label: "Manage Offices", icon: <Building2 className="w-4 h-4" />, path: "/dtms/admin/offices" },
              { label: "Manage Templates", icon: <LayoutTemplate className="w-4 h-4" />, path: "/dtms/admin/templates" },
              { label: "All Documents", icon: <FileText className="w-4 h-4" />, path: "/dtms/admin/documents" },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border border-border hover:bg-accent hover:border-primary/40 text-sm text-foreground transition-colors">
                <span className="text-primary">{a.icon}</span>
                {a.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* Documents per office bar chart */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Documents by Office</h3>
            {officeDocCount.filter(o => o.count > 0).length === 0 ? (
              <p className="text-xs text-muted-foreground">No routing data yet.</p>
            ) : officeDocCount.filter(o => o.count > 0).map(o => (
              <div key={o.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground truncate max-w-[180px]" title={o.name}>{o.name}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">{o.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(o.count / maxOfficeCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>


      <div className="grid grid-cols-3 gap-4 mt-6 md:grid-cols-1">

        {/* Radar Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Performance Radar</h3>
          <p className="text-xs text-muted-foreground mb-4">Multi-dimensional overview of system performance.</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke="rgba(148,163,184,0.2)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.25} strokeWidth={2} animationDuration={800} />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(15,23,42,0.92)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, color: "#f1f5f9", fontSize: 12 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Queue Aging */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Queue Aging</h3>
            <p className="mt-1 text-xs text-muted-foreground">How long active documents have been waiting.</p>
          </div>
          <div className="space-y-3">
            {ageBuckets.map(bucket => (
              <div key={bucket.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{bucket.label}</span>
                  <span className="font-mono text-muted-foreground">{bucket.count}</span>
                </div>
                <div className="h-2 rounded-full bg-accent overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all"
                    style={{ width: `${bucket.count === 0 ? 0 : Math.max(8, (bucket.count / maxAgeBucketCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Templates */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Top Templates</h3>
            <p className="mt-1 text-xs text-muted-foreground">Most-used document templates across the system.</p>
          </div>
          {templateUsage.length === 0 ? (
            <p className="text-xs text-muted-foreground">No template-linked documents yet.</p>
          ) : (
            <div className="space-y-3">
              {templateUsage.map(template => (
                <div key={template.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-foreground">{template.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{template.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-primary transition-all"
                      style={{ width: `${Math.max(10, (template.count / maxTemplateUsage) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Requestors - full width bar chart */}
      <div className="rounded-xl border border-border bg-card p-5 mt-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Top Requestors</h3>
        <p className="text-xs text-muted-foreground mb-4">Users generating the highest document volume.</p>
        {topRequestors.length === 0 ? (
          <p className="text-xs text-muted-foreground">No requestor data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topRequestors} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(15,23,42,0.92)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, color: "#f1f5f9", fontSize: 12 }}
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
              />
              <Bar dataKey="count" name="Documents" fill="url(#requestorGrad)" radius={[0, 6, 6, 0]} barSize={20} animationDuration={800} />
              <defs>
                <linearGradient id="requestorGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
