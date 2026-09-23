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
import { insertVatResultSchema, withWeekEndingValidation, type InsertVatResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrentWeekEnding } from "@/lib/utils";

export default function VatResults() {
  const { toast } = useToast();
  const currentWeekEnding = getCurrentWeekEnding();

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
  });

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ['/api/vat/results'],
  });

  const form = useForm<InsertVatResult>({
    resolver: zodResolver(withWeekEndingValidation(insertVatResultSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: currentWeekEnding,
      actualCompleted: 0,
      notes: "",
    },
  });

  const createResultMutation = useMutation({
    mutationFn: async (data: InsertVatResult) => {
      const response = await apiRequest('/api/vat/results', 'POST', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vat/results'] });
      toast({
        title: "Success",
        description: "VAT result recorded successfully",
      });
      form.reset({
        teamId: 0,
        weekEnding: currentWeekEnding,
        actualCompleted: 0,
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record VAT result",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertVatResult) => {
    createResultMutation.mutate(data);
  };

  if (teamsLoading || resultsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">VAT Return Results</h1>
        <p className="text-gray-600 mt-2">Record weekly VAT return completion results by team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Result Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>Record VAT Results</CardTitle>
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
                  name="actualCompleted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Returns Completed</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Enter number completed"
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
                          placeholder="Additional notes or comments..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createResultMutation.isPending}
                >
                  {createResultMutation.isPending ? "Recording..." : "Record VAT Results"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Recent Results List */}
        <Card>
          <CardHeader>
            <CardTitle>All VAT Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results && results.length > 0 ? (
              <div className="space-y-4">
                {results.map((result: any) => (
                  <div key={result.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{result.team?.name}</h3>
                        <p className="text-gray-600">Week ending: {result.weekEnding}</p>
                        <p className="text-green-600 font-medium">
                          Completed: {result.actualCompleted} VAT returns
                        </p>
                        {result.notes && (
                          <p className="text-gray-500 text-sm mt-1">{result.notes}</p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(result.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No VAT results recorded yet</p>
                <p className="text-gray-400 text-sm mt-1">Record your first results to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">About VAT Return Results</h3>
          <div className="text-gray-600 space-y-2">
            <p>• Record the actual number of VAT returns your team completed each week</p>
            <p>• Results are used to calculate rolling 4-week performance against targets</p>
            <p>• Include any relevant notes about challenges, improvements, or special circumstances</p>
            <p>• Regular recording ensures accurate performance tracking and trend analysis</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}