import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, CheckCircle2, RotateCcw, XCircle, Plus, ChevronDown, ChevronRight,
  AlertTriangle, Calendar, User, Users, Target, Lock, FileText, Sparkles,
  ClipboardList, Loader2, Upload,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CoachingSession = {
  id: number; clientId: number; sessionDate: string; status: string;
  agendaNotes?: string; transcript?: string;
  clientSummary?: string; clientSummaryShared: boolean;
  internalSummary?: string;
};

type CoachingAction = {
  id: number; clientId: number; sessionId: number; description: string;
  owner: string; deadline?: string; status: string;
  carriedToSessionId?: number; linkedObjectiveId?: number; linkedGoalId?: number;
};

type QuarterlyObjective = {
  id: number; quarter: number; year: number; objective: string; status: string;
};

type StrategicGoal = {
  id: number; horizon: string; specific: string; targetDate?: string;
};

type CoachingClient = {
  id: number; name: string; companyName?: string;
};

type AISummary = {
  keyPoints: string[];
  internalNotes: string[];
  suggestedActions: Array<{ description: string; owner: 'client' | 'coach' }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysOverdue(deadline: string): number {
  if (!deadline) return 0;
  const londonToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  if (londonToday <= deadline) return 0;
  return Math.floor(
    (new Date(londonToday + 'T00:00:00').getTime() - new Date(deadline + 'T00:00:00').getTime())
    / 86_400_000,
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const OBJECTIVE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', making_a_start: 'Making a Start',
  in_progress: 'In Progress', halfway: 'Halfway',
  mostly_there: 'Mostly There', last_little_bit: 'Last Little Bit',
  done: 'Done', carried: 'Carried',
};

const OBJECTIVE_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  making_a_start: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  halfway: 'bg-indigo-100 text-indigo-700',
  mostly_there: 'bg-purple-100 text-purple-700',
  last_little_bit: 'bg-orange-100 text-orange-700',
  done: 'bg-green-100 text-green-700',
  carried: 'bg-gray-100 text-gray-400',
};

const ACTION_STATUS_STYLE: Record<string, string> = {
  open: 'bg-amber-50 border-amber-200',
  done: 'bg-green-50 border-green-200',
  abandoned: 'bg-gray-50 border-gray-200',
  carried: 'bg-blue-50 border-blue-200',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CoachingSessionScreen() {
  const { clientId: clientIdStr, sessionId: sessionIdStr } =
    useParams<{ clientId: string; sessionId: string }>();
  const clientId = parseInt(clientIdStr);
  const sessionId = parseInt(sessionIdStr);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Close-session modal
  const [showClose, setShowClose] = useState(false);
  const [closeClientSummary, setCloseClientSummary] = useState('');
  const [closeInternalSummary, setCloseInternalSummary] = useState('');
  const [closeShare, setCloseShare] = useState(false);

  // Context panel
  const [contextOpen, setContextOpen] = useState(false);
  // Transcript panel
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // Live notes (agendaNotes) — local value + debounced save
  const [localNotes, setLocalNotes] = useState('');
  const notesInitialised = useRef(false);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesSaving, setNotesSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Transcript — local value + debounced save
  const [localTranscript, setLocalTranscript] = useState('');
  const transcriptInitialised = useRef(false);
  const transcriptSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transcriptSaving, setTranscriptSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI summary
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<'transcript' | 'notes'>('transcript');

  // New-action form
  const [newDesc, setNewDesc] = useState('');
  const [newOwner, setNewOwner] = useState<'coach' | 'client'>('client');
  const [newDeadline, setNewDeadline] = useState('');
  const [newLinkedObj, setNewLinkedObj] = useState('');
  const [newLinkedGoal, setNewLinkedGoal] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: session, isLoading: sessionLoading } = useQuery<CoachingSession>({
    queryKey: ['/api/coaching/sessions', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
  });

  const { data: client } = useQuery<CoachingClient>({
    queryKey: ['/api/coaching/clients', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}`);
      return res.json();
    },
  });

  const { data: allActions = [] } = useQuery<CoachingAction[]>({
    queryKey: ['/api/coaching/clients', clientId, 'actions'],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/actions`);
      return res.json();
    },
  });

  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  const { data: objectives = [] } = useQuery<QuarterlyObjective[]>({
    queryKey: ['/api/coaching/clients', clientId, 'objectives'],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/objectives`);
      return res.json();
    },
  });

  const { data: goals = [] } = useQuery<StrategicGoal[]>({
    queryKey: ['/api/coaching/clients', clientId, 'strategic-goals'],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/clients/${clientId}/strategic-goals`);
      return res.json();
    },
  });

  // ── Seed local state from server ──────────────────────────────────────────

  useEffect(() => {
    if (session && !notesInitialised.current) {
      setLocalNotes(session.agendaNotes ?? '');
      notesInitialised.current = true;
    }
  }, [session]);

  useEffect(() => {
    if (session && !transcriptInitialised.current) {
      setLocalTranscript(session.transcript ?? '');
      transcriptInitialised.current = true;
    }
  }, [session]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const priorOpenActions = allActions.filter(
    (a) => a.status === 'open' && a.sessionId !== sessionId,
  );
  const thisSessionActions = allActions.filter((a) => a.sessionId === sessionId);

  const currentObjectives = objectives.filter(
    (o) => o.quarter === currentQ && o.year === currentYear && o.status !== 'carried',
  );
  const oneYearGoals = goals.filter((g) => g.horizon === '1year');

  const isOpen = session?.status === 'open';

  // ── Auto-save helpers ─────────────────────────────────────────────────────

  const saveField = useCallback(async (field: 'agendaNotes' | 'transcript', value: string) => {
    await apiRequest(`/api/coaching/sessions/${sessionId}`, 'PUT', { [field]: value });
    queryClient.invalidateQueries({ queryKey: ['/api/coaching/sessions', sessionId] });
  }, [sessionId]);

  function handleNotesChange(value: string) {
    setLocalNotes(value);
    setNotesSaving('saving');
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      try {
        await saveField('agendaNotes', value);
        setNotesSaving('saved');
        setTimeout(() => setNotesSaving('idle'), 2000);
      } catch {
        toast({ title: 'Failed to save notes', variant: 'destructive' });
        setNotesSaving('idle');
      }
    }, 800);
  }

  function handleTranscriptChange(value: string) {
    setLocalTranscript(value);
    setTranscriptSaving('saving');
    if (transcriptSaveTimer.current) clearTimeout(transcriptSaveTimer.current);
    transcriptSaveTimer.current = setTimeout(async () => {
      try {
        await saveField('transcript', value);
        setTranscriptSaving('saved');
        setTimeout(() => setTranscriptSaving('idle'), 2000);
      } catch {
        toast({ title: 'Failed to save transcript', variant: 'destructive' });
        setTranscriptSaving('idle');
      }
    }, 800);
  }

  // ── File upload for transcript ────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      toast({ title: 'Only .txt files are supported', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) handleTranscriptChange(text);
      toast({ title: `"${file.name}" loaded into transcript` });
    };
    reader.onerror = () => toast({ title: 'Failed to read file', variant: 'destructive' });
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';
  }

  // ── AI Summarise ──────────────────────────────────────────────────────────

  async function handleAiSummarise() {
    const text = aiSource === 'transcript' ? localTranscript : localNotes;
    if (!text || text.trim().length < 20) {
      toast({
        title: aiSource === 'transcript' ? 'No transcript to summarise' : 'No session notes to summarise',
        description: 'Add some content first, then try again.',
        variant: 'destructive',
      });
      return;
    }
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await apiRequest(`/api/coaching/sessions/${sessionId}/summarise`, 'POST', { text });
      const data: AISummary = await res.json();
      setAiSummary(data);
    } catch {
      toast({ title: 'AI summary failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiToCloseModal() {
    if (!aiSummary) return;
    const clientText = aiSummary.keyPoints.map(p => `• ${p}`).join('\n');
    const internalText = aiSummary.internalNotes.map(p => `• ${p}`).join('\n');
    setCloseClientSummary(clientText);
    setCloseInternalSummary(internalText);
    setShowClose(true);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const actionStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/coaching/actions/${id}`, 'PUT', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'actions'] });
    },
    onError: () => toast({ title: 'Failed to update action', variant: 'destructive' }),
  });

  const carryForwardMutation = useMutation({
    mutationFn: (actionId: number) =>
      apiRequest(`/api/coaching/actions/${actionId}/carry-forward`, 'POST', { toSessionId: sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'actions'] });
    },
    onError: () => toast({ title: 'Failed to carry forward', variant: 'destructive' }),
  });

  const addActionMutation = useMutation({
    mutationFn: (data: object) =>
      apiRequest(`/api/coaching/sessions/${sessionId}/actions`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'actions'] });
      setNewDesc('');
      setNewOwner('client');
      setNewDeadline('');
      setNewLinkedObj('');
      setNewLinkedGoal('');
    },
    onError: () => toast({ title: 'Failed to add action', variant: 'destructive' }),
  });

  const deleteActionMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/actions/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'actions'] });
    },
    onError: () => toast({ title: 'Failed to delete action', variant: 'destructive' }),
  });

  const addSuggestedActionMutation = useMutation({
    mutationFn: (data: object) =>
      apiRequest(`/api/coaching/sessions/${sessionId}/actions`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'actions'] });
      toast({ title: 'Action added from AI suggestions' });
    },
    onError: () => toast({ title: 'Failed to add action', variant: 'destructive' }),
  });

  const closeSessionMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/coaching/sessions/${sessionId}`, 'PUT', {
        status: 'closed',
        clientSummary: closeClientSummary,
        internalSummary: closeInternalSummary,
        clientSummaryShared: closeShare,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/sessions', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coaching/clients', clientId, 'sessions'] });
      setShowClose(false);
      toast({ title: 'Session closed' });
      navigate(`/coaching/clients/${clientId}`);
    },
    onError: () => toast({ title: 'Failed to close session', variant: 'destructive' }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newDesc.trim()) return;
    addActionMutation.mutate({
      description: newDesc.trim(),
      owner: newOwner,
      deadline: newDeadline || undefined,
      linkedObjectiveId:
        newLinkedObj && newLinkedObj !== '_none' ? parseInt(newLinkedObj) : undefined,
      linkedGoalId:
        newLinkedGoal && newLinkedGoal !== '_none' ? parseInt(newLinkedGoal) : undefined,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-48 bg-gray-200 rounded" />
        <div className="h-48 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Session not found.</p>
        <Link href={`/coaching/clients/${clientId}`}>
          <Button variant="link">Back to client</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/coaching/clients/${clientId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">
                Session — {formatDate(session.sessionDate)}
              </h1>
              <Badge className={
                isOpen
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-green-100 text-green-800 border border-green-200'
              }>
                {isOpen ? 'Open' : 'Closed'}
              </Badge>
            </div>
            {client && (
              <p className="text-sm text-gray-500">
                {client.name}{client.companyName ? ` · ${client.companyName}` : ''}
              </p>
            )}
          </div>
        </div>
        {isOpen && (
          <Button
            onClick={() => setShowClose(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Close Session
          </Button>
        )}
      </div>

      {/* ── SESSION NOTES (live, auto-saving) ───────────────────────── */}
      {isOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                Session Notes
              </span>
              <span className="text-xs font-normal text-gray-400">
                {notesSaving === 'saving' && 'Saving…'}
                {notesSaving === 'saved' && '✓ Saved'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Jot notes as you go — key themes, observations, questions raised…"
              rows={6}
              className="text-sm resize-y"
            />
          </CardContent>
        </Card>
      )}

      {/* Closed session notes (read-only) */}
      {!isOpen && session.agendaNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-500" />
              Session Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.agendaNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* ── TRANSCRIPT ──────────────────────────────────────────────── */}
      <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 rounded-t-lg select-none">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  Transcript / Uploaded Notes
                  {localTranscript && (
                    <Badge variant="secondary" className="text-xs">
                      {localTranscript.split(/\s+/).filter(Boolean).length} words
                    </Badge>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {transcriptSaving === 'saving' && (
                    <span className="text-xs font-normal text-gray-400">Saving…</span>
                  )}
                  {transcriptSaving === 'saved' && (
                    <span className="text-xs font-normal text-gray-400">✓ Saved</span>
                  )}
                  {transcriptOpen
                    ? <ChevronDown className="h-4 w-4 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Paste your transcript here, or upload a <code className="bg-gray-100 px-1 rounded">.txt</code> file. Saved automatically.
                </p>
                {isOpen && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 ml-3 border-violet-200 text-violet-700 hover:bg-violet-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload .txt
                    </Button>
                  </>
                )}
              </div>
              {isOpen ? (
                <Textarea
                  value={localTranscript}
                  onChange={(e) => handleTranscriptChange(e.target.value)}
                  placeholder="Paste transcript or notes here, or use the Upload button above…"
                  rows={12}
                  className="text-sm font-mono resize-y"
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-md p-3 max-h-96 overflow-y-auto">
                  {localTranscript || <span className="italic text-gray-400">No transcript recorded</span>}
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── AI MEETING SUMMARY ───────────────────────────────────────── */}
      {isOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Meeting Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-600">Summarise from:</Label>
                <Select value={aiSource} onValueChange={(v) => setAiSource(v as 'transcript' | 'notes')}>
                  <SelectTrigger className="h-8 text-sm w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transcript">Transcript</SelectItem>
                    <SelectItem value="notes">Session Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAiSummarise}
                disabled={aiLoading}
                className="border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {aiLoading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analysing…</>
                  : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate Summary</>}
              </Button>
            </div>

            {aiSummary && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                {/* Key points */}
                {aiSummary.keyPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Key Points (for client summary)
                    </p>
                    <ul className="space-y-1.5">
                      {aiSummary.keyPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Internal notes */}
                {aiSummary.internalNotes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Internal Observations
                    </p>
                    <ul className="space-y-1.5">
                      {aiSummary.internalNotes.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested actions */}
                {aiSummary.suggestedActions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Suggested Next Actions
                    </p>
                    <div className="space-y-2">
                      {aiSummary.suggestedActions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                          <div className="flex-1 text-sm text-gray-800">{action.description}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            action.owner === 'client'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {action.owner}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-green-700 hover:bg-green-50 flex-shrink-0"
                            onClick={() => addSuggestedActionMutation.mutate({
                              description: action.description,
                              owner: action.owner,
                            })}
                            disabled={addSuggestedActionMutation.isPending}
                          >
                            <Plus className="h-3 w-3 mr-1" />Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={applyAiToCloseModal}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Use Summary &amp; Close Session
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── REVIEW: Prior Open Actions ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-500" />
            Review — Open Actions from Previous Sessions
            {priorOpenActions.length > 0 && (
              <Badge variant="secondary">{priorOpenActions.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {priorOpenActions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No outstanding actions from previous sessions.
            </p>
          ) : (
            <div className="space-y-2">
              {priorOpenActions.map((action) => {
                const daysOverdue = action.deadline ? getDaysOverdue(action.deadline) : 0;
                return (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {action.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          action.owner === 'client'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {action.owner === 'client'
                            ? <Users className="h-3 w-3" />
                            : <User className="h-3 w-3" />}
                          {action.owner}
                        </span>
                        {action.deadline && (
                          <span className={`flex items-center gap-1 text-xs ${
                            daysOverdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'
                          }`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(action.deadline)}
                            {daysOverdue > 0 && (
                              <span className="ml-0.5">({daysOverdue}d overdue)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="flex gap-1 flex-shrink-0 flex-wrap">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs text-green-700 hover:bg-green-50"
                          onClick={() => actionStatusMutation.mutate({ id: action.id, status: 'done' })}
                          disabled={actionStatusMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Done
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-50"
                          onClick={() => carryForwardMutation.mutate(action.id)}
                          disabled={carryForwardMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Carry
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs text-gray-500 hover:bg-gray-100"
                          onClick={() => actionStatusMutation.mutate({ id: action.id, status: 'abandoned' })}
                          disabled={actionStatusMutation.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />Close
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CONTEXT: Objectives & Goals (collapsible) ────────────────── */}
      <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 rounded-t-lg select-none">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Context — Q{currentQ} Objectives &amp; 1-Year Goals
                  <span className="text-xs font-normal text-gray-400">
                    ({currentObjectives.length} objectives · {oneYearGoals.length} goals)
                  </span>
                </span>
                {contextOpen
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {currentObjectives.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Q{currentQ} {currentYear} Objectives
                  </p>
                  <div className="space-y-2">
                    {currentObjectives.map((obj) => (
                      <div key={obj.id} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          OBJECTIVE_STATUS_COLORS[obj.status] ?? 'bg-gray-100 text-gray-600'
                        }`}>
                          {OBJECTIVE_STATUS_LABELS[obj.status] ?? obj.status}
                        </span>
                        <span className="text-gray-800">{obj.objective}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {oneYearGoals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    1-Year Goals
                  </p>
                  <div className="space-y-2">
                    {oneYearGoals.map((g) => (
                      <div
                        key={g.id}
                        className="text-sm text-gray-800 pl-3 border-l-2 border-indigo-200"
                      >
                        {g.specific || '(No description)'}
                        {g.targetDate && (
                          <span className="text-xs text-gray-400 ml-2">
                            by {formatDate(g.targetDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentObjectives.length === 0 && oneYearGoals.length === 0 && (
                <p className="text-sm text-gray-400 italic">
                  No objectives or 1-year goals recorded yet.
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── CAPTURE: This Session's Actions ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
            <Plus className="h-4 w-4 text-green-500" />
            Capture — This Session's Actions
            {thisSessionActions.length > 0 && (
              <Badge variant="secondary">{thisSessionActions.length}</Badge>
            )}
            {thisSessionActions.length > 5 && (
              <span className="flex items-center gap-1 text-xs font-normal text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Consider focusing on the top 5
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Running list */}
          {thisSessionActions.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              No actions captured yet for this session.
            </p>
          )}
          {thisSessionActions.length > 0 && (
            <div className="space-y-2">
              {thisSessionActions.map((action) => {
                const daysOverdue = action.deadline ? getDaysOverdue(action.deadline) : 0;
                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${
                      ACTION_STATUS_STYLE[action.status] ?? 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium break-words ${
                        action.status === 'abandoned' || action.status === 'carried'
                          ? 'line-through text-gray-400'
                          : 'text-gray-900'
                      }`}>
                        {action.description}
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          action.owner === 'client'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {action.owner}
                        </span>
                        {action.deadline && (
                          <span className={`text-xs flex items-center gap-1 ${
                            daysOverdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'
                          }`}>
                            <Calendar className="h-3 w-3" />
                            {formatDate(action.deadline)}
                            {daysOverdue > 0 && (
                              <span>({daysOverdue}d overdue)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen && action.status === 'open' && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                        onClick={() => deleteActionMutation.mutate(action.id)}
                        disabled={deleteActionMutation.isPending}
                        title="Remove action"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add-action form (only when session is open) */}
          {isOpen && (
            <form onSubmit={handleAddAction} className="space-y-3 pt-3 border-t border-gray-100">
              <div className="space-y-1.5">
                <Label htmlFor="action-desc" className="text-xs font-medium">
                  Action description <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="action-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What needs to happen?"
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Owner</Label>
                  <Select
                    value={newOwner}
                    onValueChange={(v) => setNewOwner(v as 'coach' | 'client')}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="action-deadline" className="text-xs font-medium">
                    Deadline
                  </Label>
                  <Input
                    id="action-deadline"
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Link to objective (optional)</Label>
                  <Select value={newLinkedObj} onValueChange={setNewLinkedObj}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {currentObjectives.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.objective.length > 42
                            ? o.objective.slice(0, 42) + '…'
                            : o.objective}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Link to 1-yr goal (optional)</Label>
                  <Select value={newLinkedGoal} onValueChange={setNewLinkedGoal}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {oneYearGoals.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {(g.specific || '(untitled)').length > 42
                            ? (g.specific || '(untitled)').slice(0, 42) + '…'
                            : (g.specific || '(untitled)')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={!newDesc.trim() || addActionMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {addActionMutation.isPending ? 'Adding…' : 'Add Action'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Close Session Modal ──────────────────────────────────────── */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Close Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="close-client-summary">
                Client summary
                <span className="text-gray-400 font-normal text-xs ml-1">
                  (visible to portal if shared)
                </span>
              </Label>
              <Textarea
                id="close-client-summary"
                rows={4}
                value={closeClientSummary}
                onChange={(e) => setCloseClientSummary(e.target.value)}
                placeholder="Key themes and takeaways from today's session…"
              />
            </div>

            <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200">
              <Switch
                id="close-share"
                checked={closeShare}
                onCheckedChange={setCloseShare}
              />
              <Label htmlFor="close-share" className="text-sm cursor-pointer">
                Share client summary to portal
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="close-internal-summary" className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Internal summary
                <span className="text-gray-400 font-normal text-xs ml-1">
                  (never visible to client)
                </span>
              </Label>
              <Textarea
                id="close-internal-summary"
                rows={4}
                value={closeInternalSummary}
                onChange={(e) => setCloseInternalSummary(e.target.value)}
                placeholder="Your private coaching notes for this session…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClose(false)}
              disabled={closeSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => closeSessionMutation.mutate()}
              disabled={closeSessionMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {closeSessionMutation.isPending ? 'Closing…' : 'Close Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
