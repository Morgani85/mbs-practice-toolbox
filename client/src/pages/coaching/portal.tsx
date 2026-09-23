import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, Target, CalendarDays, FileText, LogOut, User, ChevronDown, ChevronRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/use-auth";

const OBJECTIVE_STATUSES: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700" },
  making_a_start: { label: "Making a Start", color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  halfway: { label: "Halfway", color: "bg-indigo-100 text-indigo-700" },
  mostly_there: { label: "Mostly There", color: "bg-purple-100 text-purple-700" },
  last_little_bit: { label: "Last Little Bit", color: "bg-orange-100 text-orange-700" },
  done: { label: "Done", color: "bg-green-100 text-green-700" },
};

const HORIZON_LABELS: Record<string, string> = {
  "5year": "5-Year Vision",
  "3year": "3-Year Goals",
  "1year": "1-Year Targets",
};

type CoachingClient = { id: number; name: string; companyName?: string };
type SessionNote = { id: number; noteDate: string; title: string; body: string };
type CoachingSession = {
  id: number; sessionDate: string; status: string;
  clientSummary?: string; clientSummaryShared: boolean;
};
type PortalAction = {
  id: number; description: string; owner: string; deadline?: string;
  status: string; updatedAt: string;
};
type StrategicGoal = {
  id: number; horizon: string; specific: string; measurable: string;
  achievable: string; relevant: string; timeBound: string; targetDate?: string;
};
type QuarterlyObjective = {
  id: number; quarter: number; year: number; objective: string; status: string;
};

