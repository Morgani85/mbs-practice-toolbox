import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Receipt, Edit, Trash2, Plus, Calendar, TrendingUp, Target } from "lucide-react";
import type { Team, TaxData, InsertTaxData } from "@shared/schema";
import { insertTaxDataSchema, withWeekEndingValidation } from "@shared/schema";

// Form schema without the cumulative field - includes date validation
const taxDataFormSchema = withWeekEndingValidation(insertTaxDataSchema.omit({ taxYearStart: true }));
type TaxDataForm = z.infer<typeof taxDataFormSchema>;

// Helper function to get current week ending date
function getCurrentWeekEnding(): string {
  const today = new Date();
  const currentDay = today.getDay();
  const daysToSaturday = currentDay === 0 ? -1 : 6 - currentDay;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysToSaturday);
  return saturday.toISOString().split('T')[0];
}

export default function TaxDataEntry() {
  const [editingEntry, setEditingEntry] = useState<TaxData | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TaxData | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const queryClient = useQueryClient();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  const form = useForm<TaxDataForm>({
    resolver: zodResolver(taxDataFormSchema),
    defaultValues: {
      teamId: 0,
      weekEnding: getCurrentWeekEnding(),
      personalTaxCompletedThisWeek: 0,
      personalTaxTotalToComplete: 0,
      notes: "",
    },
  });

  const { data: taxData = [], isLoading, error } = useQuery<TaxData[]>({
    queryKey: ['/api/tax-data', selectedTeam],
    queryFn: async () => {
      const url = selectedTeam ? `/api/tax-data?teamId=${selectedTeam}` : '/api/tax-data';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tax data');
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch tax progress data with auto-calculated cumulative totals
  const { data: taxProgress } = useQuery({
    queryKey: ['/api/tax-progress', selectedTeam],
    queryFn: async () => {
      const url = selectedTeam ? `/api/tax-progress?teamId=${selectedTeam}` : '/api/tax-progress';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tax progress data');
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TaxDataForm) => {
      const response = await fetch('/api/tax-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create tax data' }));
        throw new Error(errorData.message || 'Failed to create tax data');
      }
      return response.json();
    },
    onSuccess: () => {
      // Force immediate refetch of both data sets
      queryClient.invalidateQueries({ queryKey: ['/api/tax-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-progress'] });
      
      // Wait a moment then refetch to ensure data is updated
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/tax-data'] });
        queryClient.refetchQueries({ queryKey: ['/api/tax-progress'] });
      }, 100);
      
      form.reset({
        teamId: 0,
        weekEnding: getCurrentWeekEnding(),
        personalTaxCompletedThisWeek: 0,
        personalTaxTotalToComplete: 0,
        notes: "",
      });
      toast({
        title: "Success",
        description: "Tax data entry created successfully",
      });
    },
    onError: (error: any) => {
      console.error("Tax data creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create tax data entry",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TaxDataForm) => {
      const response = await fetch(`/api/tax-data/${data.teamId}/${data.weekEnding}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update tax data');
      return response.json();
    },
    onSuccess: () => {
      // Force immediate refetch of both data sets
      queryClient.invalidateQueries({ queryKey: ['/api/tax-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-progress'] });
      
      // Wait a moment then refetch to ensure data is updated
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/tax-data'] });
        queryClient.refetchQueries({ queryKey: ['/api/tax-progress'] });
      }, 100);
      
      setEditingEntry(null);
      form.reset({
        teamId: 0,
        weekEnding: getCurrentWeekEnding(),
        personalTaxCompletedThisWeek: 0,
        personalTaxTotalToComplete: 0,
        notes: "",
      });
      toast({
        title: "Success",
        description: "Tax data entry updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tax data entry",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: TaxData) => {
      const response = await fetch(`/api/tax-data/${entry.teamId}/${entry.weekEnding}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete tax data');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-progress'] });
      setDeleteEntry(null);
      toast({
        title: "Success",
        description: "Tax data entry deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tax data entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaxDataForm) => {
    console.log("Submitting tax data:", data);
    
    // Validation check
    if (!data.teamId || data.teamId === 0) {
      toast({
        title: "Error",
        description: "Please select a team",
        variant: "destructive",
      });
      return;
    }
    
    if (editingEntry) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (entry: TaxData) => {
    setEditingEntry(entry);
    form.reset({
      teamId: entry.teamId,
      weekEnding: entry.weekEnding,
      personalTaxCompletedThisWeek: entry.personalTaxCompletedThisWeek,
      personalTaxTotalToComplete: entry.personalTaxTotalToComplete,
      notes: entry.notes || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    form.reset({
      teamId: 0,
      weekEnding: getCurrentWeekEnding(),
      personalTaxCompletedThisWeek: 0,
      personalTaxTotalToComplete: 0,
      notes: "",
    });
  };

  // Auto-populate total target when team is selected
  useEffect(() => {
    const selectedTeamId = form.watch('teamId');
    if (selectedTeamId && selectedTeamId > 0 && !editingEntry && taxData) {
      // Find the most recent entry for this team to get the last total target
      const teamEntries = taxData.filter(entry => entry.teamId === selectedTeamId);
      if (teamEntries.length > 0) {
        // Sort by weekEnding to get the most recent
        const sortedEntries = teamEntries.sort((a, b) => 
          new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
        );
        const lastEntry = sortedEntries[0];
        
        // Auto-populate the total target field with the last entered amount
        form.setValue('personalTaxTotalToComplete', lastEntry.personalTaxTotalToComplete);
      }
    }
  }, [form.watch('teamId'), taxData, editingEntry, form]);

  const handleDelete = (entry: TaxData) => {
    setDeleteEntry(entry);
  };

  const confirmDelete = () => {
    if (deleteEntry) {
      deleteMutation.mutate(deleteEntry);
    }
  };

  // Get cumulative total for a specific entry from progress data
  const getCumulativeTotal = (teamId: number, weekEnding: string) => {
    if (!taxProgress?.progressData) return null;
    const progressEntry = taxProgress.progressData.find(
      (p: any) => p.teamId === teamId && p.weekEnding === weekEnding
    );
    return progressEntry?.cumulativeCompleted ?? null;
  };

  // Get percentage complete for a specific entry
  const getPercentageComplete = (teamId: number, weekEnding: string) => {
    if (!taxProgress?.progressData) return null;
    const progressEntry = taxProgress.progressData.find(
      (p: any) => p.teamId === teamId && p.weekEnding === weekEnding
    );
    return progressEntry?.percentageComplete || null;
  };

  const getTeamName = (teamId: number) => {
    const team = teams?.find(t => t.id === teamId);
    return team?.name || `Team ${teamId}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading tax data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading tax data</p>
      </div>
    );
  }

  const taxYearInfo = taxProgress?.taxYearInfo;
  const taxYearLabel = taxYearInfo?.label ?? taxYearInfo?.taxYearDisplay ?? "";
  const isGracePeriod = !!taxYearInfo?.isGracePeriod;
  const isActive = !!taxYearInfo?.isActive;

  return (
    <div className="space-y-6">
      {/* Tax Year Status Banner */}
      {taxYearInfo && (
        <div className={`border-l-4 p-4 rounded-r-md flex items-start gap-3 ${
          isGracePeriod
            ? "bg-amber-50 border-amber-400"
            : isActive
              ? "bg-blue-50 border-blue-400"
              : "bg-green-50 border-green-400"
        }`}>
          <Calendar className={`h-5 w-5 mt-0.5 shrink-0 ${
            isGracePeriod ? "text-amber-500" : isActive ? "text-blue-500" : "text-green-500"
          }`} />
          <div>
            <p className={`font-semibold ${
              isGracePeriod ? "text-amber-800" : isActive ? "text-blue-800" : "text-green-800"
            }`}>
              Filing {taxYearLabel} returns
              {isActive && " — Active"}
              {isGracePeriod && " — Deadline passed (read-only)"}
              {!isActive && !isGracePeriod && " — Starting soon"}
            </p>
            <p className={`text-sm ${
              isGracePeriod ? "text-amber-700" : isActive ? "text-blue-700" : "text-green-700"
            }`}>
              {isGracePeriod
                ? `The 31 January filing deadline has passed. Data entry is closed until 6 April when work on the next year's returns begins.`
                : isActive
                  ? `Filing window: 6 April → 31 January ${taxYearInfo.filingDeadline.slice(0, 4)}. Cumulative totals are calculated automatically.`
                  : `The new filing season opens on 6 April.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Data Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            {editingEntry ? 'Edit Tax Data Entry' : 'Add Tax Data Entry'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teams?.map((team) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="personalTaxCompletedThisWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Completed This Week</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
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
                  name="personalTaxTotalToComplete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Target (Annual)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes about this week's tax completion data..."
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || isGracePeriod}
                  className="flex-1"
                  title={isGracePeriod ? "Data entry is closed during the grace period (Feb–Mar)" : undefined}
                >
                  {editingEntry ? 'Update Entry' : 'Create Entry'}
                </Button>
                {editingEntry && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select
              onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}
              value={selectedTeam?.toString() || "all"}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Data Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {taxData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tax data entries found. Create your first entry above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Team</th>
                    <th className="text-left p-2">Week Ending</th>
                    <th className="text-left p-2">Completed This Week</th>
                    <th className="text-left p-2">Cumulative Total</th>
                    <th className="text-left p-2">Annual Target</th>
                    <th className="text-left p-2">Progress</th>
                    <th className="text-left p-2">Notes</th>
                    <th className="text-left p-2">Submitted By</th>
                    <th className="text-left p-2">Submitted At</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {taxData.map((entry) => {
                    const cumulativeTotal = getCumulativeTotal(entry.teamId, entry.weekEnding);
                    const percentageComplete = getPercentageComplete(entry.teamId, entry.weekEnding);
                    
                    return (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{getTeamName(entry.teamId)}</td>
                        <td className="p-2">{format(new Date(entry.weekEnding), 'dd MMM yyyy')}</td>
                        <td className="p-2">{entry.personalTaxCompletedThisWeek}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-blue-600">
                              {cumulativeTotal !== null ? cumulativeTotal : 'Calculating...'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-green-500" />
                            {entry.personalTaxTotalToComplete}
                          </div>
                        </td>
                        <td className="p-2">
                          {percentageComplete !== null && (
                            <Badge
                              variant={percentageComplete >= 100 ? "default" : percentageComplete >= 75 ? "secondary" : "outline"}
                            >
                              {percentageComplete}%
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 max-w-xs truncate">{entry.notes || '-'}</td>
                        <td className="p-2 text-sm text-gray-500">{getUserName((entry as any).submittedBy)}</td>
                        <td className="p-2 text-sm text-gray-500 whitespace-nowrap">{(entry as any).updatedAt ? new Date((entry as any).updatedAt).toLocaleString() : "—"}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(entry)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(entry)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteEntry !== null} onOpenChange={() => setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tax data entry for {deleteEntry && getTeamName(deleteEntry.teamId)} 
              (Week ending: {deleteEntry && format(new Date(deleteEntry.weekEnding), 'dd MMM yyyy')})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}