import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Save, Trash2, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertClientOldestItemsSchema, withWeekEndingValidation, type Team, type ClientOldestItems } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const formSchema = withWeekEndingValidation(insertClientOldestItemsSchema);

type FormData = z.infer<typeof formSchema>;

export default function ClientOldestItems() {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const queryClient = useQueryClient();

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: oldestItemsData, isLoading: dataLoading } = useQuery<ClientOldestItems[]>({
    queryKey: ["/api/client-oldest-items", selectedTeam],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamId: 0,
      weekEnding: "",
      oldestItemDays: 0,
      target: 10,
      worstPerformingClients: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("/api/client-oldest-items", "POST", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Client Oldest Items data saved successfully",
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/client-oldest-items"
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Client Oldest Items data",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Attempting to delete entry with ID: ${id}`);
      const result = await apiRequest(`/api/client-oldest-items/${id}`, "DELETE");
      console.log("Delete request completed:", result);
      return result;
    },
    onSuccess: () => {
      console.log("Delete mutation successful");
      toast({
        title: "Success",
        description: "Client Oldest Items entry deleted successfully",
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/client-oldest-items"
      });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete Client Oldest Items entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      deleteMutation.mutate(id);
    }
  };

  const getTeamName = (teamId: number) => {
    return teams?.find(team => team.id === teamId)?.name || `Team ${teamId}`;
  };

  const getPerformanceStatus = (days: number, target: number) => {
    if (days <= target) return { status: 'good', color: 'bg-green-500' };
    if (days <= target + 5) return { status: 'warning', color: 'bg-yellow-500' };
    return { status: 'poor', color: 'bg-red-500' };
  };

  // Filter and sort data
  const filteredData = selectedTeam
    ? oldestItemsData?.filter(entry => entry.teamId === selectedTeam)
    : oldestItemsData;

  const sortedData = filteredData?.sort((a, b) => 
    new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
  );

  if (teamsLoading) {
    return <div className="p-6">Loading teams...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/client-bookkeeping/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Oldest Items Management</h1>
            <p className="text-gray-600">Track and manage client oldest items performance</p>
          </div>
        </div>

        {/* Team Filter */}
        <Select value={selectedTeam?.toString() || "all"} onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select team" />
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

      {/* Data Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Add New Client Oldest Items Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="teamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team</FormLabel>
                      <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
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
                  name="oldestItemDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Oldest Item (Days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
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
                  name="target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target (Days)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
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
                control={form.control}
                name="worstPerformingClients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worst Performing Clients</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter details about clients with the oldest items..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={createMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Current Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Client Oldest Items Data</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : sortedData && sortedData.length > 0 ? (
            <div className="space-y-4">
              {sortedData.map((entry) => {
                const performanceStatus = getPerformanceStatus(entry.oldestItemDays, entry.target);

                return (
                  <div key={entry.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-semibold">{getTeamName(entry.teamId)}</h3>
                          <p className="text-sm text-gray-600">
                            Week ending: {format(parseISO(entry.weekEnding), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <Badge className={`${performanceStatus.color} text-white`}>
                          {entry.oldestItemDays} days
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Oldest Item:</span> {entry.oldestItemDays} days
                      </div>
                      <div>
                        <span className="font-medium">Target:</span> {entry.target} days
                      </div>
                    </div>

                    {entry.worstPerformingClients && (
                      <div className="mt-2">
                        <span className="font-medium text-sm">Worst Performing Clients:</span>
                        <p className="text-sm text-gray-600 mt-1">{entry.worstPerformingClients}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>Submitted by: <span className="font-medium">{getUserName((entry as any).submittedBy)}</span></span>
                      <span>{(entry as any).updatedAt ? new Date((entry as any).updatedAt).toLocaleString() : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No Client Oldest Items data found. Add your first entry using the form above.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Insights */}
      {sortedData && sortedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Latest Week Summary */}
              {(() => {
                const latestWeek = sortedData[0];
                const isOnTarget = latestWeek.oldestItemDays <= latestWeek.target;
                
                return (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Latest Week Performance:</strong> {latestWeek.oldestItemDays} days oldest item
                      (target: {latestWeek.target} days).
                      {isOnTarget ? " On target!" : 
                       latestWeek.oldestItemDays <= latestWeek.target + 5 ? " Close to target." : 
                       " Above target - attention needed."}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Trend Analysis */}
              {sortedData.length >= 2 && (() => {
                const current = sortedData[0].oldestItemDays;
                const previous = sortedData[1].oldestItemDays;
                const trend = current - previous;
                
                return (
                  <Alert>
                    {trend <= 0 ? <TrendingUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertDescription>
                      <strong>Week-over-Week Trend:</strong> 
                      {trend < 0 ? ` ${Math.abs(trend)} day improvement` : 
                       trend > 0 ? ` ${trend} day increase` : " No change"} 
                      compared to previous week.
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}