export default function CoachingPortal() {
  const { user, logoutMutation } = useAuth();

  const { data: clients = [], isLoading } = useQuery<CoachingClient[]>({
    queryKey: ["/api/coaching/clients"],
  });

  const client = clients[0];

  const { data: notes = [] } = useQuery<SessionNote[]>({
    queryKey: ["/api/coaching/clients", client?.id, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${client!.id}/notes`);
      return res.json();
    },
    enabled: !!client,
  });

  const { data: goals = [] } = useQuery<StrategicGoal[]>({
    queryKey: ["/api/coaching/clients", client?.id, "strategic-goals"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${client!.id}/strategic-goals`);
      return res.json();
    },
    enabled: !!client,
  });

  const { data: objectives = [] } = useQuery<QuarterlyObjective[]>({
    queryKey: ["/api/coaching/clients", client?.id, "objectives"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${client!.id}/objectives`);
      return res.json();
    },
    enabled: !!client,
  });

  const { data: sessions = [] } = useQuery<CoachingSession[]>({
    queryKey: ["/api/coaching/clients", client?.id, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${client!.id}/sessions`);
      return res.json();
    },
    enabled: !!client,
  });

  const { data: actions = [] } = useQuery<PortalAction[]>({
    queryKey: ["/api/coaching/clients", client?.id, "actions"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${client!.id}/actions`);
      return res.json();
    },
    enabled: !!client,
  });

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "My Portal"
    : "My Portal";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal portal header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-gray-900">Coaching Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4 text-gray-400" />
            <span className="hidden sm:inline">{displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        ) : !client ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">Your coaching portal is being set up</p>
              <p className="text-sm mt-1">Please check back soon, or contact your coach</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Welcome */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              {client.companyName && <p className="text-sm text-gray-500">{client.companyName}</p>}
            </div>

            {/* Full read-only tabs — mirrors staff client-hub */}
            <Tabs defaultValue="actions">
              <TabsList className="grid grid-cols-5 w-full max-w-xl mb-4">
                <TabsTrigger value="actions" className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  My Actions
                </TabsTrigger>
                <TabsTrigger value="sessions" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Sessions
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="strategy" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Strategy
                </TabsTrigger>
                <TabsTrigger value="objectives" className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Objectives
                </TabsTrigger>
              </TabsList>

              {/* ── My Actions tab ─────────────────────────── */}
              <TabsContent value="actions">
                <PortalActionsTab actions={actions} />
              </TabsContent>

              {/* ── Sessions tab ───────────────────────────── */}
              <TabsContent value="sessions">
                <PortalSessionsTab sessions={sessions} />
              </TabsContent>

              {/* ── Notes tab ──────────────────────────────── */}
              <TabsContent value="notes">
                <PortalNotesTab notes={notes} />
              </TabsContent>

              {/* ── Strategy tab ───────────────────────────── */}
              <TabsContent value="strategy">
                <PortalStrategyTab goals={goals} />
              </TabsContent>

              {/* ── Objectives tab ─────────────────────────── */}
              <TabsContent value="objectives">
                <PortalObjectivesTab objectives={objectives} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

// ── Portal Tabs (read-only) ───────────────────────────────────────────────────

function getDaysOverdue(deadline: string): number {
  const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  if (londonToday <= deadline) return 0;
  return Math.floor(
    (new Date(londonToday + 'T00:00:00').getTime() - new Date(deadline + 'T00:00:00').getTime()) / 86_400_000,
  );
}

function formatActionDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PortalActionsTab({ actions }: { actions: PortalAction[] }) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

  const open = [...actions]
    .filter((a) => a.status === 'open')
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  const recentDone = [...actions]
    .filter((a) => a.status === 'done' && new Date(a.updatedAt) >= ninetyDaysAgo)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (open.length === 0 && recentDone.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-400 text-sm">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          No actions recorded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Open actions */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          Open ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="text-sm text-gray-400 italic pl-1">All caught up — no open actions.</p>
        ) : (
          <div className="space-y-2">
            {open.map((action) => {
              const overdue = action.deadline ? getDaysOverdue(action.deadline) : 0;
              return (
                <div key={action.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  overdue > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 break-words">{action.description}</p>
                    {action.deadline && (
                      <p className={`text-xs mt-1 ${overdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        Due {formatActionDate(action.deadline)}
                        {overdue > 0 && ` — ${overdue} day${overdue !== 1 ? 's' : ''} overdue`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently completed */}
      {recentDone.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            Recently Completed ({recentDone.length})
          </h3>
          <div className="space-y-2">
            {recentDone.map((action) => (
              <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-through break-words">{action.description}</p>
                  {action.deadline && (
                    <p className="text-xs text-gray-400 mt-0.5">Due {formatActionDate(action.deadline)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortalSessionsTab({ sessions }: { sessions: CoachingSession[] }) {
  const shared = [...sessions]
    .filter((s) => s.clientSummaryShared)
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  if (shared.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-400 text-sm">
          <Clock className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          No session summaries shared yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {shared.map((session) => (
        <Card key={session.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-800">
                {formatDate(session.sessionDate)}
              </CardTitle>
              <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">
                Closed
              </Badge>
            </div>
          </CardHeader>
          {session.clientSummary && (
            <CardContent className="pt-0">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {session.clientSummary}
              </p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function PortalNotesTab({ notes }: { notes: SessionNote[] }) {
  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-400 text-sm">
          <FileText className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          No session notes yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-gray-900">{note.title}</p>
              <span className="text-xs text-gray-400">
                {new Date(note.noteDate).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
            {note.body && (
              <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{note.body}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PortalStrategyTab({ goals }: { goals: StrategicGoal[] }) {
  const [openHorizons, setOpenHorizons] = useState<Set<string>>(new Set(["5year", "3year", "1year"]));

  const toggle = (h: string) => {
    setOpenHorizons((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h); else next.add(h);
      return next;
    });
  };

  const goalsByHorizon: Record<string, StrategicGoal[]> = {};
  for (const g of goals) {
    if (!goalsByHorizon[g.horizon]) goalsByHorizon[g.horizon] = [];
    goalsByHorizon[g.horizon].push(g);
  }

  const HORIZONS = [
    { value: "5year", label: "5-Year Vision" },
    { value: "3year", label: "3-Year Goals" },
    { value: "1year", label: "1-Year Targets" },
  ];

  return (
    <div className="space-y-3">
      {HORIZONS.map(({ value, label }) => {
        const hGoals = goalsByHorizon[value] || [];
        const isOpen = openHorizons.has(value);
        return (
          <Collapsible key={value} open={isOpen} onOpenChange={() => toggle(value)}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                  <span className="font-semibold text-sm text-gray-700">{label}</span>
                  <Badge variant="secondary" className="text-xs">{hGoals.length}</Badge>
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 pl-2">
                {hGoals.length === 0 ? (
                  <p className="text-sm text-gray-400 italic px-2 py-3">No {label.toLowerCase()} goals set yet.</p>
                ) : (
                  hGoals.map((goal) => (
                    <Card key={goal.id}>
                      <CardContent className="py-4">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          {goal.specific && <SmartField label="Specific" value={goal.specific} />}
                          {goal.measurable && <SmartField label="Measurable" value={goal.measurable} />}
                          {goal.achievable && <SmartField label="Achievable" value={goal.achievable} />}
                          {goal.relevant && <SmartField label="Relevant" value={goal.relevant} />}
                          {goal.timeBound && <SmartField label="Time-bound" value={goal.timeBound} />}
                          {goal.targetDate && (
                            <SmartField label="Target Date" value={new Date(goal.targetDate).toLocaleDateString("en-GB")} />
                          )}
                        </dl>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function PortalObjectivesTab({ objectives }: { objectives: QuarterlyObjective[] }) {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  if (objectives.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-400 text-sm">
          <Target className="h-10 w-10 mx-auto mb-2 text-gray-200" />
          No objectives set yet.
        </CardContent>
      </Card>
    );
  }

  // Group by year+quarter, sorted newest first
  const groups: Map<string, QuarterlyObjective[]> = new Map();
  for (const obj of objectives) {
    const key = `${obj.year}-${obj.quarter}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(obj);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  const overallDone = objectives.filter((o) => o.status === "done").length;

  return (
    <div className="space-y-5">
      {/* History header — full record across every quarter, not just the current one */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Objective History</h2>
        <p className="text-sm text-gray-500">
          {sortedKeys.length} quarter{sortedKeys.length !== 1 ? "s" : ""} tracked · {overallDone} of {objectives.length} objectives completed overall
        </p>
      </div>
      {sortedKeys.map((key) => {
        const [yearStr, qStr] = key.split("-");
        const year = parseInt(yearStr);
        const q = parseInt(qStr);
        const isCurrentPeriod = q === currentQ && year === currentYear;
        const objs = groups.get(key)!;
        const doneCount = objs.filter((o) => o.status === "done").length;

        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Q{q} {year}</h3>
              {isCurrentPeriod && <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>}
              <span className="text-xs text-gray-400">{doneCount}/{objs.length} done</span>
              {objs.length > 0 && (
                <div className="flex-1 max-w-24">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${(doneCount / objs.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {objs.map((obj) => {
                const s = OBJECTIVE_STATUSES[obj.status] || OBJECTIVE_STATUSES.not_started;
                return (
                  <div key={obj.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color} whitespace-nowrap flex-shrink-0 mt-0.5`}>
                      {s.label}
                    </span>
                    <p className="text-sm text-gray-800">{obj.objective}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmartField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
