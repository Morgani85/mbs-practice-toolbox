import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Download, RefreshCw, Search, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { ValuationSubmission } from "@shared/schema";

export default function ValuationSubmissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());

  const { data: valuations = [], isLoading } = useQuery<ValuationSubmission[]>({
    queryKey: ["/api/platform-admin/valuations"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/platform-admin/valuations/${id}`, "DELETE");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      toast({ title: "Submission deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/valuations"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function regeneratePdf(id: number) {
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const res = await apiRequest(`/api/platform-admin/valuations/${id}/regenerate-pdf`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
      toast({ title: "PDF regenerated" });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/valuations"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setRegeneratingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function exportCsv() {
    const headers = ["ID", "Type", "First Name", "Last Name", "Email", "Phone", "Firm", "GRF", "Clients", "EBITDA%", "Conservative", "Mid", "Optimistic", "Multiple", "Email Confirmed", "Confirmed Email", "PDF URL", "Date"];
    const rows = filtered.map(v => [
      v.id, v.valuationType, v.firstName, v.lastName, v.email, v.phone ?? "",
      v.firmName, v.grf, v.clientCount, v.ebitdaPercent,
      v.conservativeValuation, v.midValuation, v.optimisticValuation, v.adjustedMultiple,
      (v as any).emailConfirmed ? "Yes" : "No",
      (v as any).confirmedEmail ?? "",
      v.pdfUrl ?? "",
      v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-GB") : "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "valuation-submissions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = valuations.filter(v => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.firstName?.toLowerCase().includes(q) ||
      v.lastName?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.firmName?.toLowerCase().includes(q)
    );
  });

  const totalSubmissions = valuations.length;
  const pdfGenerated = valuations.filter(v => v.pdfUrl).length;
  const avgMid = valuations.length > 0
    ? Math.round(valuations.reduce((s, v) => s + parseFloat(String(v.midValuation || 0)), 0) / valuations.length)
    : 0;
  const ownPractice = valuations.filter(v => v.valuationType === "own_practice").length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/platform-admin">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-1" /> Platform Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Valuation Submissions</h1>
              <p className="text-sm text-gray-400">Practice Valuation Calculator — all submissions</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={exportCsv}
            disabled={valuations.length === 0}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Submissions", value: totalSubmissions },
            { label: "Own Practice", value: ownPractice },
            { label: "PDFs Generated", value: `${pdfGenerated} (${totalSubmissions > 0 ? Math.round((pdfGenerated / totalSubmissions) * 100) : 0}%)` },
            { label: "Avg Mid Valuation", value: avgMid > 0 ? `£${avgMid.toLocaleString("en-GB")}` : "—" },
          ].map(m => (
            <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{m.value}</p>
              <p className="text-xs text-gray-400 mt-1">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            placeholder="Search by name, email or firm…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-500">Loading submissions…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {search ? "No submissions match your search." : "No submissions yet."}
          </div>
        ) : (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent bg-gray-900/50">
                  <TableHead className="text-gray-400">Contact</TableHead>
                  <TableHead className="text-gray-400">Firm</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">GRF</TableHead>
                  <TableHead className="text-gray-400">Mid Value</TableHead>
                  <TableHead className="text-gray-400">Multiple</TableHead>
                  <TableHead className="text-gray-400">Alt Email</TableHead>
                  <TableHead className="text-gray-400">PDF</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id} className="border-gray-800 hover:bg-gray-800/40">
                    <TableCell>
                      <div className="text-white font-medium text-sm">{v.firstName} {v.lastName}</div>
                      <a href={`mailto:${v.email}`} className="text-blue-400 text-xs hover:text-blue-300">{v.email}</a>
                      {v.phone && <div className="text-gray-500 text-xs">{v.phone}</div>}
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">{v.firmName}</TableCell>
                    <TableCell>
                      <Badge className={v.valuationType === "own_practice"
                        ? "bg-blue-900/50 text-blue-300 border-0 text-xs"
                        : "bg-purple-900/50 text-purple-300 border-0 text-xs"}>
                        {v.valuationType === "own_practice" ? "Own" : "Acquisition"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">
                      £{parseFloat(String(v.grf)).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell className="text-emerald-300 font-medium text-sm">
                      £{Math.round(parseFloat(String(v.midValuation))).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">
                      {parseFloat(String(v.adjustedMultiple)).toFixed(2)}x
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs max-w-[140px] truncate">
                      {(v as any).confirmedEmail && (v as any).confirmedEmail !== v.email
                        ? <a href={`mailto:${(v as any).confirmedEmail}`} className="text-blue-400 hover:text-blue-300">{(v as any).confirmedEmail}</a>
                        : <span className="text-gray-600">—</span>}
                    </TableCell>
                    <TableCell>
                      {v.pdfUrl ? (
                        <a
                          href={`https://app.practicetoolbox.co.uk${v.pdfUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </a>
                      ) : (
                        <button
                          onClick={() => regeneratePdf(v.id)}
                          disabled={regeneratingIds.has(v.id)}
                          className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${regeneratingIds.has(v.id) ? "animate-spin" : ""}`} />
                          {regeneratingIds.has(v.id) ? "…" : "Regen"}
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
                        onClick={() => setDeleteTarget({ id: v.id, label: `${v.firstName} ${v.lastName} (${v.email})` })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-gray-600 text-right">
          Showing {filtered.length} of {totalSubmissions} submissions
        </p>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete submission?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete the submission from <span className="text-white">{deleteTarget?.label}</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
