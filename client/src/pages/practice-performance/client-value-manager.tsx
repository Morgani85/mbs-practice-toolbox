import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Plus, Edit, Trash2, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, SlidersHorizontal, AlertTriangle, TrendingUp, TrendingDown, Clock, RefreshCw, Archive, ArchiveRestore, ChevronDown, ChevronUp, CheckCircle2, FileText } from "lucide-react";
import { Link } from "wouter";
import type { ClientValueClient } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTORS = ["Dental", "Construction", "Hospitality", "Professional Services", "Retail", "Property", "Healthcare", "Other"];
const PODS = ["Pod 1", "Pod 2"];
const SERVICE_LEVELS = ["Control the Chaos", "Financial Insight", "Growth Machine", "Maximum Exit"];
const CLIENT_QUALITIES = [
  { value: "A", label: "A – Strategic Growth" },
  { value: "B", label: "B – Core Value" },
  { value: "C", label: "C – Maintenance" },
  { value: "D", label: "D – Declining/Misaligned" },
];
const CCR_STATUSES = ["Not Started", "Call Booked", "Awaiting Decision", "Upgraded", "Declined", "Churned Risk"];

const TURNOVER_OPTIONS = [
  "Dormant",
  "Non-Trading",
  "Parent Company",
  "CIS / Contractor",
  "Up to £90k",
  "£90k - £150k",
  "£150k - £250k",
  "£250k - £500k",
  "£500k - £750k",
  "£750k - £1m",
  "£1m - £1.5m",
  "£1.5m - £2m",
  "£2m - £2.5m",
  "£2.5m - £3m",
  "£3m - £4m",
  "£4m - £5m",
  "£5m - £6m",
  "£6m - £7m",
  "£8m - £10m",
  "£10m+",
];

// ─── Turnover band helpers ─────────────────────────────────────────────────────
const TURNOVER_BAND_ORDER = [
  "up_to_90k", "90k_150k", "150k_250k", "250k_500k", "500k_750k",
  "750k_1m", "1m_1_5m", "1_5m_2m", "2m_2_5m", "2_5m_3m", "over_3m",
] as const;

type TurnoverBand = typeof TURNOVER_BAND_ORDER[number];

const TURNOVER_BAND_LABELS: Record<TurnoverBand, string> = {
  up_to_90k: "Up to £90k",
  "90k_150k": "£90k–£150k",
  "150k_250k": "£150k–£250k",
  "250k_500k": "£250k–£500k",
  "500k_750k": "£500k–£750k",
  "750k_1m": "£750k–£1m",
  "1m_1_5m": "£1m–£1.5m",
  "1_5m_2m": "£1.5m–£2m",
  "2m_2_5m": "£2m–£2.5m",
  "2_5m_3m": "£2.5m–£3m",
  over_3m: "Over £3m",
};

// Maps display values from the existing TURNOVER_OPTIONS dropdown to band keys
const TURNOVER_DISPLAY_TO_BAND: Record<string, TurnoverBand> = {
  "Up to £90k": "up_to_90k",
  "£90k - £150k": "90k_150k",
  "£150k - £250k": "150k_250k",
  "£250k - £500k": "250k_500k",
  "£500k - £750k": "500k_750k",
  "£750k - £1m": "750k_1m",
  "£1m - £1.5m": "1m_1_5m",
  "£1.5m - £2m": "1_5m_2m",
  "£2m - £2.5m": "2m_2_5m",
  "£2.5m - £3m": "2_5m_3m",
  "£3m - £4m": "over_3m",
  "£4m - £5m": "over_3m",
  "£5m - £6m": "over_3m",
  "£6m - £7m": "over_3m",
  "£8m - £10m": "over_3m",
  "£10m+": "over_3m",
};

function calcTurnoverBand(amount: number | null | undefined): TurnoverBand | null {
  if (amount === null || amount === undefined) return null;
  if (amount < 90000) return "up_to_90k";
  if (amount < 150000) return "90k_150k";
  if (amount < 250000) return "150k_250k";
  if (amount < 500000) return "250k_500k";
  if (amount < 750000) return "500k_750k";
  if (amount < 1000000) return "750k_1m";
  if (amount < 1500000) return "1m_1_5m";
  if (amount < 2000000) return "1_5m_2m";
  if (amount < 2500000) return "2m_2_5m";
  if (amount < 3000000) return "2_5m_3m";
  return "over_3m";
}

function bandIndex(band: string | null | undefined): number {
  if (!band) return -1;
  return TURNOVER_BAND_ORDER.indexOf(band as TurnoverBand);
}

// Service level hierarchy for upgrade detection
const SERVICE_LEVEL_ORDER = ["Control the Chaos", "Financial Insight", "Growth Machine", "Maximum Exit"];

// ─── Column definitions ────────────────────────────────────────────────────────
const COL_DEFS = [
  { key: "clientCode",          label: "Code",                defaultOn: true  },
  { key: "sector",              label: "Sector",              defaultOn: false },
  { key: "pod",                 label: "Pod",                 defaultOn: false },
  { key: "turnover",            label: "Turnover",            defaultOn: false },
  { key: "currentServiceLevel", label: "Current Level",       defaultOn: false },
  { key: "targetServiceLevel",  label: "Target Level",        defaultOn: false },
  { key: "currentMonthlyFee",   label: "Monthly Fee",         defaultOn: true  },
  { key: "targetMonthlyFee",    label: "Target Fee",          defaultOn: false },
  { key: "opportunityFee",      label: "Opportunity Fee",     defaultOn: true  },
  { key: "annualFee",           label: "Annual Fee",          defaultOn: false },
  { key: "feeQuality",          label: "Fee Quality",         defaultOn: true  },
  { key: "ccrStatus",           label: "CCR Status",          defaultOn: true  },
  { key: "clientQuality",       label: "Client Quality",      defaultOn: true  },
  { key: "lastCcrDate",         label: "Last CCR Date",       defaultOn: false },
  { key: "nextCcrDate",         label: "Next CCR Date",       defaultOn: false },
  { key: "lastFeeChangeDate",   label: "Last Fee Change Date",defaultOn: false },
  { key: "referredBy",          label: "Referred By",         defaultOn: false },
  { key: "notes",               label: "Notes",               defaultOn: false },
  { key: "currentReportedTurnover", label: "Current Turnover (£)", defaultOn: false },
  { key: "turnoverLastUpdated", label: "Turnover Updated",    defaultOn: false },
] as const;
const DEFAULT_VISIBLE_COLS = new Set(COL_DEFS.filter(c => c.defaultOn).map(c => c.key));

// ─── Calculated helpers ────────────────────────────────────────────────────────
function calcOpportunityFee(client: Pick<ClientValueClient, "currentMonthlyFee" | "targetMonthlyFee">) {
  return (client.targetMonthlyFee ?? 0) - (client.currentMonthlyFee ?? 0);
}

function calcAnnualFee(client: Pick<ClientValueClient, "currentMonthlyFee">) {
  return (client.currentMonthlyFee ?? 0) * 12;
}

function calcFeeQuality(client: Pick<ClientValueClient, "currentMonthlyFee" | "targetMonthlyFee" | "currentServiceLevel" | "targetServiceLevel">): string {
  const cur = client.currentMonthlyFee ?? 0;
  const tgt = client.targetMonthlyFee ?? 0;
  if (tgt > 0 && cur >= tgt * 1.2) return "Premium";
  if (cur < tgt && client.currentServiceLevel === client.targetServiceLevel) return "Low";
  if (cur < tgt && client.currentServiceLevel !== client.targetServiceLevel) return "Upgrade";
  return "Fair";
}

function fmt(n: number) {
  return `£${n.toLocaleString()}`;
}

