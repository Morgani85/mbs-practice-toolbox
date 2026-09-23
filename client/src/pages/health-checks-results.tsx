import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHealthChecksResultSchema, withWeekEndingValidation, type InsertHealthChecksResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { getCurrentWeekEnding, getPreviousCompletedWeekEnding, getWeekNumber, validateWeekEndingDateClient } from "@/lib/utils";

export default function HealthChecksResults() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>(getPreviousCompletedWeekEnding());

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: targets } = useQuery({
    queryKey: ['/api/health-checks/targets'],
  });

  const { data: existingResult, isLoading: resultLoading } = useQuery({
    queryKey: ['/api/health-checks/results', selectedTeam, selectedWeek],
    enabled: !!selectedTeam && !!selectedWeek,
  });

  const form = useForm<InsertHealthChecksResult>({
    resolver: zodResolver(withWeekEndingValidation(insertHealthChecksResultSchema)),
    defaultValues: {
      teamId: selectedTeam || 0,
      weekEnding: selectedWeek,
      actualCompleted: (existingResult as any)?.actualCompleted || 0,
      notes: (existingResult as any)?.notes || "",
    },
  });

  // Update form when team, week, or existing result changes
  useEffect(() => {
    if (selectedTeam && selectedWeek) {
      form.setValue('teamId', selectedTeam);
      form.setValue('weekEnding', selectedWeek);
      form.setValue('actualCompleted', (existingResult as any)?.actualCompleted || 0);
      form.setValue('notes', (existingResult as any)?.notes || "");
    }
  }, [selectedTeam, selectedWeek, existingResult, form]);

  const createResultMutation = useMutation({
    mutationFn: async (data: InsertHealthChecksResult) => {
      const response = await apiRequest('/api/health-checks/results', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/dashboard'] });
      toast({
        title: "Success",
        description: "Health checks results updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update results",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertHealthChecksResult) => {
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

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Generate array of previous weeks for selection (104 weeks = 24 months of history)
  const generateWeekOptions = () => {
    const weeks = [];
    const today = new Date();
    for (let i = 0; i < 104; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() - (i * 7));
      // Adjust to previous Sunday
      weekDate.setDate(weekDate.getDate() - weekDate.getDay());
      weeks.push(weekDate.toISOString().split('T')[0]);
    }
    return weeks;
  };

  const weekOptions = generateWeekOptions();

  // Get current target for selected team and week
  const currentTarget = (Array.isArray(targets) ? targets : []).find((t: any) => 
    t.teamId === selectedTeam && t.weekEnding === selectedWeek
  );

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-purple-900 mb-1">MANAGEMENT ACCOUNTS MODULE</h1>
          <h2 className="text-xl font-semibold text-purple-800 mb-2">Enter Management Accounts Results</h2>
          <p className="text-purple-700">Enter actual management accounts completion results for each team and week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selection Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Select Team & Week</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
              <Select value={selectedTeam?.toString() || ""} onValueChange={(value) => setSelectedTeam(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {(Array.isArray(teams) ? teams : []).map((team: any) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Week Ending</label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week ending" />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((week) => (
                    <SelectItem key={week} value={week}>
                      Week {getWeekNumber(new Date(week))} - {new Date(week).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTarget && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-blue-900">Target for this week:</h4>
                <p className="text-blue-700">{currentTarget.targetCompleted} health checks</p>
              </div>
            )}

            {existingResult && (
              <div className="bg-green-50 p-3 rounded-lg">
                <h4 className="font-medium text-green-900">Current result:</h4>
                <p className="text-green-700">{(existingResult as any)?.actualCompleted || 0} health checks completed</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Entry Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enter Results</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTeam && selectedWeek ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="actualCompleted"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Management Accounts Completed</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Enter actual number completed"
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
                            placeholder="Additional notes about performance, challenges, etc..."
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createResultMutation.isPending || resultLoading}
                  >
                    {createResultMutation.isPending ? "Updating..." : existingResult ? "Update Result" : "Enter Result"}
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Please select a team and week to enter results
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
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
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Achievement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* This would be populated with recent results data */}
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No results entered yet
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}