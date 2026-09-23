import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, CheckCircle, RefreshCw, ChevronRight, Target } from "lucide-react";
import { Link } from "wouter";

const STEPS = [
  { number: 1, label: "Basic details" },
  { number: 2, label: "Client context" },
  { number: 3, label: "Review structure" },
  { number: 4, label: "Strategic plan" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            current === step.number
              ? "bg-teal-600 text-white"
              : current > step.number
              ? "bg-teal-100 text-teal-700"
              : "bg-gray-100 text-gray-400"
          }`}>
            {current > step.number ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <span className="w-4 h-4 flex items-center justify-center text-xs">{step.number}</span>
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-0.5 mx-1 ${current > step.number ? "bg-teal-300" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const step1Schema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  companyName: z.string().min(1, "Company name is required"),
  industry: z.string().min(1),
  reportFrequency: z.string().min(1),
});
type Step1Values = z.infer<typeof step1Schema>;

export default function NewReportClient() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientIndustry, setClientIndustry] = useState("sme_general");
  const [contextText, setContextText] = useState("");
  const [generatingStructure, setGeneratingStructure] = useState(false);
  const [structureGenerated, setStructureGenerated] = useState(false);
  const [rationale, setRationale] = useState<string | null>(null);

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      clientName: "",
      companyName: "",
      industry: "sme_general",
      reportFrequency: "monthly",
    },
  });

  // Step 1: Create client
  const createMutation = useMutation({
    mutationFn: async (values: Step1Values) => {
      const res = await apiRequest("/api/report-clients", "POST", values);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-clients"] });
      setClientId(client.id);
      setClientIndustry(client.industry);
      setStep(2);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Step 2: Generate structure
  async function handleGenerateStructure() {
    if (!clientId) return;
    setGeneratingStructure(true);
    try {
      const res = await apiRequest(`/api/report-clients/${clientId}/generate-structure`, "POST", {
        clientContext: contextText,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const data = await res.json();
      setRationale(data.rationale);
      setStructureGenerated(true);
      toast({ title: "Structure generated", description: "Review it in the next step" });
      setStep(3);
    } catch (e: any) {
      toast({ title: "Failed to generate structure", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingStructure(false);
    }
  }

  async function handleSaveContext() {
    if (!clientId) return;
    if (contextText) {
      await apiRequest(`/api/report-clients/${clientId}/context`, "PUT", { clientContext: contextText });
    }
    setStep(3);
  }

  function handleFinish() {
    navigate(`/management-reports/clients/${clientId}`);
  }

  function handleGoToStrategicPlan() {
    navigate(`/management-reports/clients/${clientId}/strategic-plan/edit`);
  }

  return (
    <div className="max-w-lg space-y-2">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/management-reports">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add Report Client</h1>
      </div>

      <StepIndicator current={step} />

      {/* STEP 1: Basic details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-4">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client name</FormLabel>
                    <FormControl><Input placeholder="e.g. Tim Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl><Input placeholder="e.g. Smith & Partners Ltd" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="industry" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="sme_general">SME General</SelectItem>
                        <SelectItem value="professional_services">Professional Services</SelectItem>
                        <SelectItem value="hospitality_retail">Hospitality & Retail</SelectItem>
                        <SelectItem value="property">Property</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reportFrequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="12_weekly">12-Weekly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 gap-2" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving…" : "Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Client context */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tell the AI about this client</CardTitle>
            <p className="text-sm text-gray-500 mt-1">This context shapes the report structure. More detail = better tailoring.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`e.g. ${clientIndustry === "professional_services" ? "Marketing agency, 8 staff, main issue is utilisation dropping in Q1, owner wants to step back from day-to-day" : clientIndustry === "hospitality_retail" ? "Seasonal hospitality business, main goal is £1m exit in 3-5 years, currently has significant debt, owner works too many hours" : "SME business, owner-managed, main goal is building a sustainable income and eventual exit"}`}
              className="min-h-[140px] text-sm"
              value={contextText}
              onChange={e => setContextText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateStructure}
                disabled={generatingStructure || !contextText.trim()}
                className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${generatingStructure ? "animate-spin" : ""}`} />
                {generatingStructure ? "Generating structure…" : "Generate Report Structure"}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => { handleSaveContext(); }}
              disabled={generatingStructure}
            >
              Skip — use industry defaults
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Review structure */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              Review Generated Structure
            </CardTitle>
            {rationale && (
              <p className="text-sm text-gray-500 mt-1">{rationale}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
              <p className="text-sm text-teal-800 font-medium mb-2">Structure generated successfully</p>
              <p className="text-xs text-teal-700">
                The AI has tailored the core questions and key metrics for this client.
                You can view the full structure, edit questions, and approve it from the client hub.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate(`/management-reports/clients/${clientId}/structure`)}
                className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
              >
                Review & Approve Structure
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep(4)}
              >
                Continue to strategic plan
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="ghost" className="w-full text-gray-500" onClick={handleFinish}>
                Finish setup — go to client hub
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 (skipped): No structure */}
      {step === 3 && !structureGenerated && (
        <></>
      )}

      {/* STEP 4: Strategic plan */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategic plan</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Would you like to add a strategic plan for this client now? The AI uses it to link recommendations to their goals.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleGoToStrategicPlan}
              className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            >
              Yes — add strategic plan now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full" onClick={handleFinish}>
              No — go to client hub
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
