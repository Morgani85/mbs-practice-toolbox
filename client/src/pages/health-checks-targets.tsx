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
import { insertHealthChecksTargetSchema, withWeekEndingValidation, type InsertHealthChecksTarget } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { getCurrentWeekEnding } from "@/lib/utils";

export default function HealthChecksTargets() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const currentWeekEnding = getCurrentWeekEnding();

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['/api/health-checks/targets'],
  });

  const form = useForm<InsertHealthChecksTarget>({
    resolver: zodResolver(withWeekEndingValidation(insertHealthChecksTargetSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      targetCompleted: 0,
      notes: "",
    },
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: InsertHealthChecksTarget) => {
      const response = await apiRequest('/api/health-checks/targets', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health-checks/targets'] });
      toast({
        title: "Success",
        description: "Health checks target set successfully",
      });
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        targetCompleted: 0,
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set target",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertHealthChecksTarget) => {
    createTargetMutation.mutate(data);
  };

  if (teamsLoading || targetsLoading) {
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
          <h2 className="text-xl font-semibold text-purple-800 mb-2">Set Management Accounts Targets</h2>
          <p className="text-purple-700">Set weekly management accounts completion targets for each team</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Target Setting Form */}
        <Card>
          <CardHeader>
            <CardTitle>Set Weekly Target</CardTitle>
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
                          {(Array.isArray(teams) ? teams : [])?.map((team: any) => (
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
                  name="targetCompleted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Management Accounts to Complete</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter target number"
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
                          placeholder="Additional notes about this target..."
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
                  disabled={createTargetMutation.isPending}
                >
                  {createTargetMutation.isPending ? "Setting Target..." : "Set Target"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* All Targets */}
        <Card>
          <CardHeader>
            <CardTitle>All Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(Array.isArray(targets) ? targets : [])?.map((target: any) => (
                <div key={`${target.teamId}-${target.weekEnding}`} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{target.team?.name}</h4>
                      <p className="text-sm text-gray-600">
                        Week ending: {new Date(target.weekEnding).toLocaleDateString()}
                      </p>
                      <p className="text-lg font-semibold text-blue-600">
                        Target: {target.targetCompleted} health checks
                      </p>
                      {target.notes && (
                        <p className="text-sm text-gray-500 mt-2">{target.notes}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Submitted by: <span className="font-medium">{getUserName(target.submittedBy)}</span></span>
                        <span>{target.updatedAt ? new Date(target.updatedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!(Array.isArray(targets) ? targets : []).length && (
                <p className="text-gray-500 text-center py-8">No targets set yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}