import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle, Calendar, Percent, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  type Team, 
  type InsertVatTurnoverChecks,
  type VatTurnoverChecks,
  insertVatTurnoverChecksSchema,
  withWeekEndingValidation
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentWeekEnding } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";

export default function VatTurnoverChecks() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<VatTurnoverChecks | null>(null);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: vatTurnoverChecks = [] } = useQuery<VatTurnoverChecks[]>({
    queryKey: ["/api/vat/turnover-checks", selectedTeam],
    enabled: true,
  });

  const form = useForm<InsertVatTurnoverChecks>({
    resolver: zodResolver(withWeekEndingValidation(insertVatTurnoverChecksSchema.extend({
      percentageComplete: insertVatTurnoverChecksSchema.shape.percentageComplete.refine(
        (val: number) => val >= 0 && val <= 100,
        "Percentage must be between 0 and 100"
      ),
    }))),
    defaultValues: {
      teamId: 0,
      weekEnding: getCurrentWeekEnding(),
      percentageComplete: 0,
      notes: "",
    },
  });

  const createVatTurnoverChecksMutation = useMutation({
    mutationFn: async (data: InsertVatTurnoverChecks) => {
      if (editingEntry) {
        const response = await apiRequest(`/api/vat/turnover-checks/${editingEntry.id}`, 'PUT', data);
        return response;
      } else {
        const response = await apiRequest('/api/vat/turnover-checks', 'POST', data);
        return response;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/turnover-checks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vat/dashboard'] });
      toast({
        title: "Success",
        description: editingEntry ? "VAT turnover checks entry updated successfully" : "VAT turnover checks entry saved successfully",
      });
      form.reset({
        teamId: form.getValues().teamId,
        weekEnding: getCurrentWeekEnding(),
        percentageComplete: 0,
        notes: "",
      });
      setEditingEntry(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: editingEntry ? "Failed to update VAT turnover checks entry" : "Failed to save VAT turnover checks entry",
        variant: "destructive",
      });
    },
  });

  const deleteVatTurnoverChecksMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/vat/turnover-checks/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/turnover-checks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vat/dashboard'] });
      toast({
        title: "Success",
        description: "VAT turnover checks entry deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete VAT turnover checks entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVatTurnoverChecks) => {
    createVatTurnoverChecksMutation.mutate(data);
  };

  const handleEdit = (entry: VatTurnoverChecks) => {
    setEditingEntry(entry);
    form.reset({
      teamId: entry.teamId,
      weekEnding: entry.weekEnding,
      percentageComplete: entry.percentageComplete,
      notes: entry.notes || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    form.reset({
      teamId: 0,
      weekEnding: getCurrentWeekEnding(),
      percentageComplete: 0,
      notes: "",
    });
  };

  const handleDelete = (id: number) => {
    deleteVatTurnoverChecksMutation.mutate(id);
  };

  const filteredVatTurnoverChecks = selectedTeam 
    ? vatTurnoverChecks.filter(entry => entry.teamId === selectedTeam)
    : vatTurnoverChecks;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-green-900 mb-1">VAT MODULE</h1>
            <h2 className="text-xl font-semibold text-green-800 mb-2">VAT Turnover Checks</h2>
            <p className="text-green-700">Enter weekly percentage completion for VAT turnover checks</p>
          </div>
        </div>
        <Link href="/">
          <Button variant="outline" className="flex items-center space-x-2">
            <ArrowLeft size={16} />
            <span>Back to Main Menu</span>
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Percent className="h-5 w-5" />
              <span>Enter VAT Turnover Checks Data</span>
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
                      <Select
                        value={field.value?.toString() || ""}
                        onValueChange={(value) => {
                          const teamId = parseInt(value);
                          field.onChange(teamId);
                          setSelectedTeam(teamId);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team..." />
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

                <FormField
                  control={form.control}
                  name="percentageComplete"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentage Complete (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          max="100"
                          placeholder="e.g. 85"
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
                          placeholder="Add any additional notes..."
                          className="min-h-[100px]"
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
                    disabled={createVatTurnoverChecksMutation.isPending}
                  >
                    {createVatTurnoverChecksMutation.isPending ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {editingEntry ? "Update Entry" : "Save Entry"}
                      </>
                    )}
                  </Button>
                  {editingEntry && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={createVatTurnoverChecksMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Recent Entries</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select
                value={selectedTeam?.toString() || "all"}
                onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by team..." />
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

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredVatTurnoverChecks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No entries found</p>
              ) : (
                filteredVatTurnoverChecks
                  .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
                  .map((entry) => {
                    const team = teams?.find(t => t.id === entry.teamId);
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{team?.name}</p>
                            <p className="text-sm text-gray-600">
                              Week ending {format(new Date(entry.weekEnding), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className={`text-lg font-bold ${
                              entry.percentageComplete >= 90 ? "text-green-600" : 
                              entry.percentageComplete >= 70 ? "text-yellow-600" : "text-red-600"
                            }`}>
                              {entry.percentageComplete}%
                            </p>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(entry)}
                                disabled={deleteVatTurnoverChecksMutation.isPending}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={deleteVatTurnoverChecksMutation.isPending}
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this VAT turnover checks entry for {team?.name} (week ending {format(new Date(entry.weekEnding), "MMM dd, yyyy")})?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(entry.id)}
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
                        {entry.notes && (
                          <p className="text-sm text-gray-600 mt-2">{entry.notes}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Submitted by: <span className="font-medium">{getUserName((entry as any).submittedBy)}</span></span>
                          <span>{format(new Date(entry.updatedAt), "MMM dd, yyyy HH:mm")}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}