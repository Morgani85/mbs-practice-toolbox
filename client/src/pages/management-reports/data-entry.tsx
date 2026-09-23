import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Save, Sparkles, ChevronDown, ChevronRight, Plus, Trash2, Upload, FileText, X, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type RevenueStream = { name: string; this_period: number; prior_period: number; pct_of_revenue: number };
type CosDetail = { name: string; this_period: number; prior_period: number; pct_of_revenue: number; note: string };
type OverheadBreakdown = { category: string; amount: number; pct_of_revenue: number };
type DebtFacility = { facility: string; type: string; open_balance: number; close_balance: number; movement: number; is_new_this_period: boolean; rag: "red" | "amber" | "green"; note: string };
type DLA = { name: string; open_balance: number; close_balance: number; movement: number; direction: "owed_to_company" | "owed_by_company"; status: string };
type GrantIncome = { name: string; amount: number; recurring: boolean; note: string };
type CashflowWaterfall = { opening_cash: number; gp_earned: number; overheads_paid: number; debt_service: number; grant_received: number; asset_purchases: number; working_capital_movement: number; closing_cash: number };
type Breakeven = { required_gross_profit: number; required_revenue_at_current_margin: number; note: string };
type ThreeCoreQuestions = { profitability_verdict: string; capital_verdict: string; borrowing_verdict: string };
type NextPeriodMetric = { metric: string; why: string; priority: "red" | "amber" | "green" };
type PeriodComparison = { label: string; this_period: number; prior_period: number; movement: number; movement_pct: number; note: string; rag: "red" | "amber" | "green" };

type FinancialData = {
  income_statement: {
    total_revenue: number; cost_of_sales: number; gross_profit: number; gross_margin_pct: number;
    total_expenses: number; operating_profit: number; operating_margin_pct: number;
    net_profit: number; net_margin_pct: number;
  };
  cashflow: { opening_balance: number; cash_in: number; cash_out: number; net_cashflow: number; closing_balance: number };
  balance_sheet: { total_assets: number; current_assets: number; current_liabilities: number; net_assets: number; total_debt: number };
  kpis: { debtor_days: number; creditor_days: number; current_ratio: number; cash_balance: number };
  period_type?: string;
  period_number?: number;
  revenue_streams?: RevenueStream[];
  cost_of_sales_detail?: CosDetail[];
  overhead_breakdown?: OverheadBreakdown[];
  debt_schedule?: DebtFacility[];
  director_loan_accounts?: DLA[];
  grant_income?: GrantIncome[];
  cashflow_waterfall?: CashflowWaterfall;
  breakeven?: Breakeven;
  three_core_questions?: ThreeCoreQuestions;
  next_period_metrics?: NextPeriodMetric[];
  period_comparison?: PeriodComparison[];
};

