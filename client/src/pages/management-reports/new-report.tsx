import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import type { ReportClient } from "@shared/schema";

function getDefaultPeriod(frequency: string): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === "monthly") {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const start = new Date(prevYear, prevMonth, 1);
    const end = new Date(prevYear, prevMonth + 1, 0);
    const label = start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      label,
    };
  }

  if (frequency === "quarterly") {
    const quarter = Math.floor(month / 3);
    const prevQuarter = quarter === 0 ? 3 : quarter - 1;
    const prevYear = quarter === 0 ? year - 1 : year;
    const quarterStart = prevQuarter * 3;
    const start = new Date(prevYear, quarterStart, 1);
    const end = new Date(prevYear, quarterStart + 3, 0);
    const qLabel = `Q${prevQuarter + 1} ${prevYear}`;
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
      label: qLabel,
    };
  }

  // Default fallback
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  };
}

export default function NewReport() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: client } = useQuery<ReportClient>({
    queryKey: ["/api/report-clients", clientId],
    queryFn: () => fetch(`/api/report-clients/${clientId}`).then(r => r.json()),
    enabled: !!clientId,
  });

  const defaultPeriod = client ? getDefaultPeriod(client.reportFrequency) : { start: "", end: "", label: "" };

  const [periodType, setPeriodType] = useState(client?.reportFrequency || "monthly");
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end);
  const [periodLabel, setPeriodLabel] = useState(defaultPeriod.label);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/report-clients/${clientId}/reports`, "POST", {
        periodType,
        periodStart,
        periodEnd,
        periodLabel,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (report) => {
      toast({ title: "Report created" });
      navigate(`/management-reports/reports/${report.id}/data-entry`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/management-reports/clients/${clientId}`}>
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Report</h1>
          {client && <p className="text-sm text-gray-500">{client.clientName} — {client.companyName}</p>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Reporting period</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Period type</label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="12_weekly">12-Weekly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start date</label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End date</label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Period label (shown on report)</label>
            <Input
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              placeholder="e.g. March 2026"
            />
          </div>

          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !periodStart || !periodEnd || !periodLabel}
          >
            <Plus className="h-4 w-4" />
            {mutation.isPending ? "Creating…" : "Create report & enter data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
