import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertWeeklyResultSchema, withWeekEndingValidation, type Team, type WeeklyTarget, type WeeklyResult, type InsertWeeklyResult } from "@shared/schema";
import { Save, Info, CheckCircle, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { validateWeekEndingDateClient } from "@/lib/utils";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { useUsers } from "@/hooks/use-users";

export default function Results() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const [selectedWeek, setSelectedWeek] = useState("");

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: targets } = useQuery<WeeklyTarget[]>({
    queryKey: ["/api/targets", selectedTeam],
    enabled: !!selectedTeam,
    queryFn: async () => {
      const params = selectedTeam ? `?teamId=${selectedTeam}` : '';
      const response = await fetch(`/api/targets${params}`);
      return response.json();
    },
  });

  const { data: currentResult } = useQuery<WeeklyResult>({
    queryKey: ["/api/results", selectedTeam, selectedWeek],
    enabled: !!selectedTeam && !!selectedWeek,
    queryFn: async () => {
      const response = await fetch(`/api/results/${selectedTeam}/${selectedWeek}`);
      if (response.status === 404) return null;
      return response.json();
    },
  });

  // Get performance data for rolling calculations
  const { data: performanceData } = useQuery<{
    performanceData: Array<{
      teamId: number;
      teamName: string;
      weekEnding: string;
      rollingFourWeekTarget: number | null;
      rollingFourWeekActual: number | null;
      weeklyActual: number | null;
      accountsDue: number | null;
    }>;
  }>({
    queryKey: ["/api/dashboard"],
  });

  // Also get direct results data for historical display
  const { data: allResults } = useQuery<WeeklyResult[]>({
    queryKey: ["/api/results"],
  });

  const form = useForm<InsertWeeklyResult>({
    resolver: zodResolver(withWeekEndingValidation(insertWeeklyResultSchema)),
    defaultValues: {
      teamId: selectedTeam || 0,
      weekEnding: "",
      actualCompleted: 0,
      notes: "",
    },
  });

  // Update form when currentResult changes
  useEffect(() => {
    if (currentResult) {
      form.reset({
        teamId: currentResult.teamId,
        weekEnding: currentResult.weekEnding,
        actualCompleted: currentResult.actualCompleted,
        notes: currentResult.notes || "",
      });
    } else if (selectedTeam && selectedWeek) {
      form.reset({
        teamId: selectedTeam,
        weekEnding: selectedWeek,
        actualCompleted: 0,
        notes: "",
      });
    }
  }, [currentResult, selectedTeam, selectedWeek, form]);

  const createResultMutation = useMutation({
    mutationFn: async (data: InsertWeeklyResult) => {
      const response = await apiRequest("/api/results", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Results saved successfully",
        description: "Your weekly results have been saved.",
      });
      // Invalidate all related queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/targets"] });
      // Force refetch of current result
      queryClient.refetchQueries({ queryKey: ["/api/results", selectedTeam, selectedWeek] });
    },
    onError: () => {
      toast({
        title: "Error saving results",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/results/${id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Result deleted successfully",
        description: "The weekly result has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error deleting result",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWeeklyResult) => {
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
    createResultMutation.mutate(data);
  };

  const handleEdit = (result: WeeklyResult) => {
    setSelectedTeam(result.teamId);
    setSelectedWeek(result.weekEnding);
    form.reset({
      teamId: result.teamId,
      weekEnding: result.weekEnding,
      actualCompleted: result.actualCompleted,
      notes: result.notes || "",
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this result? This action cannot be undone.")) {
      deleteResultMutation.mutate(id);
    }
  };

  // Get current target for selected team and week
  const selectedTarget = targets?.find(t => t.weekEnding === selectedWeek && t.teamId === selectedTeam);
  const actualValue = form.watch("actualCompleted");
  
  // Get rolling 4-week performance data for this team and week
  const weekPerformance = performanceData?.performanceData?.find(
    (p) => p.teamId === selectedTeam && p.weekEnding === selectedWeek
  );
  
  const rollingTarget = selectedTarget?.rollingFourWeekTarget || 0;
  const rollingActual = weekPerformance?.rollingFourWeekActual || 0;
  const weeklyActual = actualValue || currentResult?.actualCompleted || 0;
  
  const rollingVariance = rollingActual - rollingTarget;
  const rollingAchievement = rollingTarget > 0 ? Math.round((rollingActual / rollingTarget) * 100) : 0;
  const metRollingTarget = rollingActual >= rollingTarget;

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">ACCOUNTS MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Accounts Prepared</h2>
          <p className="text-blue-700">Record the actual number of accounts prepared for each week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Results Entry Form */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Results Entry</h3>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="teamId">Team</Label>
                <Select
                  value={selectedTeam?.toString() || ""}
                  onValueChange={(value) => {
                    const teamId = parseInt(value);
                    setSelectedTeam(teamId);
                    form.setValue("teamId", teamId);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team..." />
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
                  onChange={(e) => {
                    setSelectedWeek(e.target.value);
                    form.setValue("weekEnding", e.target.value);
                  }}
                />
              </div>

              {selectedTarget && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Info className="text-blue-500 mr-2" size={16} />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Target for selected week</p>
                      <p className="text-lg font-semibold text-blue-900">{selectedTarget.rollingFourWeekTarget} accounts (4-week rolling target)</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="actualCompleted">Actual Accounts Prepared</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 28"
                  {...form.register("actualCompleted", { valueAsNumber: true })}
                />
                {form.formState.errors.actualCompleted && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.actualCompleted.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Any additional notes about this week's performance..."
                  {...form.register("notes")}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Button 
                  type="submit" 
                  disabled={createResultMutation.isPending || !selectedTeam || !selectedWeek}
                  className="bg-primary hover:bg-blue-700"
                >
                  <Save className="mr-2" size={16} />
                  {createResultMutation.isPending ? "Saving..." : "Save Results"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Clear Form
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Performance Preview */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Performance Preview</h3>
            
            {selectedWeek ? (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">This Week's Entry</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700">Weekly Actual</span>
                    <span className="text-lg font-semibold text-blue-900">{weeklyActual} accounts</span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">4-Week Rolling Performance</h4>
                  
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Rolling Target (4 weeks)</span>
                    <span className="text-lg font-semibold text-gray-900">{rollingTarget} accounts</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Rolling Actual (4 weeks)</span>
                    <span className="text-lg font-semibold text-gray-900">{rollingActual} accounts</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Variance</span>
                    <span className={`text-lg font-semibold ${rollingVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {rollingVariance >= 0 ? "+" : ""}{rollingVariance} accounts
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-sm font-medium text-gray-600">Achievement Rate</span>
                    <span className={`text-lg font-semibold ${metRollingTarget ? "text-green-600" : "text-red-600"}`}>
                      {rollingAchievement}%
                    </span>
                  </div>

                  <div className={`mt-6 p-4 rounded-lg ${metRollingTarget ? "bg-green-50" : "bg-red-50"}`}>
                    <div className="flex items-center">
                      <CheckCircle className={`${metRollingTarget ? "text-green-600" : "text-red-600"} text-xl mr-3`} size={20} />
                      <div>
                        <p className={`text-sm font-medium ${metRollingTarget ? "text-green-900" : "text-red-900"}`}>
                          {metRollingTarget ? "Rolling Target Met!" : "Below Rolling Target"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {metRollingTarget 
                            ? "Your 4-week performance is on track. Keep up the great work!" 
                            : "Focus on increasing weekly output to meet your 4-week target."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select a week to see performance preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Results Display */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Historical Results</h3>
            <p className="text-sm text-gray-500 mt-1">Previous accounts prepared entries</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {allResults
                ?.filter(result => selectedTeam ? result.teamId === selectedTeam : true)
                ?.sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
                ?.slice(0, 52)
                ?.map((result, index) => {
                  const teamName = teams?.find(t => t.id === result.teamId)?.name;
                  const target = targets?.find(t => t.teamId === result.teamId && t.weekEnding === result.weekEnding);
                  return (
                    <div key={`${result.teamId}-${result.weekEnding}-hist-${index}`} className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {format(new Date(result.weekEnding), "MMM dd, yyyy")}
                          </p>
                          <p className="text-sm text-gray-500">
                            {teamName} - Week ending
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Target</p>
                          <p className="font-medium">{target?.rollingFourWeekTarget || 0}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Actual</p>
                          <p className="font-medium">{result.actualCompleted}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Notes</p>
                          <p className="font-medium text-xs">{result.notes || "—"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Submitted By</p>
                          <p className="font-medium text-xs">{getUserName((result as any).submittedBy)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Date/Time</p>
                          <p className="font-medium text-xs">{format(new Date(result.updatedAt), "MMM dd HH:mm")}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(result)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(result.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {(!allResults?.length) && (
                <div className="text-center py-8 text-gray-500">
                  No historical results found
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
