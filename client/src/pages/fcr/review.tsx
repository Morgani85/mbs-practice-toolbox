import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Review = Record<string, any>;
type TrafficLight = "green" | "amber" | "red" | null;

const FCR_CHALLENGES = [
  { value: "cash", label: "Cash" },
  { value: "profit", label: "Profit" },
  { value: "growth", label: "Growth" },
  { value: "pricing", label: "Pricing" },
  { value: "staff", label: "Staff" },
  { value: "leadership", label: "Leadership" },
  { value: "systems", label: "Systems" },
  { value: "sales", label: "Sales" },
  { value: "capacity", label: "Capacity" },
  { value: "time", label: "Time" },
  { value: "other", label: "Other" },
] as const;

const NEXT_STEP_OPTIONS = [
  { value: "remain", label: "Remain as they are" },
  { value: "diy", label: "DIY implementation" },
  { value: "control_chaos", label: "Control the Chaos" },
  { value: "create_clarity", label: "Create Financial Clarity" },
  { value: "build_performance", label: "Build Better Performance" },
  { value: "lead_confidence", label: "Lead with Confidence" },
  { value: "other", label: "Other" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function TrafficLightPicker({
  value,
  onChange,
}: {
  value: TrafficLight;
  onChange: (v: TrafficLight) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["green", "amber", "red"] as const).map((tl) => (
        <button
          key={tl}
          type="button"
          onClick={() => onChange(value === tl ? null : tl)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-all",
            value === tl
              ? tl === "green"
                ? "bg-emerald-500 text-white border-emerald-500"
                : tl === "amber"
                ? "bg-amber-400 text-white border-amber-400"
                : "bg-red-500 text-white border-red-500"
              : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
          )}
        >
          {tl.charAt(0).toUpperCase() + tl.slice(1)}
        </button>
      ))}
    </div>
  );
}

