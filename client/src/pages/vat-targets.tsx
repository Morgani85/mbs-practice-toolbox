import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVatTargetSchema, withWeekEndingValidation, type InsertVatTarget } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrentWeekEnding } from "@/lib/utils";

export default function VatTargets() {
  const { toast } = useToast();
  const currentWeekEnding = getCurrentWeekEnding();

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ['/api/vat/targets'],
  });

  const form = useForm<InsertVatTarget>({
    resolver: zodResolver(withWeekEndingValidation(insertVatTargetSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      rollingFourWeekTarget: 0,
    },
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: InsertVatTarget) => {
      const response = await apiRequest('/api/vat/targets', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/targets'] });
      toast({
        title: "Success",
        description: "VAT target created successfully",
      });
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        rollingFourWeekTarget: 0,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create VAT target",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVatTarget) => {
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
        <h1 className="text-3xl font-bold text-gray-900">VAT Return Targets</h1>
        <p className="text-gray-600 mt-2">Set rolling 4-week targets for VAT return preparation by team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Target Setting Form */}
        <Card>
          <CardHeader>
            <CardTitle>Set VAT Target</CardTitle>
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
                            {teams?.map((team: any) => (
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
                  name="rollingFourWeekTarget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolling 4-Week Target</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter VAT returns target"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                  {createTargetMutation.isPending ? "Creating..." : "Create VAT Target"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Current Targets List */}
        <Card>
          <CardHeader>
            <CardTitle>Current VAT Targets</CardTitle>
          </CardHeader>
          <CardContent>
            {targets && targets.length > 0 ? (
              <div className="space-y-4">
                {targets.map((target: any) => (
                  <div key={target.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{target.team?.name}</h3>
                        <p className="text-gray-600">Week ending: {target.weekEnding}</p>
                        <p className="text-blue-600 font-medium">
                          Target: {target.rollingFourWeekTarget} VAT returns
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(target.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No VAT targets set yet</p>
                <p className="text-gray-400 text-sm mt-1">Create your first target to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">About Rolling 4-Week VAT Targets</h3>
          <div className="text-gray-600 space-y-2">
            <p>• Rolling 4-week targets represent the total number of VAT returns your team should complete over any 4-week period</p>
            <p>• This system smooths out weekly variations and provides a more stable performance metric</p>
            <p>• Targets are compared against actual completions from the same 4-week rolling period</p>
            <p>• Use this for planning VAT return preparation workload and measuring team efficiency</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}