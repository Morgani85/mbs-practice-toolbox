import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import type { StrategicPlan } from "@shared/schema";

type FormValues = {
  clientName: string;
  companyName: string;
  coachName: string;
  planDate: string;
  longTermGoals: { goal: string; currentPosition: string }[];
  quickWins: { value: string }[];
  smartActions: { action: string; specific: string; measurable: string; attainable: string; realistic: string; timeBound: string; targetDate: string }[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  sessionSummaryClient: string[];
  sessionSummaryCoach: string[];
};

export default function StrategicPlanEdit() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: client } = useQuery<any>({
    queryKey: ["/api/report-clients", id],
    queryFn: () => fetch(`/api/report-clients/${id}`).then(r => r.json()),
  });

  const { data: plan } = useQuery<StrategicPlan | null>({
    queryKey: ["/api/report-clients", id, "strategic-plan"],
    queryFn: () => fetch(`/api/report-clients/${id}/strategic-plan`).then(r => r.json()),
    enabled: !!id,
  });

  const form = useForm<FormValues>({
    defaultValues: {
      clientName: "", companyName: "", coachName: "", planDate: "",
      longTermGoals: [{ goal: "", currentPosition: "" }],
      quickWins: [{ value: "" }],
      smartActions: [{ action: "", specific: "", measurable: "", attainable: "", realistic: "", timeBound: "", targetDate: "" }],
      swot: { strengths: [""], weaknesses: [""], opportunities: [""], threats: [""] },
      sessionSummaryClient: ["", "", ""],
      sessionSummaryCoach: ["", "", ""],
    },
  });

  const { fields: goalFields, append: addGoal, remove: removeGoal } = useFieldArray({ control: form.control, name: "longTermGoals" });
  const { fields: quickWinFields, append: addQuickWin, remove: removeQuickWin } = useFieldArray({ control: form.control, name: "quickWins" });
  const { fields: actionFields, append: addAction, remove: removeAction } = useFieldArray({ control: form.control, name: "smartActions" });

  useEffect(() => {
    if (plan) {
      form.reset({
        clientName: plan.clientName || client?.clientName || "",
        companyName: plan.companyName || client?.companyName || "",
        coachName: plan.coachName || "",
        planDate: plan.planDate || "",
        longTermGoals: (plan.longTermGoals as any[])?.length ? plan.longTermGoals as any : [{ goal: "", currentPosition: "" }],
        quickWins: (plan.quickWins as string[])?.length ? (plan.quickWins as string[]).map(v => ({ value: v })) : [{ value: "" }],
        smartActions: (plan.smartActions as any[])?.length ? plan.smartActions as any : [{ action: "", specific: "", measurable: "", attainable: "", realistic: "", timeBound: "", targetDate: "" }],
        swot: (plan.swot as any) || { strengths: [""], weaknesses: [""], opportunities: [""], threats: [""] },
        sessionSummaryClient: (plan.sessionSummaryClient as string[])?.length === 3 ? plan.sessionSummaryClient as string[] : ["", "", ""],
        sessionSummaryCoach: (plan.sessionSummaryCoach as string[])?.length === 3 ? plan.sessionSummaryCoach as string[] : ["", "", ""],
      });
    } else if (client) {
      form.setValue("clientName", client.clientName || "");
      form.setValue("companyName", client.companyName || "");
    }
  }, [plan, client]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        quickWins: values.quickWins.map(w => w.value).filter(Boolean),
      };
      const res = await apiRequest(`/api/report-clients/${id}/strategic-plan`, "POST", payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients", id, "strategic-plan"] });
      toast({ title: "Strategic plan saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const swotKeys = ["strengths", "weaknesses", "opportunities", "threats"] as const;
  const swotColours = { strengths: "border-green-200 bg-green-50", weaknesses: "border-red-200 bg-red-50", opportunities: "border-blue-200 bg-blue-50", threats: "border-amber-200 bg-amber-50" };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/management-reports/clients/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Strategic Plan</h1>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={form.handleSubmit(v => saveMutation.mutate(v))} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save plan"}
        </Button>
      </div>

      {/* Header section */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Session header</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 mb-1 block">Client name</label>
            <Input {...form.register("clientName")} placeholder="Client name" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Company name</label>
            <Input {...form.register("companyName")} placeholder="Company name" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Coach name</label>
            <Input {...form.register("coachName")} placeholder="Coach / accountant name" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Session date</label>
            <Input {...form.register("planDate")} type="date" /></div>
        </CardContent>
      </Card>

      {/* Long-term goals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Long-term Goals</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => addGoal({ goal: "", currentPosition: "" })}>
            <Plus className="h-3 w-3" /> Add goal
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-500 px-2">
            <span>Goal</span><span>Current position</span>
          </div>
          {goalFields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-2 gap-2 items-start">
              <Input {...form.register(`longTermGoals.${idx}.goal`)} placeholder="Long-term goal" />
              <div className="flex gap-2">
                <Input {...form.register(`longTermGoals.${idx}.currentPosition`)} placeholder="Where they are now" />
                {goalFields.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-gray-400 hover:text-red-400 shrink-0" onClick={() => removeGoal(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick wins */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Quick Wins</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => addQuickWin({ value: "" })}>
            <Plus className="h-3 w-3" /> Add win
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {quickWinFields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <Input {...form.register(`quickWins.${idx}.value`)} placeholder={`Quick win ${idx + 1}`} />
              {quickWinFields.length > 1 && (
                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-gray-400 hover:text-red-400 shrink-0" onClick={() => removeQuickWin(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SMART Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">SMART Actions</CardTitle>
          <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => addAction({ action: "", specific: "", measurable: "", attainable: "", realistic: "", timeBound: "", targetDate: "" })}>
            <Plus className="h-3 w-3" /> Add action
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {actionFields.map((field, idx) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Action {idx + 1}</span>
                {actionFields.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-400" onClick={() => removeAction(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Input {...form.register(`smartActions.${idx}.action`)} placeholder="Action headline" />
              <div className="grid grid-cols-2 gap-3">
                {(["specific", "measurable", "attainable", "realistic", "timeBound"] as const).map(key => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block capitalize">{key === "timeBound" ? "Time-bound" : key}</label>
                    <Input {...form.register(`smartActions.${idx}.${key}`)} placeholder={`${key === "timeBound" ? "Time-bound" : key} detail`} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Target date</label>
                  <Input {...form.register(`smartActions.${idx}.targetDate`)} type="date" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SWOT */}
      <Card>
        <CardHeader><CardTitle className="text-sm">SWOT Analysis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {swotKeys.map(key => (
              <div key={key} className={`p-3 rounded-lg border ${swotColours[key]}`}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2">{key}</p>
                <Textarea
                  className="bg-white min-h-[80px] text-sm"
                  placeholder={`One per line`}
                  value={((form.watch(`swot.${key}`) as string[]) || []).join("\n")}
                  onChange={e => form.setValue(`swot.${key}`, e.target.value.split("\n"))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session summary */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Session Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Client takeaways (3)</p>
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <Input key={i} {...form.register(`sessionSummaryClient.${i}`)} placeholder={`Takeaway ${i + 1}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Coach observations (3)</p>
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <Input key={i} {...form.register(`sessionSummaryCoach.${i}`)} placeholder={`Observation ${i + 1}`} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full bg-teal-600 hover:bg-teal-700 gap-2" onClick={form.handleSubmit(v => saveMutation.mutate(v))} disabled={saveMutation.isPending}>
        <Save className="h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save strategic plan"}
      </Button>
    </div>
  );
}
