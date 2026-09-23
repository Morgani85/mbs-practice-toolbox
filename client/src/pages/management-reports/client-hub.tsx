import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, FileText, Target, Eye, CheckCircle, Clock, Send, Wifi, WifiOff, Save, Layers, AlertCircle } from "lucide-react";
import type { ReportClient, StrategicPlan, ManagementReport, ManagementReportPeriod, ReportStructure } from "@shared/schema";
import { ClientProfileTab } from "./client-profile-tab";

type ReportWithPeriod = ManagementReport & { period: ManagementReportPeriod };

function statusBadge(status: string) {
  if (status === "sent") return <Badge className="bg-blue-100 text-blue-700 border-0 gap-1"><Send className="h-3 w-3" />Sent</Badge>;
  if (status === "ready") return <Badge className="bg-green-100 text-green-700 border-0 gap-1"><CheckCircle className="h-3 w-3" />Ready</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-0 gap-1"><Clock className="h-3 w-3" />Draft</Badge>;
}

function HealthScore({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-gray-400 text-sm">—</span>;
  const colour = score >= 86 ? "text-teal-600" : score >= 66 ? "text-green-600" : score >= 41 ? "text-amber-600" : "text-red-600";
  return <span className={`font-semibold ${colour}`}>{score}</span>;
}

export default function ClientHub() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: client, isLoading: clientLoading } = useQuery<ReportClient>({
    queryKey: ["/api/report-clients", id],
    queryFn: () => fetch(`/api/report-clients/${id}`).then(r => r.json()),
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<ReportWithPeriod[]>({
    queryKey: ["/api/report-clients", id, "reports"],
    queryFn: () => fetch(`/api/report-clients/${id}/reports`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: plan } = useQuery<StrategicPlan | null>({
    queryKey: ["/api/report-clients", id, "strategic-plan"],
    queryFn: () => fetch(`/api/report-clients/${id}/strategic-plan`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: structure, isLoading: structureLoading } = useQuery<ReportStructure | null>({
    queryKey: ["/api/report-clients", id, "structure"],
    queryFn: () => fetch(`/api/report-clients/${id}/structure`).then(r => r.json()),
    enabled: !!id,
  });

  // Settings state
  const [settingsIndustry, setSettingsIndustry] = useState("");
  const [settingsFrequency, setSettingsFrequency] = useState("");
  const [settingsReportType, setSettingsReportType] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);

  function initSettings(c: ReportClient) {
    setSettingsIndustry((c as any).industry || "sme_general");
    setSettingsFrequency((c as any).reportFrequency || "monthly");
    setSettingsReportType((c as any).reportType || "standard");
    setSettingsDirty(false);
  }

  // Initialize settings when client loads
  if (client && !settingsDirty && !settingsIndustry) {
    initSettings(client);
  }

  const xeroConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/xero/connect/${id}`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Xero connected (demo mode)" });
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/report-clients/${id}`, "PUT", {
        industry: settingsIndustry,
        reportFrequency: settingsFrequency,
        reportType: settingsReportType,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id] });
      setSettingsDirty(false);
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error saving settings", description: e.message, variant: "destructive" }),
  });

  if (clientLoading) return (
    <div className="space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="h-32 bg-gray-100 rounded animate-pulse" />
    </div>
  );

  if (!client) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Client not found.</p>
      <Link href="/management-reports"><Button variant="ghost" className="mt-4">Back to Management Reports</Button></Link>
    </div>
  );

  const latestReport = reports[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/management-reports">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.clientName}</h1>
            <p className="text-sm text-gray-500">{client.companyName}</p>
          </div>
        </div>
        <div className="text-right flex items-center gap-4">
          {(client as any).reportType === "mi_pack" && (
            <Badge className="bg-teal-100 text-teal-700 border-0 font-medium">MI Pack</Badge>
          )}
          {latestReport?.aiHealthScore != null && (
            <div>
              <div className={`text-3xl font-bold ${latestReport.aiHealthScore >= 86 ? "text-teal-600" : latestReport.aiHealthScore >= 66 ? "text-green-600" : latestReport.aiHealthScore >= 41 ? "text-amber-600" : "text-red-600"}`}>
                {latestReport.aiHealthScore}
              </div>
              <div className="text-xs text-gray-500">{latestReport.aiHealthStatus}</div>
            </div>
          )}
        </div>
      </div>

      {/* Structure status banner */}
      {!structureLoading && structure === null ? (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">No report structure set up — AI will use industry defaults. Set up a custom structure for better tailored analysis.</p>
          </div>
          <Link href={`/management-reports/clients/${id}/structure`}>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
              <Layers className="h-3.5 w-3.5 mr-1" /> Set up structure
            </Button>
          </Link>
        </div>
      ) : structure?.status === "approved" ? (
        <div className="flex items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-teal-600 flex-shrink-0" />
            <p className="text-sm text-teal-800">Custom report structure approved — AI uses {((structure?.coreQuestions as any[]) || []).length} tailored questions for this client.</p>
          </div>
          <Link href={`/management-reports/clients/${id}/structure`}>
            <Button size="sm" variant="ghost" className="text-teal-700 hover:bg-teal-100 whitespace-nowrap">
              <Layers className="h-3.5 w-3.5 mr-1" /> Manage
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">Report structure generated — pending approval. Approve it to activate tailored AI analysis.</p>
          </div>
          <Link href={`/management-reports/clients/${id}/structure`}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
              Review & Approve
            </Button>
          </Link>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="strategic-plan">Strategic Plan</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Reports tab */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Link href={`/management-reports/reports/new/${id}`}>
              <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                <Plus className="h-4 w-4" /> New Report
              </Button>
            </Link>
          </div>

          {reportsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : reports.length === 0 ? (
            <Card className="border-dashed border-gray-200">
              <CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No reports yet for this client</p>
                <Link href={`/management-reports/reports/new/${id}`}>
                  <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                    <Plus className="h-4 w-4" /> Create first report
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map(report => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.period.periodLabel}</TableCell>
                      <TableCell>{statusBadge(report.status)}</TableCell>
                      <TableCell><HealthScore score={report.aiHealthScore} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/management-reports/reports/${report.id}`}>
                            <Button size="sm" variant="outline" className="gap-1 h-7">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </Link>
                          <Link href={`/management-reports/reports/${report.id}/data-entry`}>
                            <Button size="sm" variant="ghost" className="h-7 text-gray-500">Edit data</Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Strategic Plan tab */}
        <TabsContent value="strategic-plan" className="mt-4">
          {plan ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Link href={`/management-reports/clients/${id}/strategic-plan/edit`}>
                  <Button variant="outline" className="gap-2">
                    <Target className="h-4 w-4" /> Edit Strategic Plan
                  </Button>
                </Link>
              </div>

              {(plan.longTermGoals as any[])?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Long-term Goals</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(plan.longTermGoals as any[]).map((g, i) => (
                      <div key={i} className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Goal</p>
                          <p className="text-sm font-medium text-gray-800">{g.goal}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Current position</p>
                          <p className="text-sm text-gray-600">{g.currentPosition}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {plan.swot && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">SWOT Analysis</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {(["strengths", "weaknesses", "opportunities", "threats"] as const).map(key => {
                        const items = (plan.swot as any)?.[key] || [];
                        const colours: Record<string, string> = {
                          strengths: "bg-green-50 border-green-200 text-green-700",
                          weaknesses: "bg-red-50 border-red-200 text-red-700",
                          opportunities: "bg-blue-50 border-blue-200 text-blue-700",
                          threats: "bg-amber-50 border-amber-200 text-amber-700"
                        };
                        return (
                          <div key={key} className={`p-3 rounded-lg border ${colours[key]}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2">{key}</p>
                            {items.length === 0 ? <p className="text-xs opacity-60">None listed</p> : (
                              <ul className="text-xs space-y-0.5">
                                {items.map((item: string, i: number) => <li key={i}>• {item}</li>)}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="border-dashed border-gray-200">
              <CardContent className="py-12 text-center">
                <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No strategic plan yet for this client</p>
                <Link href={`/management-reports/clients/${id}/strategic-plan/edit`}>
                  <Button className="bg-teal-600 hover:bg-teal-700 gap-2">
                    <Plus className="h-4 w-4" /> Create strategic plan
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-4">
          <ClientProfileTab clientId={parseInt(id || "0")} />
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Report settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Report Type */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Report Type</p>
                  <Select value={settingsReportType} onValueChange={v => { setSettingsReportType(v); setSettingsDirty(true); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard — Core P&L, cashflow, AI commentary</SelectItem>
                      <SelectItem value="mi_pack">MI Pack — Full management information pack with three core questions, debt schedule, DLA, and PDF</SelectItem>
                    </SelectContent>
                  </Select>
                  {settingsReportType === "mi_pack" && (
                    <div className="mt-2 p-3 bg-teal-50 border border-teal-100 rounded-lg text-xs text-teal-700">
                      MI Pack includes extended data entry sections, three core question verdicts, debt schedule, DLA tracking, cashflow waterfall, and a structured PDF report.
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Report frequency</p>
                  <Select value={settingsFrequency} onValueChange={v => { setSettingsFrequency(v); setSettingsDirty(true); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="12_weekly">12-weekly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Industry</p>
                <Select value={settingsIndustry} onValueChange={v => { setSettingsIndustry(v); setSettingsDirty(true); }}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sme_general">SME General</SelectItem>
                    <SelectItem value="hospitality_retail">Hospitality & Retail</SelectItem>
                    <SelectItem value="professional_services">Professional Services</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settingsDirty && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 gap-2"
                    onClick={() => saveSettingsMutation.mutate()}
                    disabled={saveSettingsMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {saveSettingsMutation.isPending ? "Saving…" : "Save settings"}
                  </Button>
                  <Button variant="ghost" onClick={() => { initSettings(client); setSettingsDirty(false); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Xero connection</CardTitle></CardHeader>
            <CardContent>
              {(client as any).xeroTenantId ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <Wifi className="h-4 w-4" />
                  <span>Connected (demo mode)</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <WifiOff className="h-4 w-4" />
                    <span>Not connected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => xeroConnectMutation.mutate()}
                    disabled={xeroConnectMutation.isPending}
                  >
                    {xeroConnectMutation.isPending ? "Connecting…" : "Connect Xero (stub)"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
