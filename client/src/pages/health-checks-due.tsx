import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHealthChecksDueSchema, withWeekEndingValidation, type InsertHealthChecksDue, type HealthChecksDue } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { getCurrentWeekEnding } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";

export default function HealthChecksDue() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const currentWeekEnding = getCurrentWeekEnding();
  const [editingEntry, setEditingEntry] = useState<HealthChecksDue | null>(null);

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: healthChecksDueData, isLoading: healthChecksDueLoading } = useQuery({
    queryKey: ['/api/health-checks/due'],
  });

  const form = useForm<InsertHealthChecksDue>({
    resolver: zodResolver(withWeekEndingValidation(insertHealthChecksDueSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      healthChecksDue: 0,
      notes: "",
    },
  });

  const createHealthChecksDueMutation = useMutation({
    mutationFn: async (data: InsertHealthChecksDue) => {
      const response = await apiRequest('/api/health-checks/due', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/due'] });
      toast({
        title: "Success",
        description: "Health checks due data updated successfully",
      });
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        healthChecksDue: 0,
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update health checks due data",
        variant: "destructive",
      });
    },
  });

  const deleteHealthChecksDueMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/health-checks/due/${id}`, 'DELETE');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/due'] });
      toast({
        title: "Success",
        description: "Health checks entry deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete health checks entry",
        variant: "destructive",
      });
    },
  });

  const updateHealthChecksDueMutation = useMutation({
    mutationFn: async (data: InsertHealthChecksDue & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest(`/api/health-checks/due/${id}`, 'PATCH', updateData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/due'] });
      toast({
        title: "Success",
        description: "Health checks entry updated successfully",
      });
      setEditingEntry(null);
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        healthChecksDue: 0,
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update health checks entry",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (entry: HealthChecksDue) => {
    setEditingEntry(entry);
    form.reset({
      teamId: entry.teamId,
      weekEnding: entry.weekEnding,
      healthChecksDue: entry.healthChecksDue,
      notes: entry.notes || "",
    });
  };

  const handleDelete = (id: number) => {
    deleteHealthChecksDueMutation.mutate(id);
  };

  const onSubmit = (data: InsertHealthChecksDue) => {
    if (editingEntry) {
      updateHealthChecksDueMutation.mutate({ ...data, id: editingEntry.id });
    } else {
      createHealthChecksDueMutation.mutate(data);
    }
  };

  if (teamsLoading || healthChecksDueLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-purple-900 mb-1">MANAGEMENT ACCOUNTS MODULE</h1>
          <h2 className="text-xl font-semibold text-purple-800 mb-2">Management Accounts Data Entry</h2>
          <p className="text-purple-700">Track management accounts remaining this month by team</p>
        </div>
      </div>

      {/* Important Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Management Accounts Target Information</h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Target:</strong> 0 management accounts remaining</p>
          <p>• <strong>Deadline:</strong> Target should be reached by the 15th of each month</p>
          <p>• <strong>Reset:</strong> Targets reset on the 1st of the next month</p>
          <p>• <strong>Monthly Setup:</strong> Team members set next month's target by completing scorecard entry on the 1st</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Management Accounts Due Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {editingEntry ? "Edit Management Accounts Entry" : "Update Management Accounts Remaining"}
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
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Array.isArray(teams) ? teams : []).map((team: any) => (
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

                <FormField
                  control={form.control}
                  name="healthChecksDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Management Accounts Remaining This Month</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter number of management accounts remaining"
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
                          placeholder="Additional notes about management accounts..."
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
                    disabled={createHealthChecksDueMutation.isPending || updateHealthChecksDueMutation.isPending}
                  >
                    {(createHealthChecksDueMutation.isPending || updateHealthChecksDueMutation.isPending) 
                      ? "Saving..." 
                      : editingEntry 
                        ? "Update Entry" 
                        : "Add Entry"
                    }
                  </Button>
                  {editingEntry && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setEditingEntry(null);
                        form.reset({
                          teamId: 0,
                          weekEnding: currentWeekEnding,
                          healthChecksDue: 0,
                          notes: "",
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* All Management Accounts Due Entries */}
        <Card>
          <CardHeader>
            <CardTitle>All Management Accounts Due Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Array.isArray(healthChecksDueData) ? healthChecksDueData : []).map((item: any) => (
                <div key={`${item.teamId}-${item.weekEnding}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.team?.name}</h4>
                      <p className="text-sm text-gray-600">
                        Week ending: {new Date(item.weekEnding).toLocaleDateString()}
                      </p>
                      <p className={`text-lg font-semibold ${
                        item.healthChecksDue === 0 ? "text-green-600" : 
                        item.healthChecksDue <= 2 ? "text-orange-600" : "text-red-600"
                      }`}>
                        {item.healthChecksDue} management accounts remaining
                      </p>
                      {item.notes && (
                        <p className="text-sm text-gray-500 mt-2">{item.notes}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Submitted by: <span className="font-medium">{getUserName(item.submittedBy)}</span></span>
                        <span>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(item)}
                        disabled={editingEntry?.id === item.id}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deleteHealthChecksDueMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Management Accounts Entry</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this health checks entry for {item.team?.name} 
                              (Week ending: {new Date(item.weekEnding).toLocaleDateString()})?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
              {!(Array.isArray(healthChecksDueData) ? healthChecksDueData : []).length && (
                <p className="text-gray-500 text-center py-8">No health checks due data entered yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}