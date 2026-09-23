import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertWeeklyTargetSchema, withWeekEndingValidation, type Team, type WeeklyTarget, type InsertWeeklyTarget } from "@shared/schema";
import { Save, Edit } from "lucide-react";
import { format } from "date-fns";
import { validateWeekEndingDateClient, getPreviousCompletedWeekEnding } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";

export default function Targets() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // Default to the most recent completed week ending (last Sunday)
    // This prevents creating future targets prematurely
    return getPreviousCompletedWeekEnding();
  });
  const [hasSynced, setHasSynced] = useState(false);

  // Sync all teams' targets to the current week when the page loads
  useEffect(() => {
    if (!hasSynced) {
      fetch("/api/targets/sync-all", { method: "POST" })
        .then(response => response.json())
        .then(data => {
          if (data.syncedTeams && data.syncedTeams.length > 0) {
            queryClient.invalidateQueries({ queryKey: ["/api/targets"] });
          }
          setHasSynced(true);
        })
        .catch(console.error);
    }
  }, [hasSynced]);

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: targets, isLoading } = useQuery<WeeklyTarget[]>({
    queryKey: ["/api/targets", selectedTeam],
    queryFn: async () => {
      const params = selectedTeam ? `?teamId=${selectedTeam}` : '';
      const response = await fetch(`/api/targets${params}`);
      return response.json();
    },
  });

  const { data: currentTarget } = useQuery<WeeklyTarget>({
    queryKey: ["/api/targets", selectedTeam, selectedWeek],
    enabled: !!selectedTeam && !!selectedWeek,
    queryFn: async () => {
      const response = await fetch(`/api/targets/${selectedTeam}/${selectedWeek}`);
      if (response.status === 404) return null;
      return response.json();
    },
  });

  // Get latest target for the selected team to use as default
  const { data: latestTeamTarget } = useQuery<WeeklyTarget[]>({
    queryKey: ["/api/targets/latest", selectedTeam],
    enabled: !!selectedTeam,
    queryFn: async () => {
      const response = await fetch(`/api/targets?teamId=${selectedTeam}`);
      return response.json();
    },
  });

  // Get the most recent target for the selected team as default
  const getDefaultTarget = () => {
    if (currentTarget) return currentTarget.rollingFourWeekTarget;
    if (latestTeamTarget && latestTeamTarget.length > 0) {
      return latestTeamTarget[0].rollingFourWeekTarget;
    }
    return 4; // fallback default for 4-week rolling target (1 per week x 4)
  };

  const form = useForm<InsertWeeklyTarget>({
    resolver: zodResolver(withWeekEndingValidation(insertWeeklyTargetSchema)),
    defaultValues: {
      teamId: selectedTeam || 0,
      weekEnding: selectedWeek,
      rollingFourWeekTarget: getDefaultTarget(),
    },
  });

  // Update form when selections change
  useEffect(() => {
    if (selectedTeam && selectedWeek) {
      form.setValue("teamId", selectedTeam);
      form.setValue("weekEnding", selectedWeek);
      form.setValue("rollingFourWeekTarget", getDefaultTarget());
    }
  }, [selectedTeam, selectedWeek, currentTarget, latestTeamTarget]);

  const createTargetMutation = useMutation({
    mutationFn: async (data: InsertWeeklyTarget) => {
      const response = await apiRequest("/api/targets", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Target saved successfully",
        description: "Your weekly target has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({
        title: "Error saving target",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertWeeklyTarget) => {
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
    createTargetMutation.mutate(data);
  };

  const latestTarget = targets?.[0];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-96 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">ACCOUNTS MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Set Weekly Targets</h2>
          <p className="text-blue-700">Define your weekly account preparation targets and quarterly goals</p>
        </div>
      </div>

      {/* Smart Target Information */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Smart Target Management</h3>
        <p className="text-green-800 text-sm">
          <strong>Automatic carry-forward:</strong> If you don't set a new target for a week, the system automatically uses your previous week's target. 
          Only update the target when you want to change it from the previous week.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Target Setting Form */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Target Settings</h3>
            
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
                {form.formState.errors.weekEnding && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.weekEnding.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="rollingFourWeekTarget">4-Week Rolling Target (Total Accounts)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 4 (1 per week x 4 weeks)"
                  {...form.register("rollingFourWeekTarget", { valueAsNumber: true })}
                />
                {!currentTarget && latestTeamTarget && latestTeamTarget.length > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    📋 Target carried forward from previous week ({latestTeamTarget[0].rollingFourWeekTarget})
                  </p>
                )}
                {form.formState.errors.rollingFourWeekTarget && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.rollingFourWeekTarget.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <Button 
                  type="submit" 
                  disabled={createTargetMutation.isPending || !selectedTeam}
                  className="bg-primary hover:bg-blue-700"
                >
                  <Save className="mr-2" size={16} />
                  {createTargetMutation.isPending ? "Saving..." : "Save Target"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => form.reset()}
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Current Targets Summary */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Current Target Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Current 4-Week Rolling Target</span>
                <span className="text-lg font-semibold text-gray-900">
                  {latestTarget?.rollingFourWeekTarget || 0} accounts
                </span>
              </div>
              {selectedTeam && (
                <div className="text-center text-sm text-gray-500 py-4">
                  Showing target for {teams?.find(t => t.id === selectedTeam)?.name || 'selected team'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Targets Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Historical Targets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    4-Week Rolling Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
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
                {targets?.map((target) => (
                  <tr key={target.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {format(new Date(target.weekEnding), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {target.rollingFourWeekTarget}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {teams?.find(t => t.id === target.teamId)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getUserName((target as any).submittedBy)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(target.updatedAt), "MMM dd, yyyy HH:mm")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          // Set the state values first
                          setSelectedTeam(target.teamId);
                          setSelectedWeek(target.weekEnding);
                          
                          // Force form update with the target values
                          form.setValue("teamId", target.teamId);
                          form.setValue("weekEnding", target.weekEnding);
                          form.setValue("rollingFourWeekTarget", target.rollingFourWeekTarget);
                          
                          // Show success message
                          toast({
                            title: "Target loaded for editing",
                            description: `Loaded target for ${teams?.find(t => t.id === target.teamId)?.name} - Week ending ${format(new Date(target.weekEnding), "MMM dd, yyyy")}`,
                          });
                        }}
                      >
                        <Edit size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
