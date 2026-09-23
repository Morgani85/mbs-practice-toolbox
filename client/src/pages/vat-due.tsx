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
import { insertVatDueSchema, withWeekEndingValidation, type InsertVatDue } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { getCurrentWeekEnding } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";

// Helper function to generate quarter ending dates
const getQuarterEndingOptions = (): Array<{label: string, value: string, deadline: string}> => {
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const options: Array<{label: string, value: string, deadline: string}> = [];
  const now = new Date();
  // Start from the current month and go back 24 months
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-based, current month
  for (let i = 0; i < 24; i++) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    options.push({ label: `${monthNames[month]} ${year}`, value: dateValue, deadline: getVATDeadline(dateValue) });
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return options;
};

// Helper function to calculate VAT submission deadline
const getVATDeadline = (quarterEndDate: string) => {
  const quarterEnd = new Date(quarterEndDate);
  // VAT returns due 1 month + 7 days after quarter end
  const deadline = new Date(quarterEnd);
  deadline.setMonth(deadline.getMonth() + 1);
  deadline.setDate(deadline.getDate() + 7);
  return deadline.toLocaleDateString('en-GB');
};

export default function VatDue() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const currentWeekEnding = getCurrentWeekEnding();
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: vatDueData, isLoading: vatDueLoading } = useQuery({
    queryKey: ['/api/vat/due'],
  });

  const form = useForm<InsertVatDue>({
    resolver: zodResolver(withWeekEndingValidation(insertVatDueSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      quarterEnding: "",
      vatDue: 0,
      notes: "",
    },
  });

  const createVatDueMutation = useMutation({
    mutationFn: async (data: InsertVatDue) => {
      const response = await apiRequest('/api/vat/due', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/due'] });
      toast({
        title: "Success",
        description: "VAT due data updated successfully",
      });
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        quarterEnding: "",
        vatDue: 0,
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update VAT due data",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertVatDue }) => {
      return apiRequest(`/api/vat/due/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/due'] });
      setEditingEntry(null);
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        quarterEnding: "",
        vatDue: 0,
        notes: "",
      });
      toast({
        title: "Success",
        description: "VAT due entry updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update VAT due entry",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/vat/due/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/due'] });
      toast({
        title: "Success",
        description: "VAT due entry deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete VAT due entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVatDue) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createVatDueMutation.mutate(data);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    form.reset({
      teamId: entry.teamId,
      weekEnding: entry.weekEnding,
      quarterEnding: entry.quarterEnding,
      vatDue: entry.vatDue,
      notes: entry.notes || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    form.reset({
      teamId: 0,
      weekEnding: currentWeekEnding,
      quarterEnding: "",
      vatDue: 0,
      notes: "",
    });
  };

  const handleDelete = (id: number, teamName: string, weekEnding: string) => {
    const confirmMessage = `Are you sure you want to permanently delete this VAT due entry?\n\nTeam: ${teamName}\nWeek Ending: ${weekEnding}\n\nThis action cannot be undone and will remove the entry from all reports and graphs.`;
    
    if (confirm(confirmMessage)) {
      deleteMutation.mutate(id);
    }
  };

  if (teamsLoading || vatDueLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-green-900 mb-1">VAT MODULE</h1>
          <h2 className="text-xl font-semibold text-green-800 mb-2">VAT Returns Due</h2>
          <p className="text-green-700">Track VAT returns remaining to file for each quarter ending. Monitor progress toward deadline (due 1 month + 7 days after quarter end).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* VAT Due Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEntry ? "Edit VAT Returns Due Entry" : "Update VAT Returns Due by Quarter"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(teams) && teams.map((team: any) => (
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
                  name="quarterEnding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Quarter Ending</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select quarter ending month" />
                          </SelectTrigger>
                          <SelectContent>
                            {getQuarterEndingOptions().map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex flex-col">
                                  <span>{option.label}</span>
                                  <span className="text-xs text-gray-500">Due: {option.deadline}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vatDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Returns Remaining to Prepare & Send for Selected Quarter</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter number of VAT returns due"
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
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about upcoming VAT returns..."
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
                    className="flex-1"
                    disabled={createVatDueMutation.isPending || updateMutation.isPending}
                  >
                    {(createVatDueMutation.isPending || updateMutation.isPending) 
                      ? "Saving..." 
                      : editingEntry 
                        ? "Update Entry" 
                        : "Create Entry"
                    }
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

        {/* Current VAT Due List */}
        <Card>
          <CardHeader>
            <CardTitle>All VAT Returns Due Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(vatDueData) && vatDueData.length > 0 ? (
              <div className="space-y-4">
                {vatDueData.map((due: any) => {
                  const vatDueCount = due.vatDue || 0;
                  const statusColor = vatDueCount === 0 ? "text-green-600" : 
                                    vatDueCount <= 2 ? "text-orange-600" : "text-red-600";
                  
                  return (
                    <div key={due.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{due.team?.name}</h3>
                          <p className="text-gray-600">Week ending: {due.weekEnding}</p>
                          <p className="text-gray-600">Quarter ending: {due.quarterEnding}</p>
                          <p className={`font-medium ${statusColor}`}>
                            Due: {vatDueCount} VAT returns
                          </p>
                          {due.notes && (
                            <p className="text-gray-500 text-sm mt-1">{due.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-500 mr-2 text-right">
                            <div>{getUserName((due as any).submittedBy)}</div>
                            <div>{new Date(due.updatedAt).toLocaleString()}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(due)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(due.id, due.team?.name || 'Unknown Team', due.weekEnding)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No VAT due data recorded yet</p>
                <p className="text-gray-400 text-sm mt-1">Update your first entry to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">About VAT Returns Due Tracking</h3>
          <div className="text-gray-600 space-y-2">
            <p>• Track the number of VAT returns due for submission in the next 3 months</p>
            <p>• Lower numbers are better - aim to reduce overdue returns to zero</p>
            <p>• Color coding: Green (0), Orange (1-2), Red (3+)</p>
            <p>• Regular updates help prevent bottlenecks and ensure timely VAT submissions</p>
            <p>• Use this metric to identify teams that may need additional support or resources</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}