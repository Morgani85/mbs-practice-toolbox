import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, User, Network, Clock, Sparkles, AlertTriangle, Lightbulb, MapPin,
  Plus, Trash2, ChevronDown, Save, Info
} from "lucide-react";

interface Profile {
  businessDescription?: string | null;
  ownerProfile?: string | null;
  keyRelationships?: Array<{ type: string; name: string; description: string; importance: string }> | null;
  historicalContext?: string | null;
  standingInstructions?: string | null;
  keyRisks?: Array<{ risk: string; likelihood: string; impact: string }> | null;
  keyOpportunities?: Array<{ opportunity: string; timeline: string; potential_impact: string }> | null;
  sectorNotes?: string | null;
}

const RELATIONSHIP_TYPES = [
  { value: "major_customer", label: "Major Customer", colour: "#3B82F6" },
  { value: "key_supplier", label: "Key Supplier", colour: "#F97316" },
  { value: "lender", label: "Lender", colour: "#EF4444" },
  { value: "key_employee", label: "Key Employee", colour: "#10B981" },
  { value: "investor", label: "Investor", colour: "#8B5CF6" },
];

const LEVELS = ["high", "medium", "low"] as const;

function ragColour(level: string) {
  return level === "high" ? "#EF4444" : level === "medium" ? "#F59E0B" : "#10B981";
}

function RelTypeBadge({ type }: { type: string }) {
  const t = RELATIONSHIP_TYPES.find(r => r.value === type) || RELATIONSHIP_TYPES[0];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: t.colour }}>
      {t.label}
    </span>
  );
}

function LevelBadge({ level, onClick }: { level: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white cursor-pointer hover:opacity-80"
      style={{ background: ragColour(level) }}
      title={onClick ? "Click to cycle" : undefined}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </button>
  );
}

function TextAreaField({
  label, value, onChange, placeholder, rows = 4, info
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; info?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">{label}</label>
      {info && (
        <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 mb-2">
          <Info className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-teal-800 leading-relaxed">{info}</p>
        </div>
      )}
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="resize-none text-sm"
      />
    </div>
  );
}

