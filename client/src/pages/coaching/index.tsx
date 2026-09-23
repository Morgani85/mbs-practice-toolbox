import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, ChevronRight, UserCircle2, Lightbulb, CalendarDays } from "lucide-react";

type CoachingClient = {
  id: number;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  linkedUserId?: number;
  portalEnabled: boolean;
  lastSessionDate?: string | null;
};

export default function CoachingIndex() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<CoachingClient | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: clients = [], isLoading } = useQuery<CoachingClient[]>({
    queryKey: ["/api/coaching/clients"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CoachingClient>) =>
      apiRequest("/api/coaching/clients", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients"] });
      setShowAdd(false);
      toast({ title: "Client added" });
    },
    onError: () => toast({ title: "Failed to add client", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CoachingClient> }) =>
      apiRequest(`/api/coaching/clients/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients"] });
      setEditClient(null);
      toast({ title: "Client updated" });
    },
    onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/coaching/clients/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching/clients"] });
      setDeleteId(null);
      toast({ title: "Client deleted" });
    },
    onError: () => toast({ title: "Failed to delete client", variant: "destructive" }),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-900">Coaching Clients</h1>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20" />
            </Card>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <UserCircle2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No coaching clients yet</p>
            <p className="text-sm mt-1">Add your first client to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <Link href={`/coaching/clients/${client.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-700 font-semibold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{client.name}</p>
                        {client.portalEnabled && (
                          <Badge variant="secondary" className="text-xs">Portal active</Badge>
                        )}
                      </div>
                      {client.companyName && (
                        <p className="text-sm text-gray-500 truncate">{client.companyName}</p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        {client.email && (
                          <p className="text-xs text-gray-400 truncate">{client.email}</p>
                        )}
                        {client.lastSessionDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                            <CalendarDays className="h-3 w-3" />
                            Last session:{" "}
                            {new Date(client.lastSessionDate).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setEditClient(client); }}
                  >
                    <Pencil className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                  <Link href={`/coaching/clients/${client.id}`}>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Client Dialog */}
      <ClientFormDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        title="Add Coaching Client"
      />

      {/* Edit Client Dialog */}
      {editClient && (
        <ClientFormDialog
          open={!!editClient}
          onClose={() => setEditClient(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editClient.id, data })}
          isPending={updateMutation.isPending}
          title="Edit Client"
          defaultValues={editClient}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coaching client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this client and all their notes, goals, and objectives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientFormDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  title,
  defaultValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<CoachingClient>) => void;
  isPending: boolean;
  title: string;
  defaultValues?: Partial<CoachingClient>;
}) {
  const [form, setForm] = useState({
    name: defaultValues?.name || "",
    companyName: defaultValues?.companyName || "",
    email: defaultValues?.email || "",
    phone: defaultValues?.phone || "",
    notes: defaultValues?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