function NumInput({ label, value, onChange, prefix = "£", suffix = "" }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <Input
          type="number"
          className={prefix ? "pl-6" : ""}
          value={value || ""}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = true, optional = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; optional?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {title}
            {optional && <Badge variant="outline" className="text-xs text-gray-400 border-gray-300 font-normal">Optional — enhanced report</Badge>}
          </span>
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function RagSelect({ value, onChange }: { value: string; onChange: (v: "red" | "amber" | "green") => void }) {
  const colours: Record<string, string> = { red: "bg-red-500", amber: "bg-amber-400", green: "bg-green-500" };
  return (
    <Select value={value} onValueChange={v => onChange(v as any)}>
      <SelectTrigger className="h-8 w-24">
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${colours[value]}`} />
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {["red", "amber", "green"].map(r => (
          <SelectItem key={r} value={r}>
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${colours[r]}`} />
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UploadDropzone({ label, hint, file, onFile }: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputId = `upload-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
          <FileText className="h-4 w-4 text-teal-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-teal-800 truncate">{file.name}</p>
            <p className="text-xs text-teal-600">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="text-teal-400 hover:text-teal-700 p-0.5 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 cursor-pointer hover:border-teal-300 hover:bg-teal-50/50 transition-colors"
        >
          <Upload className="h-5 w-5 text-gray-300" />
          <span className="text-sm text-gray-500">
            <span className="font-medium text-teal-600">Click to upload</span> or drag and drop
          </span>
          <span className="text-xs text-gray-400">{hint}</span>
          <span className="text-xs text-gray-300">PDF, XLS, XLSX, CSV</span>
          <input
            id={inputId}
            type="file"
            accept=".pdf,.xls,.xlsx,.csv"
            className="sr-only"
            onChange={e => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

export default function DataEntry() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/reports", id],
    queryFn: () => fetch(`/api/reports/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const emptyFD: FinancialData = {
    income_statement: { total_revenue: 0, cost_of_sales: 0, gross_profit: 0, gross_margin_pct: 0, total_expenses: 0, operating_profit: 0, operating_margin_pct: 0, net_profit: 0, net_margin_pct: 0 },
    cashflow: { opening_balance: 0, cash_in: 0, cash_out: 0, net_cashflow: 0, closing_balance: 0 },
    balance_sheet: { total_assets: 0, current_assets: 0, current_liabilities: 0, net_assets: 0, total_debt: 0 },
    kpis: { debtor_days: 0, creditor_days: 0, current_ratio: 0, cash_balance: 0 },
  };

  const [fd, setFd] = useState<FinancialData>(emptyFD);
  const [customNotes, setCustomNotes] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<"pl" | "bs" | "both">("both");
  const [uploadPeriodMode, setUploadPeriodMode] = useState<"range" | "endlen">("range");
  const [uploadStartDate, setUploadStartDate] = useState("");
  const [uploadEndDate, setUploadEndDate] = useState("");
  const [uploadPeriodLength, setUploadPeriodLength] = useState("12");
  const [uploadStartFile, setUploadStartFile] = useState<File | null>(null);
  const [uploadEndFile, setUploadEndFile] = useState<File | null>(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  // Extended state
  const [revenueStreams, setRevenueStreams] = useState<RevenueStream[]>([]);
  const [cosDetail, setCosDetail] = useState<CosDetail[]>([]);
  const [overheadBreakdown, setOverheadBreakdown] = useState<OverheadBreakdown[]>([]);
  const [debtSchedule, setDebtSchedule] = useState<DebtFacility[]>([]);
  const [dlas, setDlas] = useState<DLA[]>([]);
  const [grantIncome, setGrantIncome] = useState<GrantIncome[]>([]);
  const [cashflowWaterfall, setCashflowWaterfall] = useState<CashflowWaterfall>({
    opening_cash: 0, gp_earned: 0, overheads_paid: 0, debt_service: 0, grant_received: 0, asset_purchases: 0, working_capital_movement: 0, closing_cash: 0
  });
  const [breakeven, setBreakeven] = useState<Breakeven>({ required_gross_profit: 0, required_revenue_at_current_margin: 0, note: "" });
  const [threeCoreQ, setThreeCoreQ] = useState<ThreeCoreQuestions>({ profitability_verdict: "", capital_verdict: "", borrowing_verdict: "" });
  const [nextPeriodMetrics, setNextPeriodMetrics] = useState<NextPeriodMetric[]>([]);

  useEffect(() => {
    if (report?.financialData) {
      const d = report.financialData as any;
      setFd({
        income_statement: d.income_statement || emptyFD.income_statement,
        cashflow: d.cashflow || emptyFD.cashflow,
        balance_sheet: d.balance_sheet || emptyFD.balance_sheet,
        kpis: d.kpis || emptyFD.kpis,
      });
      if (d.revenue_streams) setRevenueStreams(d.revenue_streams);
      if (d.cost_of_sales_detail) setCosDetail(d.cost_of_sales_detail);
      if (d.overhead_breakdown) setOverheadBreakdown(d.overhead_breakdown);
      if (d.debt_schedule) setDebtSchedule(d.debt_schedule);
      if (d.director_loan_accounts) setDlas(d.director_loan_accounts);
      if (d.grant_income) setGrantIncome(d.grant_income);
      if (d.cashflow_waterfall) setCashflowWaterfall(d.cashflow_waterfall);
      if (d.breakeven) setBreakeven(d.breakeven);
      if (d.three_core_questions) setThreeCoreQ(d.three_core_questions);
      if (d.next_period_metrics) setNextPeriodMetrics(d.next_period_metrics);
    }
    if ((report?.customData as any)?.notes) setCustomNotes((report.customData as any).notes);
  }, [report]);

  const updateIS = (key: keyof FinancialData["income_statement"], value: number) => {
    setFd(prev => {
      const is = { ...prev.income_statement, [key]: value };
      is.gross_profit = is.total_revenue - is.cost_of_sales;
      is.gross_margin_pct = is.total_revenue > 0 ? Math.round((is.gross_profit / is.total_revenue) * 1000) / 10 : 0;
      is.operating_profit = is.gross_profit - is.total_expenses;
      is.operating_margin_pct = is.total_revenue > 0 ? Math.round((is.operating_profit / is.total_revenue) * 1000) / 10 : 0;
      is.net_profit = is.operating_profit;
      is.net_margin_pct = is.total_revenue > 0 ? Math.round((is.net_profit / is.total_revenue) * 1000) / 10 : 0;
      return { ...prev, income_statement: is };
    });
  };

  const updateCF = (key: keyof FinancialData["cashflow"], value: number) => {
    setFd(prev => {
      const cf = { ...prev.cashflow, [key]: value };
      cf.net_cashflow = cf.cash_in - cf.cash_out;
      cf.closing_balance = cf.opening_balance + cf.net_cashflow;
      return { ...prev, cashflow: cf };
    });
  };

  const updateBS = (key: keyof FinancialData["balance_sheet"], value: number) => {
    setFd(prev => {
      const bs = { ...prev.balance_sheet, [key]: value };
      bs.net_assets = bs.total_assets - bs.total_debt;
      return { ...prev, balance_sheet: bs };
    });
  };

  const updateKPI = (key: keyof FinancialData["kpis"], value: number) => {
    setFd(prev => ({ ...prev, kpis: { ...prev.kpis, [key]: value } }));
  };

  const updateCFW = (key: keyof CashflowWaterfall, value: number) => {
    setCashflowWaterfall(prev => {
      const wf = { ...prev, [key]: value };
      wf.closing_cash = wf.opening_cash + wf.gp_earned - wf.overheads_paid - wf.debt_service + wf.grant_received - wf.asset_purchases + wf.working_capital_movement;
      return wf;
    });
  };

  const buildFullFD = (): FinancialData => ({
    ...fd,
    revenue_streams: revenueStreams.length > 0 ? revenueStreams : undefined,
    cost_of_sales_detail: cosDetail.length > 0 ? cosDetail : undefined,
    overhead_breakdown: overheadBreakdown.length > 0 ? overheadBreakdown : undefined,
    debt_schedule: debtSchedule.length > 0 ? debtSchedule : undefined,
    director_loan_accounts: dlas.length > 0 ? dlas : undefined,
    grant_income: grantIncome.length > 0 ? grantIncome : undefined,
    cashflow_waterfall: (cashflowWaterfall.opening_cash !== 0 || cashflowWaterfall.gp_earned !== 0) ? cashflowWaterfall : undefined,
    breakeven: breakeven.required_gross_profit > 0 ? breakeven : undefined,
    three_core_questions: (threeCoreQ.profitability_verdict || threeCoreQ.capital_verdict || threeCoreQ.borrowing_verdict) ? threeCoreQ : undefined,
    next_period_metrics: nextPeriodMetrics.length > 0 ? nextPeriodMetrics : undefined,
  } as any);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullFD = buildFullFD();
      const fdRes = await apiRequest(`/api/reports/${id}/financial-data`, "PUT", fullFD);
      if (!fdRes.ok) throw new Error("Failed to save financial data");
      const cdRes = await apiRequest(`/api/reports/${id}/custom-data`, "PUT", { notes: customNotes });
      if (!cdRes.ok) throw new Error("Failed to save notes");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", id] });
      toast({ title: "Data saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const fullFD = buildFullFD();
      await apiRequest(`/api/reports/${id}/financial-data`, "PUT", fullFD);
      await apiRequest(`/api/reports/${id}/custom-data`, "PUT", { notes: customNotes });
      const res = await apiRequest(`/api/reports/${id}/generate-ai`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", id] });
      toast({ title: "AI report generated successfully" });
      navigate(`/management-reports/reports/${id}`);
    },
    onError: (e: Error) => toast({ title: "AI generation failed", description: e.message, variant: "destructive" }),
  });

  async function syncFromXero() {
    if (!report?.clientId) return;
    setSyncLoading(true);
    try {
      const res = await apiRequest(`/api/xero/sync/${report.clientId}/${id}`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const data = await res.json();
      if (data.data) {
        setFd({
          income_statement: data.data.income_statement || emptyFD.income_statement,
          cashflow: data.data.cashflow || emptyFD.cashflow,
          balance_sheet: data.data.balance_sheet || emptyFD.balance_sheet,
          kpis: data.data.kpis || emptyFD.kpis,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/reports", id] });
      toast({ title: "Demo data loaded from Xero (stub)" });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncLoading(false);
    }
  }

  async function processUpload() {
    if (!uploadStartFile && !uploadEndFile) {
      toast({ title: "No files selected", description: "Please upload at least one document.", variant: "destructive" });
      return;
    }
    if (uploadPeriodMode === "range" && (!uploadStartDate || !uploadEndDate)) {
      toast({ title: "Period required", description: "Please set both a start and end date.", variant: "destructive" });
      return;
    }
    if (uploadPeriodMode === "endlen" && !uploadEndDate) {
      toast({ title: "Period end date required", description: "Please set the period end date.", variant: "destructive" });
      return;
    }
    setUploadProcessing(true);
    await new Promise(r => setTimeout(r, 1800));
    setUploadProcessing(false);
    setUploadOpen(false);
    setUploadStartFile(null);
    setUploadEndFile(null);
    const docLabel = uploadDocType === "pl" ? "P&L" : uploadDocType === "bs" ? "Balance Sheet" : "P&L & Balance Sheet";
    toast({
      title: "Documents received",
      description: `${docLabel} document${uploadEndFile && uploadStartFile ? "s" : ""} uploaded. Manual review required before data can be entered.`,
    });
  }

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (!report) return <div className="text-center py-16 text-gray-400">Report not found.</div>;

  const is = fd.income_statement;
  const cf = fd.cashflow;
  const bs = fd.balance_sheet;
  const kpi = fd.kpis;
  const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB")}${n < 0 ? " (loss)" : ""}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/management-reports/clients/${report.clientId}`}>
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Financial Data Entry</h1>
            <p className="text-sm text-gray-500">{report.client?.clientName} — {report.period?.periodLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Data
          </Button>
          <Button variant="outline" className="gap-2 border-teal-200 text-teal-700 hover:bg-teal-50" onClick={syncFromXero} disabled={syncLoading}>
            <RefreshCw className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`} />
            {syncLoading ? "Syncing…" : "Sync from Xero"}
          </Button>
        </div>
      </div>

      {/* ── Upload Data Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-gray-500" />
              Upload Financial Documents
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* Document type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Document type</Label>
              <div className="grid grid-cols-3 gap-2">
                {([["pl","P&L"], ["bs","Balance Sheet"], ["both","Both"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setUploadDocType(val)}
                    className={`rounded-lg border py-2 px-3 text-sm font-medium transition-all ${
                      uploadDocType === val
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Period definition */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Period</Label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {([["range","Start & end date"], ["endlen","End date + length"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setUploadPeriodMode(val)}
                    className={`rounded-lg border py-2 px-3 text-sm font-medium transition-all ${
                      uploadPeriodMode === val
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {uploadPeriodMode === "range" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Period start</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-9 text-sm"
                        value={uploadStartDate}
                        onChange={e => setUploadStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Period end</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-9 text-sm"
                        value={uploadEndDate}
                        onChange={e => setUploadEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Period end date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                      <Input
                        type="date"
                        className="pl-9 text-sm"
                        value={uploadEndDate}
                        onChange={e => setUploadEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Period length</Label>
                    <Select value={uploadPeriodLength} onValueChange={setUploadPeriodLength}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12w">12 weeks</SelectItem>
                        <SelectItem value="1">1 month</SelectItem>
                        <SelectItem value="3">3 months</SelectItem>
                        <SelectItem value="6">6 months</SelectItem>
                        <SelectItem value="9">9 months</SelectItem>
                        <SelectItem value="12">12 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* File uploads */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Documents</Label>
              <UploadDropzone
                label="Period start document"
                hint="Opening position — balance sheet at start of period"
                file={uploadStartFile}
                onFile={setUploadStartFile}
              />
              <UploadDropzone
                label="Period end document"
                hint="Closing position — P&L and/or balance sheet at end of period"
                file={uploadEndFile}
                onFile={setUploadEndFile}
              />
            </div>

          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadStartFile(null); setUploadEndFile(null); }}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 gap-2"
              onClick={processUpload}
              disabled={uploadProcessing}
            >
              {uploadProcessing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><Upload className="h-4 w-4" /> Upload documents</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CORE SECTION: Income Statement ── */}
      <Section title="Income Statement">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Total revenue" value={is.total_revenue} onChange={v => updateIS("total_revenue", v)} />
          <NumInput label="Cost of sales (total)" value={is.cost_of_sales} onChange={v => updateIS("cost_of_sales", v)} />
          <div className="col-span-2 bg-teal-50 border border-teal-100 rounded-lg p-3 flex gap-6 text-sm">
            <div><span className="text-gray-500 mr-1">Gross profit:</span><span className="font-semibold">£{is.gross_profit.toLocaleString("en-GB")}</span></div>
            <div><span className="text-gray-500 mr-1">GP%:</span><span className="font-semibold">{is.gross_margin_pct}%</span></div>
          </div>
          <NumInput label="Total operating expenses" value={is.total_expenses} onChange={v => updateIS("total_expenses", v)} />
          <div className="flex items-end pb-0.5">
            <div className="bg-gray-50 rounded-lg p-3 text-sm w-full">
              <div><span className="text-gray-500 mr-1">Operating profit:</span><span className={`font-semibold ${is.operating_profit < 0 ? "text-red-600" : "text-green-600"}`}>{fmt(is.operating_profit)}</span></div>
              <div><span className="text-gray-500 mr-1">Net margin:</span><span className="font-semibold">{is.net_margin_pct}%</span></div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CORE SECTION: Cashflow ── */}
      <Section title="Cashflow">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Opening bank balance" value={cf.opening_balance} onChange={v => updateCF("opening_balance", v)} />
          <NumInput label="Total cash in" value={cf.cash_in} onChange={v => updateCF("cash_in", v)} />
          <NumInput label="Total cash out" value={cf.cash_out} onChange={v => updateCF("cash_out", v)} />
          <div className="flex items-end pb-0.5">
            <div className="bg-gray-50 rounded-lg p-3 text-sm w-full">
              <div><span className="text-gray-500 mr-1">Net cashflow:</span><span className={`font-semibold ${cf.net_cashflow < 0 ? "text-red-600" : "text-green-600"}`}>£{cf.net_cashflow.toLocaleString("en-GB")}</span></div>
              <div><span className="text-gray-500 mr-1">Closing balance:</span><span className="font-semibold">£{cf.closing_balance.toLocaleString("en-GB")}</span></div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CORE SECTION: Balance Sheet ── */}
      <Section title="Balance Sheet">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Total assets" value={bs.total_assets} onChange={v => updateBS("total_assets", v)} />
          <NumInput label="Current assets" value={bs.current_assets} onChange={v => updateBS("current_assets", v)} />
          <NumInput label="Current liabilities" value={bs.current_liabilities} onChange={v => updateBS("current_liabilities", v)} />
          <NumInput label="Total debt" value={bs.total_debt} onChange={v => updateBS("total_debt", v)} />
          <div className="col-span-2 bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500 mr-1">Net assets:</span>
            <span className={`font-semibold ${bs.net_assets < 0 ? "text-red-600" : "text-gray-900"}`}>£{bs.net_assets.toLocaleString("en-GB")}</span>
          </div>
        </div>
      </Section>

      {/* ── CORE SECTION: KPIs ── */}
      <Section title="KPIs">
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Debtor days" value={kpi.debtor_days} onChange={v => updateKPI("debtor_days", v)} prefix="" />
          <NumInput label="Creditor days" value={kpi.creditor_days} onChange={v => updateKPI("creditor_days", v)} prefix="" />
          <NumInput label="Current ratio" value={kpi.current_ratio} onChange={v => updateKPI("current_ratio", v)} prefix="" />
          <NumInput label="Cash balance (closing)" value={kpi.cash_balance} onChange={v => updateKPI("cash_balance", v)} />
        </div>
      </Section>

      {/* ── OPTIONAL: Revenue Streams ── */}
      <Section title="Revenue Streams" optional defaultOpen={false}>
        <div className="space-y-3">
          {revenueStreams.map((rs, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <Input placeholder="Stream name" value={rs.name} onChange={e => setRevenueStreams(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="This period" value={rs.this_period || ""} onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setRevenueStreams(p => p.map((x, j) => j === i ? { ...x, this_period: v, pct_of_revenue: is.total_revenue > 0 ? Math.round(v / is.total_revenue * 100) : 0 } : x));
                  }} />
                </div>
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Prior period" value={rs.prior_period || ""} onChange={e => setRevenueStreams(p => p.map((x, j) => j === i ? { ...x, prior_period: parseFloat(e.target.value) || 0 } : x))} />
                </div>
              </div>
              <div className="col-span-1 text-xs text-gray-400 text-center">{rs.pct_of_revenue}%</div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setRevenueStreams(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setRevenueStreams(p => [...p, { name: "", this_period: 0, prior_period: 0, pct_of_revenue: 0 }])}>
            <Plus className="h-3.5 w-3.5" /> Add stream
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: CoS Detail ── */}
      <Section title="Cost of Sales — Detail" optional defaultOpen={false}>
        <div className="space-y-3">
          {cosDetail.map((cs, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <Input placeholder="CoS line name" value={cs.name} onChange={e => setCosDetail(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="This period" value={cs.this_period || ""} onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setCosDetail(p => p.map((x, j) => j === i ? { ...x, this_period: v, pct_of_revenue: is.total_revenue > 0 ? Math.round(v / is.total_revenue * 1000) / 10 : 0 } : x));
                  }} />
                </div>
              </div>
              <div className="col-span-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Prior" value={cs.prior_period || ""} onChange={e => setCosDetail(p => p.map((x, j) => j === i ? { ...x, prior_period: parseFloat(e.target.value) || 0 } : x))} />
                </div>
              </div>
              <div className="col-span-2">
                <Input placeholder="Note" value={cs.note} onChange={e => setCosDetail(p => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
              </div>
              <div className="col-span-1 text-xs text-gray-400 text-center">{cs.pct_of_revenue}%</div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setCosDetail(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setCosDetail(p => [...p, { name: "", this_period: 0, prior_period: 0, pct_of_revenue: 0, note: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add CoS line
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: Overhead Breakdown ── */}
      <Section title="Overhead Breakdown" optional defaultOpen={false}>
        <div className="space-y-3">
          {overheadBreakdown.map((oh, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input placeholder="Category (e.g. People, Rent)" value={oh.category} onChange={e => setOverheadBreakdown(p => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
              </div>
              <div className="col-span-5">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Amount" value={oh.amount || ""} onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setOverheadBreakdown(p => p.map((x, j) => j === i ? { ...x, amount: v, pct_of_revenue: is.total_revenue > 0 ? Math.round(v / is.total_revenue * 1000) / 10 : 0 } : x));
                  }} />
                </div>
              </div>
              <div className="col-span-1 text-xs text-gray-400 text-center">{oh.pct_of_revenue}%</div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setOverheadBreakdown(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setOverheadBreakdown(p => [...p, { category: "", amount: 0, pct_of_revenue: 0 }])}>
            <Plus className="h-3.5 w-3.5" /> Add overhead category
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: Debt Schedule ── */}
      <Section title="Debt Schedule" optional defaultOpen={false}>
        <div className="space-y-4">
          {debtSchedule.map((d, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Facility name (e.g. IWOCA Loan)" value={d.facility} onChange={e => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, facility: e.target.value } : x))} />
                <Input placeholder="Type (e.g. Term loan, HP)" value={d.type} onChange={e => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumInput label="Opening balance" value={d.open_balance} onChange={v => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, open_balance: v, movement: x.close_balance - v } : x))} />
                <NumInput label="Closing balance" value={d.close_balance} onChange={v => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, close_balance: v, movement: v - x.open_balance } : x))} />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">RAG</label>
                  <RagSelect value={d.rag} onChange={v => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, rag: v } : x))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <Input placeholder="Note (optional)" value={d.note} onChange={e => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={d.is_new_this_period} onChange={e => setDebtSchedule(p => p.map((x, j) => j === i ? { ...x, is_new_this_period: e.target.checked } : x))} />
                    New this period
                  </label>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => setDebtSchedule(p => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setDebtSchedule(p => [...p, { facility: "", type: "", open_balance: 0, close_balance: 0, movement: 0, is_new_this_period: false, rag: "amber", note: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add facility
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: Director Loan Accounts ── */}
      <Section title="Director Loan Accounts" optional defaultOpen={false}>
        <div className="space-y-3">
          {dlas.map((d, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <Input placeholder="Director name" value={d.name} onChange={e => setDlas(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="col-span-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Open" value={d.open_balance || ""} onChange={e => setDlas(p => p.map((x, j) => j === i ? { ...x, open_balance: parseFloat(e.target.value) || 0 } : x))} />
                </div>
              </div>
              <div className="col-span-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Close" value={d.close_balance || ""} onChange={e => setDlas(p => p.map((x, j) => j === i ? { ...x, close_balance: parseFloat(e.target.value) || 0, movement: parseFloat(e.target.value) - x.open_balance } : x))} />
                </div>
              </div>
              <div className="col-span-2">
                <Select value={d.direction} onValueChange={v => setDlas(p => p.map((x, j) => j === i ? { ...x, direction: v as any } : x))}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owed_to_company">Owed to Co.</SelectItem>
                    <SelectItem value="owed_by_company">Owed by Co.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input placeholder="Status" value={d.status} onChange={e => setDlas(p => p.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} />
              </div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setDlas(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setDlas(p => [...p, { name: "", open_balance: 0, close_balance: 0, movement: 0, direction: "owed_to_company", status: "Reducing" }])}>
            <Plus className="h-3.5 w-3.5" /> Add director
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: Grant Income ── */}
      <Section title="Grant Income" optional defaultOpen={false}>
        <div className="space-y-3">
          {grantIncome.map((g, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <Input placeholder="Grant name" value={g.name} onChange={e => setGrantIncome(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="col-span-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input type="number" className="pl-6" placeholder="Amount" value={g.amount || ""} onChange={e => setGrantIncome(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} />
                </div>
              </div>
              <div className="col-span-2">
                <Input placeholder="Note" value={g.note} onChange={e => setGrantIncome(p => p.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-sm text-gray-600">
                <input type="checkbox" checked={g.recurring} onChange={e => setGrantIncome(p => p.map((x, j) => j === i ? { ...x, recurring: e.target.checked } : x))} />
                Recurring
              </div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setGrantIncome(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setGrantIncome(p => [...p, { name: "", amount: 0, recurring: false, note: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add grant
          </Button>
        </div>
      </Section>

      {/* ── OPTIONAL: Cashflow Waterfall ── */}
      <Section title="Cashflow Waterfall" optional defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Opening cash" value={cashflowWaterfall.opening_cash} onChange={v => updateCFW("opening_cash", v)} />
          <NumInput label="GP earned (revenue − CoS)" value={cashflowWaterfall.gp_earned} onChange={v => updateCFW("gp_earned", v)} />
          <NumInput label="Overheads paid" value={cashflowWaterfall.overheads_paid} onChange={v => updateCFW("overheads_paid", v)} />
          <NumInput label="Debt service (loan repayments)" value={cashflowWaterfall.debt_service} onChange={v => updateCFW("debt_service", v)} />
          <NumInput label="Grant income received" value={cashflowWaterfall.grant_received} onChange={v => updateCFW("grant_received", v)} />
          <NumInput label="Asset purchases" value={cashflowWaterfall.asset_purchases} onChange={v => updateCFW("asset_purchases", v)} />
          <NumInput label="Working capital movement (+/−)" value={cashflowWaterfall.working_capital_movement} onChange={v => updateCFW("working_capital_movement", v)} prefix="£ +/-" />
          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-sm">
            <span className="text-gray-500 mr-1">Closing cash (calculated):</span>
            <span className={`font-semibold ${cashflowWaterfall.closing_cash < 0 ? "text-red-600" : "text-teal-700"}`}>£{cashflowWaterfall.closing_cash.toLocaleString("en-GB")}</span>
          </div>
        </div>
      </Section>

      {/* ── OPTIONAL: Breakeven ── */}
      <Section title="Breakeven Analysis" optional defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Required gross profit to break even" value={breakeven.required_gross_profit} onChange={v => setBreakeven(p => ({ ...p, required_gross_profit: v }))} />
          <NumInput label="Required revenue at current margin" value={breakeven.required_revenue_at_current_margin} onChange={v => setBreakeven(p => ({ ...p, required_revenue_at_current_margin: v }))} />
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Breakeven narrative (shown in report)</label>
            <Textarea placeholder="e.g. At current overhead levels the business needs £55,000 gross profit per period to break even…" value={breakeven.note} onChange={e => setBreakeven(p => ({ ...p, note: e.target.value }))} className="min-h-[80px]" />
          </div>
        </div>
      </Section>

      {/* ── OPTIONAL: Three Core Questions ── */}
      <Section title="Three Core Questions — Accountant Verdicts" optional defaultOpen={false}>
        <p className="text-xs text-gray-400 mb-4">Write short, direct verdicts for each question. These are displayed prominently in the report and PDF. The AI will also generate these automatically if left blank.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">1. How profitable are we?</label>
            <Textarea placeholder="2-3 sentence direct verdict on profitability…" value={threeCoreQ.profitability_verdict} onChange={e => setThreeCoreQ(p => ({ ...p, profitability_verdict: e.target.value }))} className="min-h-[80px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">2. Is our capital deployed correctly?</label>
            <Textarea placeholder="2-3 sentence direct verdict on capital efficiency…" value={threeCoreQ.capital_verdict} onChange={e => setThreeCoreQ(p => ({ ...p, capital_verdict: e.target.value }))} className="min-h-[80px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">3. Can / should we look to borrow more?</label>
            <Textarea placeholder="2-3 sentence direct verdict on borrowing position…" value={threeCoreQ.borrowing_verdict} onChange={e => setThreeCoreQ(p => ({ ...p, borrowing_verdict: e.target.value }))} className="min-h-[80px]" />
          </div>
        </div>
      </Section>

      {/* ── OPTIONAL: Next Period Metrics ── */}
      <Section title="Metrics to Introduce Next Period" optional defaultOpen={false}>
        <div className="space-y-3">
          {nextPeriodMetrics.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-4">
                <Input placeholder="Metric name" value={m.metric} onChange={e => setNextPeriodMetrics(p => p.map((x, j) => j === i ? { ...x, metric: e.target.value } : x))} />
              </div>
              <div className="col-span-5">
                <Input placeholder="Why track this?" value={m.why} onChange={e => setNextPeriodMetrics(p => p.map((x, j) => j === i ? { ...x, why: e.target.value } : x))} />
              </div>
              <div className="col-span-2">
                <RagSelect value={m.priority} onChange={v => setNextPeriodMetrics(p => p.map((x, j) => j === i ? { ...x, priority: v } : x))} />
              </div>
              <Button variant="ghost" size="sm" className="col-span-1 h-8 w-8 p-0 text-gray-400 hover:text-red-500" onClick={() => setNextPeriodMetrics(p => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50" onClick={() => setNextPeriodMetrics(p => [...p, { metric: "", why: "", priority: "amber" }])}>
            <Plus className="h-3.5 w-3.5" /> Add metric
          </Button>
        </div>
      </Section>

      {/* ── Accountant notes ── */}
      <Section title="Additional context (accountant notes for AI)" defaultOpen={false}>
        <Textarea
          className="min-h-[120px]"
          placeholder="Any additional context you want the AI to consider when generating commentary…"
          value={customNotes}
          onChange={e => setCustomNotes(e.target.value)}
        />
      </Section>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save data"}
        </Button>
        <Button
          className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          <Sparkles className="h-4 w-4" />{generateMutation.isPending ? "Generating AI report…" : "Save & Generate Report"}
        </Button>
      </div>
    </div>
  );
}
