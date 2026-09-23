import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMbsOldestItemsSchema, withWeekEndingValidation, type Team, type MbsOldestItems, type InsertMbsOldestItems } from "@shared/schema";
import { Save, Edit3, AlertCircle, CheckCircle, ArrowLeft, Edit, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { validateWeekEndingDateClient } from "@/lib/utils";

export default function MbsOldestItems() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [editingEntry, setEditingEntry] = useState<MbsOldestItems | null>(null);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: oldestItemsData } = useQuery<MbsOldestItems[]>({
    queryKey: ["/api/mbs-oldest-items", selectedTeam],
    queryFn: async () => {
      const url = selectedTeam 
        ? `/api/mbs-oldest-items?teamId=${selectedTeam}`
        : "/api/mbs-oldest-items";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
  });

  const form = useForm<InsertMbsOldestItems>({
    resolver: zodResolver(withWeekEndingValidation(insertMbsOldestItemsSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: "",
      oldestItemDays: 0,
      target: 10,
      worstPerformingClients: "",
    },
  });

  // Update form when team, week, or editing entry changes
  useEffect(() => {
    if (selectedTeam && selectedWeek) {
      const existing = oldestItemsData?.find(
        (item) => item.teamId === selectedTeam && item.weekEnding === selectedWeek
      );
      
      form.reset({
        teamId: selectedTeam,
        weekEnding: selectedWeek,
        oldestItemDays: existing?.oldestItemDays || 0,
        target: existing?.target || 10,
        worstPerformingClients: existing?.worstPerformingClients || "",
      });
    }
  }, [selectedTeam, selectedWeek, oldestItemsData, form]);

  // Update form when editing an entry
  useEffect(() => {
    if (editingEntry) {
      setSelectedTeam(editingEntry.teamId);
      setSelectedWeek(editingEntry.weekEnding);
      form.reset({
        teamId: editingEntry.teamId,
        weekEnding: editingEntry.weekEnding,
        oldestItemDays: editingEntry.oldestItemDays,
        target: editingEntry.target,
        worstPerformingClients: editingEntry.worstPerformingClients,
      });
    }
  }, [editingEntry, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertMbsOldestItems) => {
      const response = await apiRequest("/api/mbs-oldest-items", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Oldest items to reconcile data saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mbs-oldest-items"] });
      setEditingEntry(null);
      form.reset();
      setSelectedWeek("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save oldest items data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/mbs-oldest-items/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Oldest items entry deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mbs-oldest-items"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMbsOldestItems) => {
    // Validate the weekEnding date
    const validation = validateWeekEndingDateClient(data.weekEnding);
    if (!validation.isValid) {
      toast({
        title: "Invalid date",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const handleEdit = (entry: MbsOldestItems) => {
    setEditingEntry(entry);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    form.reset();
    setSelectedWeek("");
  };

  // Get all entries for display (filtered by selected team if applicable)
  const displayEntries = oldestItemsData || [];

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">INTERNAL BOOKKEEPING MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Oldest Items to Reconcile</h2>
          <p className="text-blue-700">Track oldest reconciliation items and identify worst performing clients</p>
        </div>
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <ArrowLeft size={16} />
              <span>Back to Main Menu</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>{editingEntry ? "Edit" : "Enter"} Oldest Items Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="teamId">Team</Label>
                <Select
                  value={selectedTeam?.toString() || ""}
                  onValueChange={(value) => setSelectedTeam(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="weekEnding">Week Ending Date</Label>
                <Input
                  type="date"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="oldestItemDays">Oldest item to reconcile (in days)</Label>
                <Input
                  type="number"
                  min="0"
                  {...form.register("oldestItemDays", { valueAsNumber: true })}
                  placeholder="Enter number of days"
                />
                {form.formState.errors.oldestItemDays && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.oldestItemDays.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="target">Target (days)</Label>
                <Input
                  type="number"
                  min="0"
                  {...form.register("target", { valueAsNumber: true })}
                  placeholder="Default target is 10 days"
                />
                <p className="text-sm text-gray-500 mt-1">Default target: 10 days</p>
                {form.formState.errors.target && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.target.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="worstPerformingClients">Top 2 worst performing clients & days o/s</Label>
                <Textarea
                  {...form.register("worstPerformingClients")}
                  placeholder="Enter top 2 worst performing clients and their days outstanding (e.g., 'ABC Ltd - 45 days, XYZ Corp - 38 days')"
                  className="resize-none"
                  rows={4}
                />
                {form.formState.errors.worstPerformingClients && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.worstPerformingClients.message}
                  </p>
                )}
              </div>

              <div className="flex space-x-2">
                <Button 
                  type="submit" 
                  disabled={mutation.isPending || !selectedTeam || !selectedWeek}
                  className="flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{mutation.isPending ? "Saving..." : editingEntry ? "Update" : "Save"}</span>
                </Button>
                {editingEntry && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* All Entries */}
        <Card>
          <CardHeader>
            <CardTitle>All Entries ({displayEntries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {displayEntries.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No entries found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Select a team and start entering oldest items data
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {displayEntries.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">
                          {teams?.find(t => t.id === entry.teamId)?.name || 'Unknown Team'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Week ending: {format(new Date(entry.weekEnding), "MMM dd, yyyy")}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this oldest items entry? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Oldest item:</span>
                        <span className={`font-medium ${entry.oldestItemDays > entry.target ? 'text-red-600' : 'text-green-600'}`}>
                          {entry.oldestItemDays} days
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Target:</span>
                        <span className="font-medium">{entry.target} days</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Worst performing clients:</span>
                        <div className="mt-1 text-sm bg-gray-50 p-2 rounded">
                          {entry.worstPerformingClients || "No details provided"}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>Submitted by: <span className="font-medium">{getUserName((entry as any).submittedBy)}</span></span>
                        <span>{(entry as any).updatedAt ? new Date((entry as any).updatedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}