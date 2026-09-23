import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle,
  TrendingUp, Building2, Users, PoundSterling, BarChart3, Info, CreditCard, Mail, Download,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import MarketingNav from "@/components/marketing/nav";

const BLUE = "#035C82";

// ── Schemas ───────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  valuationType: z.enum(["own_practice", "acquisition_target"]),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  firmName: z.string().min(1, "Firm name required"),
});

const step2Schema = z.object({
  grf: z.string().min(1, "GRF required").refine(v => parseFloat(v) > 0, "Must be a positive number"),
  clientCount: z.string().min(1, "Client count required").refine(v => parseInt(v) > 0, "Must be a positive number"),
  ebitdaPercent: z.string().min(1, "Adjusted EBITDA% required").refine(v => {
    const n = parseFloat(v); return n >= 0 && n <= 100;
  }, "Must be 0–100"),
  ebitdaPrePostDrawings: z.enum(["before_drawings", "after_drawings"]),
  technicalDependency: z.enum(["yes", "partial", "no"]),
  relationshipDependency: z.enum(["owner", "mixed", "team"]),
  ownerHoursPerWeek: z.enum(["under_20", "20_35", "35_45", "45_60", "60_plus"]),
  teamStructure: z.enum(["2_plus_managers", "1_manager", "solo"]),
  niche: z.string().min(1, "Please select a niche"),
  nicheOther: z.string().optional(),
  ddCollectionRate: z.enum(["90_plus", "70_90", "50_70", "under_50", "not_sure"]),
  clientConcentration: z.enum(["under_10", "10_20", "20_30", "30_40", "over_40"]),
  cloudAdoptionPercent: z.enum(["90_plus", "70_90", "50_70", "under_50", "not_sure"]),
  clientTenure: z.string().optional(),
  churnRate: z.string().optional(),
  consentGiven: z.boolean().refine(v => v === true, "You must agree to continue"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

interface ValuationResult {
  id: number;
  email: string;
  pdfUrl?: string | null;
  method: string;
  methodLabel: string;
  adjustedMultiple: number;
  conservativeValuation: number;
  midValuation: number;
  optimisticValuation: number;
  technicalNormalisationAmount: number;
  ownerDrawingsNormalisationAmount: number;
  relationshipRiskDiscount: number;
  normalisedEbitda: number;
  keyFactors: string[];
  positiveFactors: string[];
  improvementActions: { title: string; impact: string; ptHelp: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatGBP(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toFixed(0)}`;
}

function formatGBPFull(n: number) {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function logEvent(submissionId: number | null, eventType: string) {
  fetch('/api/valuation/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId, eventType }),
  }).catch(() => {});
}

// ── Step 1: Contact ───────────────────────────────────────────────────────────
function Step1({ onNext }: { onNext: (d: Step1Data) => void }) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { valuationType: "own_practice", firstName: "", lastName: "", email: "", phone: "", firmName: "" },
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Your Details</h2>
        <p className="text-sm text-gray-500">We'll send your personalised report to your email address.</p>
      </div>

      <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-2 block">What are you valuing?</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "own_practice", label: "My own practice", icon: Building2 },
              { value: "acquisition_target", label: "An acquisition target", icon: TrendingUp },
            ].map(opt => {
              const selected = form.watch("valuationType") === opt.value;
              return (
                <button key={opt.value} type="button"
                  onClick={() => form.setValue("valuationType", opt.value as any)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${selected ? "border-[#035C82] bg-blue-50 text-[#035C82]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <opt.icon className="w-4 h-4 flex-shrink-0" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name *</Label>
            <Input id="firstName" {...form.register("firstName")} className="mt-1" placeholder="Jane" />
            {form.formState.errors.firstName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.firstName.message}</p>}
          </div>
          <div>
            <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name *</Label>
            <Input id="lastName" {...form.register("lastName")} className="mt-1" placeholder="Smith" />
            {form.formState.errors.lastName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address *</Label>
          <Input id="email" type="email" {...form.register("email")} className="mt-1" placeholder="jane@smithco.co.uk" />
          {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone</Label>
            <Input id="phone" {...form.register("phone")} className="mt-1" placeholder="07700 900000" />
          </div>
          <div>
            <Label htmlFor="firmName" className="text-sm font-medium text-gray-700">Firm Name *</Label>
            <Input id="firmName" {...form.register("firmName")} className="mt-1" placeholder="Smith & Co Accountants" />
            {form.formState.errors.firmName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.firmName.message}</p>}
          </div>
        </div>

        <Button type="submit" className="w-full text-white font-semibold py-3" style={{ background: BLUE }}>
          Continue to Practice Data <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </form>
    </div>
  );
}

// ── Step 2: Practice Data ─────────────────────────────────────────────────────
function Step2({ onNext, onBack, isLoading }: { onNext: (d: Step2Data) => void; onBack: () => void; isLoading: boolean }) {
  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      grf: "", clientCount: "", ebitdaPercent: "",
      ebitdaPrePostDrawings: undefined,
      technicalDependency: undefined, relationshipDependency: undefined, ownerHoursPerWeek: undefined,
      teamStructure: undefined,
      niche: "", nicheOther: "", ddCollectionRate: undefined,
      clientConcentration: undefined, cloudAdoptionPercent: undefined,
      clientTenure: "", churnRate: "", consentGiven: false,
    },
  });

  const selectedNiche = form.watch("niche");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Practice Data</h2>
        <p className="text-sm text-gray-500">The more accurate your data, the more useful your valuation.</p>
      </div>

      <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
        {/* Financials */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><PoundSterling className="w-4 h-4" /> Financial Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grf" className="text-sm font-medium text-gray-700">Gross Recurring Fees (£) *
                <span className="ml-1 text-xs text-gray-400 font-normal">Annual recurring revenue</span>
              </Label>
              <Input id="grf" type="number" min="0" step="1000" {...form.register("grf")} className="mt-1" placeholder="250000" />
              {form.formState.errors.grf && <p className="text-red-500 text-xs mt-1">{form.formState.errors.grf.message}</p>}
            </div>
            <div>
              <Label htmlFor="ebitdaPercent" className="text-sm font-medium text-gray-700">Adjusted EBITDA Margin (%) *
                <span className="ml-1 text-xs text-gray-400 font-normal">Profit before interest, tax &amp; depreciation</span>
              </Label>
              <Input id="ebitdaPercent" type="number" min="0" max="100" step="0.5" {...form.register("ebitdaPercent")} className="mt-1" placeholder="25" />
              {form.formState.errors.ebitdaPercent && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ebitdaPercent.message}</p>}
            </div>
          </div>

          {/* EBITDA pre/post owner drawings */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Is that EBITDA figure stated before or after owner drawings? *
              <span className="block text-xs text-gray-400 font-normal mt-0.5">This affects how we normalise the figure for buyer analysis</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "after_drawings", label: "After drawings", desc: "Owner drawings already deducted" },
                { value: "before_drawings", label: "Before drawings", desc: "Owner drawings not yet deducted" },
              ].map(opt => {
                const selected = form.watch("ebitdaPrePostDrawings") === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => form.setValue("ebitdaPrePostDrawings", opt.value as any)}
                    className={`flex flex-col gap-0.5 p-3 rounded-lg border-2 text-sm text-left transition-all ${selected ? "border-[#035C82] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className={`font-medium ${selected ? "text-[#035C82]" : "text-gray-700"}`}>{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            {form.formState.errors.ebitdaPrePostDrawings && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientCount" className="text-sm font-medium text-gray-700">Number of Clients *</Label>
              <Input id="clientCount" type="number" min="1" step="1" {...form.register("clientCount")} className="mt-1" placeholder="120" />
              {form.formState.errors.clientCount && <p className="text-red-500 text-xs mt-1">{form.formState.errors.clientCount.message}</p>}
            </div>
            <div>
              <Label htmlFor="clientTenure" className="text-sm font-medium text-gray-700">Avg Client Tenure (yrs)
                <span className="ml-1 text-xs text-gray-400 font-normal">Optional</span>
              </Label>
              <Input id="clientTenure" type="number" min="0" step="0.5" {...form.register("clientTenure")} className="mt-1" placeholder="5" />
            </div>
          </div>

          {/* DD Collection Rate — required */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-gray-500" />
                Fees collected by Direct Debit, Standing Order or recurring card? *
              </span>
            </Label>
            <Select onValueChange={v => form.setValue("ddCollectionRate", v as any)} value={form.watch("ddCollectionRate")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select collection rate..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90_plus">90% or more</SelectItem>
                <SelectItem value="70_90">70–90%</SelectItem>
                <SelectItem value="50_70">50–70%</SelectItem>
                <SelectItem value="under_50">Less than 50%</SelectItem>
                <SelectItem value="not_sure">Not sure</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.ddCollectionRate && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>

          {/* Client concentration */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-500" />
                What % of your revenue comes from your single largest client? *
              </span>
            </Label>
            <Select onValueChange={v => form.setValue("clientConcentration", v as any)} value={form.watch("clientConcentration")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select concentration level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="under_10">Under 10% — well diversified</SelectItem>
                <SelectItem value="10_20">10–20%</SelectItem>
                <SelectItem value="20_30">20–30%</SelectItem>
                <SelectItem value="30_40">30–40%</SelectItem>
                <SelectItem value="over_40">Over 40% — high concentration</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.clientConcentration && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>

          {/* Cloud adoption */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                What % of your clients use cloud accounting software (e.g. Xero, QBO, Sage)? *
              </span>
            </Label>
            <Select onValueChange={v => form.setValue("cloudAdoptionPercent", v as any)} value={form.watch("cloudAdoptionPercent")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select cloud adoption level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90_plus">90% or more</SelectItem>
                <SelectItem value="70_90">70–90%</SelectItem>
                <SelectItem value="50_70">50–70%</SelectItem>
                <SelectItem value="under_50">Less than 50%</SelectItem>
                <SelectItem value="not_sure">Not sure</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.cloudAdoptionPercent && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>
        </div>

        {/* Owner & Team Structure */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-5">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users className="w-4 h-4" /> Owner & Team Structure</h3>

          {/* Q1 — Technical dependency */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Does the owner personally complete client work — accounts, tax, VAT, bookkeeping? *
            </Label>
            <div className="space-y-2">
              {[
                { value: "yes", label: "Yes — the owner does most technical work personally", color: "red" },
                { value: "partial", label: "Partially — the owner reviews and signs off but a team does most of the work", color: "yellow" },
                { value: "no", label: "No — the team delivers all technical work independently", color: "green" },
              ].map(opt => {
                const selected = form.watch("technicalDependency") === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => form.setValue("technicalDependency", opt.value as any)}
                    className={`w-full flex items-start gap-2 p-3 rounded-lg border-2 text-sm text-left transition-all ${selected ? "border-[#035C82] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${opt.color === "green" ? "bg-green-500" : opt.color === "yellow" ? "bg-yellow-400" : "bg-red-500"}`} />
                    <span className={selected ? "text-[#035C82] font-medium" : "text-gray-700"}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {form.formState.errors.technicalDependency && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>

          {/* Q2 — Relationship dependency */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Who holds the primary relationship with most clients? *
            </Label>
            <div className="space-y-2">
              {[
                { value: "owner", label: "The owner — most clients would follow the owner if they left", color: "red" },
                { value: "mixed", label: "Mixed — some clients are owner-led, others are team-led", color: "yellow" },
                { value: "team", label: "The team — clients have strong relationships with team members, not just the owner", color: "green" },
              ].map(opt => {
                const selected = form.watch("relationshipDependency") === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => form.setValue("relationshipDependency", opt.value as any)}
                    className={`w-full flex items-start gap-2 p-3 rounded-lg border-2 text-sm text-left transition-all ${selected ? "border-[#035C82] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <span className={`mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${opt.color === "green" ? "bg-green-500" : opt.color === "yellow" ? "bg-yellow-400" : "bg-red-500"}`} />
                    <span className={selected ? "text-[#035C82] font-medium" : "text-gray-700"}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {form.formState.errors.relationshipDependency && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>

          {/* Q3 — Owner hours per week */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-1 block">Owner hours per week *</Label>
            <Select onValueChange={v => form.setValue("ownerHoursPerWeek", v as any)} value={form.watch("ownerHoursPerWeek")}>
              <SelectTrigger>
                <SelectValue placeholder="Select hours per week..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="under_20">Under 20 hours/week</SelectItem>
                <SelectItem value="20_35">20–35 hours/week</SelectItem>
                <SelectItem value="35_45">35–45 hours/week</SelectItem>
                <SelectItem value="45_60">45–60 hours/week</SelectItem>
                <SelectItem value="60_plus">60+ hours/week</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.ownerHoursPerWeek && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Management Team *</Label>
            <div className="space-y-2">
              {[
                { value: "2_plus_managers", label: "2 or more managers — strong senior team with clear roles and delegated responsibility" },
                { value: "1_manager", label: "1 manager — limited senior leadership; some delegation but still fragile" },
                { value: "solo", label: "Solo / owner-operator — no management team; owner is the practice" },
              ].map(opt => {
                const selected = form.watch("teamStructure") === opt.value;
                return (
                  <button key={opt.value} type="button"
                    onClick={() => form.setValue("teamStructure", opt.value as any)}
                    className={`w-full flex items-start gap-2 p-3 rounded-lg border-2 text-sm text-left transition-all ${selected ? "border-[#035C82] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <BarChart3 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selected ? "text-[#035C82]" : "text-gray-400"}`} />
                    <span className={selected ? "text-[#035C82] font-medium" : "text-gray-700"}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            {form.formState.errors.teamStructure && <p className="text-red-500 text-xs mt-1">Please select an option</p>}
          </div>
        </div>

        {/* Niche */}
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1 block">Primary Client Niche *</Label>
          <Select onValueChange={v => form.setValue("niche", v)} value={form.watch("niche")}>
            <SelectTrigger>
              <SelectValue placeholder="Select your primary niche..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General practice (mixed clients)</SelectItem>
              <SelectItem value="medical_dental">Medical & dental</SelectItem>
              <SelectItem value="property_developers">Property & real estate</SelectItem>
              <SelectItem value="technology">Technology & startups</SelectItem>
              <SelectItem value="hospitality_leisure">Hospitality & leisure</SelectItem>
              <SelectItem value="construction_trades">Construction & trades</SelectItem>
              <SelectItem value="professional_services">Professional services</SelectItem>
              <SelectItem value="retail_ecommerce">Retail & e-commerce</SelectItem>
              <SelectItem value="charities_nfp">Charities & not-for-profit</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.niche && <p className="text-red-500 text-xs mt-1">{form.formState.errors.niche.message}</p>}
          {selectedNiche === "Other" && (
            <Input {...form.register("nicheOther")} placeholder="Please describe your niche..." className="mt-2" />
          )}
        </div>

        {/* Consent */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Checkbox id="consent" checked={form.watch("consentGiven")} onCheckedChange={v => form.setValue("consentGiven", !!v)} className="mt-0.5" />
            <Label htmlFor="consent" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
              I agree to receive my valuation report by email and to Practice Toolbox contacting me about practice management software. I understand this is a free tool and not a formal valuation.
            </Label>
          </div>
          {form.formState.errors.consentGiven && <p className="text-red-500 text-xs mt-2">{form.formState.errors.consentGiven.message}</p>}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-shrink-0">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button type="submit" disabled={isLoading} className="flex-1 text-white font-semibold" style={{ background: BLUE }}>
            {isLoading ? "Calculating your valuation..." : <>Calculate My Valuation <ChevronRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Method badge ──────────────────────────────────────────────────────────────
function MethodBadge({ method, label }: { method: string; label: string }) {
  const styles = {
    grf: "bg-blue-100 text-blue-800 border-blue-200",
    ebitda: "bg-purple-100 text-purple-800 border-purple-200",
    blended: "bg-teal-100 text-teal-800 border-teal-200",
  } as Record<string, string>;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${styles[method] || styles.grf}`}>
      <Info className="w-3 h-3" />
      {label}
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function Results({ result, step1, step2, onRestart }: {
  result: ValuationResult; step1: Step1Data; step2: Step2Data; onRestart: () => void;
}) {
  const [confirmEmail, setConfirmEmail] = useState(result.email || step1.email);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(result.pdfUrl || null);
  const [pdfPolling, setPdfPolling] = useState(!result.pdfUrl);

  // Poll for PDF URL if it wasn't ready at submission time
  useEffect(() => {
    if (pdfUrl || !pdfPolling) return;
    let attempts = 0;
    const maxAttempts = 20; // poll for up to ~2 minutes
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/valuation/pdf-status/${result.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.pdfReady && data.pdfUrl) {
            setPdfUrl(data.pdfUrl);
            setPdfPolling(false);
            clearInterval(interval);
          }
        }
      } catch (_) {}
      if (attempts >= maxAttempts) {
        setPdfPolling(false);
        clearInterval(interval);
      }
    }, 6_000);
    return () => clearInterval(interval);
  }, [result.id, pdfUrl, pdfPolling]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/valuation/confirm', 'POST', {
        submissionId: result.id,
        confirmedEmail: confirmEmail,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send report');
      return data;
    },
    onSuccess: () => {
      setSent(true);
      setSendError(null);
      logEvent(result.id, 'email_confirmed');
    },
    onError: (err: any) => {
      setSendError(err.message || 'Something went wrong. Please try again.');
    },
  });

  const grfNum = parseFloat(step2.grf);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{step1.firmName}</h2>
        <p className="text-sm text-gray-500 mt-1">Practice Valuation Estimate · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
      </div>

      {/* Methodology badge */}
      <div className="flex justify-center">
        <MethodBadge method={result.method} label={result.methodLabel} />
      </div>

      {/* Valuation Range */}
      <div className="rounded-xl border-2 border-[#035C82] overflow-hidden">
        <div className="bg-[#035C82] px-4 py-3">
          <p className="text-white text-sm font-medium">Estimated Valuation Range</p>
        </div>
        <div className="grid grid-cols-3 divide-x">
          {[
            { label: "Conservative", value: result.conservativeValuation, highlight: false },
            { label: "Mid-Market", value: result.midValuation, highlight: true },
            { label: "Optimistic", value: result.optimisticValuation, highlight: false },
          ].map(col => (
            <div key={col.label} className={`p-4 text-center ${col.highlight ? "bg-blue-50" : "bg-white"}`}>
              <p className="text-xs text-gray-500 mb-1">{col.label}</p>
              <p className={`font-bold ${col.highlight ? "text-2xl text-[#035C82]" : "text-lg text-gray-700"}`}>
                {formatGBP(col.value)}
              </p>
              {col.highlight && <p className="text-xs text-[#035C82] mt-1">Primary estimate</p>}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
          <span>
            {result.method === 'grf'
              ? <>GRF multiple: <strong className="text-gray-700">{result.adjustedMultiple.toFixed(2)}x</strong></>
              : result.method === 'ebitda'
                ? <>EBITDA multiple: <strong className="text-gray-700">{result.adjustedMultiple.toFixed(2)}x</strong></>
                : <>Blended effective multiple: <strong className="text-gray-700">{result.adjustedMultiple.toFixed(2)}x GRF</strong></>
            }
          </span>
          <span>GRF: <strong className="text-gray-700">{formatGBPFull(grfNum)}</strong></span>
        </div>
      </div>

      {/* Download PDF button — available immediately after submission */}
      {pdfUrl ? (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="block">
          <Button className="w-full text-white font-semibold py-3 flex items-center justify-center gap-2" style={{ background: BLUE }}>
            <Download className="w-4 h-4" />
            Download Your PDF Report
          </Button>
        </a>
      ) : (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
          Your PDF report is being prepared — it will be available to download here in a moment.
        </div>
      )}

      {/* Email section */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
        {!sent ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-5 h-5 text-[#035C82]" />
              <h3 className="text-base font-semibold text-gray-900">Get your report by email</h3>
            </div>
            <p className="text-sm text-gray-600">
              We'll send your full report to the email address below. Update it if needed.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmEmail" className="text-sm font-medium text-gray-700">Email address</Label>
              <Input
                id="confirmEmail"
                type="email"
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                className="bg-white"
                disabled={confirmMutation.isPending}
              />
            </div>
            {sendError && (
              <p className="text-sm text-red-600">{sendError}</p>
            )}
            <Button
              className="w-full text-white font-semibold py-3"
              style={{ background: BLUE }}
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || !confirmEmail}
            >
              {confirmMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : 'Send my report'}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              We will also keep you updated on Practice Toolbox. Unsubscribe any time.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="text-base font-semibold text-gray-900">Report sent to {confirmEmail}</h3>
            </div>
            <p className="text-sm text-gray-600">
              Check your inbox in the next few minutes. Also check your spam folder if it does not arrive.
            </p>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        This estimate is based on UK accounting practice market data and is not a formal valuation.
      </p>

      <button onClick={onRestart} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center underline">
        Start a new valuation
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ValuationTool() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);

  useEffect(() => { logEvent(null, 'page_viewed'); }, []);

  const submitMutation = useMutation({
    mutationFn: async (payload: Step1Data & Step2Data) => {
      const res = await apiRequest('/api/valuation/submit', 'POST', payload);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to calculate valuation');
      return data as ValuationResult;
    },
    onSuccess: (data) => { setResult(data); setStep(3); },
  });

  const handleStep1 = (data: Step1Data) => {
    setStep1Data(data);
    logEvent(null, 'form_started');
    setStep(2);
  };

  const handleStep2 = (data: Step2Data) => {
    setStep2Data(data);
    if (!step1Data) return;
    submitMutation.mutate({ ...step1Data, ...data });
  };

  const handleRestart = () => {
    setStep(1); setStep1Data(null); setStep2Data(null); setResult(null);
    submitMutation.reset();
  };

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <MarketingNav />

      <div className="pt-20 pb-10 px-4 text-center" style={{ background: `linear-gradient(135deg, #035C82 0%, #0a7aad 100%)` }}>
        <div className="max-w-2xl mx-auto">
          <Badge className="mb-3 text-xs bg-white/20 text-white border-white/30">Free Tool</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Practice Valuation Calculator</h1>
          <p className="text-blue-100 text-base md:text-lg">
            Get an instant estimate of your accounting practice's market value — with a personalised PDF report and actionable steps to increase it.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-5 text-sm text-blue-100">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-300" /> UK market benchmarks</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-300" /> GRF & EBITDA methods</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-300" /> Instant PDF report</span>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 -mt-4">
        <Card className="shadow-xl border-0">
          <CardContent className="p-6 md:p-8">
            {step < 3 && (
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>Step {step} of 2</span>
                  <span>{progress}% complete</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {step === 1 && <Step1 onNext={handleStep1} />}
            {step === 2 && <Step2 onNext={handleStep2} onBack={() => setStep(1)} isLoading={submitMutation.isPending} />}
            {step === 3 && result && step1Data && step2Data && (
              <Results result={result} step1={step1Data} step2={step2Data} onRestart={handleRestart} />
            )}

            {submitMutation.isError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {(submitMutation.error as Error).message || "Something went wrong. Please try again."}
              </div>
            )}
          </CardContent>
        </Card>

        {step < 3 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Valuations based on UK accounting practice sale data. Not a formal valuation.
            </p>
          </div>
        )}
      </div>

      <footer className="py-8 px-4 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} Practice Toolbox · <a href="https://app.practicetoolbox.co.uk" className="hover:text-gray-600">app.practicetoolbox.co.uk</a></p>
      </footer>
    </div>
  );
}
