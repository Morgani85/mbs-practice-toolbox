import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Target, Users, DollarSign, Settings, Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { validateWeekEndingDateClient } from "@/lib/utils";

// Schema for form validation
const targetSchema = z.object({
  teamId: z.number(),
  weekEnding: z.string(),
  debtorsOver30Days: z.number().min(0),
  clientsNotPayingMonthly: z.number().min(0),
  valueClientsNotPayingMonthly: z.number().min(0),
  averageFeePerClient: z.number().min(0),
  numberOfClients: z.number().min(0),
  notes: z.string().optional(),
});

const resultSchema = z.object({
  teamId: z.number(),
  weekEnding: z.string(),
  debtorsOver30Days: z.number().min(0),
  clientsNotPayingMonthly: z.number().min(0),
  valueClientsNotPayingMonthly: z.number().min(0),
  averageFeePerClient: z.number().min(0),
  numberOfClients: z.number().min(0),
  notes: z.string().optional(),
});

export default function RevenueAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedWeekEnding, setSelectedWeekEnding] = useState<string>("");
  const [activeTab, setActiveTab] = useState("targets");

  // Fetch teams
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Fetch revenue analytics data
  const { data: performanceData = [] } = useQuery({
    queryKey: ["/api/revenue-analytics/performance", selectedTeamId],
    enabled: !!selectedTeamId,
  });

  // Target form
  const targetForm = useForm<z.infer<typeof targetSchema>>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      teamId: selectedTeamId || 0,
      weekEnding: selectedWeekEnding || "",
      debtorsOver30Days: 0,
      clientsNotPayingMonthly: 0,
      valueClientsNotPayingMonthly: 0,
      averageFeePerClient: 0,
      numberOfClients: 0,
      notes: "",
    },
  });

  // Result form
  const resultForm = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: {
      teamId: selectedTeamId || 0,
      weekEnding: selectedWeekEnding || "",
      debtorsOver30Days: 0,
      clientsNotPayingMonthly: 0,
      valueClientsNotPayingMonthly: 0,
      averageFeePerClient: 0,
      numberOfClients: 0,
      notes: "",
    },
  });

  // Mutations
  const targetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof targetSchema>) => {
      const response = await fetch("/api/revenue-analytics/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save target");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Target saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-analytics/performance"] });
    },
    onError: () => {
      toast({ title: "Failed to save target", variant: "destructive" });
    },
  });

  const resultMutation = useMutation({
    mutationFn: async (data: z.infer<typeof resultSchema>) => {
      const response = await fetch("/api/revenue-analytics/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save result");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Result saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-analytics/performance"] });
    },
    onError: () => {
      toast({ title: "Failed to save result", variant: "destructive" });
    },
  });

  // Get current week ending (next Monday)
  const getCurrentWeekEnding = () => {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7));
    return format(nextMonday, "yyyy-MM-dd");
  };

  // Calculate MRR
  const calculateMRR = (averageFee: number, numberOfClients: number) => {
    return averageFee * numberOfClients;
  };

  // Get most recent 8 weeks of data
  const getRecentData = () => {
    return performanceData.slice(0, 8);
  };

  const onTargetSubmit = (data: z.infer<typeof targetSchema>) => {
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
    targetMutation.mutate(data);
  };

  const onResultSubmit = (data: z.infer<typeof resultSchema>) => {
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
    resultMutation.mutate(data);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/practice-performance">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Practice Performance
            </Button>
          </Link>
        </div>
        
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Revenue Analytics</h1>
          <p className="text-gray-600">Set targets, track weekly performance, and analyze revenue trends</p>
        </div>
      </div>

      {/* Team Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team-select">Team</Label>
              <Select
                value={selectedTeamId?.toString() || ""}
                onValueChange={(value) => setSelectedTeamId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="week-ending">Week Ending</Label>
              <Input
                id="week-ending"
                type="date"
                value={selectedWeekEnding}
                onChange={(e) => setSelectedWeekEnding(e.target.value)}
                placeholder={getCurrentWeekEnding()}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTeamId && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="targets" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Set Targets
            </TabsTrigger>
            <TabsTrigger value="entry" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Data Entry
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          {/* Targets Tab */}
          <TabsContent value="targets">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Revenue Analytics Targets
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set targets for revenue analytics metrics. These targets will be used to compare against actual results.
                </p>
              </CardHeader>
              <CardContent>
                <Form {...targetForm}>
                  <form onSubmit={targetForm.handleSubmit(onTargetSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={targetForm.control}
                        name="debtorsOver30Days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Debtors over 30 days (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={targetForm.control}
                        name="clientsNotPayingMonthly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Clients not paying monthly</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={targetForm.control}
                        name="valueClientsNotPayingMonthly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value of clients not paying monthly (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={targetForm.control}
                        name="averageFeePerClient"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Average fee per client (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={targetForm.control}
                        name="numberOfClients"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of clients</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={targetForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={targetMutation.isPending}>
                      {targetMutation.isPending ? "Saving..." : "Save Target"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Entry Tab */}
          <TabsContent value="entry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Weekly Data Entry
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter actual results for this week. Data will be used to calculate performance against targets.
                </p>
              </CardHeader>
              <CardContent>
                <Form {...resultForm}>
                  <form onSubmit={resultForm.handleSubmit(onResultSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={resultForm.control}
                        name="debtorsOver30Days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Debtors over 30 days (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resultForm.control}
                        name="clientsNotPayingMonthly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Clients not paying monthly</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resultForm.control}
                        name="valueClientsNotPayingMonthly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value of clients not paying monthly (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resultForm.control}
                        name="averageFeePerClient"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Average fee per client (£)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={resultForm.control}
                        name="numberOfClients"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of clients</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={resultForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={resultMutation.isPending}>
                      {resultMutation.isPending ? "Saving..." : "Save Results"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Current Week Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.length > 0 && performanceData[0].results
                        ? `£${calculateMRR(performanceData[0].results.averageFeePerClient, performanceData[0].results.numberOfClients).toLocaleString()}`
                        : "No data"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current week calculation
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Debtors Over 30 Days</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.length > 0 && performanceData[0].results
                        ? `£${performanceData[0].results.debtorsOver30Days.toLocaleString()}`
                        : "No data"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current week actual
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Fee Per Client</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.length > 0 && performanceData[0].results
                        ? `£${performanceData[0].results.averageFeePerClient.toLocaleString()}`
                        : "No data"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current week average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {performanceData.length > 0 && performanceData[0].results
                        ? performanceData[0].results.numberOfClients.toLocaleString()
                        : "No data"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current week total
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Historical Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle>8-Week Performance History</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Historical performance data with targets vs actual comparisons
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Week Ending</th>
                          <th className="text-left p-2">MRR</th>
                          <th className="text-left p-2">Debtors (30+)</th>
                          <th className="text-left p-2">Clients (Non-Monthly)</th>
                          <th className="text-left p-2">Avg Fee</th>
                          <th className="text-left p-2">Total Clients</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getRecentData().map((row, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{format(new Date(row.weekEnding), "MMM dd, yyyy")}</td>
                            <td className="p-2">
                              {row.results ? `£${calculateMRR(row.results.averageFeePerClient, row.results.numberOfClients).toLocaleString()}` : "-"}
                            </td>
                            <td className="p-2">
                              {row.results ? `£${row.results.debtorsOver30Days.toLocaleString()}` : "-"}
                            </td>
                            <td className="p-2">
                              {row.results ? row.results.clientsNotPayingMonthly.toLocaleString() : "-"}
                            </td>
                            <td className="p-2">
                              {row.results ? `£${row.results.averageFeePerClient.toLocaleString()}` : "-"}
                            </td>
                            <td className="p-2">
                              {row.results ? row.results.numberOfClients.toLocaleString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {performanceData.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No data available. Start by setting targets and entering weekly results.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!selectedTeamId && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Select a Team</h3>
            <p className="text-muted-foreground">
              Choose a team from the dropdown above to start working with Revenue Analytics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}