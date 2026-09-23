import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2, Plus, Pause, Play, Trash2, Users, LogOut, ShieldAlert, AlertTriangle, CreditCard, ShieldCheck, ShieldOff, ClipboardList, Mail, Phone, TrendingUp, Download, RefreshCw,
} from "lucide-react";
import type { Organisation, WaitlistRegistration, ValuationSubmission } from "@shared/schema";

type OrgWithStats = Organisation & {
  userCount: number;
  clientCount: number;
  isExempt: boolean;
  exemptionReason: string | null;
  isDemoOrg: boolean;
};

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded border bg-yellow-900/40 text-yellow-300 border-yellow-600 uppercase tracking-wide">
      DEMO
    </span>
  );
}

function StatusBadge({ org }: { org: OrgWithStats }) {
  if (org.isSuspended) return <Badge variant="destructive">Suspended</Badge>;
  const status = org.subscriptionStatus;
  if (status === 'active') return <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>;
  if (status === 'trialling') return <Badge className="bg-blue-100 text-blue-800 border-0">Trialling</Badge>;
  if (status === 'cancelled') return <Badge variant="outline" className="text-gray-500">Cancelled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const PLAN_BADGE_STYLES: Record<string, string> = {
  trialling: "bg-blue-900/40 text-blue-300 border-blue-700",
  starter: "bg-gray-800 text-gray-300 border-gray-600",
  growth: "bg-purple-900/40 text-purple-300 border-purple-700",
  scale: "bg-indigo-900/40 text-indigo-300 border-indigo-700",
  pro: "bg-amber-900/40 text-amber-300 border-amber-700",
  cancelled: "bg-red-900/40 text-red-300 border-red-700",
  past_due: "bg-orange-900/40 text-orange-300 border-orange-700",
};

const PLAN_LABELS: Record<string, string> = {
  trialling: "Trial",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  pro: "Pro",
  cancelled: "Cancelled",
  past_due: "Past Due",
};

function PlanBadge({ org }: { org: OrgWithStats }) {
  const plan = (org as any).subscriptionPlan || "trialling";
  const interval = (org as any).subscriptionInterval;
  const label = PLAN_LABELS[plan] || plan;
  const style = PLAN_BADGE_STYLES[plan] || PLAN_BADGE_STYLES.starter;
  const trialEndsAt = (org as any).trialEndsAt;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${style}`}>
        <CreditCard className="h-3 w-3" />
        {label}
        {interval && <span className="opacity-70">/{interval === "monthly" ? "mo" : "yr"}</span>}
      </span>
      {plan === "trialling" && daysLeft !== null && (
        <span className={`text-xs ${daysLeft <= 3 ? "text-red-400" : "text-gray-500"}`}>
          {daysLeft}d left
        </span>
      )}
    </div>
  );
}

function ExemptBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700">
      <ShieldCheck className="h-3 w-3" />
      Exempt
    </span>
  );
}

export default function PlatformAdminPage() {
  const { toast } = useToast();
  const { logoutMutation } = useAuth();
  const [newOrgName, setNewOrgName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrgWithStats | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [exemptTarget, setExemptTarget] = useState<OrgWithStats | null>(null);
  const [exemptReason, setExemptReason] = useState("");
  const [deleteRecord, setDeleteRecord] = useState<{ type: "waitlist" | "valuation"; id: number; label: string } | null>(null);

  const { data: orgs = [], isLoading } = useQuery<OrgWithStats[]>({
    queryKey: ["/api/platform-admin/organisations"],
  });

  const { data: valuations = [], isLoading: valuationsLoading } = useQuery<ValuationSubmission[]>({
    queryKey: ["/api/platform-admin/valuations"],
  });

  const { data: waitlist = [], isLoading: waitlistLoading } = useQuery<WaitlistRegistration[]>({
    queryKey: ["/api/platform-admin/waitlist"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/platform-admin/organisations", "POST", { name: newOrgName });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organisation created" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/organisations"] });
      setNewOrgName("");
      setCreateOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, isSuspended }: { id: number; isSuspended: boolean }) => {
      const res = await apiRequest(`/api/platform-admin/organisations/${id}/suspend`, "PATCH", { isSuspended });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_, { isSuspended }) => {
      toast({ title: isSuspended ? "Organisation suspended" : "Organisation reinstated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/organisations"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const exemptMutation = useMutation({
    mutationFn: async ({ id, isExempt, exemptionReason }: { id: number; isExempt: boolean; exemptionReason?: string }) => {
      const res = await apiRequest(`/api/platform-admin/organisations/${id}/exempt`, "PATCH", { isExempt, exemptionReason });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (_, { isExempt }) => {
      toast({ title: isExempt ? "Exemption granted" : "Exemption removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/organisations"] });
      setExemptTarget(null);
      setExemptReason("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/platform-admin/organisations/${id}`, "DELETE");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast({ title: "Organisation permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/organisations"] });
      setDeleteTarget(null);
      setDeleteConfirmText("");
    },
    onError: (e: Error) => toast({ title: "Deletion failed", description: e.message, variant: "destructive" }),
  });

  const deleteWaitlistMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/platform-admin/waitlist/${id}`, "DELETE");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast({ title: "Registration deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/waitlist"] });
      setDeleteRecord(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteValuationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/platform-admin/valuations/${id}`, "DELETE");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast({ title: "Submission deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/valuations"] });
      setDeleteRecord(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());

  async function regeneratePdf(id: number) {
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const res = await apiRequest(`/api/platform-admin/valuations/${id}/regenerate-pdf`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      const data = await res.json();
      toast({ title: "PDF regenerated", description: `Available at ${data.pdfUrl}` });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/valuations"] });
    } catch (e: any) {
      toast({ title: "Regeneration failed", description: e.message, variant: "destructive" });
    } finally {
      setRegeneratingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  const realOrgs = orgs.filter((o) => !(o as any).isDemoOrg);
  const totalOrgs = realOrgs.length;
  const activeOrgs = realOrgs.filter((o) => !o.isSuspended && o.subscriptionStatus !== 'cancelled').length;
  const totalUsers = realOrgs.reduce((sum, o) => sum + o.userCount, 0);
  const exemptOrgs = realOrgs.filter((o) => o.isExempt).length;
  const confirmNameMatches = deleteTarget && deleteConfirmText === deleteTarget.name;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900 rounded-lg">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Platform Administration</h1>
              <p className="text-xs text-gray-400">Superadmin · Practice Toolbox</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Organisations", value: totalOrgs, icon: Building2 },
            { label: "Active Organisations", value: activeOrgs, icon: Building2 },
            { label: "Total Users", value: totalUsers, icon: Users },
            { label: "Exempt Accounts", value: exemptOrgs, icon: ShieldCheck },
          ].map((stat) => (
            <Card key={stat.label} className="bg-gray-900 border-gray-800">
              <CardContent className="p-5">
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Organisations table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-white">Organisations</CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> New Organisation
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white">
                <DialogHeader>
                  <DialogTitle>Create Organisation</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Create a new organisation. You can set up their admin user separately.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="orgName" className="text-gray-300">Organisation Name</Label>
                  <Input
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g. Acme Accountants"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-gray-600 text-gray-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!newOrgName.trim() || createMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading organisations...</div>
            ) : orgs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No organisations yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Organisation</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Plan</TableHead>
                    <TableHead className="text-gray-400 text-center">Users</TableHead>
                    <TableHead className="text-gray-400 text-center">Clients</TableHead>
                    <TableHead className="text-gray-400">BK Platform</TableHead>
                    <TableHead className="text-gray-400">Created</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...orgs].sort((a, b) => ((b as any).isDemoOrg ? 1 : 0) - ((a as any).isDemoOrg ? 1 : 0)).map((org) => (
                    <TableRow
                      key={org.id}
                      className={`border-gray-800 transition-colors ${
                        (org as any).isDemoOrg
                          ? "bg-yellow-950/30 hover:bg-yellow-950/40 border-l-2 border-l-yellow-600"
                          : org.isExempt
                          ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                          : "hover:bg-gray-800/50"
                      }`}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-white">{org.name}</p>
                            {(org as any).isDemoOrg && <DemoBadge />}
                            {org.isExempt && <ExemptBadge />}
                          </div>
                          <p className="text-xs text-gray-500">{org.slug}</p>
                          {(org as any).isDemoOrg && (
                            <p className="text-xs text-yellow-600 italic">Demo organisation — excluded from benchmarks</p>
                          )}
                          {org.isExempt && org.exemptionReason && (
                            <p className="text-xs text-emerald-600 italic">{org.exemptionReason}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge org={org} />
                      </TableCell>
                      <TableCell>
                        <PlanBadge org={org} />
                      </TableCell>
                      <TableCell className="text-center text-gray-300">{org.userCount}</TableCell>
                      <TableCell className="text-center text-gray-300">{org.clientCount}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {org.bookkeepingPlatform === "Other"
                          ? (org.bookkeepingPlatformCustom || "Other")
                          : (org.bookkeepingPlatform || "Dext Precision")}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {new Date(org.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Exempt / Remove Exemption */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={org.isExempt
                              ? "text-emerald-400 hover:text-red-300 hover:bg-red-900/20"
                              : "text-gray-500 hover:text-emerald-300 hover:bg-emerald-900/20"}
                            onClick={() => {
                              if (org.isExempt) {
                                exemptMutation.mutate({ id: org.id, isExempt: false });
                              } else {
                                setExemptTarget(org);
                                setExemptReason(org.exemptionReason || "");
                              }
                            }}
                            disabled={exemptMutation.isPending}
                            title={org.isExempt ? "Remove exemption" : "Grant exemption"}
                          >
                            {org.isExempt ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                          </Button>

                          {/* Suspend / Reinstate */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={org.isSuspended ? "text-green-400 hover:text-green-300 hover:bg-green-900/30" : "text-amber-400 hover:text-amber-300 hover:bg-amber-900/30"}
                            onClick={() => suspendMutation.mutate({ id: org.id, isSuspended: !org.isSuspended })}
                            disabled={suspendMutation.isPending}
                            title={org.isSuspended ? "Reinstate" : "Suspend"}
                          >
                            {org.isSuspended ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          </Button>

                          {/* Delete */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            title="Delete organisation"
                            onClick={() => {
                              setDeleteTarget(org);
                              setDeleteConfirmText("");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Waitlist */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" />
              Waitlist Registrations
              <span className="ml-2 text-sm font-normal text-gray-400">({waitlist.length})</span>
            </CardTitle>
            {waitlist.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => {
                  const headers = ["First Name", "Last Name", "Firm Name", "Email", "Phone", "Practice Size", "Message", "Registered"];
                  const rows = waitlist.map((r) => [
                    r.firstName, r.lastName, r.firmName, r.email,
                    r.phone ?? "", r.practiceSize ?? "", (r.message ?? "").replace(/\n/g, " "),
                    r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "",
                  ]);
                  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "waitlist-registrations.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export CSV
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {waitlistLoading ? (
              <div className="text-center py-8 text-gray-500">Loading registrations...</div>
            ) : waitlist.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No registrations yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Name</TableHead>
                    <TableHead className="text-gray-400">Firm</TableHead>
                    <TableHead className="text-gray-400">Email</TableHead>
                    <TableHead className="text-gray-400">Phone</TableHead>
                    <TableHead className="text-gray-400">Practice Size</TableHead>
                    <TableHead className="text-gray-400">Notes</TableHead>
                    <TableHead className="text-gray-400">Registered</TableHead>
                    <TableHead className="text-gray-400 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlist.map((reg) => (
                    <TableRow key={reg.id} className="border-gray-800 hover:bg-gray-800/40">
                      <TableCell className="text-white font-medium">
                        {reg.firstName} {reg.lastName}
                      </TableCell>
                      <TableCell className="text-gray-300">{reg.firmName}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${reg.email}`}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          <Mail className="h-3.5 w-3.5" /> {reg.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {reg.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {reg.phone}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {reg.practiceSize ?? <span className="text-gray-600">—</span>}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm max-w-xs truncate">
                        {reg.message ?? <span className="text-gray-600">—</span>}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        }) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-600 hover:text-red-400 hover:bg-red-950/50"
                          onClick={() => setDeleteRecord({ type: "waitlist", id: reg.id, label: `${reg.firstName} ${reg.lastName} (${reg.email})` })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Valuation Tool Analytics */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Practice Valuation Calculator
              <span className="ml-2 text-sm font-normal text-gray-400">({valuations.length} submissions)</span>
            </CardTitle>
            {valuations.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => {
                  const headers = ["ID", "Type", "First Name", "Last Name", "Email", "Phone", "Firm", "GRF", "Clients", "EBITDA%", "Owner Dep.", "Team", "Niche", "Conservative", "Mid", "Optimistic", "Multiple", "Email Confirmed", "Confirmed Email", "PDF", "Date"];
                  const rows = valuations.map((v) => [
                    v.id, v.valuationType, v.firstName, v.lastName, v.email, v.phone ?? "",
                    v.firmName, v.grf, v.clientCount, v.ebitdaPercent,
                    v.ownerDependency, v.teamStructure, v.niche,
                    v.conservativeValuation, v.midValuation, v.optimisticValuation,
                    v.adjustedMultiple,
                    (v as any).emailConfirmed ? "Yes" : "No",
                    (v as any).confirmedEmail ?? "",
                    v.pdfUrl ?? "",
                    v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-GB") : "",
                  ]);
                  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "valuation-submissions.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Summary metrics */}
            {valuations.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total Submissions", value: valuations.length },
                  {
                    label: "PDF Generation Rate",
                    value: valuations.length > 0
                      ? `${Math.round((valuations.filter((v: any) => v.pdfUrl).length / valuations.length) * 100)}%`
                      : "—"
                  },
                  { label: "PDFs Generated", value: valuations.filter(v => v.pdfUrl).length },
                  {
                    label: "Avg Mid Valuation",
                    value: valuations.length > 0
                      ? `£${Math.round(valuations.reduce((sum, v) => sum + parseFloat(String(v.midValuation || 0)), 0) / valuations.length).toLocaleString("en-GB")}`
                      : "—"
                  },
                ].map(metric => (
                  <div key={metric.label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-white">{metric.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{metric.label}</p>
                  </div>
                ))}
              </div>
            )}

            {valuationsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading valuations...</div>
            ) : valuations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No valuation submissions yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Contact</TableHead>
                    <TableHead className="text-gray-400">Firm</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400">GRF</TableHead>
                    <TableHead className="text-gray-400">Mid Value</TableHead>
                    <TableHead className="text-gray-400">Multiple</TableHead>
                    <TableHead className="text-gray-400">PDF Generated</TableHead>
                    <TableHead className="text-gray-400">Alt Email</TableHead>
                    <TableHead className="text-gray-400">PDF</TableHead>
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valuations.map((v) => (
                    <TableRow key={v.id} className="border-gray-800 hover:bg-gray-800/40">
                      <TableCell>
                        <div className="text-white font-medium text-sm">{v.firstName} {v.lastName}</div>
                        <a href={`mailto:${v.email}`} className="text-blue-400 text-xs hover:text-blue-300">{v.email}</a>
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">{v.firmName}</TableCell>
                      <TableCell>
                        <Badge className={v.valuationType === 'own_practice' ? "bg-blue-900/50 text-blue-300 border-0 text-xs" : "bg-purple-900/50 text-purple-300 border-0 text-xs"}>
                          {v.valuationType === 'own_practice' ? 'Own' : 'Acquisition'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">£{parseFloat(String(v.grf)).toLocaleString("en-GB")}</TableCell>
                      <TableCell className="text-emerald-300 font-medium text-sm">£{Math.round(parseFloat(String(v.midValuation))).toLocaleString("en-GB")}</TableCell>
                      <TableCell className="text-gray-300 text-sm">{parseFloat(String(v.adjustedMultiple)).toFixed(2)}x</TableCell>
                      <TableCell>
                        {v.pdfUrl
                          ? <Badge className="bg-green-900/50 text-green-300 border-0 text-xs">Yes</Badge>
                          : <Badge className="bg-gray-800 text-gray-500 border-0 text-xs">No</Badge>}
                      </TableCell>
                      <TableCell className="text-gray-400 text-xs max-w-[140px] truncate">
                        {(v as any).confirmedEmail && (v as any).confirmedEmail !== v.email
                          ? <a href={`mailto:${(v as any).confirmedEmail}`} className="text-blue-400 hover:text-blue-300">{(v as any).confirmedEmail}</a>
                          : <span className="text-gray-600">—</span>}
                      </TableCell>
                      <TableCell>
                        {v.pdfUrl ? (
                          <a href={`https://app.practicetoolbox.co.uk${v.pdfUrl}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
                            <Download className="h-3 w-3" /> PDF
                          </a>
                        ) : (
                          <button
                            onClick={() => regeneratePdf(v.id)}
                            disabled={regeneratingIds.has(v.id)}
                            className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${regeneratingIds.has(v.id) ? "animate-spin" : ""}`} />
                            {regeneratingIds.has(v.id) ? "..." : "Regen"}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-600 hover:text-red-400 hover:bg-red-950/50"
                          onClick={() => setDeleteRecord({ type: "valuation", id: v.id, label: `${v.firstName} ${v.lastName} (${v.email})` })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant Exemption Dialog */}
      <Dialog open={!!exemptTarget} onOpenChange={(open) => { if (!open) { setExemptTarget(null); setExemptReason(""); } }}>
        <DialogContent className="bg-gray-900 border-emerald-900/50 text-white max-w-md">
          <div className="flex items-center gap-3 p-3 bg-emerald-950/50 border border-emerald-800/50 rounded-lg mb-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              Exempt organisations bypass all subscription checks, payment walls, trial expiry, and plan limits.
            </p>
          </div>
          <DialogHeader>
            <DialogTitle className="text-white">Grant Exemption</DialogTitle>
            <DialogDescription className="text-gray-400">
              Grant <span className="text-white font-medium">{exemptTarget?.name}</span> full unrestricted access.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <Label className="text-gray-300 text-sm">Exemption Reason <span className="text-gray-500">(optional)</span></Label>
              <Textarea
                value={exemptReason}
                onChange={(e) => setExemptReason(e.target.value)}
                placeholder="e.g. Internal — MBS, Beta partner, Freemans acquisition"
                className="mt-2 bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setExemptTarget(null); setExemptReason(""); }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => exemptTarget && exemptMutation.mutate({ id: exemptTarget.id, isExempt: true, exemptionReason: exemptReason || undefined })}
              disabled={exemptMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-600 text-white"
            >
              {exemptMutation.isPending ? "Granting..." : "Grant Exemption"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Record Dialog (waitlist / valuation) */}
      <Dialog open={!!deleteRecord} onOpenChange={(open) => { if (!open) setDeleteRecord(null); }}>
        <DialogContent className="bg-gray-900 border-red-900 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete {deleteRecord?.type === "waitlist" ? "registration" : "submission"}?
            </DialogTitle>
            <DialogDescription className="text-gray-400 pt-1">
              This will permanently delete the record for:
            </DialogDescription>
          </DialogHeader>
          {deleteRecord && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white">
              {deleteRecord.label}
            </div>
          )}
          <p className="text-xs text-gray-500">This action cannot be undone.</p>
          <DialogFooter className="gap-2 mt-1">
            <Button
              variant="outline"
              onClick={() => setDeleteRecord(null)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-700 hover:bg-red-600 text-white"
              disabled={deleteWaitlistMutation.isPending || deleteValuationMutation.isPending}
              onClick={() => {
                if (!deleteRecord) return;
                if (deleteRecord.type === "waitlist") deleteWaitlistMutation.mutate(deleteRecord.id);
                else deleteValuationMutation.mutate(deleteRecord.id);
              }}
            >
              {(deleteWaitlistMutation.isPending || deleteValuationMutation.isPending) ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}
      >
        <DialogContent className="bg-gray-900 border-red-900 text-white max-w-lg">
          <div className="flex items-center gap-3 p-4 bg-red-950 border border-red-800 rounded-lg mb-2">
            <div className="flex-shrink-0 p-2 bg-red-900 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="font-bold text-red-300 text-base">This action is permanent and cannot be undone</p>
              <p className="text-red-400 text-sm mt-0.5">All data for this organisation will be destroyed forever.</p>
            </div>
          </div>

          <DialogHeader>
            <DialogTitle className="text-white text-lg">Delete organisation?</DialogTitle>
            <DialogDescription className="text-gray-400 space-y-2 pt-1">
              <span className="block">You are about to permanently delete:</span>
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <span className="font-semibold text-white text-base">{deleteTarget.name}</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-400 pl-7">
                  <span>{deleteTarget.userCount} {deleteTarget.userCount === 1 ? "user" : "users"}</span>
                  <span>{deleteTarget.clientCount} {deleteTarget.clientCount === 1 ? "client record" : "client records"}</span>
                </div>
              </div>

              <div className="text-sm text-gray-400 space-y-1">
                <p className="font-medium text-gray-300">The following will be permanently deleted:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-2 text-gray-500">
                  <li>All users and their accounts</li>
                  <li>All teams and performance data</li>
                  <li>All client value records</li>
                  <li>All VAT, accounts, tax, and bookkeeping data</li>
                  <li>All AI analyses and reports</li>
                  <li>All settings and configurations</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">
                  To confirm, type <span className="font-mono font-bold text-white bg-gray-800 px-1.5 py-0.5 rounded">{deleteTarget.name}</span> below:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type the organisation name to confirm"
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-600 focus:border-red-500"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
              disabled={!confirmNameMatches || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
