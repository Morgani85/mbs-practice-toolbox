import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertConfirmationStatementTurnaroundSchema, withWeekEndingValidation, type InsertConfirmationStatementTurnaround } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { getCurrentWeekEnding } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";

export default function ConfirmationStatementsDataEntry() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const currentWeekEnding = getCurrentWeekEnding();
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: turnaroundData, isLoading: turnaroundLoading } = useQuery({
    queryKey: ['/api/confirmation-statement-turnaround'],
  });

  const form = useForm<InsertConfirmationStatementTurnaround>({
    resolver: zodResolver(withWeekEndingValidation(insertConfirmationStatementTurnaroundSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      turnaroundTimeDays: 0,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertConfirmationStatementTurnaround) => {
      const response = await apiRequest("/api/confirmation-statement-turnaround", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry created successfully",
        description: "Confirmation statement turnaround data has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statement-turnaround"] });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statements/dashboard"] });
      form.reset();
      form.setValue("weekEnding", currentWeekEnding);
    },
    onError: () => {
      toast({
        title: "Error creating entry",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertConfirmationStatementTurnaround> }) => {
      const response = await apiRequest(`/api/confirmation-statement-turnaround/${id}`, "PUT", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry updated successfully",
        description: "Confirmation statement turnaround data has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statement-turnaround"] });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statements/dashboard"] });
      setEditingEntry(null);
      form.reset();
      form.setValue("weekEnding", currentWeekEnding);
    },
    onError: () => {
      toast({
        title: "Error updating entry",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/confirmation-statement-turnaround/${id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Entry deleted successfully",
        description: "Confirmation statement turnaround data has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statement-turnaround"] });
      queryClient.invalidateQueries({ queryKey: ["/api/confirmation-statements/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error deleting entry",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertConfirmationStatementTurnaround) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    form.setValue("teamId", entry.teamId);
    form.setValue("weekEnding", entry.weekEnding);
    form.setValue("turnaroundTimeDays", entry.turnaroundTimeDays);
    form.setValue("notes", entry.notes || "");
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    form.reset();
    form.setValue("weekEnding", currentWeekEnding);
  };

  const handleDelete = (id: number, teamName: string, weekEnding: string) => {
    const confirmMessage = `Are you sure you want to permanently delete this confirmation statement turnaround entry?\n\nTeam: ${teamName}\nWeek Ending: ${weekEnding}\n\nThis action cannot be undone and will remove the entry from all reports and graphs.`;
    
    if (confirm(confirmMessage)) {
      deleteMutation.mutate(id);
    }
  };

  if (teamsLoading || turnaroundLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">CONFIRMATION STATEMENTS MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Turnaround Time Data Entry</h2>
          <p className="text-blue-700">Track confirmation statement turnaround times from earliest filing date to actual filing completion.</p>
        </div>
      </div>

      {/* Data Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingEntry ? "Edit Turnaround Time Entry" : "Add New Turnaround Time Entry"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="weekEnding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week Ending</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() || ""}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent>
                            {(teams as any[])?.map((team: any) => (
                              <SelectItem key={team.id} value={team.id.toString()}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="turnaroundTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmation Statement Turnaround Time (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Enter number of days from earliest filing date to actual filing"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Comments on Issues)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional comments about filing issues, delays, or other relevant information..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingEntry ? "Update Entry" : "Create Entry"}
                </Button>
                {editingEntry && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Current Turnaround Data List */}
      <Card>
        <CardHeader>
          <CardTitle>All Confirmation Statement Turnaround Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(turnaroundData) && turnaroundData.length > 0 ? (
            <div className="space-y-4">
              {turnaroundData.map((entry: any) => {
                const turnaroundDays = entry.turnaroundTimeDays || 0;
                const statusColor = turnaroundDays <= 3 ? "text-green-600" : 
                                  turnaroundDays <= 7 ? "text-orange-600" : "text-red-600";
                
                return (
                  <div key={entry.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{entry.team?.name}</h3>
                        <p className="text-gray-600">Week ending: {entry.weekEnding}</p>
                        <p className={`font-medium ${statusColor}`}>
                          Turnaround: {turnaroundDays} days
                        </p>
                        {entry.notes && (
                          <p className="text-gray-500 text-sm mt-1">{entry.notes}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>Submitted by: <span className="font-medium">{getUserName((entry as any).submittedBy)}</span></span>
                          <span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          disabled={editingEntry?.id === entry.id}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(entry.id, entry.team?.name, entry.weekEnding)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No turnaround data entries found.</p>
              <p className="text-gray-400 text-sm">Add your first entry using the form above.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}