function addTwelveMonths(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const newYear = y + 1;
  const daysInNewMonth = new Date(newYear, m, 0).getDate();
  const clampedDay = Math.min(d, daysInNewMonth);
  return `${newYear}-${String(m).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// ─── Form schema ──────────────────────────────────────────────────────────────
const formSchema = z.object({
  teamId: z.number(),
  clientName: z.string().min(1, "Client name is required"),
  clientCode: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  pod: z.string().optional().nullable(),
  clientSince: z.string().optional().nullable(),
  currentServiceLevel: z.string().optional().nullable(),
  targetServiceLevel: z.string().optional().nullable(),
  currentMonthlyFee: z.coerce.number().min(0).default(0),
  targetMonthlyFee: z.coerce.number().min(0).default(0),
  clientQuality: z.string().optional().nullable(),
  lastCcrDate: z.string().optional().nullable(),
  nextCcrDate: z.string().optional().nullable(),
  ccrStatus: z.string().optional().nullable(),
  lastFeeChangeDate: z.string().optional().nullable(),
  lastTurnoverUpdateDate: z.string().optional().nullable(),
  turnover: z.string().optional().nullable(),
  currentReportedTurnover: z.coerce.number().optional().nullable(),
  currentReportedTurnoverBand: z.string().optional().nullable(),
  turnoverLastUpdated: z.string().optional().nullable(),
  dextClientId: z.string().optional().nullable(),
  referredBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof formSchema>;

// ─── Client form ──────────────────────────────────────────────────────────────
function ClientForm({ client, teamId, onClose }: { client?: ClientValueClient; teamId: number; onClose: () => void }) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamId,
      clientName: client?.clientName ?? "",
      clientCode: client?.clientCode ?? "",
      sector: client?.sector ?? "",
      pod: client?.pod ?? "",
      clientSince: client?.clientSince ?? "",
      currentServiceLevel: client?.currentServiceLevel ?? "",
      targetServiceLevel: client?.targetServiceLevel ?? "",
      currentMonthlyFee: client?.currentMonthlyFee ?? 0,
      targetMonthlyFee: client?.targetMonthlyFee ?? 0,
      clientQuality: client?.clientQuality ?? "",
      lastCcrDate: client?.lastCcrDate ?? "",
      nextCcrDate: client?.nextCcrDate ?? "",
      ccrStatus: client?.ccrStatus ?? "",
      lastFeeChangeDate: client?.lastFeeChangeDate ?? "",
      lastTurnoverUpdateDate: client?.lastTurnoverUpdateDate ?? "",
      turnover: client?.turnover ?? "",
      currentReportedTurnover: (client as any)?.currentReportedTurnover ?? null,
      currentReportedTurnoverBand: (client as any)?.currentReportedTurnoverBand ?? null,
      turnoverLastUpdated: (client as any)?.turnoverLastUpdated ?? "",
      dextClientId: (client as any)?.dextClientId ?? "",
      referredBy: client?.referredBy ?? "",
      notes: client?.notes ?? "",
    },
  });

  const watchCurrent = form.watch("currentMonthlyFee") ?? 0;
  const watchTarget = form.watch("targetMonthlyFee") ?? 0;
  const watchCurSvc = form.watch("currentServiceLevel") ?? "";
  const watchTgtSvc = form.watch("targetServiceLevel") ?? "";
  const watchReportedTurnover = form.watch("currentReportedTurnover");
  const liveReportedBand = calcTurnoverBand(watchReportedTurnover ?? null);
  const [showDext, setShowDext] = useState(false);

  const opportunityFee = (watchTarget ?? 0) - (watchCurrent ?? 0);
  const annualFee = (watchCurrent ?? 0) * 12;
  const feeQuality = calcFeeQuality({
    currentMonthlyFee: watchCurrent,
    targetMonthlyFee: watchTarget,
    currentServiceLevel: watchCurSvc,
    targetServiceLevel: watchTgtSvc,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("/api/client-value-clients", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
      toast({ title: "Client added successfully" });
      onClose();
    },
    onError: (err: any) => {
      console.error("Failed to save client:", err?.message);
      toast({ title: "Failed to save client", description: err?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest(`/api/client-value-clients/${client!.id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
      toast({ title: "Client updated successfully" });
      onClose();
    },
    onError: (err: any) => {
      console.error("Failed to update client:", err?.message);
      toast({ title: "Failed to update client", description: err?.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    const crt = data.currentReportedTurnover ? Number(data.currentReportedTurnover) : null;
    const clean = {
      ...data,
      teamId,
      clientCode: data.clientCode || null,
      sector: data.sector || null,
      pod: data.pod || null,
      clientSince: data.clientSince || null,
      currentServiceLevel: data.currentServiceLevel || null,
      targetServiceLevel: data.targetServiceLevel || null,
      clientQuality: data.clientQuality || null,
      lastCcrDate: data.lastCcrDate || null,
      nextCcrDate: data.nextCcrDate || null,
      ccrStatus: data.ccrStatus || null,
      lastFeeChangeDate: data.lastFeeChangeDate || null,
      lastTurnoverUpdateDate: data.lastTurnoverUpdateDate || null,
      turnover: data.turnover || null,
      currentReportedTurnover: crt,
      currentReportedTurnoverBand: crt !== null ? calcTurnoverBand(crt) : null,
      turnoverLastUpdated: data.turnoverLastUpdated || null,
      dextClientId: data.dextClientId || null,
      referredBy: data.referredBy || null,
      notes: data.notes || null,
    };
    if (client) updateMutation.mutate(clean as FormValues);
    else createMutation.mutate(clean as FormValues);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Name */}
          <FormField control={form.control} name="clientName" render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Client Code */}
          <FormField control={form.control} name="clientCode" render={({ field }) => (
            <FormItem>
              <FormLabel>Client Code</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Sector */}
          <FormField control={form.control} name="sector" render={({ field }) => (
            <FormItem>
              <FormLabel>Sector / Niche</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger></FormControl>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Turnover */}
          <FormField control={form.control} name="turnover" render={({ field }) => (
            <FormItem>
              <FormLabel>Turnover</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select turnover" /></SelectTrigger></FormControl>
                <SelectContent>
                  {TURNOVER_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Pod */}
          <FormField control={form.control} name="pod" render={({ field }) => (
            <FormItem>
              <FormLabel>Pod</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select pod" /></SelectTrigger></FormControl>
                <SelectContent>
                  {PODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Client Since */}
          <FormField control={form.control} name="clientSince" render={({ field }) => (
            <FormItem>
              <FormLabel>Client Since</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Current Service Level */}
          <FormField control={form.control} name="currentServiceLevel" render={({ field }) => (
            <FormItem>
              <FormLabel>Current Service Level</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                <SelectContent>
                  {SERVICE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Target Service Level */}
          <FormField control={form.control} name="targetServiceLevel" render={({ field }) => (
            <FormItem>
              <FormLabel>Target Service Level</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                <SelectContent>
                  {SERVICE_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Current Monthly Fee */}
          <FormField control={form.control} name="currentMonthlyFee" render={({ field }) => (
            <FormItem>
              <FormLabel>Current Monthly Fee (£)</FormLabel>
              <FormControl><Input type="number" min={0} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Target Monthly Fee */}
          <FormField control={form.control} name="targetMonthlyFee" render={({ field }) => (
            <FormItem>
              <FormLabel>Target Monthly Fee (£)</FormLabel>
              <FormControl><Input type="number" min={0} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Calculated: Opportunity Fee */}
          <FormItem>
            <FormLabel>Opportunity Fee (auto)</FormLabel>
            <div className={`h-10 px-3 flex items-center rounded-md border bg-gray-50 text-sm font-medium ${opportunityFee > 0 ? "text-green-700" : opportunityFee < 0 ? "text-red-700" : "text-gray-500"}`}>
              {fmt(opportunityFee)}
            </div>
          </FormItem>

          {/* Calculated: Annual Fee */}
          <FormItem>
            <FormLabel>Annual Fee (auto)</FormLabel>
            <div className="h-10 px-3 flex items-center rounded-md border bg-gray-50 text-sm font-medium text-gray-700">
              {fmt(annualFee)}
            </div>
          </FormItem>

          {/* Client Quality */}
          <FormField control={form.control} name="clientQuality" render={({ field }) => (
            <FormItem>
              <FormLabel>Client Quality</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select quality" /></SelectTrigger></FormControl>
                <SelectContent>
                  {CLIENT_QUALITIES.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Fee Quality Score (auto) */}
          <FormItem>
            <FormLabel>Fee Quality Score (auto)</FormLabel>
            <div className="h-10 px-3 flex items-center rounded-md border bg-gray-50 text-sm font-medium text-gray-700">
              <FeeQualityBadge score={feeQuality} />
            </div>
          </FormItem>

          {/* Last CCR Date */}
          <FormField control={form.control} name="lastCcrDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Last CCR Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ""}
                  onChange={e => {
                    field.onChange(e);
                    if (e.target.value) {
                      form.setValue("nextCcrDate", addTwelveMonths(e.target.value));
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Next CCR Date — auto-filled from Last CCR Date (+12 months); can be overridden manually */}
          <FormField control={form.control} name="nextCcrDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Next CCR Date</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* CCR Status */}
          <FormField control={form.control} name="ccrStatus" render={({ field }) => (
            <FormItem>
              <FormLabel>CCR Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                <SelectContent>
                  {CCR_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          {/* Last Fee Change Date */}
          <FormField control={form.control} name="lastFeeChangeDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Last Fee Change Date</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Last Turnover Review Date */}
          <FormField control={form.control} name="lastTurnoverUpdateDate" render={({ field }) => (
            <FormItem>
              <FormLabel>Last Turnover Review Date</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Current Reported Turnover */}
          <FormField control={form.control} name="currentReportedTurnover" render={({ field }) => (
            <FormItem>
              <FormLabel>Current Known Turnover (£)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 320000"
                  {...field}
                  value={field.value ?? ""}
                  onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormControl>
              <p className="text-xs text-gray-500 mt-1">Enter the client's most recent known annual turnover. Used to identify repricing opportunities where turnover has grown beyond their current fee band.</p>
              {liveReportedBand && (
                <p className="text-xs font-medium text-blue-700 mt-1">
                  Turnover band: {TURNOVER_BAND_LABELS[liveReportedBand]}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )} />

          {/* Turnover Last Updated */}
          <FormField control={form.control} name="turnoverLastUpdated" render={({ field }) => (
            <FormItem>
              <FormLabel>Turnover Figure as Of</FormLabel>
              <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Referred By */}
          <FormField control={form.control} name="referredBy" render={({ field }) => (
            <FormItem>
              <FormLabel>Referred By</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Notes */}
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea rows={3} {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Dext Integration (collapsible) */}
        <div className="border rounded-lg">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => setShowDext(v => !v)}
          >
            <span className="flex items-center gap-2">
              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Coming soon</span>
              Dext Integration
            </span>
            {showDext ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {showDext && (
            <div className="px-4 pb-4 pt-1 border-t">
              <p className="text-xs text-gray-500 mb-3">Manual entry for now — automatic matching available when Dext is connected.</p>
              <FormField control={form.control} name="dextClientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dext Client Match</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="Dext client identifier" /></FormControl>
                  <p className="text-xs text-gray-500 mt-1">Connect this client to their Dext record to automatically update turnover data. Available when Dext integration is configured.</p>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : client ? "Update Client" : "Add Client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Fee quality badge ─────────────────────────────────────────────────────────
function FeeQualityBadge({ score }: { score: string }) {
  const map: Record<string, string> = {
    Premium: "bg-purple-100 text-purple-800",
    Low: "bg-red-100 text-red-800",
    Upgrade: "bg-blue-100 text-blue-800",
    Fair: "bg-green-100 text-green-800",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[score] ?? "bg-gray-100 text-gray-700"}`}>{score}</span>;
}

function ClientQualityBadge({ quality }: { quality: string | null }) {
  if (!quality) return <span className="text-gray-400">—</span>;
  const map: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-800",
    B: "bg-blue-100 text-blue-800",
    C: "bg-yellow-100 text-yellow-800",
    D: "bg-red-100 text-red-800",
  };
  const label = CLIENT_QUALITIES.find(q => q.value === quality)?.label ?? quality;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[quality] ?? "bg-gray-100 text-gray-700"}`}>{label}</span>;
}

// ─── Sort icon ────────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: "asc" | "desc" }) {
  if (col !== sortCol) return <ArrowUpDown className="ml-1 h-3 w-3 text-gray-400 inline" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
    : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />;
}

// ─── Filter panel ─────────────────────────────────────────────────────────────
interface Filters {
  pod: string;
  sector: string;
  clientQuality: string;
  feeQuality: string;
  currentServiceLevel: string;
  targetServiceLevel: string;
  ccrStatus: string;
}
const emptyFilters: Filters = { pod: "", sector: "", clientQuality: "", feeQuality: "", currentServiceLevel: "", targetServiceLevel: "", ccrStatus: "" };

// ─── Enriched client helper ───────────────────────────────────────────────────
function enrich(c: ClientValueClient) {
  return {
    ...c,
    opportunityFee: calcOpportunityFee(c),
    annualFee: calcAnnualFee(c),
    feeQuality: calcFeeQuality(c),
  };
}

type Enriched = ReturnType<typeof enrich>;

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const CSV_TEMPLATE_HEADERS = [
  "Client Name", "Client Code", "Sector", "Pod",
  "Current Service Level", "Target Service Level",
  "Current Monthly Fee", "Target Monthly Fee",
  "Client Quality", "Notes",
];

interface CsvRow {
  clientName: string;
  clientCode: string;
  sector: string;
  pod: string;
  currentServiceLevel: string;
  targetServiceLevel: string;
  currentMonthlyFee: string;
  targetMonthlyFee: string;
  clientQuality: string;
  notes: string;
}

function parseCsvText(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map(h =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "")
  );

  const keyMap: Record<string, keyof CsvRow> = {
    client_name: "clientName",
    client_code: "clientCode",
    sector: "sector",
    pod: "pod",
    current_service_level: "currentServiceLevel",
    target_service_level: "targetServiceLevel",
    current_monthly_fee: "currentMonthlyFee",
    target_monthly_fee: "targetMonthlyFee",
    client_quality: "clientQuality",
    notes: "notes",
  };

  return lines.slice(1).map(line => {
    const vals = parseRow(line);
    const row: CsvRow = { clientName: "", clientCode: "", sector: "", pod: "", currentServiceLevel: "", targetServiceLevel: "", currentMonthlyFee: "", targetMonthlyFee: "", clientQuality: "", notes: "" };
    headers.forEach((h, i) => {
      const key = keyMap[h];
      if (key) row[key] = vals[i] ?? "";
    });
    return row;
  }).filter(r => Object.values(r).some(v => v.trim()));
}

function downloadCsvTemplate() {
  const csv = CSV_TEMPLATE_HEADERS.join(",") + "\n" +
    "Acme Ltd,AC001,Construction,Pod 1,Financial Insight,Growth Machine,1500,2000,A,Example row\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "client_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Import Dialog ─────────────────────────────────────────────────────────
type ImportStep = "select" | "preview" | "importing" | "done";

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; name: string; reason: string }[];
}

function CsvImportDialog({
  open, onClose, teamId, existingClients,
}: {
  open: boolean;
  onClose: () => void;
  teamId: number;
  existingClients: ClientValueClient[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("select");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip");
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep("select");
    setParsedRows([]);
    setParseError("");
    setDuplicateNames([]);
    setDuplicateAction("skip");
    setResult(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (file: File) => {
    setParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsvText(text);
      if (rows.length === 0) {
        setParseError("No data rows found. Make sure your CSV has headers on the first row and at least one data row.");
        return;
      }
      setParsedRows(rows);
      // Detect duplicates against existing client list
      const existingNames = new Set(existingClients.map(c => c.clientName.toLowerCase().trim()));
      const dupes = rows
        .map(r => r.clientName.trim())
        .filter(n => n && existingNames.has(n.toLowerCase()));
      setDuplicateNames([...new Set(dupes)]);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep("importing");
    try {
      const res = await apiRequest("/api/client-value-clients/import", "POST", {
        clients: parsedRows,
        teamId,
        duplicateAction,
      });
      const data: ImportResult = await res.json();
      setResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
    } catch {
      toast({ title: "Import failed", description: "Something went wrong. Please try again.", variant: "destructive" });
      setStep("preview");
    }
  };

  const validRows = parsedRows.filter(r => r.clientName.trim());
  const invalidRows = parsedRows.filter(r => !r.clientName.trim());
  const previewRows = parsedRows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Import Clients from CSV
          </DialogTitle>
        </DialogHeader>

        {/* ── Step: select ─────────────────────────────────────── */}
        {step === "select" && (
          <div className="space-y-5">
            {/* Template download */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 text-sm mb-1">Step 1 — Download the template</p>
                  <p className="text-xs text-blue-700 mb-3">
                    Fill in the CSV template with your client data. Columns: <span className="font-medium">{CSV_TEMPLATE_HEADERS.join(", ")}</span>.
                    Only Client Name is required.
                  </p>
                  <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" onClick={downloadCsvTemplate}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download CSV Template
                  </Button>
                </div>
              </div>
            </div>

            {/* Upload area */}
            <div>
              <p className="font-semibold text-gray-800 text-sm mb-3">Step 2 — Upload your completed CSV</p>
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group">
                <Upload className="h-8 w-8 text-gray-400 group-hover:text-blue-500 mb-2" />
                <span className="text-sm text-gray-600 group-hover:text-blue-700 font-medium">Click to select a CSV file</span>
                <span className="text-xs text-gray-400 mt-1">.csv files only</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </label>
              {parseError && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {parseError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step: preview ────────────────────────────────────── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{parsedRows.length} rows</span> found in your CSV
                {validRows.length !== parsedRows.length && (
                  <span className="text-amber-600 ml-2">· {invalidRows.length} will be skipped (missing Client Name)</span>
                )}
              </p>
              <Button size="sm" variant="ghost" className="text-xs text-gray-500" onClick={reset}>
                <X className="mr-1 h-3 w-3" /> Change file
              </Button>
            </div>

            {/* Preview table */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Preview — first {Math.min(5, parsedRows.length)} rows
              </p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {["Client Name", "Client Code", "Sector", "Pod", "Current Level", "Monthly Fee", "Target Fee", "Quality"].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className={`border-b last:border-0 ${!r.clientName.trim() ? "bg-red-50" : ""}`}>
                        <td className="px-2 py-1.5 font-medium text-gray-900">{r.clientName || <span className="text-red-500 italic">missing</span>}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.clientCode || "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.sector || "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.pod || "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.currentServiceLevel || "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.currentMonthlyFee ? `£${r.currentMonthlyFee}` : "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.targetMonthlyFee ? `£${r.targetMonthlyFee}` : "—"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{r.clientQuality || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <p className="text-xs text-gray-400 mt-1 text-right">…and {parsedRows.length - 5} more rows</p>
              )}
            </div>

            {/* Duplicate warning */}
            {duplicateNames.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  {duplicateNames.length} client{duplicateNames.length !== 1 ? "s" : ""} already exist in your list
                </p>
                <p className="text-xs text-amber-700 mb-3">
                  {duplicateNames.slice(0, 5).join(", ")}{duplicateNames.length > 5 ? ` and ${duplicateNames.length - 5} more` : ""}
                </p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dupeAction" value="skip" checked={duplicateAction === "skip"} onChange={() => setDuplicateAction("skip")} className="accent-amber-600" />
                    <span className="text-sm text-amber-900 font-medium">Skip duplicates</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="dupeAction" value="update" checked={duplicateAction === "update"} onChange={() => setDuplicateAction("update")} className="accent-amber-600" />
                    <span className="text-sm text-amber-900 font-medium">Update existing</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={validRows.length === 0}
                onClick={handleImport}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Import {validRows.length} client{validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: importing ──────────────────────────────────── */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-gray-600 font-medium">Importing clients…</p>
          </div>
        )}

        {/* ── Step: done ───────────────────────────────────────── */}
        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Import complete</p>
                <p className="text-sm text-green-700 mt-0.5">
                  {result.imported > 0 && <span>{result.imported} client{result.imported !== 1 ? "s" : ""} added. </span>}
                  {result.updated > 0 && <span>{result.updated} updated. </span>}
                  {result.skipped > 0 && <span>{result.skipped} skipped. </span>}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} skipped due to errors
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700">Row {e.row}: <span className="font-medium">{e.name}</span> — {e.reason}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleClose}>
                View Client List
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ClientValueManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"form" | "list" | "dashboard">("form");
  const [editingClient, setEditingClient] = useState<ClientValueClient | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sortCol, setSortCol] = useState("clientName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_COLS));
  const [mobileViewClient, setMobileViewClient] = useState<Enriched | null>(null);
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function toggleCol(key: string) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Fetch real teams from the database
  const { data: teams = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/teams"],
  });
  const teamId = teams[0]?.id ?? 0;

  const { data: clients = [], isLoading } = useQuery<ClientValueClient[]>({
    queryKey: ["/api/client-value-clients"],
    enabled: teamId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/client-value-clients/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
      toast({ title: "Client deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete client", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/client-value-clients/${id}`, "PUT", { isArchived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients?archived=true"] });
      toast({ title: "Client archived", description: "They've been removed from all lists. You can reinstate them at any time." });
      setArchiveId(null);
    },
    onError: () => toast({ title: "Failed to archive client", variant: "destructive" }),
  });

  const reinstateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/client-value-clients/${id}`, "PUT", { isArchived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-value-clients?archived=true"] });
      toast({ title: "Client reinstated", description: "They've been added back to the active client list." });
    },
    onError: () => toast({ title: "Failed to reinstate client", variant: "destructive" }),
  });

  const { data: archivedClients = [] } = useQuery<ClientValueClient[]>({
    queryKey: ["/api/client-value-clients?archived=true"],
    enabled: showArchived,
  });

  const enriched = useMemo(() => clients.map(enrich), [clients]);

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter(c => {
      if (filters.pod && c.pod !== filters.pod) return false;
      if (filters.sector && c.sector !== filters.sector) return false;
      if (filters.clientQuality && c.clientQuality !== filters.clientQuality) return false;
      if (filters.feeQuality && c.feeQuality !== filters.feeQuality) return false;
      if (filters.currentServiceLevel && c.currentServiceLevel !== filters.currentServiceLevel) return false;
      if (filters.targetServiceLevel && c.targetServiceLevel !== filters.targetServiceLevel) return false;
      if (filters.ccrStatus && c.ccrStatus !== filters.ccrStatus) return false;
      return true;
    });
  }, [enriched, filters]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortCol] ?? "";
      const bv = (b as any)[sortCol] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function exportCsv() {
    const headers = ["Client Name", "Client Code", "Sector", "Pod", "Turnover", "Client Since", "Current Service Level",
      "Target Service Level", "Current Monthly Fee", "Target Monthly Fee", "Opportunity Fee",
      "Annual Fee", "Client Quality", "Fee Quality Score", "Last CCR Date", "Next CCR Date",
      "CCR Status", "Last Fee Change Date", "Referred By", "Notes"];
    const rows = sorted.map(c => [
      c.clientName, c.clientCode ?? "", c.sector ?? "", c.pod ?? "", c.turnover ?? "", c.clientSince ?? "",
      c.currentServiceLevel ?? "", c.targetServiceLevel ?? "",
      c.currentMonthlyFee, c.targetMonthlyFee, c.opportunityFee, c.annualFee,
      c.clientQuality ?? "", c.feeQuality, c.lastCcrDate ?? "", c.nextCcrDate ?? "",
      c.ccrStatus ?? "", c.lastFeeChangeDate ?? "", c.referredBy ?? "", (c.notes ?? "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "client-value-manager.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toISOString().split("T")[0];

  // ─── Dashboard stats ──────────────────────────────────────────────────────
  const totalMRR = useMemo(() => filtered.reduce((s, c) => s + c.currentMonthlyFee, 0), [filtered]);
  const totalTargetMRR = useMemo(() => filtered.reduce((s, c) => s + c.targetMonthlyFee, 0), [filtered]);
  const totalOpportunity = useMemo(() => filtered.reduce((s, c) => s + Math.max(0, c.opportunityFee), 0), [filtered]);
  const pctCorrectLevel = useMemo(() => {
    if (!filtered.length) return 0;
    const match = filtered.filter(c => c.currentServiceLevel && c.currentServiceLevel === c.targetServiceLevel).length;
    return Math.round((match / filtered.length) * 100);
  }, [filtered]);
  const avgFee = useMemo(() => filtered.length ? Math.round(totalMRR / filtered.length) : 0, [filtered, totalMRR]);

  // Average client lifetime (months) — only counts clients that have clientSince set
  const filteredWithSince = useMemo(() => filtered.filter(c => !!c.clientSince), [filtered]);
  const avgClientLifetimeMonths = useMemo(() => {
    const todayMs = Date.now();
    if (!filteredWithSince.length) return null;
    const totalMonths = filteredWithSince.reduce((sum, c) => {
      const sinceMs = new Date(c.clientSince!).getTime();
      const months = (todayMs - sinceMs) / (1000 * 60 * 60 * 24 * 30.4375);
      return sum + Math.max(0, months);
    }, 0);
    return Math.round(totalMonths / filteredWithSince.length);
  }, [filteredWithSince]);

  // Average lifetime value per client = avg of (currentMonthlyFee × months as client)
  const avgLifetimeValuePerClient = useMemo(() => {
    const todayMs = Date.now();
    if (!filteredWithSince.length) return null;
    const total = filteredWithSince.reduce((sum, c) => {
      const sinceMs = new Date(c.clientSince!).getTime();
      const months = Math.max(0, (todayMs - sinceMs) / (1000 * 60 * 60 * 24 * 30.4375));
      return sum + c.currentMonthlyFee * months;
    }, 0);
    return Math.round(total / filteredWithSince.length);
  }, [filteredWithSince]);

  // Helper: format months into a readable string e.g. "38 months (3.2 yrs)"
  const fmtLifetime = (months: number) => {
    const yrs = (months / 12).toFixed(1);
    return months < 24 ? `${months} months` : `${months} months (${yrs} yrs)`;
  };

  // Top-N tables (sorted full lists — Top10Table slices internally)
  // Price Uplift: same service level, fee gap ≤ 30% of current fee
  const allOpportunities = useMemo(() => {
    return [...filtered]
      .filter(c => {
        if (c.opportunityFee <= 0) return false;
        const sameTier = c.currentServiceLevel === c.targetServiceLevel;
        if (!sameTier) return false;
        const gapPct = c.currentMonthlyFee > 0 ? (c.opportunityFee / c.currentMonthlyFee) : 1;
        return gapPct <= 0.30;
      })
      .sort((a, b) => b.opportunityFee - a.opportunityFee);
  }, [filtered]);

  // Upgrade Opportunities: different service level, OR same tier but gap > 30%
  const allUpgrades = useMemo(() => {
    return [...filtered]
      .filter(c => {
        if (c.opportunityFee <= 0) return false;
        const sameTier = c.currentServiceLevel === c.targetServiceLevel;
        const curIdx = SERVICE_LEVEL_ORDER.indexOf(c.currentServiceLevel ?? "");
        const tgtIdx = SERVICE_LEVEL_ORDER.indexOf(c.targetServiceLevel ?? "");
        if (!sameTier && tgtIdx > curIdx) return true;
        if (sameTier) {
          const gapPct = c.currentMonthlyFee > 0 ? (c.opportunityFee / c.currentMonthlyFee) : 1;
          return gapPct > 0.30;
        }
        return false;
      })
      .sort((a, b) => b.opportunityFee - a.opportunityFee);
  }, [filtered]);

  const allLowFee = useMemo(() => [...filtered].filter(c => c.feeQuality === "Low").sort((a, b) => b.opportunityFee - a.opportunityFee), [filtered]);
  const allByFee = useMemo(() => [...filtered].sort((a, b) => b.currentMonthlyFee - a.currentMonthlyFee), [filtered]);
  const allOverdueCcr = useMemo(() => [...filtered].filter(c => c.nextCcrDate && c.nextCcrDate < today).sort((a, b) => (a.nextCcrDate ?? "").localeCompare(b.nextCcrDate ?? "")), [filtered, today]);

  // Turnover mismatch: current_reported_turnover_band is in a higher band than original turnover band
  const turnoverMismatch = useMemo(() => {
    return [...filtered]
      .filter(c => {
        const reported = (c as any).currentReportedTurnoverBand as string | null;
        const original = c.turnover ? TURNOVER_DISPLAY_TO_BAND[c.turnover] : null;
        if (!reported || !original) return false;
        return bandIndex(reported) > bandIndex(original);
      })
      .map(c => {
        const reported = (c as any).currentReportedTurnoverBand as string;
        const original = c.turnover ? TURNOVER_DISPLAY_TO_BAND[c.turnover] : null;
        return {
          ...c,
          originalBand: original,
          currentBand: reported,
          bandsUp: bandIndex(reported) - bandIndex(original ?? ""),
        };
      })
      .sort((a, b) => b.bandsUp - a.bandsUp);
  }, [filtered]);

  // Chart data: client quality breakdown
  const qualityData = useMemo(() => {
    const segments = ["A", "B", "C", "D"];
    return segments.map(seg => ({
      name: seg,
      clients: filtered.filter(c => c.clientQuality === seg).length,
      mrr: filtered.filter(c => c.clientQuality === seg).reduce((s, c) => s + c.currentMonthlyFee, 0),
    }));
  }, [filtered]);

  // Chart data: fee quality breakdown
  const feeQualityData = useMemo(() => {
    const segs = ["Premium", "Fair", "Low", "Upgrade"];
    return segs.map(seg => ({
      name: seg,
      clients: filtered.filter(c => c.feeQuality === seg).length,
      mrr: filtered.filter(c => c.feeQuality === seg).reduce((s, c) => s + c.currentMonthlyFee, 0),
    }));
  }, [filtered]);

  // Chart data: CCR pipeline
  const ccrPipelineData = useMemo(() => {
    return CCR_STATUSES.map(status => ({
      name: status,
      clients: filtered.filter(c => c.ccrStatus === status).length,
      opportunity: filtered.filter(c => c.ccrStatus === status).reduce((s, c) => s + Math.max(0, c.opportunityFee), 0),
    }));
  }, [filtered]);

  // ─── Pricing Alerts ────────────────────────────────────────────────────────
  const thirtyDaysAgo = useMemo(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], []);
  const twelveMonthsAgo = useMemo(() => new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], []);

  const alertsUndercharged = useMemo(() =>
    filtered.filter(c => c.currentMonthlyFee < c.targetMonthlyFee && !!c.turnover),
  [filtered]);

  const alertsOvercharged = useMemo(() =>
    filtered.filter(c => c.targetMonthlyFee > 0 && c.currentMonthlyFee > c.targetMonthlyFee * 1.2),
  [filtered]);

  const alertsReviewOverdue = useMemo(() =>
    filtered.filter(c =>
      (c.nextCcrDate && c.nextCcrDate < today) ||
      (!c.nextCcrDate && c.lastCcrDate && c.lastCcrDate < twelveMonthsAgo)
    ),
  [filtered, today, twelveMonthsAgo]);

  const alertsRecentlyUpdated = useMemo(() =>
    filtered.filter(c => c.lastFeeChangeDate && c.lastFeeChangeDate >= thirtyDaysAgo),
  [filtered, thirtyDaysAgo]);

  const alertedClients = useMemo(() => {
    const underchargedIds = new Set(alertsUndercharged.map(c => c.id));
    const overchargedIds = new Set(alertsOvercharged.map(c => c.id));
    const reviewOverdueIds = new Set(alertsReviewOverdue.map(c => c.id));
    const flaggedIds = new Set([...underchargedIds, ...overchargedIds, ...reviewOverdueIds]);

    return filtered
      .filter(c => flaggedIds.has(c.id))
      .map(c => ({
        ...c,
        alertStatuses: [
          underchargedIds.has(c.id) ? "Undercharged" : null,
          overchargedIds.has(c.id) ? "Overcharged" : null,
          reviewOverdueIds.has(c.id) ? "Review Overdue" : null,
        ].filter(Boolean) as string[],
        gap: c.targetMonthlyFee - c.currentMonthlyFee,
      }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }, [filtered, alertsUndercharged, alertsOvercharged, alertsReviewOverdue]);

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  function clearFilters() { setFilters(emptyFilters); }

  // Column header button
  function ColHeader({ col, label }: { col: string; label: string }) {
    return (
      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
        {label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </th>
    );
  }

  // Mini top-N table with Review button and expand/collapse
  function Top10Table({
    title, allRows, cols, subtitle, note,
  }: {
    title: string;
    allRows: Enriched[];
    cols: { key: keyof Enriched | string; label: string }[];
    subtitle?: string;
    note?: string;
  }) {
    const [expanded, setExpanded] = useState(false);
    const rows = expanded ? allRows : allRows.slice(0, 10);
    const hasMore = allRows.length > 10;

    if (!allRows.length) return (
      <Card>
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-500">No data</p></CardContent>
      </Card>
    );
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                {cols.map(c => <th key={c.key} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{c.label}</th>)}
                <th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    {cols.map(c => (
                      <td key={c.key} className="px-3 py-2 text-gray-700">
                        {c.key === "currentMonthlyFee" || c.key === "opportunityFee" || c.key === "targetMonthlyFee"
                          ? fmt((r as any)[c.key] ?? 0)
                          : c.key === "nextCcrDate"
                          ? (r.nextCcrDate ?? "—")
                          : (r as any)[c.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        onClick={() => { setEditingClient(clients.find(x => x.id === r.id)); setActiveTab("form"); }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {note && (
            <div className="px-3 py-2 border-t">
              <p className="text-xs text-gray-400 italic">{note}</p>
            </div>
          )}
          {hasMore && (
            <div className={`px-3 py-2 ${note ? "" : "border-t"}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-blue-600 hover:text-blue-800 w-full"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded
                  ? <><ChevronUp className="mr-1 h-3 w-3" />Show less</>
                  : <><ChevronDown className="mr-1 h-3 w-3" />Expand / See all ({allRows.length} clients)</>
                }
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href="/practice-performance">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Client Value Manager</h1>
          </div>
          <p className="text-gray-500 text-sm ml-20">Track client fees, service levels, and CCR pipeline</p>
        </div>
        <Button onClick={() => { setEditingClient(undefined); setShowForm(true); }} disabled={teamId === 0}>
          <Plus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="form">Add / Edit Client</TabsTrigger>
          <TabsTrigger value="list">Client List ({filtered.length})</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        {/* ── Add/Edit tab ── */}
        <TabsContent value="form">
          <Card>
            <CardHeader>
              <CardTitle>{editingClient ? `Editing: ${editingClient.clientName}` : "Add New Client"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientForm
                key={teamId}
                client={editingClient}
                teamId={teamId}
                onClose={() => { setEditingClient(undefined); setActiveTab("list"); }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Client list tab ── */}
        <TabsContent value="list">
          {/* Filter bar */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && <Badge className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0">{Object.values(filters).filter(v => v).length}</Badge>}
            </Button>

            {/* Columns picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Toggle columns</p>
                {COL_DEFS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-gray-50 rounded select-none">
                    <Checkbox checked={visibleCols.has(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                    {c.label}
                  </label>
                ))}
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" /> Clear filters
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>

          {showFilters && (
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { key: "pod" as const, label: "Pod", opts: PODS },
                    { key: "sector" as const, label: "Sector", opts: SECTORS },
                    { key: "clientQuality" as const, label: "Client Quality", opts: CLIENT_QUALITIES.map(q => q.value) },
                    { key: "feeQuality" as const, label: "Fee Quality", opts: ["Premium", "Fair", "Low", "Upgrade"] },
                    { key: "currentServiceLevel" as const, label: "Current Level", opts: SERVICE_LEVELS },
                    { key: "targetServiceLevel" as const, label: "Target Level", opts: SERVICE_LEVELS },
                    { key: "ccrStatus" as const, label: "CCR Status", opts: CCR_STATUSES },
                  ].map(({ key, label, opts }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                      <Select value={filters[key]} onValueChange={v => setFilters(f => ({ ...f, [key]: v === "all" ? "" : v }))}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading clients...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-3">{hasActiveFilters ? "No clients match the current filters." : "No clients yet."}</p>
              {!hasActiveFilters && (
                <Button onClick={() => { setEditingClient(undefined); setActiveTab("form"); }}>
                  <Plus className="mr-2 h-4 w-4" /> Add your first client
                </Button>
              )}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">

                {/* ── Mobile table (< md) ── */}
                <div className="md:hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CCR Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(c => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-medium text-gray-900 text-xs">{c.clientName}</td>
                          <td className="px-3 py-1.5 text-gray-700 text-xs">{fmt(c.currentMonthlyFee)}</td>
                          <td className="px-3 py-1.5 text-gray-600 text-xs">{c.ccrStatus || "—"}</td>
                          <td className="px-3 py-1.5">
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setMobileViewClient(c)}>View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Desktop table (>= md) ── */}
                <div className="hidden md:block relative overflow-x-auto w-full min-w-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            {/* Frozen Client column */}
                            <th
                              className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                              onClick={() => toggleSort("clientName")}
                            >
                              Client<SortIcon col="clientName" sortCol={sortCol} sortDir={sortDir} />
                            </th>
                            {visibleCols.has("clientCode")          && <ColHeader col="clientCode"          label="Code"           />}
                            {visibleCols.has("sector")              && <ColHeader col="sector"              label="Sector"         />}
                            {visibleCols.has("pod")                 && <ColHeader col="pod"                 label="Pod"            />}
                            {visibleCols.has("turnover")            && <ColHeader col="turnover"            label="Turnover"       />}
                            {visibleCols.has("currentServiceLevel") && <ColHeader col="currentServiceLevel" label="Current Level"  />}
                            {visibleCols.has("targetServiceLevel")  && <ColHeader col="targetServiceLevel"  label="Target Level"   />}
                            {visibleCols.has("currentMonthlyFee")   && <ColHeader col="currentMonthlyFee"   label="Monthly Fee"    />}
                            {visibleCols.has("targetMonthlyFee")    && <ColHeader col="targetMonthlyFee"    label="Target Fee"     />}
                            {visibleCols.has("opportunityFee")      && <ColHeader col="opportunityFee"      label="Opportunity Fee"/>}
                            {visibleCols.has("annualFee")           && <ColHeader col="annualFee"           label="Annual Fee"     />}
                            {visibleCols.has("feeQuality")          && <ColHeader col="feeQuality"          label="Fee Quality"    />}
                            {visibleCols.has("ccrStatus")           && <ColHeader col="ccrStatus"           label="CCR Status"     />}
                            {visibleCols.has("clientQuality")       && <ColHeader col="clientQuality"       label="Client Quality" />}
                            {visibleCols.has("lastCcrDate")         && <ColHeader col="lastCcrDate"         label="Last CCR Date"  />}
                            {visibleCols.has("nextCcrDate")         && <ColHeader col="nextCcrDate"         label="Next CCR Date"  />}
                            {visibleCols.has("lastFeeChangeDate")   && <ColHeader col="lastFeeChangeDate"   label="Last Fee Change"/>}
                            {visibleCols.has("referredBy")          && <ColHeader col="referredBy"          label="Referred By"    />}
                            {visibleCols.has("notes")               && <ColHeader col="notes"               label="Notes"          />}
                            {visibleCols.has("currentReportedTurnover") && <ColHeader col="currentReportedTurnover" label="Current Turnover" />}
                            {visibleCols.has("turnoverLastUpdated")  && <ColHeader col="turnoverLastUpdated"  label="Turnover Updated"/>}
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map(c => (
                            <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                              {/* Frozen Client cell */}
                              <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-1 font-medium text-gray-900 whitespace-nowrap group-hover:bg-gray-50">
                                {c.clientName}
                              </td>
                              {visibleCols.has("clientCode")          && <td className="px-3 py-1 text-gray-500 whitespace-nowrap">{c.clientCode || "—"}</td>}
                              {visibleCols.has("sector")              && <td className="px-3 py-1 text-gray-600">{c.sector || "—"}</td>}
                              {visibleCols.has("pod")                 && <td className="px-3 py-1 text-gray-600">{c.pod || "—"}</td>}
                              {visibleCols.has("turnover")            && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.turnover || "—"}</td>}
                              {visibleCols.has("currentServiceLevel") && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.currentServiceLevel || "—"}</td>}
                              {visibleCols.has("targetServiceLevel")  && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.targetServiceLevel || "—"}</td>}
                              {visibleCols.has("currentMonthlyFee")   && <td className="px-3 py-1 text-gray-700 font-medium">{fmt(c.currentMonthlyFee)}</td>}
                              {visibleCols.has("targetMonthlyFee")    && <td className="px-3 py-1 text-gray-700">{fmt(c.targetMonthlyFee)}</td>}
                              {visibleCols.has("opportunityFee")      && <td className={`px-3 py-1 font-medium ${c.opportunityFee > 0 ? "text-green-700" : c.opportunityFee < 0 ? "text-red-600" : "text-gray-500"}`}>{fmt(c.opportunityFee)}</td>}
                              {visibleCols.has("annualFee")           && <td className="px-3 py-1 text-gray-700">{fmt(c.annualFee)}</td>}
                              {visibleCols.has("feeQuality")          && <td className="px-3 py-1"><FeeQualityBadge score={c.feeQuality} /></td>}
                              {visibleCols.has("ccrStatus")           && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.ccrStatus || "—"}</td>}
                              {visibleCols.has("clientQuality")       && <td className="px-3 py-1"><ClientQualityBadge quality={c.clientQuality} /></td>}
                              {visibleCols.has("lastCcrDate")         && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.lastCcrDate || "—"}</td>}
                              {visibleCols.has("nextCcrDate")         && <td className={`px-3 py-1 whitespace-nowrap ${c.nextCcrDate && c.nextCcrDate < today ? "text-red-600 font-medium" : "text-gray-600"}`}>{c.nextCcrDate || "—"}</td>}
                              {visibleCols.has("lastFeeChangeDate")   && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{c.lastFeeChangeDate || "—"}</td>}
                              {visibleCols.has("referredBy")          && <td className="px-3 py-1 text-gray-600">{c.referredBy || "—"}</td>}
                              {visibleCols.has("notes")               && <td className="px-3 py-1 text-gray-600 max-w-xs truncate">{c.notes || "—"}</td>}
                              {visibleCols.has("currentReportedTurnover") && <td className="px-3 py-1 text-gray-700 whitespace-nowrap">{(c as any).currentReportedTurnover != null ? `£${((c as any).currentReportedTurnover as number).toLocaleString()}` : "—"}</td>}
                              {visibleCols.has("turnoverLastUpdated")  && <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{(c as any).turnoverLastUpdated || "—"}</td>}
                              <td className="px-3 py-1">
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingClient(clients.find(x => x.id === c.id)); setActiveTab("form"); }}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500 hover:text-amber-700" title="Archive client" onClick={() => setArchiveId(c.id)}>
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => setDeleteId(c.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  {/* Right-edge scroll shadow */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/[0.05] to-transparent rounded-r-lg" />
                </div>

              </CardContent>
            </Card>
          )}

          {/* Mobile client detail dialog */}
          <Dialog open={!!mobileViewClient} onOpenChange={open => { if (!open) setMobileViewClient(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{mobileViewClient?.clientName}</DialogTitle>
              </DialogHeader>
              {mobileViewClient && (
                <div className="space-y-1.5 text-sm max-h-[60vh] overflow-y-auto pr-1">
                  {([
                    ["Client Code",       mobileViewClient.clientCode],
                    ["Sector",            mobileViewClient.sector],
                    ["Pod",               mobileViewClient.pod],
                    ["Turnover",          mobileViewClient.turnover],
                    ["Client Since",      mobileViewClient.clientSince],
                    ["Current Level",     mobileViewClient.currentServiceLevel],
                    ["Target Level",      mobileViewClient.targetServiceLevel],
                    ["Monthly Fee",       fmt(mobileViewClient.currentMonthlyFee)],
                    ["Target Fee",        fmt(mobileViewClient.targetMonthlyFee)],
                    ["Opportunity Fee",   fmt(mobileViewClient.opportunityFee)],
                    ["Annual Fee",        fmt(mobileViewClient.annualFee)],
                    ["Client Quality",    mobileViewClient.clientQuality],
                    ["Fee Quality",       mobileViewClient.feeQuality],
                    ["CCR Status",        mobileViewClient.ccrStatus],
                    ["Last CCR Date",     mobileViewClient.lastCcrDate],
                    ["Next CCR Date",     mobileViewClient.nextCcrDate],
                    ["Last Fee Change",   mobileViewClient.lastFeeChangeDate],
                    ["Referred By",       mobileViewClient.referredBy],
                    ["Notes",             mobileViewClient.notes],
                  ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 py-0.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-500 shrink-0">{label}</span>
                      <span className="text-gray-900 text-right">{value}</span>
                    </div>
                  ))}
                  <div className="pt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditingClient(clients.find(x => x.id === mobileViewClient.id)); setActiveTab("form"); setMobileViewClient(null); }}>
                      <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setDeleteId(mobileViewClient.id); setMobileViewClient(null); }}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ── Archived Clients ── */}
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="text-gray-500 border-dashed"
            >
              {showArchived ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}
              {showArchived ? "Hide" : "View"} Archived Clients
              {showArchived && archivedClients.length > 0 && ` (${archivedClients.length})`}
            </Button>

            {showArchived && (
              <Card className="mt-3">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
                    <Archive className="h-4 w-4" />
                    Archived Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {archivedClients.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No archived clients.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Monthly Fee</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pod</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">CCR Status</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {archivedClients.map(c => (
                            <tr key={c.id} className="border-b last:border-0 bg-gray-50/50">
                              <td className="px-3 py-2 font-medium text-gray-500">{c.clientName}</td>
                              <td className="px-3 py-2 text-gray-400">{fmt(c.currentMonthlyFee)}</td>
                              <td className="px-3 py-2 text-gray-400">{c.pod || "—"}</td>
                              <td className="px-3 py-2 text-gray-400">{c.ccrStatus || "—"}</td>
                              <td className="px-3 py-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => reinstateMutation.mutate(c.id)}
                                  disabled={reinstateMutation.isPending}
                                >
                                  <ArchiveRestore className="mr-1 h-3 w-3" />
                                  Reinstate
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Dashboard tab ── */}
        <TabsContent value="dashboard">
          {/* Summary metrics — row 1: fee metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {[
              { label: "Total MRR", value: fmt(totalMRR), color: "text-blue-700" },
              { label: "Target MRR", value: fmt(totalTargetMRR), color: "text-purple-700" },
              { label: "Opportunity Gap", value: fmt(totalOpportunity), color: "text-green-700" },
              { label: "% Correct Level", value: `${pctCorrectLevel}%`, color: "text-orange-700" },
              { label: "Average Fee", value: fmt(avgFee), color: "text-gray-700" },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary metrics — row 2: retention & lifetime metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-gray-500 mb-1">Avg Client Lifetime</p>
                {avgClientLifetimeMonths !== null ? (
                  <>
                    <p className="text-xl font-bold text-teal-700">{fmtLifetime(avgClientLifetimeMonths)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Based on {filteredWithSince.length} of {filtered.length} clients with a start date
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">No start dates recorded</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-gray-500 mb-1">Avg Lifetime Value Per Client</p>
                {avgLifetimeValuePerClient !== null ? (
                  <>
                    <p className="text-xl font-bold text-indigo-700">{fmt(avgLifetimeValuePerClient)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Monthly fee × months as client, avg across {filteredWithSince.length} clients with a start date
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">Add start dates to clients to calculate</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Pricing Alerts ── */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Pricing Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary chips */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: "Undercharged",
                    icon: TrendingDown,
                    color: "text-orange-700",
                    bg: "bg-orange-50 border-orange-200",
                    count: alertsUndercharged.length,
                    total: alertsUndercharged.reduce((s, c) => s + (c.targetMonthlyFee - c.currentMonthlyFee), 0),
                    desc: "Gap to target",
                  },
                  {
                    label: "Overcharged",
                    icon: TrendingUp,
                    color: "text-red-700",
                    bg: "bg-red-50 border-red-200",
                    count: alertsOvercharged.length,
                    total: alertsOvercharged.reduce((s, c) => s + (c.currentMonthlyFee - c.targetMonthlyFee), 0),
                    desc: "Above target",
                  },
                  {
                    label: "Review Overdue",
                    icon: Clock,
                    color: "text-purple-700",
                    bg: "bg-purple-50 border-purple-200",
                    count: alertsReviewOverdue.length,
                    total: alertsReviewOverdue.reduce((s, c) => s + c.currentMonthlyFee, 0),
                    desc: "MRR at risk",
                  },
                  {
                    label: "Recently Updated",
                    icon: RefreshCw,
                    color: "text-green-700",
                    bg: "bg-green-50 border-green-200",
                    count: alertsRecentlyUpdated.length,
                    total: alertsRecentlyUpdated.reduce((s, c) => s + c.currentMonthlyFee, 0),
                    desc: "MRR updated",
                  },
                ].map(({ label, icon: Icon, color, bg, count, total, desc }) => (
                  <div key={label} className={`rounded-lg border p-3 ${bg}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                    </div>
                    <p className={`text-xl font-bold ${color}`}>{count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}: <span className="font-medium text-gray-700">{fmt(total)}/mo</span></p>
                  </div>
                ))}
              </div>

              {/* Flagged clients table */}
              {alertedClients.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No pricing alerts — all clients are within expected ranges.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Current Fee</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Target Fee</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Gap</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">CCR Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Next CCR Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertedClients.map(c => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{c.clientName}</td>
                          <td className="px-3 py-2 text-gray-700">{fmt(c.currentMonthlyFee)}</td>
                          <td className="px-3 py-2 text-gray-700">{fmt(c.targetMonthlyFee)}</td>
                          <td className={`px-3 py-2 font-medium ${c.gap > 0 ? "text-orange-700" : "text-red-700"}`}>
                            {fmt(Math.abs(c.gap))}
                            <span className="text-xs ml-1">{c.gap > 0 ? "below" : "above"}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {c.alertStatuses.map(s => (
                                <span key={s} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  s === "Undercharged" ? "bg-orange-100 text-orange-800" :
                                  s === "Overcharged"  ? "bg-red-100 text-red-800" :
                                  "bg-purple-100 text-purple-800"
                                }`}>{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{c.ccrStatus || "—"}</td>
                          <td className={`px-3 py-2 whitespace-nowrap ${c.nextCcrDate && c.nextCcrDate < today ? "text-red-600 font-medium" : "text-gray-600"}`}>
                            {c.nextCcrDate || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => { setEditingClient(clients.find(x => x.id === c.id)); setActiveTab("form"); }}
                            >
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top-N tables — 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Top10Table
              title="Top Opportunities (Price Uplift)"
              subtitle="Same service level — fee increase opportunity"
              allRows={allOpportunities}
              cols={[{ key: "clientName", label: "Client" }, { key: "opportunityFee", label: "Opportunity" }, { key: "currentMonthlyFee", label: "Current Fee" }]}
              note="Clients with a fee gap above 30% of current fees have been moved to Upgrade Opportunities"
            />
            <Top10Table
              title="Upgrade Opportunities"
              subtitle="Service level upgrade — move to higher tier"
              allRows={allUpgrades}
              cols={[{ key: "clientName", label: "Client" }, { key: "currentServiceLevel", label: "Current" }, { key: "targetServiceLevel", label: "Target" }, { key: "opportunityFee", label: "Opportunity" }]}
            />
            <Top10Table
              title="Top Low Fee Clients"
              allRows={allLowFee}
              cols={[{ key: "clientName", label: "Client" }, { key: "currentMonthlyFee", label: "Current" }, { key: "targetMonthlyFee", label: "Target" }, { key: "opportunityFee", label: "Gap" }]}
            />
            <Top10Table
              title="Top Clients by Current Fee"
              allRows={allByFee}
              cols={[{ key: "clientName", label: "Client" }, { key: "currentMonthlyFee", label: "Monthly Fee" }, { key: "currentServiceLevel", label: "Level" }]}
            />
            <Top10Table
              title="Overdue CCRs"
              allRows={allOverdueCcr}
              cols={[{ key: "clientName", label: "Client" }, { key: "nextCcrDate", label: "Due Date" }, { key: "currentMonthlyFee", label: "Fee" }]}
            />
          </div>

          {/* ── Turnover Mismatch ── */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Turnover Mismatch
              </CardTitle>
            </CardHeader>
            <CardContent>
              {turnoverMismatch.length === 0 ? (
                filtered.some(c => (c as any).currentReportedTurnover !== null && (c as any).currentReportedTurnover !== undefined) ? (
                  <p className="text-sm text-gray-500 text-center py-4">No mismatches found — all clients are priced at or above their current turnover band.</p>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500 mb-1">No turnover data entered yet.</p>
                    <p className="text-xs text-gray-400">Add current turnover figures to your client records to identify repricing opportunities. Connect Dext to update these automatically.</p>
                  </div>
                )
              ) : (
                <>
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {turnoverMismatch.length} client{turnoverMismatch.length !== 1 ? "s" : ""} {turnoverMismatch.length === 1 ? "has" : "have"} grown beyond their original pricing band
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Client</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Original Band</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Current Turnover</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Current Band</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Bands Up</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Monthly Fee</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">Updated</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnoverMismatch.map((c, i) => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{c.clientName}</td>
                            <td className="px-3 py-2 text-gray-600">{c.originalBand ? TURNOVER_BAND_LABELS[c.originalBand as TurnoverBand] : c.turnover ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-700">£{((c as any).currentReportedTurnover as number)?.toLocaleString() ?? "—"}</td>
                            <td className="px-3 py-2 text-gray-700">{TURNOVER_BAND_LABELS[c.currentBand as TurnoverBand] ?? c.currentBand}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">+{c.bandsUp}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-700">{fmt(c.currentMonthlyFee)}</td>
                            <td className="px-3 py-2 text-gray-500">{(c as any).turnoverLastUpdated ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                onClick={() => { setEditingClient(clients.find(x => x.id === c.id)); setActiveTab("form"); }}
                              >
                                Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Client quality */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Client Quality (A/B/C/D)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, n) => [n === "mrr" ? fmt(v as number) : v, n === "mrr" ? "MRR" : "Clients"]} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="clients" fill="#3b82f6" name="Clients" />
                    <Bar yAxisId="right" dataKey="mrr" fill="#8b5cf6" name="MRR" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fee quality */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Fee Quality Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={feeQualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, n) => [n === "mrr" ? fmt(v as number) : v, n === "mrr" ? "MRR" : "Clients"]} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="clients" fill="#10b981" name="Clients" />
                    <Bar yAxisId="right" dataKey="mrr" fill="#f59e0b" name="MRR" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* CCR Pipeline */}
            <Card>
              <CardHeader><CardTitle className="text-sm">CCR Pipeline</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ccrPipelineData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [n === "opportunity" ? fmt(v as number) : v, n === "opportunity" ? "Opportunity" : "Clients"]} />
                    <Legend />
                    <Bar dataKey="clients" fill="#6366f1" name="Clients" />
                    <Bar dataKey="opportunity" fill="#ec4899" name="Opportunity (£)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        teamId={teamId}
        existingClients={clients}
      />

      {/* Add client dialog (from header button) */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <ClientForm teamId={teamId} onClose={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={archiveId !== null} onOpenChange={open => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This client will be removed from all active lists, MRR totals, and CCR tracking. Their data is kept and you can reinstate them at any time from the Archived Clients section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700" onClick={() => archiveId !== null && archiveMutation.mutate(archiveId)}>
              <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the client and all their data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
