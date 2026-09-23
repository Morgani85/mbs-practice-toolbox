import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Plus, Pencil, Trash2, FileText, Target, CalendarDays,
  UserCircle2, Send, LayoutDashboard, ChevronDown, ChevronRight,
  Lock, Eye, PlayCircle, Clock, ExternalLink, RotateCcw, CheckCircle2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type CoachingClient = {
  id: number; name: string; companyName?: string; email?: string; phone?: string;
  notes?: string; linkedUserId?: number; portalEnabled: boolean;
};

type SessionNote = {
  id: number; clientId: number; noteDate: string; title: string; body: string;
  sharedWithClient: boolean;
};

type StrategicGoal = {
  id: number; clientId: number; horizon: string;
  specific: string; measurable: string; achievable: string; relevant: string;
  timeBound: string; targetDate?: string; sortOrder: number;
};

type QuarterlyObjective = {
  id: number; clientId: number; quarter: number; year: number;
  objective: string; status: string; sortOrder: number;
};

type CoachingAction = {
  id: number; clientId: number; sessionId: number; description: string;
  owner: string; deadline?: string; status: string; updatedAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const OBJECTIVE_STATUSES = [
  { value: "not_started", label: "Not Started", color: "bg-gray-100 text-gray-700" },
  { value: "making_a_start", label: "Making a Start", color: "bg-yellow-100 text-yellow-700" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "halfway", label: "Halfway", color: "bg-indigo-100 text-indigo-700" },
  { value: "mostly_there", label: "Mostly There", color: "bg-purple-100 text-purple-700" },
  { value: "last_little_bit", label: "Last Little Bit", color: "bg-orange-100 text-orange-700" },
  { value: "done", label: "Done", color: "bg-green-100 text-green-700" },
];

const STATUS_MAP = Object.fromEntries(OBJECTIVE_STATUSES.map((s) => [s.value, s]));

const HORIZONS = [
  { value: "5year", label: "5-Year Vision" },
  { value: "3year", label: "3-Year Goals" },
  { value: "1year", label: "1-Year Targets" },
];

const QUARTERS = [1, 2, 3, 4];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

// ── Main Component ────────────────────────────────────────────────────────────

export default function CoachingClientHub() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/coaching/clients/${clientId}/sessions/start`, "POST", {});
      return res.json();
    },
    onSuccess: (session: any) => {
      navigate(`/coaching/clients/${clientId}/sessions/${session.id}`);
    },
    onError: () => toast({ title: "Failed to start session", variant: "destructive" }),
  });

  const { data: client, isLoading: clientLoading } = useQuery<CoachingClient>({
    queryKey: ["/api/coaching/clients", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const [showInvite, setShowInvite] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest(`/api/coaching/clients/${clientId}/invite`, "POST", { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId] });
      setShowInvite(false);
      toast({ title: "Invitation sent" });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Failed to send invitation", variant: "destructive" }),
  });

  if (clientLoading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16 text-gray-500">
        <UserCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>Client not found</p>
        <Link href="/coaching"><Button variant="link">Back to clients</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/coaching">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-700 font-semibold">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            {client.companyName && <p className="text-sm text-gray-500">{client.companyName}</p>}
          </div>
          {client.portalEnabled && (
            <Badge variant="secondary" className="ml-2">Portal active</Badge>
          )}
        </div>
        <Button
          onClick={() => startSessionMutation.mutate()}
          disabled={startSessionMutation.isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
        >
          <PlayCircle className="h-4 w-4 mr-1.5" />
          {startSessionMutation.isPending ? "Starting…" : "Start Session"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Overview
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
            Strategic Plan
          </TabsTrigger>
          <TabsTrigger value="objectives" className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Objectives
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTab client={client} clientId={clientId} onOpenInvite={() => setShowInvite(true)} />
        </TabsContent>

        {/* ── Sessions Tab ───────────────────────────────────── */}
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab clientId={clientId} />
        </TabsContent>

        {/* ── Session Notes Tab ─────────────────────────────── */}
        <TabsContent value="notes" className="mt-4">
          <SessionNotesTab clientId={clientId} />
        </TabsContent>

        {/* ── Strategic Plan Tab ────────────────────────────── */}
        <TabsContent value="strategy" className="mt-4">
          <StrategicPlanTab clientId={clientId} />
        </TabsContent>

        {/* ── Quarterly Objectives Tab ──────────────────────── */}
        <TabsContent value="objectives" className="mt-4">
          <QuarterlyObjectivesTab clientId={clientId} />
        </TabsContent>
      </Tabs>

      {/* ── Invite Dialog ─────────────────────────────────── */}
      <InviteDialog
        open={showInvite}
        onClose={() => setShowInvite(false)}
        defaultEmail={client.email || ""}
        onSend={(email) => inviteMutation.mutate(email)}
        isSending={inviteMutation.isPending}
      />
    </div>
  );
}

function InviteDialog({
  open, onClose, defaultEmail, onSend, isSending,
}: {
  open: boolean; onClose: () => void; defaultEmail: string;
  onSend: (email: string) => void; isSending: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);

  // Sync defaultEmail if parent changes it
  const handleOpenChange = (next: boolean) => {
    if (next) setEmail(defaultEmail);
    if (!next) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite client to portal</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1 mb-2">
          An invitation email will be sent to the address below. The client will be able to
          log in and view their goals, objectives and session notes in read-only mode.
        </p>
        <div>
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
          <Button
            onClick={() => onSend(email.trim())}
            disabled={isSending || !email.trim()}
            className="flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  client, clientId, onOpenInvite,
}: {
  client: CoachingClient; clientId: number; onOpenInvite: () => void;
}) {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);

  const { data: notes = [] } = useQuery<SessionNote[]>({
    queryKey: ["/api/coaching/clients", clientId, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/notes`);
      return res.json();
    },
  });

  const { data: goals = [] } = useQuery<StrategicGoal[]>({
    queryKey: ["/api/coaching/clients", clientId, "strategic-goals"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/strategic-goals`);
      return res.json();
    },
  });

  const { data: objectives = [] } = useQuery<QuarterlyObjective[]>({
    queryKey: ["/api/coaching/clients", clientId, "objectives"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/objectives`);
      return res.json();
    },
  });

  const { data: allSessions = [] } = useQuery<{ id: number; status: string; sessionDate: string }[]>({
    queryKey: ["/api/coaching/clients", clientId, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/sessions`);
      return res.json();
    },
  });

  const { data: allActions = [] } = useQuery<CoachingAction[]>({
    queryKey: ["/api/coaching/clients", clientId, "actions"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/actions`);
      return res.json();
    },
  });

  const currentObjectives = objectives.filter(
    (o) => o.quarter === currentQ && o.year === now.getFullYear() && o.status !== "carried"
  );
  const doneCount = currentObjectives.filter((o) => o.status === "done").length;
  const inProgressCount = currentObjectives.filter(
    (o) => !["not_started", "done"].includes(o.status)
  ).length;

  const openActionCount = allActions.filter((a) => a.status === "open").length;

  // Last closed session's completion rate: done = complete, abandoned = incomplete, carried excluded
  const lastClosedSession = [...allSessions]
    .filter((s) => s.status === "closed")
    .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())[0];
  const lastSessionActions = lastClosedSession
    ? allActions.filter((a) => a.sessionId === lastClosedSession.id && a.status !== "carried")
    : [];
  const lastSessionDone = lastSessionActions.filter((a) => a.status === "done").length;
  const lastSessionTotal = lastSessionActions.length;
  const lastSessionPct = lastSessionTotal > 0
    ? Math.round((lastSessionDone / lastSessionTotal) * 100)
    : null;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Session Notes" value={notes.length} icon={FileText} color="text-green-600" bg="bg-green-50" />
        <StatCard label="Strategic Goals" value={goals.length} icon={CalendarDays} color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Open Actions" value={openActionCount} icon={CheckCircle2} color="text-red-500" bg="bg-red-50" />
        <StatCard label={`Q${currentQ} Objectives`} value={currentObjectives.length} icon={Target} color="text-blue-600" bg="bg-blue-50" />
      </div>

      {/* Last session completion */}
      {lastClosedSession && lastSessionTotal > 0 && (
        <Card className={lastSessionPct === 100 ? "border-green-200 bg-green-50" : lastSessionPct !== null && lastSessionPct < 50 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Last session completion</p>
              <p className="text-sm text-gray-700">
                {lastSessionDone} of {lastSessionTotal} actions done
                <span className="text-gray-400 ml-1">
                  ({new Date(lastClosedSession.sessionDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})
                </span>
              </p>
            </div>
            <p className={`text-3xl font-bold flex-shrink-0 ${
              lastSessionPct === 100 ? 'text-green-600' :
              lastSessionPct !== null && lastSessionPct < 50 ? 'text-amber-600' : 'text-gray-800'
            }`}>
              {lastSessionPct}%
            </p>
          </CardContent>
        </Card>
      )}


      {/* Client details card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Client Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {client.email && (
            <div><span className="text-gray-500 font-medium">Email: </span><span className="text-gray-900">{client.email}</span></div>
          )}
          {client.phone && (
            <div><span className="text-gray-500 font-medium">Phone: </span><span className="text-gray-900">{client.phone}</span></div>
          )}
          {client.companyName && (
            <div><span className="text-gray-500 font-medium">Company: </span><span className="text-gray-900">{client.companyName}</span></div>
          )}
          {client.notes && (
            <div className="sm:col-span-2"><span className="text-gray-500 font-medium">Notes: </span><span className="text-gray-900">{client.notes}</span></div>
          )}
        </CardContent>
      </Card>

      {/* Q objectives summary */}
      {currentObjectives.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Q{currentQ} {now.getFullYear()} — Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {OBJECTIVE_STATUSES.map((s) => {
                const count = currentObjectives.filter((o) => o.status === s.value).length;
                if (!count) return null;
                return (
                  <span key={s.value} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                    {s.label} <strong>{count}</strong>
                  </span>
                );
              })}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: currentObjectives.length ? `${(doneCount / currentObjectives.length) * 100}%` : "0%" }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {doneCount} of {currentObjectives.length} complete · {inProgressCount} in progress
            </p>
          </CardContent>
        </Card>
      )}

      {/* Most recent note */}
      {notes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Most Recent Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm text-gray-900">{notes[0].title}</p>
              <span className="text-xs text-gray-400">
                {new Date(notes[0].noteDate).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
            </div>
            {notes[0].body && <p className="text-sm text-gray-600 line-clamp-3">{notes[0].body}</p>}
          </CardContent>
        </Card>
      )}

      {/* Portal invite section */}
      <Card className={client.portalEnabled ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium text-sm">
              {client.portalEnabled ? "Client Portal Active" : "Client Portal"}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {client.portalEnabled
                ? "Client can log in to view their goals, objectives and notes"
                : client.email
                  ? "Send an invitation so this client can access their own portal"
                  : "Add an email address to the client record first"}
            </p>
          </div>
          {!client.portalEnabled && (
            <Button
              size="sm"
              onClick={onOpenInvite}
              className="flex items-center gap-1.5 ml-4 flex-shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Send Invite
            </Button>
          )}
          {client.portalEnabled && (
            <Badge className="bg-green-600 text-white ml-4 flex-shrink-0">Active</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: any; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

// ── Session Notes Tab ─────────────────────────────────────────────────────────

function SessionNotesTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editNote, setEditNote] = useState<SessionNote | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: notes = [], isLoading } = useQuery<SessionNote[]>({
    queryKey: ["/api/coaching/clients", clientId, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/notes`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SessionNote>) =>
      apiRequest(`/api/coaching/clients/${clientId}/notes`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "notes"] });
      setShowAdd(false);
      toast({ title: "Note added" });
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SessionNote> }) =>
      apiRequest(`/api/coaching/notes/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "notes"] });
      setEditNote(null);
      toast({ title: "Note updated" });
    },
    onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/notes/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "notes"] });
      setDeleteId(null);
      toast({ title: "Note deleted" });
    },
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const toggleShareMutation = useMutation({
    mutationFn: ({ id, sharedWithClient }: { id: number; sharedWithClient: boolean }) =>
      apiRequest(`/api/coaching/notes/${id}`, "PUT", { sharedWithClient }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "notes"] });
    },
    onError: () => toast({ title: "Failed to update sharing", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-gray-700">Meeting & session notes</h2>
        <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Note
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState icon={FileText} message="No session notes yet" />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className={note.sharedWithClient ? "" : "border-gray-200 bg-gray-50"}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">
                        {new Date(note.noteDate).toLocaleDateString("en-GB", {
                          weekday: "short", day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                      {note.sharedWithClient ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Eye className="h-3 w-3" />
                          Visible to client
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Lock className="h-3 w-3" />
                          Private
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{note.title}</p>
                    {note.body && (
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{note.body}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => toggleShareMutation.mutate({ id: note.id, sharedWithClient: !note.sharedWithClient })}
                      disabled={toggleShareMutation.isPending}
                      title={note.sharedWithClient ? "Make private" : "Share with client"}
                    >
                      {note.sharedWithClient ? (
                        <><Lock className="h-3.5 w-3.5 mr-1 text-gray-400" />Make private</>
                      ) : (
                        <><Eye className="h-3.5 w-3.5 mr-1 text-green-500" />Share</>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditNote(note)}>
                      <Pencil className="h-4 w-4 text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(note.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteFormDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(d) => createMutation.mutate(d)}
        isPending={createMutation.isPending}
        title="Add Session Note"
      />
      {editNote && (
        <NoteFormDialog
          open={!!editNote}
          onClose={() => setEditNote(null)}
          onSubmit={(d) => updateMutation.mutate({ id: editNote.id, data: d })}
          isPending={updateMutation.isPending}
          title="Edit Session Note"
          defaultValues={editNote}
        />
      )}
      <ConfirmDelete
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        description="Delete this session note permanently?"
      />
    </div>
  );
}

// ── Strategic Plan Tab ────────────────────────────────────────────────────────

function StrategicPlanTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editGoal, setEditGoal] = useState<StrategicGoal | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [openHorizons, setOpenHorizons] = useState<Set<string>>(new Set(["5year", "3year", "1year"]));

  const toggleHorizon = (h: string) => {
    setOpenHorizons((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  };

  const { data: goals = [], isLoading } = useQuery<StrategicGoal[]>({
    queryKey: ["/api/coaching/clients", clientId, "strategic-goals"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/strategic-goals`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<StrategicGoal>) =>
      apiRequest(`/api/coaching/clients/${clientId}/strategic-goals`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "strategic-goals"] });
      setShowAdd(false);
      toast({ title: "Goal added" });
    },
    onError: () => toast({ title: "Failed to add goal", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StrategicGoal> }) =>
      apiRequest(`/api/coaching/strategic-goals/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "strategic-goals"] });
      setEditGoal(null);
      toast({ title: "Goal updated" });
    },
    onError: () => toast({ title: "Failed to update goal", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/strategic-goals/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "strategic-goals"] });
      setDeleteId(null);
      toast({ title: "Goal deleted" });
    },
    onError: () => toast({ title: "Failed to delete goal", variant: "destructive" }),
  });

  const goalsByHorizon: Record<string, StrategicGoal[]> = {};
  for (const g of goals) {
    if (!goalsByHorizon[g.horizon]) goalsByHorizon[g.horizon] = [];
    goalsByHorizon[g.horizon].push(g);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-gray-700">SMART goals for 5yr / 3yr / 1yr horizons</h2>
        <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Goal
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {HORIZONS.map(({ value, label }) => {
            const horizonGoals = goalsByHorizon[value] || [];
            const isOpen = openHorizons.has(value);
            return (
              <Collapsible key={value} open={isOpen} onOpenChange={() => toggleHorizon(value)}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                      <span className="font-semibold text-sm text-gray-700">{label}</span>
                      <Badge variant="secondary" className="text-xs">{horizonGoals.length}</Badge>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-2">
                    {horizonGoals.length === 0 ? (
                      <p className="text-sm text-gray-400 italic px-2 py-3">No {label.toLowerCase()} goals yet. Click "Add Goal" to create one.</p>
                    ) : (
                      horizonGoals.map((goal) => (
                        <Card key={goal.id}>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <SmartField label="Specific" value={goal.specific} />
                                <SmartField label="Measurable" value={goal.measurable} />
                                <SmartField label="Achievable" value={goal.achievable} />
                                <SmartField label="Relevant" value={goal.relevant} />
                                <SmartField label="Time-bound" value={goal.timeBound} />
                                {goal.targetDate && (
                                  <SmartField
                                    label="Target Date"
                                    value={new Date(goal.targetDate).toLocaleDateString("en-GB")}
                                  />
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => setEditGoal(goal)}>
                                  <Pencil className="h-4 w-4 text-gray-400" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(goal.id)}>
                                  <Trash2 className="h-4 w-4 text-red-400" />
                                </Button>
                              </div>
                            </div>
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
      )}

      <GoalFormDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(d) => createMutation.mutate(d)}
        isPending={createMutation.isPending}
        title="Add Strategic Goal"
      />
      {editGoal && (
        <GoalFormDialog
          open={!!editGoal}
          onClose={() => setEditGoal(null)}
          onSubmit={(d) => updateMutation.mutate({ id: editGoal.id, data: d })}
          isPending={updateMutation.isPending}
          title="Edit Strategic Goal"
          defaultValues={editGoal}
        />
      )}
      <ConfirmDelete
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        description="Delete this strategic goal permanently?"
      />
    </div>
  );
}

// ── Quarterly Objectives Tab ──────────────────────────────────────────────────

function QuarterlyObjectivesTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const now = new Date();
  const [viewMode, setViewMode] = useState<"quarter" | "all">("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [editObj, setEditObj] = useState<QuarterlyObjective | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: objectives = [], isLoading } = useQuery<QuarterlyObjective[]>({
    queryKey: ["/api/coaching/clients", clientId, "objectives", selectedQuarter, selectedYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/coaching/clients/${clientId}/objectives?quarter=${selectedQuarter}&year=${selectedYear}`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: viewMode === "quarter",
  });

  const { data: allObjectives = [], isLoading: isLoadingAll } = useQuery<QuarterlyObjective[]>({
    queryKey: ["/api/coaching/clients", clientId, "objectives", "all"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/objectives`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: viewMode === "all",
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<QuarterlyObjective>) =>
      apiRequest(`/api/coaching/clients/${clientId}/objectives`, "POST", {
        ...data, quarter: selectedQuarter, year: selectedYear,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "objectives"] });
      setShowAdd(false);
      toast({ title: "Objective added" });
    },
    onError: () => toast({ title: "Failed to add objective", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<QuarterlyObjective> }) =>
      apiRequest(`/api/coaching/objectives/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "objectives"] });
      setEditObj(null);
      toast({ title: "Objective updated" });
    },
    onError: () => toast({ title: "Failed to update objective", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/objectives/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "objectives"] });
      setDeleteId(null);
      toast({ title: "Objective deleted" });
    },
    onError: () => toast({ title: "Failed to delete objective", variant: "destructive" }),
  });

  const carryForwardMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/objectives/${id}/carry-forward`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients", clientId, "objectives"] });
      toast({ title: "Objective carried to next quarter" });
    },
    onError: () => toast({ title: "Failed to carry forward objective", variant: "destructive" }),
  });

  const statusCounts = OBJECTIVE_STATUSES.map((s) => ({
    ...s,
    count: objectives.filter((o) => o.status === s.value).length,
  })).filter((s) => s.count > 0);

  // Filter out 'carried' objectives from the display
  const visibleObjectives = objectives.filter((o) => o.status !== "carried");

  return (
    <div className="space-y-4">
      {/* View mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={viewMode === "quarter" ? "default" : "outline"}
          onClick={() => setViewMode("quarter")}
        >
          By Quarter
        </Button>
        <Button
          size="sm"
          variant={viewMode === "all" ? "default" : "outline"}
          onClick={() => setViewMode("all")}
        >
          All Quarters
        </Button>
      </div>

      {viewMode === "all" ? (
        <AllQuartersOverview objectives={allObjectives} isLoading={isLoadingAll} />
      ) : (
        <>
          {/* Quarter/Year selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              {QUARTERS.map((q) => (
                <Button
                  key={q}
                  size="sm"
                  variant={selectedQuarter === q ? "default" : "outline"}
                  onClick={() => setSelectedQuarter(q)}
                >
                  Q{q}
                </Button>
              ))}
            </div>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500 ml-auto">{visibleObjectives.length} objective{visibleObjectives.length !== 1 ? "s" : ""}</span>
            <Button size="sm" onClick={() => setShowAdd(true)} className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Objective
            </Button>
          </div>

          {/* Status summary pills — exclude 'carried' */}
          {statusCounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {statusCounts.filter((s) => s.value !== "carried" && s.count > 0).map((s) => (
                <span key={s.value} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                  {s.label} <span className="font-bold">{s.count}</span>
                </span>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded" />)}
            </div>
          ) : visibleObjectives.length === 0 ? (
            <EmptyState icon={Target} message={`No objectives for Q${selectedQuarter} ${selectedYear}`} />
          ) : (
            <div className="space-y-3">
              {visibleObjectives.map((obj) => {
                const s = STATUS_MAP[obj.status] || STATUS_MAP.not_started;
                const isFinished = obj.status === "done";
                return (
                  <Card key={obj.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <Select
                          value={obj.status}
                          onValueChange={(v) => updateMutation.mutate({ id: obj.id, data: { status: v } })}
                        >
                          <SelectTrigger className={`w-40 h-7 text-xs font-medium border-0 ${s.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OBJECTIVE_STATUSES.map((st) => (
                              <SelectItem key={st.value} value={st.value}>
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${st.color}`}>
                                  {st.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="flex-1 text-sm text-gray-800">{obj.objective}</p>
                        <div className="flex gap-1 flex-shrink-0">
                          {!isFinished && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              title="Carry to next quarter"
                              onClick={() => carryForwardMutation.mutate(obj.id)}
                              disabled={carryForwardMutation.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditObj(obj)}>
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(obj.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <ObjectiveFormDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(d) => createMutation.mutate(d)}
        isPending={createMutation.isPending}
        title={`Add Objective — Q${selectedQuarter} ${selectedYear}`}
      />
      {editObj && (
        <ObjectiveFormDialog
          open={!!editObj}
          onClose={() => setEditObj(null)}
          onSubmit={(d) => updateMutation.mutate({ id: editObj.id, data: d })}
          isPending={updateMutation.isPending}
          title="Edit Objective"
          defaultValues={editObj}
        />
      )}
      <ConfirmDelete
        open={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        description="Delete this objective permanently?"
      />
    </div>
  );
}

// ── All Quarters Overview ──────────────────────────────────────────────────────

function AllQuartersOverview({
  objectives, isLoading,
}: {
  objectives: QuarterlyObjective[]; isLoading: boolean;
}) {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded" />)}
      </div>
    );
  }

  if (objectives.length === 0) {
    return <EmptyState icon={Target} message="No objectives have been set for this client yet" />;
  }

  // Overall status breakdown across every quarter
  const overallCounts = OBJECTIVE_STATUSES.map((s) => ({
    ...s,
    count: objectives.filter((o) => o.status === s.value).length,
  })).filter((s) => s.count > 0);
  const overallDone = objectives.filter((o) => o.status === "done").length;

  // Group by year+quarter, sorted newest first
  const groups: Map<string, QuarterlyObjective[]> = new Map();
  for (const obj of objectives) {
    const key = `${obj.year}-${obj.quarter}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(obj);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5">
      {/* Overall summary card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            All-Time Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {overallCounts.map((s) => (
              <span key={s.value} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                {s.label} <strong>{s.count}</strong>
              </span>
            ))}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(overallDone / objectives.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {overallDone} of {objectives.length} objectives complete across {sortedKeys.length} quarter{sortedKeys.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Per-quarter breakdown */}
      {sortedKeys.map((key) => {
        const [yearStr, qStr] = key.split("-");
        const year = parseInt(yearStr);
        const q = parseInt(qStr);
        const isCurrentPeriod = q === currentQ && year === currentYear;
        const objs = groups.get(key)!;
        const doneCount = objs.filter((o) => o.status === "done").length;

        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Q{q} {year}</CardTitle>
                {isCurrentPeriod && <Badge className="bg-blue-100 text-blue-700 text-xs">Current</Badge>}
                <span className="text-xs text-gray-400">{doneCount}/{objs.length} done</span>
                <div className="flex-1 max-w-32">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${(doneCount / objs.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {objs.map((obj) => {
                const s = STATUS_MAP[obj.status] || STATUS_MAP.not_started;
                return (
                  <div key={obj.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color} whitespace-nowrap flex-shrink-0 mt-0.5`}>
                      {s.label}
                    </span>
                    <p className="text-sm text-gray-800">{obj.objective}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Shared Form Dialogs ───────────────────────────────────────────────────────

function NoteFormDialog({
  open, onClose, onSubmit, isPending, title, defaultValues,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (d: Partial<SessionNote>) => void;
  isPending: boolean; title: string;
  defaultValues?: Partial<SessionNote>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    noteDate: defaultValues?.noteDate?.slice(0, 10) || today,
    title: defaultValues?.title || "",
    body: defaultValues?.body || "",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div>
            <Label>Date *</Label>
            <Input type="date" value={form.noteDate} onChange={(e) => setForm({ ...form, noteDate: e.target.value })} required />
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Monthly check-in" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} placeholder="Session notes, action items, observations..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalFormDialog({
  open, onClose, onSubmit, isPending, title, defaultValues,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (d: Partial<StrategicGoal>) => void;
  isPending: boolean; title: string;
  defaultValues?: Partial<StrategicGoal>;
}) {
  const [form, setForm] = useState({
    horizon: defaultValues?.horizon || "1year",
    specific: defaultValues?.specific || "",
    measurable: defaultValues?.measurable || "",
    achievable: defaultValues?.achievable || "",
    relevant: defaultValues?.relevant || "",
    timeBound: defaultValues?.timeBound || "",
    targetDate: defaultValues?.targetDate?.slice(0, 10) || "",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div>
            <Label>Horizon *</Label>
            <Select value={form.horizon} onValueChange={(v) => setForm({ ...form, horizon: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HORIZONS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(["specific", "measurable", "achievable", "relevant"] as const).map((field) => (
            <div key={field}>
              <Label className="capitalize">{field}</Label>
              <Textarea
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                rows={2}
                placeholder={`What is ${field} about this goal?`}
              />
            </div>
          ))}
          <div>
            <Label>Time-bound</Label>
            <Textarea
              value={form.timeBound}
              onChange={(e) => setForm({ ...form, timeBound: e.target.value })}
              rows={2}
              placeholder="When will this be achieved?"
            />
          </div>
          <div>
            <Label>Target Date</Label>
            <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveFormDialog({
  open, onClose, onSubmit, isPending, title, defaultValues,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (d: Partial<QuarterlyObjective>) => void;
  isPending: boolean; title: string;
  defaultValues?: Partial<QuarterlyObjective>;
}) {
  const [form, setForm] = useState({
    objective: defaultValues?.objective || "",
    status: defaultValues?.status || "not_started",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div>
            <Label>Objective *</Label>
            <Textarea
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              rows={3}
              placeholder="What needs to be achieved this quarter?"
              required
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTIVE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

function SmartField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}

// ── SessionsTab ───────────────────────────────────────────────────────────────

type CoachingSession = {
  id: number; clientId: number; sessionDate: string; status: string;
  clientSummaryShared: boolean;
};

function SessionsTab({ clientId }: { clientId: number }) {
  const [, navigate] = useLocation();

  const { data: sessions = [], isLoading } = useQuery<CoachingSession[]>({
    queryKey: ['/api/coaching/clients', clientId, 'sessions'],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/sessions`);
      return res.json();
    },
  });

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
  );

  function formatSessionDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400">
          <Clock className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm">No sessions yet — click <strong>Start Session</strong> to begin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((session) => {
        const isOpen = session.status === 'open';
        return (
          <div
            key={session.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer hover:bg-gray-50 ${
              isOpen ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
            }`}
            onClick={() => navigate(`/coaching/clients/${clientId}/sessions/${session.id}`)}
          >
            <div className="flex items-center gap-3">
              <Clock className={`h-4 w-4 flex-shrink-0 ${isOpen ? 'text-amber-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatSessionDate(session.sessionDate)}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={
                    isOpen
                      ? 'bg-amber-100 text-amber-700 border border-amber-200 text-xs'
                      : 'bg-green-100 text-green-700 border border-green-200 text-xs'
                  }>
                    {isOpen ? 'Open' : 'Closed'}
                  </Badge>
                  {session.clientSummaryShared && (
                    <span className="text-xs text-blue-600 flex items-center gap-0.5">
                      <Eye className="h-3 w-3" />
                      Shared with client
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <Icon className="h-10 w-10 mx-auto mb-2 text-gray-200" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ConfirmDelete({
  open, onCancel, onConfirm, description,
}: {
  open: boolean; onCancel: () => void; onConfirm: () => void; description: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