function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "w-8 h-8 rounded-md text-sm font-medium border transition-all",
            value === n
              ? n <= 3
                ? "bg-red-500 text-white border-red-500"
                : n <= 6
                ? "bg-amber-400 text-white border-amber-400"
                : "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  isOpen,
  onToggle,
  status,
}: {
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  status?: TrafficLight;
}) {
  const dotColour =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
      ? "bg-amber-400"
      : status === "red"
      ? "bg-red-500"
      : "bg-gray-200";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-4 px-5 text-left hover:bg-gray-50/60 transition-colors"
    >
      <div className="flex items-center gap-3">
        {status !== undefined && (
          <span className={`w-3 h-3 rounded-full shrink-0 ${dotColour}`} />
        )}
        <div>
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
        </div>
      </div>
      {isOpen ? (
        <ChevronDown size={16} className="text-gray-400 shrink-0" />
      ) : (
        <ChevronRight size={16} className="text-gray-400 shrink-0" />
      )}
    </button>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-44 shrink-0 text-sm text-gray-600">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2 shrink-0">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEBOUNCE_MS = 800;

export default function FcrReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: review, isLoading } = useQuery<Review>({
    queryKey: [`/api/fcr/${id}`],
    queryFn: () => apiRequest(`/api/fcr/${id}`, "GET").then((r) => r.json()),
  });

  // Local state mirrors the server record — all fields
  const [local, setLocal] = useState<Record<string, any>>({});
  useEffect(() => {
    if (review) setLocal(review);
  }, [review]);

  // Saving indicator
  const [saving, setSaving] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, any>) =>
      apiRequest(`/api/fcr/${id}`, "PATCH", patch).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.setQueryData([`/api/fcr/${id}`], updated);
      setSaving(false);
    },
    onError: () => setSaving(false),
  });

  function setField(key: string, value: any) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setSaving(true);
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      saveMutation.mutate({ [key]: value });
    }, DEBOUNCE_MS);
  }

  // Challenges helper
  const challenges: string[] = (() => {
    try { return JSON.parse(local.biggestChallenges || "[]"); } catch { return []; }
  })();
  function toggleChallenge(val: string) {
    const next = challenges.includes(val)
      ? challenges.filter((c) => c !== val)
      : [...challenges, val];
    setField("biggestChallenges", JSON.stringify(next));
  }

  // Open/closed section state — all open by default
  const allSections = ["details", "chaos", "clarity", "performance", "leadership", "challenges", "opportunities", "nextstep", "aireport", "socket"];
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(allSections));
  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // AI generation
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingSocket, setGeneratingSocket] = useState(false);

  async function generateReport() {
    setGeneratingReport(true);
    try {
      const res = await apiRequest(`/api/fcr/${id}/generate-report`, "POST");
      const data = await res.json();
      setLocal((prev) => ({ ...prev, aiReport: data.aiReport }));
      qc.setQueryData([`/api/fcr/${id}`], data.review);
    } catch {
      // silent — user can retry
    } finally {
      setGeneratingReport(false);
    }
  }

  async function generateSocket() {
    setGeneratingSocket(true);
    try {
      const res = await apiRequest(`/api/fcr/${id}/generate-socket`, "POST");
      const data = await res.json();
      setLocal((prev) => ({ ...prev, socketHandover: data.socketHandover }));
      qc.setQueryData([`/api/fcr/${id}`], data.review);
    } catch {
      // silent
    } finally {
      setGeneratingSocket(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex items-center justify-center text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading review…
      </div>
    );
  }

  if (!review) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-gray-500">
        Review not found.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/fcr")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          All reviews
        </button>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Save size={12} className="animate-pulse" />
              Saving…
            </span>
          )}
          {!saving && (
            <span className="text-xs text-gray-300">Auto-saved</span>
          )}
        </div>
      </div>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {local.businessName || <span className="text-gray-300">Financial Clarity Review</span>}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Financial Clarity Review™</p>
      </div>

      {/* ── SECTION 1 — Client Details ─────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Client Details"
          subtitle="Who are we meeting with today?"
          isOpen={openSections.has("details")}
          onToggle={() => toggleSection("details")}
        />
        {openSections.has("details") && (
          <CardContent className="pt-0 pb-5 px-5 space-y-1 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4">
              {[
                { key: "businessName", label: "Business name" },
                { key: "contact", label: "Contact" },
                { key: "turnover", label: "Turnover" },
                { key: "employees", label: "Employees" },
                { key: "industry", label: "Industry" },
                { key: "currentAccountant", label: "Current accountant" },
                { key: "referralSource", label: "Referral source" },
                { key: "reviewDate", label: "Date", type: "date" },
                { key: "adviser", label: "Adviser" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <Label className="text-xs text-gray-500 mb-1 block">{label}</Label>
                  <Input
                    type={type ?? "text"}
                    value={local[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 2 — Control the Chaos ─────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Control the Chaos"
          subtitle="Can this business trust its financial information?"
          isOpen={openSections.has("chaos")}
          onToggle={() => toggleSection("chaos")}
          status={local.chaosStatus as TrafficLight}
        />
        {openSections.has("chaos") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 space-y-3 pt-4">
            {[
              { key: "bookkeepingQuality", label: "Bookkeeping quality" },
              { key: "complianceConfidence", label: "Compliance confidence" },
              { key: "vatUpToDate", label: "VAT up to date" },
              { key: "accountsUpToDate", label: "Accounts up to date" },
              { key: "taxSurprises", label: "Tax surprises" },
              { key: "softwareConfidence", label: "Software confidence" },
            ].map(({ key, label }) => (
              <FieldRow key={key} label={label}>
                <TrafficLightPicker
                  value={local[key] as TrafficLight}
                  onChange={(v) => setField(key, v)}
                />
              </FieldRow>
            ))}
            <FieldRow label="Owner confidence in numbers">
              <ScorePicker
                value={local.ownerConfidenceInNumbers ?? null}
                onChange={(v) => setField("ownerConfidenceInNumbers", v)}
              />
            </FieldRow>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Notes</Label>
              <Textarea
                value={local.chaosNotes ?? ""}
                onChange={(e) => setField("chaosNotes", e.target.value)}
                placeholder="Anything important to capture about this section…"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <FieldRow label="Overall status">
              <TrafficLightPicker
                value={local.chaosStatus as TrafficLight}
                onChange={(v) => setField("chaosStatus", v)}
              />
            </FieldRow>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 3 — Financial Clarity ─────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Financial Clarity"
          subtitle="Does the owner understand what the numbers are telling them?"
          isOpen={openSections.has("clarity")}
          onToggle={() => toggleSection("clarity")}
          status={local.clarityStatus as TrafficLight}
        />
        {openSections.has("clarity") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 space-y-3 pt-4">
            {[
              { key: "managementAccounts", label: "Management accounts" },
              { key: "kpis", label: "KPIs" },
              { key: "cashflowVisibility", label: "Cashflow visibility" },
              { key: "departmentProfitability", label: "Department profitability" },
              { key: "regularReviewMeetings", label: "Regular review meetings" },
              { key: "financialUnderstanding", label: "Financial understanding" },
            ].map(({ key, label }) => (
              <FieldRow key={key} label={label}>
                <TrafficLightPicker
                  value={local[key] as TrafficLight}
                  onChange={(v) => setField(key, v)}
                />
              </FieldRow>
            ))}
            <FieldRow label="Decision confidence">
              <ScorePicker
                value={local.decisionConfidence ?? null}
                onChange={(v) => setField("decisionConfidence", v)}
              />
            </FieldRow>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Notes</Label>
              <Textarea
                value={local.clarityNotes ?? ""}
                onChange={(e) => setField("clarityNotes", e.target.value)}
                placeholder="Anything important to capture about this section…"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
            <FieldRow label="Overall status">
              <TrafficLightPicker
                value={local.clarityStatus as TrafficLight}
                onChange={(v) => setField("clarityStatus", v)}
              />
            </FieldRow>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 4 — Business Performance ─────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Business Performance"
          subtitle="Are they using financial information to improve the business?"
          isOpen={openSections.has("performance")}
          onToggle={() => toggleSection("performance")}
          status={local.performanceStatus as TrafficLight}
        />
        {openSections.has("performance") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 space-y-3 pt-4">
            {[
              { key: "businessGoals", label: "Business goals" },
              { key: "quarterlyReviews", label: "Quarterly reviews" },
              { key: "pricingConfidence", label: "Pricing confidence" },
              { key: "profitFocus", label: "Profit focus" },
              { key: "taxPlanning", label: "Tax planning" },
              { key: "accountability", label: "Accountability" },
            ].map(({ key, label }) => (
              <FieldRow key={key} label={label}>
                <TrafficLightPicker
                  value={local[key] as TrafficLight}
                  onChange={(v) => setField(key, v)}
                />
              </FieldRow>
            ))}
            <FieldRow label="Overall status">
              <TrafficLightPicker
                value={local.performanceStatus as TrafficLight}
                onChange={(v) => setField("performanceStatus", v)}
              />
            </FieldRow>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Notes</Label>
              <Textarea
                value={local.performanceNotes ?? ""}
                onChange={(e) => setField("performanceNotes", e.target.value)}
                placeholder="Anything important to capture about this section…"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 5 — Lead with Confidence ──────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Lead with Confidence"
          subtitle="Are they using financial information to shape the future?"
          isOpen={openSections.has("leadership")}
          onToggle={() => toggleSection("leadership")}
          status={local.leadershipStatus as TrafficLight}
        />
        {openSections.has("leadership") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 space-y-3 pt-4">
            {[
              { key: "budget", label: "Budget" },
              { key: "cashflowForecast", label: "Cashflow forecast" },
              { key: "scenarioPlanning", label: "Scenario planning" },
              { key: "performanceDashboard", label: "Performance dashboard" },
              { key: "boardLevelSupport", label: "Board level support" },
              { key: "exitPlanning", label: "Exit planning" },
            ].map(({ key, label }) => (
              <FieldRow key={key} label={label}>
                <TrafficLightPicker
                  value={local[key] as TrafficLight}
                  onChange={(v) => setField(key, v)}
                />
              </FieldRow>
            ))}
            <FieldRow label="Overall status">
              <TrafficLightPicker
                value={local.leadershipStatus as TrafficLight}
                onChange={(v) => setField("leadershipStatus", v)}
              />
            </FieldRow>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Notes</Label>
              <Textarea
                value={local.leadershipNotes ?? ""}
                onChange={(e) => setField("leadershipNotes", e.target.value)}
                placeholder="Anything important to capture about this section…"
                className="min-h-[80px] text-sm resize-none"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 6 — Biggest Challenges ────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Biggest Challenges"
          subtitle="Select all that apply"
          isOpen={openSections.has("challenges")}
          onToggle={() => toggleSection("challenges")}
        />
        {openSections.has("challenges") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-3 gap-3">
              {FCR_CHALLENGES.map(({ value, label }) => (
                <label
                  key={value}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                    challenges.includes(value)
                      ? "bg-blue-50 border-blue-300 text-blue-800 font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  )}
                >
                  <Checkbox
                    checked={challenges.includes(value)}
                    onCheckedChange={() => toggleChallenge(value)}
                    className="shrink-0"
                  />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 7 — Top Three Opportunities ───────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Top Three Opportunities"
          subtitle="What are the biggest wins available to this business?"
          isOpen={openSections.has("opportunities")}
          onToggle={() => toggleSection("opportunities")}
        />
        {openSections.has("opportunities") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 space-y-3 pt-4">
            {[
              { key: "opportunity1", label: "Opportunity 1" },
              { key: "opportunity2", label: "Opportunity 2" },
              { key: "opportunity3", label: "Opportunity 3" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs text-gray-500 mb-1.5 block">{label}</Label>
                <Textarea
                  value={local[key] ?? ""}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder="Describe the opportunity…"
                  className="min-h-[72px] text-sm resize-none"
                />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 8 — Recommended Next Step ────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Recommended Next Step"
          subtitle="What is the right path forward for this client?"
          isOpen={openSections.has("nextstep")}
          onToggle={() => toggleSection("nextstep")}
        />
        {openSections.has("nextstep") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 pt-4">
            <Select
              value={local.recommendedNextStep ?? ""}
              onValueChange={(v) => setField("recommendedNextStep", v)}
            >
              <SelectTrigger className="text-sm w-full max-w-sm">
                <SelectValue placeholder="Select a recommendation…" />
              </SelectTrigger>
              <SelectContent>
                {NEXT_STEP_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value} className="text-sm">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 9 — AI Report ─────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="AI Report"
          subtitle="Generate an evidence-based Financial Clarity Summary"
          isOpen={openSections.has("aireport")}
          onToggle={() => toggleSection("aireport")}
        />
        {openSections.has("aireport") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={generateReport}
                disabled={generatingReport}
                className="gap-2"
              >
                {generatingReport ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {generatingReport ? "Generating…" : "Generate Financial Clarity Summary"}
              </Button>
              {local.aiReport && <CopyButton text={local.aiReport} />}
            </div>
            {local.aiReport && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-[inherit]">
                {local.aiReport}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── SECTION 10 — Socket Handover ──────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHeader
          title="Socket Handover"
          subtitle="Generate a structured recommendation to paste into Socket"
          isOpen={openSections.has("socket")}
          onToggle={() => toggleSection("socket")}
        />
        {openSections.has("socket") && (
          <CardContent className="pt-0 pb-5 px-5 border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs text-gray-500">
              This generates a recommendation for which service stage(s) to propose and why — no
              pricing included. Copy it into Socket to build the proposal.
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={generateSocket}
                disabled={generatingSocket}
                variant="outline"
                className="gap-2"
              >
                {generatingSocket ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                {generatingSocket ? "Generating…" : "Generate Socket Handover"}
              </Button>
              {local.socketHandover && <CopyButton text={local.socketHandover} />}
            </div>
            {local.socketHandover && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-[inherit]">
                {local.socketHandover}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
