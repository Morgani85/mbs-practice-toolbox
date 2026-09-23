import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle, RefreshCw, Target, Zap, ChevronRight, Edit3, X } from "lucide-react";
import type { ReportClient, ReportStructure } from "@shared/schema";

function ImportanceBadge({ importance }: { importance: string }) {
  if (importance === "critical") return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Critical</Badge>;
  if (importance === "high") return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">High</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Medium</Badge>;
}

export default function StructureApproval() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [rationale, setRationale] = useState<string | null>(null);
  const [contextInput, setContextInput] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const { data: client } = useQuery<ReportClient>({
    queryKey: ["/api/report-clients", id],
    queryFn: () => fetch(`/api/report-clients/${id}`).then(r => r.json()),
  });

  const { data: structure, isLoading } = useQuery<ReportStructure | null>({
    queryKey: ["/api/report-clients", id, "structure"],
    queryFn: () => fetch(`/api/report-clients/${id}/structure`).then(r => r.json()),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: async (ctx: string) => {
      setGenerating(true);
      const res = await apiRequest(`/api/report-clients/${id}/generate-structure`, "POST", { clientContext: ctx || undefined });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data) => {
      setRationale(data.rationale);
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id, "structure"] });
      toast({ title: "Structure generated", description: "Review below and approve when ready" });
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
    onSettled: () => setGenerating(false),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/report-clients/${id}/structure/approve`, "POST");
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id, "structure"] });
      toast({ title: "Structure approved", description: "AI reports will now use this structure" });
      navigate(`/management-reports/clients/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(`/api/report-clients/${id}/structure`, "PUT", data);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id, "structure"] });
    },
  });

  function saveQuestionEdit(questionNumber: number) {
    if (!structure) return;
    const updated = (structure.coreQuestions as any[]).map(q =>
      q.number === questionNumber ? { ...q, question: editText } : q
    );
    updateMutation.mutate({ coreQuestions: updated });
    setEditingQuestion(null);
  }

  const isApproved = structure?.status === "approved";

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/management-reports/clients/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Report Structure</h1>
          {client && <p className="text-sm text-gray-500">{client.clientName} · {client.companyName}</p>}
        </div>
        {isApproved && (
          <Badge className="ml-auto bg-teal-100 text-teal-700 border-0 gap-1">
            <CheckCircle className="h-3 w-3" /> Approved
          </Badge>
        )}
      </div>

      {!structure && (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-10 text-center space-y-4">
            <Target className="h-10 w-10 text-gray-300 mx-auto" />
            <div>
              <p className="font-medium text-gray-700">No structure yet</p>
              <p className="text-sm text-gray-500 mt-1">Add context about this client and generate a tailored report structure</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate / Regenerate Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-700">
            {structure ? "Regenerate Structure" : "Generate Structure"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Tell the AI what matters for this client — e.g. seasonal hospitality business, main goal is £1m exit in 3-5 years, currently has significant debt that needs managing down, owner works too many hours..."
            className="min-h-[100px] text-sm"
            value={contextInput || (client as any)?.clientContext || ""}
            onChange={e => setContextInput(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => generateMutation.mutate(contextInput)}
              disabled={generating}
              className="bg-teal-600 hover:bg-teal-700 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Generating…" : structure ? "Regenerate" : "Generate Structure"}
            </Button>
            {!structure && (
              <Button variant="ghost" asChild>
                <Link href={`/management-reports/clients/${id}`}>Skip for now</Link>
              </Button>
            )}
          </div>
          {rationale && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800 border border-blue-100">
              <span className="font-medium">AI rationale: </span>{rationale}
            </div>
          )}
        </CardContent>
      </Card>

      {structure && (
        <>
          {/* Core Questions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Zap className="h-4 w-4 text-teal-600" />
                Core Questions
                <span className="text-xs text-gray-400 font-normal ml-1">These drive the AI's analysis each period</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {((structure.coreQuestions as any[]) || []).map((q: any) => (
                <div key={q.number} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {q.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingQuestion === q.number ? (
                      <div className="flex gap-2">
                        <Input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="text-sm"
                          onKeyDown={e => { if (e.key === "Enter") saveQuestionEdit(q.number); if (e.key === "Escape") setEditingQuestion(null); }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => saveQuestionEdit(q.number)} className="bg-teal-600 hover:bg-teal-700">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-gray-800">{q.question}</p>
                        {!isApproved && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                            onClick={() => { setEditingQuestion(q.number); setEditText(q.question); }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    {q.focus && <p className="text-xs text-gray-500 mt-1">{q.focus}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                Key Metrics & Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {((structure.keyMetrics as any[]) || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.label}</p>
                      <p className="text-xs text-gray-500">Target: {m.target}</p>
                    </div>
                    <ImportanceBadge importance={m.importance} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Focus Areas */}
          {((structure.focusAreas as string[]) || []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">Focus Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(structure.focusAreas as string[]).map((f, i) => (
                    <Badge key={i} variant="outline" className="text-gray-600">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approve / Status */}
          <div className="flex items-center gap-3">
            {isApproved ? (
              <div className="flex items-center gap-2 text-teal-700 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Structure approved — AI will use this for all future reports</span>
              </div>
            ) : (
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {approveMutation.isPending ? "Approving…" : "Approve Structure"}
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href={`/management-reports/clients/${id}`}>
                {isApproved ? "Back to client" : "Skip for now"} <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
