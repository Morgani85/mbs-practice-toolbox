import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
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
import { insertAccountsDueSchema, withWeekEndingValidation, type Team, type AccountsDue, type InsertAccountsDue, type WeeklyTarget, type WeeklyResult } from "@shared/schema";
import { Save, TrendingDown, TrendingUp, AlertCircle, CheckCircle, Calendar, Target, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { validateWeekEndingDateClient } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";

export default function AccountsDue() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const [selectedWeek, setSelectedWeek] = useState("");

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: accountsDueData } = useQuery<AccountsDue[]>({
    queryKey: ["/api/accounts-due"],
  });

  const { data: weeklyTargets } = useQuery<WeeklyTarget[]>({
    queryKey: ["/api/targets"],
  });

  const { data: weeklyResults } = useQuery<WeeklyResult[]>({
    queryKey: ["/api/results"],
  });

  const form = useForm<InsertAccountsDue>({
    resolver: zodResolver(withWeekEndingValidation(insertAccountsDueSchema)),
    defaultValues: {
      teamId: selectedTeam || 0,
      weekEnding: selectedWeek || "",
      accountsDue: 0,
      accountsDueInProgress: 0,
      notes: "",
    },
  });

  // Update form when team or week changes
  useEffect(() => {
    if (selectedTeam && selectedWeek) {
      const existing = accountsDueData?.find(
        (item) => item.teamId === selectedTeam && item.weekEnding === selectedWeek
      );
      
      form.reset({
        teamId: selectedTeam,
        weekEnding: selectedWeek,
        accountsDue: existing?.accountsDue || 0,
        accountsDueInProgress: existing?.accountsDueInProgress || 0,
        notes: existing?.notes || "",
      });
    }
  }, [selectedTeam, selectedWeek, accountsDueData, form]);

  const createAccountsDueMutation = useMutation({
    mutationFn: async (data: InsertAccountsDue) => {
      const response = await apiRequest("/api/accounts-due", "POST", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Accounts due saved successfully",
        description: "The accounts due count has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error saving accounts due",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAccountsDueMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/accounts-due/${id}`, "DELETE", {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Accounts due deleted successfully",
        description: "The record has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts-due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error deleting accounts due",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertAccountsDue) => {
    if (!selectedTeam || !selectedWeek) {
      toast({
        title: "Please select team and week",
        description: "Both team and week ending must be selected before saving.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate the weekEnding date
    const validation = validateWeekEndingDateClient(selectedWeek);
    if (!validation.isValid) {
      toast({
        title: "Invalid date",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }
    
    const submissionData = {
      ...data,
      teamId: selectedTeam,
      weekEnding: selectedWeek,
    };
    
    createAccountsDueMutation.mutate(submissionData);
  };

  const handleEdit = (item: AccountsDue) => {
    setSelectedTeam(item.teamId);
    setSelectedWeek(item.weekEnding);
    form.reset({
      teamId: item.teamId,
      weekEnding: item.weekEnding,
      accountsDue: item.accountsDue,
      accountsDueInProgress: item.accountsDueInProgress,
      notes: item.notes || "",
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this accounts due record? This action cannot be undone.")) {
      deleteAccountsDueMutation.mutate(id);
    }
  };

  // Get current week ending as default
  const getCurrentWeekEnding = () => {
    const date = new Date();
    const dayOfWeek = date.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    date.setDate(date.getDate() + daysUntilSunday);
    return format(date, "yyyy-MM-dd");
  };

  // Calculate summary metrics
  const calculateAccountsDueIn3Months = () => {
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    const recentAccountsDue = accountsDueData?.filter(item => 
      new Date(item.weekEnding) <= threeMonthsFromNow
    ).slice(0, 4);
    
    if (!recentAccountsDue || recentAccountsDue.length === 0) return { count: 0, status: 'green', trend: 'No data available' };
    
    const latestCount = recentAccountsDue[0]?.accountsDue || 0;
    const previousCount = recentAccountsDue[1]?.accountsDue || latestCount;
    
    let status = 'green';
    if (latestCount > 50) status = 'red';
    else if (latestCount > 20) status = 'amber';
    
    const trend = latestCount < previousCount ? 'Decreasing trend - accounts due reducing' :
                  latestCount > previousCount ? 'Increasing trend - accounts due growing' :
                  'Stable trend - accounts due consistent';
    
    return { count: latestCount, status, trend };
  };

  const calculateLast4WeeksPerformance = () => {
    const last4WeeksTargets = weeklyTargets?.slice(0, 4) || [];
    const last4WeeksResults = weeklyResults?.slice(0, 4) || [];
    
    if (last4WeeksTargets.length === 0 || last4WeeksResults.length === 0) {
      return { percentage: 0, status: 'red', trend: 'No target/result data available for comparison' };
    }
    
    let totalTarget = 0;
    let totalActual = 0;
    
    last4WeeksTargets.forEach(target => {
      totalTarget += target.rollingFourWeekTarget || 0;
    });
    
    last4WeeksResults.forEach(result => {
      totalActual += result.actualCompleted || 0;
    });
    
    const percentage = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    
    let status = 'green';
    if (percentage < 80) status = 'red';
    else if (percentage < 95) status = 'amber';
    
    const recentPerformance = last4WeeksResults.slice(0, 2);
    const earlierPerformance = last4WeeksResults.slice(2, 4);
    
    const recentAvg = recentPerformance.reduce((sum, r) => sum + (r.actualCompleted || 0), 0) / Math.max(recentPerformance.length, 1);
    const earlierAvg = earlierPerformance.reduce((sum, r) => sum + (r.actualCompleted || 0), 0) / Math.max(earlierPerformance.length, 1);
    
    const trend = recentAvg > earlierAvg ? 'Improving trend - recent weeks showing better performance' :
                  recentAvg < earlierAvg ? 'Declining trend - performance dropping in recent weeks' :
                  'Stable trend - consistent performance across recent weeks';
    
    return { percentage: Math.round(percentage), status, trend };
  };

  const accountsDueSummary = calculateAccountsDueIn3Months();
  const performanceSummary = calculateLast4WeeksPerformance();

  const getTrafficLightStyle = (status: string) => {
    switch (status) {
      case 'green':
        return 'bg-green-100 border-green-500 text-green-800';
      case 'amber':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'red':
        return 'bg-red-100 border-red-500 text-red-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const accountsDueValue = form.watch("accountsDue");
  const isGoodProgress = accountsDueValue < 50;
  const isWarning = accountsDueValue >= 50 && accountsDueValue < 100;
  const isCritical = accountsDueValue >= 100;

  const isFutureDate = selectedWeek ? new Date(selectedWeek) > new Date() : false;

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">ACCOUNTS MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Accounts Due Tracking</h2>
          <p className="text-blue-700">Track the number of accounts due for preparation - aim to reduce this to zero</p>
        </div>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accounts Due Entry Form */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Record Accounts Due</h3>
            
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
                  placeholder={getCurrentWeekEnding()}
                />
                {isFutureDate && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-700">
                      This date is in the future. Data entry is usually done for completed weeks.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="accountsDue">Accounts Due (Current Count)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 45"
                  {...form.register("accountsDue", { valueAsNumber: true })}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Total number of accounts currently due for preparation
                </p>
                {form.formState.errors.accountsDue && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.accountsDue.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="accountsDueInProgress">Of which still work in progress / not started</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 20"
                  {...form.register("accountsDueInProgress", { valueAsNumber: true })}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Number of accounts that are still being worked on or not yet started
                </p>
                {form.formState.errors.accountsDueInProgress && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.accountsDueInProgress.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Any notes about the accounts due status..."
                  {...form.register("notes")}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Button 
                  type="submit" 
                  disabled={createAccountsDueMutation.isPending || !selectedTeam || !selectedWeek}
                  className="bg-primary hover:bg-blue-700"
                >
                  <Save className="mr-2" size={16} />
                  {createAccountsDueMutation.isPending ? "Saving..." : "Save Accounts Due"}
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

        {/* Status Preview */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Status Preview</h3>
            
            {selectedTeam && selectedWeek ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Team</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {teams?.find(t => t.id === selectedTeam)?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Week Ending</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {format(new Date(selectedWeek), "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">Accounts Due</span>
                  <span className={`text-lg font-semibold ${
                    isGoodProgress ? "text-green-600" : 
                    isWarning ? "text-yellow-600" : 
                    isCritical ? "text-red-600" : "text-gray-900"
                  }`}>
                    {accountsDueValue} accounts
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-600">In Progress / Not Started</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {form.watch("accountsDueInProgress")} accounts
                  </span>
                </div>

                <div className={`mt-6 p-4 rounded-lg ${
                  isGoodProgress ? "bg-green-50" : 
                  isWarning ? "bg-yellow-50" : 
                  isCritical ? "bg-red-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center">
                    {isGoodProgress ? (
                      <CheckCircle className="text-green-600 text-xl mr-3" size={20} />
                    ) : (
                      <AlertCircle className={`${
                        isWarning ? "text-yellow-600" : "text-red-600"
                      } text-xl mr-3`} size={20} />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        isGoodProgress ? "text-green-900" : 
                        isWarning ? "text-yellow-900" : 
                        isCritical ? "text-red-900" : "text-gray-900"
                      }`}>
                        {isGoodProgress ? "Good Progress" : 
                         isWarning ? "Attention Needed" : 
                         isCritical ? "Critical - Action Required" : "Status Unknown"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {isGoodProgress ? "Keep up the good work reducing accounts due." : 
                         isWarning ? "Consider increasing preparation efforts." : 
                         isCritical ? "Urgent action needed to reduce backlog." : "Enter a value to see status."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select a team and week to see status preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Accounts Due Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Accounts Due History</h3>
            <p className="text-sm text-gray-500 mt-1">Track progress in reducing accounts due over time</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accountsDueData?.map((item) => {
                  const isGood = item.accountsDue < 50;
                  const isWarning = item.accountsDue >= 50 && item.accountsDue < 100;
                  const isCritical = item.accountsDue >= 100;
                  
                  return (
                    <tr key={`${item.teamId}-${item.weekEnding}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {teams?.find(t => t.id === item.teamId)?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(item.weekEnding), "MMM dd, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={
                          isGood ? "text-green-600" : 
                          isWarning ? "text-yellow-600" : 
                          "text-red-600"
                        }>
                          {item.accountsDue}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.accountsDueInProgress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isGood ? "bg-green-100 text-green-800" :
                          isWarning ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {isGood ? "Good" : isWarning ? "Warning" : "Critical"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getUserName((item as any).submittedBy)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(item.updatedAt), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
        </CardContent>
      </Card>
    </div>
  );
}