export function ClientProfileTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [dirty, setDirty] = useState(false);

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['/api/report-clients', clientId, 'profile'],
    queryFn: () => fetch(`/api/report-clients/${clientId}/profile`, { credentials: 'include' }).then(r => r.json()),
  });

  const [form, setForm] = useState<Profile>({});
  const [initialised, setInitialised] = useState(false);

  if (profile && !initialised) {
    setForm({
      businessDescription: profile.businessDescription || "",
      ownerProfile: profile.ownerProfile || "",
      keyRelationships: profile.keyRelationships || [],
      historicalContext: profile.historicalContext || "",
      standingInstructions: profile.standingInstructions || "",
      keyRisks: profile.keyRisks || [],
      keyOpportunities: profile.keyOpportunities || [],
      sectorNotes: profile.sectorNotes || "",
    });
    setInitialised(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: Profile) => apiRequest('PUT', `/api/report-clients/${clientId}/profile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/report-clients', clientId, 'profile'] });
      toast({ title: "Profile saved" });
      setDirty(false);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const update = useCallback((patch: Partial<Profile>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const cycleLevel = (arr: any[], index: number, field: string) => {
    const next = { high: "medium", medium: "low", low: "high" } as Record<string, string>;
    const updated = arr.map((item, i) => i === index ? { ...item, [field]: next[item[field]] || "medium" } : item);
    return updated;
  };

  if (isLoading) return <div className="py-8 text-center text-gray-400 text-sm">Loading profile...</div>;

  const rels = form.keyRelationships || [];
  const risks = form.keyRisks || [];
  const opps = form.keyOpportunities || [];

  return (
    <div className="space-y-6">
      {/* Save bar */}
      {dirty && (
        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <p className="text-sm text-teal-800 font-medium">You have unsaved changes</p>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      )}

      {/* Section 1 — Business Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-teal-600" /> Business Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TextAreaField
            label="Business Description"
            value={form.businessDescription || ""}
            onChange={v => update({ businessDescription: v })}
            placeholder="Describe what the business does, its model, who its customers are, and how it makes money"
            rows={4}
          />
          <TextAreaField
            label="Owner Profile"
            value={form.ownerProfile || ""}
            onChange={v => update({ ownerProfile: v })}
            placeholder="Describe the owner's personality, communication style, and risk appetite. e.g. 'Tim is ambitious but risk-averse. Prefers direct communication. Doesn't like jargon. Motivated by family/lifestyle goals more than money.'"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Section 2 — Key Relationships */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-teal-600" /> Key Relationships
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rels.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-36">Type</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-32">Name</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500">Description</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 w-24">Importance</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rels.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3">
                        <Select value={r.type} onValueChange={v => {
                          const updated = rels.map((rel, idx) => idx === i ? { ...rel, type: v } : rel);
                          update({ keyRelationships: updated });
                        }}>
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-fit">
                            <RelTypeBadge type={r.type} />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIP_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          value={r.name}
                          onChange={e => {
                            const updated = rels.map((rel, idx) => idx === i ? { ...rel, name: e.target.value } : rel);
                            update({ keyRelationships: updated });
                          }}
                          className="h-7 text-xs"
                          placeholder="Name"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          value={r.description}
                          onChange={e => {
                            const updated = rels.map((rel, idx) => idx === i ? { ...rel, description: e.target.value } : rel);
                            update({ keyRelationships: updated });
                          }}
                          className="h-7 text-xs"
                          placeholder="Description"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Select value={r.importance} onValueChange={v => {
                          const updated = rels.map((rel, idx) => idx === i ? { ...rel, importance: v } : rel);
                          update({ keyRelationships: updated });
                        }}>
                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-fit">
                            <LevelBadge level={r.importance} />
                          </SelectTrigger>
                          <SelectContent>
                            {LEVELS.map(l => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => update({ keyRelationships: rels.filter((_, idx) => idx !== i) })}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => update({ keyRelationships: [...rels, { type: "major_customer", name: "", description: "", importance: "medium" }] })}
          >
            <Plus className="h-3.5 w-3.5" /> Add Relationship
          </Button>
        </CardContent>
      </Card>

      {/* Section 3 — Historical Context */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" /> Historical Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TextAreaField
            label="Important events that provide context for the numbers"
            value={form.historicalContext || ""}
            onChange={v => update({ historicalContext: v })}
            placeholder="e.g. 'January 2026: took on £130k debt across 5 facilities to fund fit-out and equipment. July 2025: lost largest wholesale customer (20% revenue). March 2026: first month of 12-weekly MI reporting.'"
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Section 4 — Standing AI Instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" /> Standing AI Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TextAreaField
            label="Permanent instructions passed to the AI every time a report is generated"
            value={form.standingInstructions || ""}
            onChange={v => update({ standingInstructions: v })}
            placeholder="e.g. Always compare to same period last year. Focus on cash and debt reduction above all else. Owner wants plain English — avoid accounting jargon. Always call out labour costs as % of revenue. Exit goal is £1m by 2029 — reference this in every report."
            rows={5}
            info="These instructions are passed to the AI every time a report is generated. Use this to shape the report's tone, focus, and approach permanently."
          />
        </CardContent>
      </Card>

      {/* Section 5 — Key Risks & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={r.risk}
                    onChange={e => {
                      const updated = risks.map((item, idx) => idx === i ? { ...item, risk: e.target.value } : item);
                      update({ keyRisks: updated });
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="Describe the risk"
                  />
                  <button
                    type="button"
                    onClick={() => update({ keyRisks: risks.filter((_, idx) => idx !== i) })}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Likelihood:</span>
                  <LevelBadge level={r.likelihood} onClick={() => {
                    update({ keyRisks: cycleLevel(risks, i, "likelihood") });
                  }} />
                  <span className="text-xs text-gray-500 ml-2">Impact:</span>
                  <LevelBadge level={r.impact} onClick={() => {
                    update({ keyRisks: cycleLevel(risks, i, "impact") });
                  }} />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs w-full"
              onClick={() => update({ keyRisks: [...risks, { risk: "", likelihood: "medium", impact: "medium" }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Risk
            </Button>
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-green-500" /> Key Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {opps.map((o, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={o.opportunity}
                    onChange={e => {
                      const updated = opps.map((item, idx) => idx === i ? { ...item, opportunity: e.target.value } : item);
                      update({ keyOpportunities: updated });
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="Describe the opportunity"
                  />
                  <button
                    type="button"
                    onClick={() => update({ keyOpportunities: opps.filter((_, idx) => idx !== i) })}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={o.timeline}
                    onChange={e => {
                      const updated = opps.map((item, idx) => idx === i ? { ...item, timeline: e.target.value } : item);
                      update({ keyOpportunities: updated });
                    }}
                    className="h-7 text-xs"
                    placeholder="Timeline (e.g. Q2 2026)"
                  />
                  <Input
                    value={o.potential_impact}
                    onChange={e => {
                      const updated = opps.map((item, idx) => idx === i ? { ...item, potential_impact: e.target.value } : item);
                      update({ keyOpportunities: updated });
                    }}
                    className="h-7 text-xs"
                    placeholder="Potential impact"
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs w-full"
              onClick={() => update({ keyOpportunities: [...opps, { opportunity: "", timeline: "", potential_impact: "" }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Opportunity
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Section 6 — Sector Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600" /> Sector Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TextAreaField
            label="Industry-specific context for the AI"
            value={form.sectorNotes || ""}
            onChange={v => update({ sectorNotes: v })}
            placeholder="e.g. 'Hospitality sector — seasonal peaks in summer. Shellfish prices volatile — check CoS% monthly. Local competition increasing in 2026.'"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end">
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending || !dirty}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
