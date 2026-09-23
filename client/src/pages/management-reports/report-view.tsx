import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Sparkles, Download, Edit3, CheckCircle, AlertTriangle,
  TrendingUp, MessageSquare, ChevronDown, ChevronRight,
  Loader2, Calendar, FileText, Target, ArrowRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ComposedChart, Line,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  LabelList, Cell, PieChart, Pie
} from "recharts";

const TEAL = "#0F9B8E";
const NAVY = "#1B2B4B";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const GREEN = "#10B981";
const GRAY = "#9CA3AF";

// ── Health gauge (SVG semicircular arc) ─────────────────────────────────────
function HealthGauge({ score }: { score: number }) {
  const colour = score >= 86 ? TEAL : score >= 66 ? GREEN : score >= 41 ? AMBER : RED;
  const statusText = score >= 86 ? "Strong" : score >= 66 ? "Good" : score >= 41 ? "Needs attention" : "Critical";
  const r = 45;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * r;
  const filled = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center" style={{ width: 120 }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path
          d={`M 15 60 A ${r} ${r} 0 0 1 105 60`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 15 60 A ${r} ${r} 0 0 1 105 60`}
          fill="none"
          stroke={colour}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="bold" fill={colour}>{score}</text>
      </svg>
      <p className="text-xs font-semibold mt-1" style={{ color: colour }}>{statusText}</p>
    </div>
  );
}

// ── RAG dot ──────────────────────────────────────────────────────────────────
function RagDot({ rag }: { rag?: string }) {
  const colour = rag === "red" ? RED : rag === "green" ? GREEN : AMBER;
  return <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colour }} />;
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "high" || priority === "red") return <Badge className="bg-red-100 text-red-700 border-0 text-xs shrink-0">High</Badge>;
  if (priority === "medium" || priority === "amber") return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs shrink-0">Medium</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs shrink-0">Low</Badge>;
}

// ── KPI pill ─────────────────────────────────────────────────────────────────
function KpiPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[110px]">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="font-bold text-gray-900 text-sm">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ num, question, period }: { num: number; question: string; period?: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: NAVY }}>
        {num}
      </div>
      <div className="flex-1 border-b-2 border-teal-400 pb-3">
        <h2 className="text-xl font-bold text-gray-900">{question}</h2>
        {period && <p className="text-sm text-gray-500">{period}</p>}
      </div>
    </div>
  );
}

// ── Expandable text (2-line clamp with toggle) ────────────────────────────────
function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const words = text.split(" ");
  const isLong = words.length > 25;
  return (
    <div>
      <p className={`text-sm text-gray-700 leading-relaxed ${!expanded && isLong ? "line-clamp-2" : ""} ${className}`}>{text}</p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-teal-600 hover:text-teal-800 mt-1">
          {expanded ? "Show less" : "...show more"}
        </button>
      )}
    </div>
  );
}

// ── KPI display card (replaces single-point scatter chart) ────────────────────
function KpiDisplayCard({ label, value, benchmark, benchmarkLabel, rag }: {
  label: string; value: string; benchmark?: string; benchmarkLabel?: string; rag?: string;
}) {
  const colour = rag === "red" ? RED : rag === "green" ? GREEN : AMBER;
  return (
    <div className="flex flex-col items-center justify-center h-[180px] bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <p className="text-4xl font-bold mb-2" style={{ color: colour }}>{value}</p>
      {benchmark && (
        <p className="text-xs text-gray-400">{benchmarkLabel || "Benchmark"}: {benchmark}</p>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        <RagDot rag={rag} />
        <span className="text-xs text-gray-500">{rag === "green" ? "Above benchmark" : rag === "red" ? "Below benchmark" : "Near benchmark"}</span>
      </div>
    </div>
  );
}

// ── Chart container wrapper ───────────────────────────────────────────────────
function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ minHeight: 180, maxHeight: 220 }}>
      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

// ── £k formatter ─────────────────────────────────────────────────────────────
const fmtK = (v: number) => `£${(v / 1000).toFixed(0)}k`;
const fmtKFull = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/reports", id],
    queryFn: () => fetch(`/api/reports/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/reports/${id}/generate-ai`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", id] });
      toast({ title: "AI report generated" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest(`/api/reports/${id}`, "PUT", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", id] });
    },
    onError: (e: Error) => toast({ title: "Error saving", description: e.message, variant: "destructive" }),
  });

  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}/generate-pdf`, { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: "PDF generation failed" }));
        throw new Error(e.message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cname = (report?.client?.companyName || "Report").replace(/[^a-zA-Z0-9]/g, "");
      const plabel = (report?.period?.periodLabel || "").replace(/[^a-zA-Z0-9]/g, "");
      a.download = `${cname}_MIPack_${plabel}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "PDF download failed", description: e.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
    </div>
  );

  if (!report) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Report not found.</p>
      <Link href="/management-reports"><Button variant="ghost" className="mt-4">Back to Management Reports</Button></Link>
    </div>
  );

  const fd = (report.financialData || {}) as any;
  const is = fd.income_statement || {};
  const cf = fd.cashflow || {};
  const bs = fd.balance_sheet || {};
  const kpis = fd.kpis || {};
  const client = report.client || {};
  const period = report.period || {};
  const hasAi = !!report.aiExecutiveSummary;
  const goingWell: string[] = report.aiGoingWell || [];
  const concerns: string[] = report.aiConcerns || [];
  const actions: any[] = report.aiActionSteps || [];
  const goalCommentary: any[] = report.aiGoalCommentary || [];
  const discussionPoints: string[] = report.aiDiscussionPoints || [];
  const threeCore = (report.aiThreeCoreQuestions || fd.three_core_questions) as any;
  const coreQuestionAnswers: any[] = report.aiCoreQuestionAnswers || [];
  const watchPoints: string[] = report.aiWatchPoints || [];
  const nextPeriodFocus: string | null = report.aiNextPeriodFocus || null;
  const debtSchedule: any[] = fd.debt_schedule || [];
  const dlas: any[] = fd.director_loan_accounts || [];
  const revenueStreams: any[] = fd.revenue_streams || [];
  const overheadBreakdown: any[] = fd.overhead_breakdown || [];
  const cosDetail: any[] = fd.cost_of_sales_detail || [];
  const grantIncome: any[] = fd.grant_income || [];
  const cashflowWaterfall = fd.cashflow_waterfall as any;
  const breakevenData = fd.breakeven as any;
  const nextPeriodMetrics: any[] = fd.next_period_metrics || [];
  const periodSchedule: any[] = fd.period_schedule || [];
  const is12Weekly = fd.period_type === "12_weekly" || report.reportPeriodType === "12_weekly";
  const periodNumber = fd.period_number;

  const fmt = (n: number | undefined | null) => {
    if (n == null) return "—";
    const abs = Math.round(Math.abs(n)).toLocaleString("en-GB");
    return n < 0 ? `(£${abs})` : `£${abs}`;
  };
  const fmtPct = (n: number | undefined | null) => n != null ? `${n}%` : "—";

  const totalDebt = debtSchedule.reduce((s, d) => s + (d.close_balance || 0), 0);
  const totalDla = dlas.reduce((s, d) => s + (d.close_balance || 0), 0);
  const debtDonutData = debtSchedule.length >= 3 ? debtSchedule.map(d => ({ name: d.facility, value: d.close_balance })) : null;
  const donutColors = [TEAL, NAVY, AMBER, RED, GREEN, "#8b5cf6", "#ec4899", "#06b6d4"];

  // Executive summary — first paragraph vs rest
  const summaryParagraphs = (report.aiExecutiveSummary || "").split("\n").filter((p: string) => p.trim());
  const summaryFirst = summaryParagraphs[0] || "";
  const summaryRest = summaryParagraphs.slice(1).join("\n\n");
  const hasSummaryMore = summaryRest.trim().length > 0;

  // Chart data
  const revenueChartData = revenueStreams.length > 0
    ? revenueStreams.map(rs => ({ name: rs.name, "This period": rs.this_period, "Prior period": rs.prior_period }))
    : [{ name: period.periodLabel || "This period", Revenue: is.total_revenue || 0, Expenses: (is.cost_of_sales || 0) + (is.total_expenses || 0) }];

  const gpTrendData = [{ name: period.periodLabel || "This period", "Gross Profit": is.gross_profit || 0, "GP%": is.gross_margin_pct || 0 }];

  const waterfallData = cashflowWaterfall ? [
    { name: "Opening", value: cashflowWaterfall.opening_cash, fill: NAVY },
    { name: "GP earned", value: cashflowWaterfall.gp_earned, fill: GREEN },
    { name: "Overheads", value: -cashflowWaterfall.overheads_paid, fill: RED },
    { name: "Debt svc", value: -cashflowWaterfall.debt_service, fill: RED },
    { name: "Grants", value: cashflowWaterfall.grant_received, fill: GREEN },
    { name: "Assets", value: -cashflowWaterfall.asset_purchases, fill: AMBER },
    { name: "Wk cap", value: cashflowWaterfall.working_capital_movement, fill: cashflowWaterfall.working_capital_movement >= 0 ? GREEN : RED },
    { name: "Closing", value: cashflowWaterfall.closing_cash, fill: TEAL },
  ].filter(d => d.value !== 0) : null;

  const overheadChartData = overheadBreakdown.length > 0
    ? overheadBreakdown.map(oh => ({ name: oh.category, Amount: oh.amount }))
    : null;

  // GP% benchmark for hospitality context
  const gpPct = is.gross_margin_pct;
  const gpRag = gpPct == null ? "amber" : gpPct >= 65 ? "green" : gpPct >= 50 ? "amber" : "red";

  // Cash rag
  const cashBalance = cf.closing_balance || kpis.cash_balance;
  const cashRag = cashBalance == null ? "amber" : cashBalance >= 10000 ? "green" : cashBalance >= 3000 ? "amber" : "red";

  // Balance sheet rows with auto-RAG
  const currentRatio = bs.current_assets && bs.current_liabilities ? bs.current_assets / bs.current_liabilities : null;
  const workingCapital = (bs.current_assets || 0) - (bs.current_liabilities || 0);
  const debtToAssets = bs.total_debt && bs.total_assets ? bs.total_debt / bs.total_assets : null;
  const bsRows = [
    { label: "Total Assets", value: bs.total_assets, rag: bs.total_assets > 0 ? "green" : "red", bold: false },
    { label: "Current Assets", value: bs.current_assets, rag: "green", bold: false },
    { label: "Current Liabilities", value: bs.current_liabilities, rag: currentRatio != null ? (currentRatio > 1.5 ? "green" : currentRatio >= 1 ? "amber" : "red") : "amber", bold: false },
    { label: "Working Capital", value: workingCapital, rag: workingCapital >= 0 ? "green" : "red", bold: true },
    { label: "Total Debt", value: bs.total_debt, rag: debtToAssets != null ? (debtToAssets < 0.5 ? "green" : debtToAssets < 0.8 ? "amber" : "red") : "amber", bold: false },
    { label: "Net Assets", value: bs.net_assets, rag: bs.net_assets < 0 ? "red" : "green", bold: true },
  ];

  return (
    <div className="max-w-4xl space-y-12 pb-16">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/management-reports/clients/${report.clientId}`}>
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.clientName || "—"}</h1>
            <p className="text-sm text-gray-500">{client.companyName} — {period.periodLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Link href={`/management-reports/reports/${id}/data-entry`}>
            <Button variant="ghost" size="sm" className="text-gray-500 gap-1"><Edit3 className="h-3.5 w-3.5" /> Edit data</Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1 border-teal-200 text-teal-700 hover:bg-teal-50" onClick={downloadPdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfLoading ? "Generating..." : "Download PDF"}
          </Button>
          {!hasAi && (
            <Button className="bg-teal-600 hover:bg-teal-700 gap-2" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generateMutation.isPending ? "Generating..." : "Generate AI report"}
            </Button>
          )}
          {hasAi && (
            <Button variant="outline" className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerate AI
            </Button>
          )}
        </div>
      </div>

      {/* ── Dashboard bar ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-8 flex-wrap">
          {report.aiHealthScore != null && <HealthGauge score={report.aiHealthScore} />}
          <div className="flex flex-wrap gap-3">
            <KpiPill label="Revenue" value={fmt(is.total_revenue)} sub={is.gross_margin_pct != null ? `GP ${is.gross_margin_pct}%` : undefined} />
            <KpiPill label="Gross Profit" value={fmt(is.gross_profit)} />
            <KpiPill label="Operating Profit" value={fmt(is.operating_profit)} />
            <KpiPill label="Cash (Close)" value={fmt(cf.closing_balance)} />
            {kpis.debtor_days > 0 && <KpiPill label="Debtor Days" value={`${kpis.debtor_days}d`} />}
            {bs.total_debt > 0 && <KpiPill label="Total Debt" value={fmt(bs.total_debt)} />}
          </div>
        </div>

        {is12Weekly && periodSchedule.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 12-Week Review Cycle</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left pb-1 pr-4">Period</th>
                    <th className="text-left pb-1 pr-4">Start</th>
                    <th className="text-left pb-1 pr-4">End</th>
                    <th className="text-left pb-1">Review meeting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {periodSchedule.map((p: any, i: number) => (
                    <tr key={i} className={p.period === periodNumber ? "bg-teal-50 font-medium text-teal-800" : "text-gray-600"}>
                      <td className="py-1 pr-4">{p.label}{p.period === periodNumber ? " — Current" : ""}</td>
                      <td className="py-1 pr-4">{p.start}</td>
                      <td className="py-1 pr-4">{p.end}</td>
                      <td className="py-1">{p.review_week}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── No AI state ─────────────────────────────────────────────── */}
      {!hasAi && !generateMutation.isPending && (
        <Card className="border-dashed border-gray-200 bg-gray-50">
          <CardContent className="py-10 text-center">
            <Sparkles className="h-10 w-10 text-teal-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium mb-1">AI commentary not yet generated</p>
            <p className="text-sm text-gray-400 mb-4">Enter financial data then click "Generate AI report"</p>
            <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Sparkles className="h-4 w-4" /> Generate AI report
            </Button>
          </CardContent>
        </Card>
      )}

      {generateMutation.isPending && (
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="py-10 text-center">
            <Loader2 className="h-10 w-10 text-teal-500 mx-auto mb-3 animate-spin" />
            <p className="text-teal-700 font-medium">Generating AI report...</p>
            <p className="text-sm text-teal-500 mt-1">This typically takes 15-30 seconds</p>
          </CardContent>
        </Card>
      )}

      {hasAi && (
        <>
          {/* ── Executive Summary ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Executive Summary</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-gray-500" onClick={() => { setSummaryDraft(report.aiExecutiveSummary || ""); setEditingSummary(true); }}>
                <Edit3 className="h-3 w-3" /> Edit
              </Button>
            </CardHeader>
            <CardContent>
              {editingSummary ? (
                <div className="space-y-3">
                  <Textarea className="min-h-[160px]" value={summaryDraft} onChange={e => setSummaryDraft(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingSummary(false)}>Cancel</Button>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { updateMutation.mutate({ aiExecutiveSummary: summaryDraft }); setEditingSummary(false); }}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="border-l-4 border-teal-400 pl-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{summaryFirst}</p>
                  {summaryExpanded && summaryRest && (
                    <p className="text-sm text-gray-700 leading-relaxed mt-3 whitespace-pre-wrap">{summaryRest}</p>
                  )}
                  {hasSummaryMore && (
                    <button onClick={() => setSummaryExpanded(!summaryExpanded)} className="text-xs text-teal-600 hover:text-teal-800 mt-2">
                      {summaryExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Going well / Concerns / Actions ─────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Going well */}
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 flex items-center gap-1.5">
                  <CheckCircle className="h-[18px] w-[18px]" /> Going well
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {goingWell.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-[18px] w-[18px] text-green-500 mt-0.5 shrink-0" />
                      <ExpandableText text={item} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Concerns */}
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-[18px] w-[18px]" /> Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {concerns.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="h-[18px] w-[18px] text-amber-500 mt-0.5 shrink-0" />
                      <ExpandableText text={item} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Priority actions */}
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700 flex items-center gap-1.5">
                  <TrendingUp className="h-[18px] w-[18px]" /> Priority actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {actions.slice(0, 3).map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-semibold text-blue-600 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <PriorityBadge priority={a.priority} />
                          <p className="font-medium text-gray-800 text-sm leading-tight">{a.action}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* ── Dynamic Core Questions (structure-based) ─────────────── */}
          {coreQuestionAnswers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                <Target className="h-4 w-4 text-teal-600" /> Core Questions
              </h3>
              {coreQuestionAnswers.map((q: any) => {
                const tints = [TEAL, "#1A56A4", NAVY, AMBER];
                const tint = tints[(q.question_number - 1) % tints.length];
                return (
                  <Card key={q.question_number} className="overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: tint }} />
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tint }}>
                          {q.question_number}
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm pt-0.5">{q.question}</h4>
                      </div>
                      <div className="ml-10">
                        <div className="border-l-4 rounded-r-lg px-3 py-2 mb-3" style={{ borderColor: tint, backgroundColor: `${tint}10` }}>
                          <p className="text-sm text-gray-800 leading-relaxed">{q.verdict}</p>
                        </div>
                        {q.key_findings?.length > 0 && (
                          <ul className="space-y-1 mb-2">
                            {q.key_findings.map((f: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                <ChevronRight className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.benchmark_commentary && (
                          <p className="text-xs text-gray-400 italic">{q.benchmark_commentary}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Three Core Questions ─────────────────────────────────── */}
          {threeCore && (threeCore.profitability_verdict || threeCore.capital_verdict || threeCore.borrowing_verdict) && (
            <div className="space-y-8">

              {/* ── Q1: Profitability ─────────────────────────────────── */}
              <Card style={{ backgroundColor: "#F0FAFA" }}>
                <CardContent className="pt-6">
                  <SectionHeader num={1} question="How profitable are we?" period={period.periodLabel} />

                  {threeCore.profitability_verdict && (
                    <div className="bg-white border-l-4 border-teal-500 rounded-r-lg px-4 py-3 mb-6 shadow-sm">
                      <p className="text-base font-medium text-gray-800 leading-relaxed">{threeCore.profitability_verdict}</p>
                    </div>
                  )}

                  {/* Revenue chart */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <ChartBox title={revenueStreams.length > 0 ? "Revenue by Stream" : "Revenue vs Expenses"}>
                      <ResponsiveContainer width="100%" height={155}>
                        <BarChart data={revenueChartData} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(v: number) => fmtKFull(v)} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                          {revenueStreams.length > 0 ? (
                            <>
                              <Bar dataKey="This period" fill={TEAL} radius={[3, 3, 0, 0]}>
                                <LabelList dataKey="This period" position="top" formatter={fmtK} style={{ fontSize: 9, fill: "#6B7280" }} />
                              </Bar>
                              <Bar dataKey="Prior period" fill="#d1faf7" radius={[3, 3, 0, 0]} />
                            </>
                          ) : (
                            <>
                              <Bar dataKey="Revenue" fill={TEAL} radius={[3, 3, 0, 0]}>
                                <LabelList dataKey="Revenue" position="top" formatter={fmtK} style={{ fontSize: 9, fill: "#6B7280" }} />
                              </Bar>
                              <Bar dataKey="Expenses" fill={AMBER} radius={[3, 3, 0, 0]}>
                                <LabelList dataKey="Expenses" position="top" formatter={fmtK} style={{ fontSize: 9, fill: "#6B7280" }} />
                              </Bar>
                            </>
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBox>

                    {/* GP chart — single period: bar with GP% label inside */}
                    <ChartBox title="Gross Profit & Margin">
                      <ResponsiveContainer width="100%" height={155}>
                        <ComposedChart data={gpTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                          <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(v: number, name: string) => name === "GP%" ? `${v}%` : fmtKFull(v)} />
                          <Bar yAxisId="left" dataKey="Gross Profit" fill={TEAL} radius={[3, 3, 0, 0]}>
                            <LabelList
                              dataKey="GP%"
                              position="insideTop"
                              formatter={(v: number) => `${v}%`}
                              style={{ fontSize: 13, fontWeight: 700, fill: "white" }}
                            />
                          </Bar>
                          {gpTrendData.length > 1 && (
                            <Line yAxisId="right" type="monotone" dataKey="GP%" stroke={AMBER} strokeWidth={2} dot={{ r: 4, fill: AMBER }} name="GP%" />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </ChartBox>
                  </div>

                  {/* CoS table */}
                  {cosDetail.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost of Sales & Key Metrics</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left pb-2 text-gray-500 font-medium">Line</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">This period</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">% Revenue</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Prior period</th>
                              <th className="text-left pb-2 text-gray-500 font-medium pl-4">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="font-semibold border-b border-gray-100">
                              <td className="py-1.5">Revenue</td>
                              <td className="text-right">{fmt(is.total_revenue)}</td>
                              <td className="text-right text-gray-400">—</td>
                              <td className="text-right">—</td>
                              <td className="pl-4" />
                            </tr>
                            {cosDetail.map((cs, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="py-1.5 text-gray-700">{cs.name}</td>
                                <td className="text-right">{fmt(cs.this_period)}</td>
                                <td className="text-right text-teal-600 font-medium">{cs.pct_of_revenue}%</td>
                                <td className="text-right text-gray-400">{fmt(cs.prior_period)}</td>
                                <td className="pl-4 text-gray-400 text-xs">{cs.note}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold border-t border-gray-200 bg-gray-50">
                              <td className="py-1.5">Gross Profit</td>
                              <td className="text-right text-teal-700">{fmt(is.gross_profit)}</td>
                              <td className="text-right text-teal-600">{is.gross_margin_pct}%</td>
                              <td className="text-right text-gray-400">—</td>
                              <td className="pl-4" />
                            </tr>
                            <tr className={cosDetail.length % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="py-1.5 text-gray-700">Total Overhead</td>
                              <td className="text-right">{fmt(is.total_expenses)}</td>
                              <td className="text-right text-gray-500">{is.total_revenue > 0 ? Math.round(is.total_expenses / is.total_revenue * 100) : 0}%</td>
                              <td className="text-right text-gray-400">—</td>
                              <td className="pl-4" />
                            </tr>
                            {grantIncome.length > 0 && (
                              <tr className="bg-green-50">
                                <td className="py-1.5 text-gray-700">Grant Income</td>
                                <td className="text-right text-green-600">{fmt(grantIncome.reduce((s, g) => s + g.amount, 0))}</td>
                                <td className="text-right text-gray-400">—</td>
                                <td className="text-right text-gray-400">—</td>
                                <td className="pl-4 text-xs text-amber-600">{grantIncome.some(g => !g.recurring) ? "Non-recurring" : ""}</td>
                              </tr>
                            )}
                            <tr className="font-semibold border-t border-gray-200 bg-gray-50">
                              <td className="py-1.5">{is.operating_profit < 0 ? "Operating Loss" : "Operating Profit"}</td>
                              <td className={`text-right ${is.operating_profit < 0 ? "text-red-600" : "text-green-600"}`}>{fmt(is.operating_profit)}</td>
                              <td className={`text-right ${is.operating_margin_pct < 0 ? "text-red-500" : "text-gray-500"}`}>{is.operating_margin_pct}%</td>
                              <td className="text-right text-gray-400">—</td>
                              <td className="pl-4" />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {breakevenData?.note && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Breakeven analysis</p>
                      <p className="text-sm text-gray-700">{breakevenData.note}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Q2: Capital ───────────────────────────────────────── */}
              <Card style={{ backgroundColor: "#F0F4FF" }}>
                <CardContent className="pt-6">
                  <SectionHeader num={2} question="Is our capital deployed correctly?" period={period.periodLabel} />

                  {threeCore.capital_verdict && (
                    <div className="bg-white border-l-4 border-teal-500 rounded-r-lg px-4 py-3 mb-6 shadow-sm">
                      <p className="text-base font-medium text-gray-800 leading-relaxed">{threeCore.capital_verdict}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Cashflow waterfall or net cashflow */}
                    <ChartBox title={waterfallData ? "Cash Movement" : "Net Cashflow"}>
                      {waterfallData ? (
                        <ResponsiveContainer width="100%" height={155}>
                          <BarChart data={waterfallData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={55} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v: number) => fmtKFull(Math.abs(v))} />
                            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                              <LabelList dataKey="value" position="right" formatter={(v: number) => fmtK(Math.abs(v))} style={{ fontSize: 9, fill: "#6B7280" }} />
                              {waterfallData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height={155}>
                          <BarChart data={[{ name: period.periodLabel || "This period", cashflow: cf.net_cashflow || 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v: number) => fmtKFull(v)} />
                            <ReferenceLine y={0} stroke="#e5e7eb" />
                            <Bar dataKey="cashflow" fill={GREEN} name="Net Cashflow" radius={[3, 3, 0, 0]}>
                              <LabelList dataKey="cashflow" position="top" formatter={fmtK} style={{ fontSize: 10, fill: "#6B7280" }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </ChartBox>

                    {/* Cash balance or overhead */}
                    {overheadChartData ? (
                      <ChartBox title="Overhead Breakdown">
                        <ResponsiveContainer width="100%" height={155}>
                          <BarChart data={overheadChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtK} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(v: number) => fmtKFull(v)} />
                            <Bar dataKey="Amount" fill={NAVY} radius={[0, 3, 3, 0]}>
                              <LabelList dataKey="Amount" position="right" formatter={fmtK} style={{ fontSize: 9, fill: "#6B7280" }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartBox>
                    ) : (
                      <KpiDisplayCard
                        label="Cash Balance"
                        value={fmt(cashBalance)}
                        benchmark="£10,000"
                        benchmarkLabel="Minimum target"
                        rag={cashRag}
                      />
                    )}
                  </div>

                  {/* Balance sheet */}
                  {(bs.total_assets > 0 || bs.total_debt > 0) && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Balance Sheet Position</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left pb-2 text-gray-500 font-medium">Item</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Amount</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bsRows.map((row, i) => (
                              <tr key={row.label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className={`py-1.5 ${row.bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>{row.label}</td>
                                <td className={`text-right font-medium ${(row.value || 0) < 0 ? "text-red-600" : row.bold ? "text-gray-900" : "text-gray-700"}`}>{fmt(row.value)}</td>
                                <td className="text-right"><span className="flex items-center justify-end gap-1"><RagDot rag={row.rag} /></span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* DLA table */}
                  {dlas.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Director Loan Accounts</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left pb-2 text-gray-500 font-medium">Director</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Opening</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Closing</th>
                              <th className="text-right pb-2 text-gray-500 font-medium">Movement</th>
                              <th className="text-left pb-2 text-gray-500 font-medium pl-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dlas.map((d, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="py-1.5 font-medium text-gray-800">{d.name}</td>
                                <td className="text-right text-gray-600">{fmt(d.open_balance)}</td>
                                <td className="text-right text-gray-800 font-medium">{fmt(d.close_balance)}</td>
                                <td className={`text-right ${d.movement < 0 ? "text-green-600" : "text-red-600"}`}>{d.movement < 0 ? `-${fmt(Math.abs(d.movement))}` : `+${fmt(d.movement)}`}</td>
                                <td className="pl-4 text-gray-500">{d.status}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold border-t border-gray-200 bg-gray-50">
                              <td className="py-1.5">Total</td>
                              <td className="text-right">{fmt(dlas.reduce((s, d) => s + d.open_balance, 0))}</td>
                              <td className="text-right">{fmt(totalDla)}</td>
                              <td className="text-right">{fmt(dlas.reduce((s, d) => s + d.movement, 0))}</td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Q3: Borrowing ─────────────────────────────────────── */}
              <Card style={{ backgroundColor: "#F4F5F8" }}>
                <CardContent className="pt-6">
                  <SectionHeader num={3} question="Can / should we look to borrow more?" period={period.periodLabel} />

                  {threeCore.borrowing_verdict && (
                    <div className="rounded-lg px-5 py-4 mb-6 text-white shadow-sm" style={{ backgroundColor: NAVY }}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2 opacity-70">Verdict</p>
                      <p className="text-base leading-relaxed font-medium">{threeCore.borrowing_verdict}</p>
                    </div>
                  )}

                  {debtSchedule.length > 0 && (
                    <div className={debtDonutData ? "grid grid-cols-5 gap-6 mb-4" : "mb-4"}>
                      {debtDonutData && (
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Debt Breakdown</p>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie data={debtDonutData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name">
                                {debtDonutData.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                              </Pie>
                              <Tooltip formatter={(v: number) => fmtKFull(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      <div className={debtDonutData ? "col-span-3" : ""}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Debt Schedule</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left pb-2 text-gray-500 font-medium">Facility</th>
                                <th className="text-right pb-2 text-gray-500 font-medium">Open</th>
                                <th className="text-right pb-2 text-gray-500 font-medium">Close</th>
                                <th className="text-left pb-2 text-gray-500 font-medium pl-2">Type</th>
                                <th className="text-center pb-2 text-gray-500 font-medium">RAG</th>
                              </tr>
                            </thead>
                            <tbody>
                              {debtSchedule.map((d, i) => (
                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="py-1.5 font-medium text-gray-800 text-xs">
                                    {d.facility}{d.is_new_this_period && <span className="ml-1 text-xs text-amber-500">NEW</span>}
                                  </td>
                                  <td className="text-right text-xs text-gray-500">{d.open_balance > 0 ? fmt(d.open_balance) : "—"}</td>
                                  <td className="text-right text-xs font-medium">{fmt(d.close_balance)}</td>
                                  <td className="pl-2 text-xs text-gray-400">{d.type}</td>
                                  <td className="text-center"><span className="flex items-center justify-center"><RagDot rag={d.rag} /></span></td>
                                </tr>
                              ))}
                              <tr className="font-semibold border-t border-gray-200 bg-gray-50">
                                <td className="py-1.5 text-xs">TOTAL (excl DLA)</td>
                                <td className="text-right text-xs">{fmt(debtSchedule.reduce((s, d) => s + d.open_balance, 0))}</td>
                                <td className="text-right text-xs">{fmt(totalDebt)}</td>
                                <td /><td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Strategic Goal Tracker ───────────────────────────────── */}
          {goalCommentary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-teal-500" /> Strategic Goal Tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {goalCommentary.map((g, i) => {
                  const pct = g.progressPct ?? (g.onTrack ? 60 : 30);
                  return (
                    <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-2 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                          <ArrowRight className="h-4 w-4 text-teal-500 shrink-0" />{g.goal}
                        </p>
                        <Badge className={g.onTrack ? "bg-green-100 text-green-700 border-0 shrink-0" : "bg-amber-100 text-amber-700 border-0 shrink-0"}>
                          {g.onTrack ? "On track" : "Off track"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 pl-5"><span className="text-gray-400 mr-1">Position:</span>{g.currentFinancialPosition}</p>
                      <p className="text-sm text-gray-600 pl-5"><span className="text-gray-400 mr-1">Gap:</span>{g.gap}</p>
                      <div className="pl-5 flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${g.onTrack ? "bg-teal-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{pct}% of goal</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ── Actions for Next Period ──────────────────────────────── */}
          {actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Actions for Next Period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {actions.map((a, i) => {
                  const borderColour = a.priority === "high" || a.priority === "red" ? RED : a.priority === "medium" || a.priority === "amber" ? AMBER : GRAY;
                  return (
                    <div key={i} className="rounded-lg bg-white border border-gray-100 shadow-sm overflow-hidden" style={{ borderLeftColor: borderColour, borderLeftWidth: 4 }}>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <PriorityBadge priority={a.priority} />
                          <p className="font-semibold text-gray-800 text-sm">{a.action}</p>
                        </div>
                        {a.why && <p className="text-xs text-gray-500 leading-relaxed">{a.why}</p>}
                        {a.metricImpact && (
                          <p className="text-xs text-teal-700 font-medium mt-1">Impact: {a.metricImpact}</p>
                        )}
                        {a.linksToGoal && (
                          <span className="inline-flex items-center gap-1 mt-2 bg-teal-50 text-teal-700 text-xs px-2 py-0.5 rounded-full border border-teal-100">
                            <Target className="h-3 w-3" /> {a.linksToGoal}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {nextPeriodMetrics.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metrics to introduce next period</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left pb-2 text-gray-500 font-medium">Metric</th>
                          <th className="text-left pb-2 text-gray-500 font-medium">Why</th>
                          <th className="text-center pb-2 text-gray-500 font-medium">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {nextPeriodMetrics.map((m, i) => (
                          <tr key={i}>
                            <td className="py-1.5 font-medium text-gray-800">{m.metric}</td>
                            <td className="text-gray-500 text-xs">{m.why}</td>
                            <td className="text-center"><span className="flex items-center justify-center"><RagDot rag={m.priority} /></span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Discussion Points ────────────────────────────────────── */}
          {discussionPoints.length > 0 && (
            <div className="rounded-xl p-6" style={{ backgroundColor: "#F9FAFB" }}>
              <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-teal-500" /> Meeting agenda / Discussion points
              </h3>
              <ol className="space-y-3">
                {discussionPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: TEAL }}>
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{point}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── Watch Points ─────────────────────────────────────────── */}
          {watchPoints.length > 0 && (
            <div className="rounded-xl p-6 bg-amber-50 border border-amber-100">
              <h3 className="text-base font-semibold text-amber-800 flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Watch Points for Next Period
              </h3>
              <ul className="space-y-2">
                {watchPoints.map((w, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                    <p className="text-sm text-amber-900 leading-relaxed">{w}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Next Period Focus ─────────────────────────────────────── */}
          {nextPeriodFocus && (
            <div className="rounded-xl p-6" style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #F0FAFA 100%)", border: "1px solid #DBEAFE" }}>
              <h3 className="text-base font-semibold flex items-center gap-2 mb-3" style={{ color: NAVY }}>
                <ArrowRight className="h-4 w-4 text-teal-600" /> Next Period Focus
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{nextPeriodFocus}</p>
            </div>
          )}

          {/* ── Accountant Notes ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-gray-400" /> Accountant Notes</CardTitle>
              {!editingNotes && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-gray-500" onClick={() => { setNotesDraft(report.accountantNotes || ""); setEditingNotes(true); }}>
                  <Edit3 className="h-3 w-3" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <div className="space-y-3">
                  <Textarea className="min-h-[100px]" value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="Add notes for the client..." />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => { updateMutation.mutate({ accountantNotes: notesDraft }); setEditingNotes(false); }}>Save notes</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {report.accountantNotes || <span className="text-gray-400 italic">No notes added yet.</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
