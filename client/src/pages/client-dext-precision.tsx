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
import { ArrowLeft, Plus, Save, Trash2, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertClientDextPrecisionSchema, withWeekEndingValidation, type Team, type ClientDextPrecision } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useOrgSettings } from "@/hooks/use-org-settings";

const formSchema = withWeekEndingValidation(insertClientDextPrecisionSchema);

type FormData = z.infer<typeof formSchema>;

export default function ClientDextPrecision() {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const { platformName, bookkeepingUpperThreshold } = useOrgSettings();
  const queryClient = useQueryClient();

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: dextPrecisionData, isLoading: dataLoading } = useQuery<ClientDextPrecision[]>({
    queryKey: ["/api/client-dext-precision", selectedTeam],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamId: 0,
      weekEnding: "",
      clientsAbove85Percent: 0,
      clientsBelow85Percent: 0,
      lowestScoreClientDetails: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("/api/client-dext-precision", "POST", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Client BK Quality Score data saved successfully",
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/client-dext-precision"
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Client BK Quality Score data",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Attempting to delete BK quality score entry with ID: ${id}`);
      const result = await apiRequest(`/api/client-dext-precision/${id}`, "DELETE");
      console.log("Delete request completed:", result);
      return result;
    },
    onSuccess: () => {
      console.log("Delete mutation successful");
      toast({
        title: "Success",
        description: "Client BK Quality Score entry deleted successfully",
      });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/client-dext-precision"
      });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete Client BK Quality Score entry",
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

  const calculatePrecisionScore = (above85: number, below85: number) => {
    const total = above85 + below85;
    return total > 0 ? Math.round((above85 / total) * 100) : 0;
  };

  const getScoreStatus = (score: number) => {
    if (score >= 85) return { status: 'good', color: 'bg-green-500' };
    if (score >= 75) return { status: 'warning', color: 'bg-yellow-500' };
    return { status: 'poor', color: 'bg-red-500' };
  };

  // Filter and sort data
  const filteredData = selectedTeam
    ? dextPrecisionData?.filter(entry => entry.teamId === selectedTeam)
    : dextPrecisionData;

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
            <h1 className="text-3xl font-bold text-gray-900">Client BK Quality Score Management</h1>
            <p className="text-gray-600">Track and manage client BK Quality scores</p>
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
            Add New Client BK Quality Score Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  name="clientsBelow85Percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformName} score below {bookkeepingUpperThreshold}%</FormLabel>
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
                name="lowestScoreClientDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lowest Score Client Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter details about the client with the lowest precision score..."
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
          <CardTitle>Current Client BK Quality Score Data</CardTitle>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="text-center py-4">Loading data...</div>
          ) : sortedData && sortedData.length > 0 ? (
            <div className="space-y-4">
              {sortedData.map((entry) => {
                const precisionScore = calculatePrecisionScore(entry.clientsAbove85Percent, entry.clientsBelow85Percent);
                const scoreStatus = getScoreStatus(precisionScore);
                const totalClients = entry.clientsAbove85Percent + entry.clientsBelow85Percent;

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
                        <Badge className={`${scoreStatus.color} text-white`}>
                          {precisionScore}% Precision
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-green-600">Above {bookkeepingUpperThreshold}%:</span> {entry.clientsAbove85Percent} clients
                      </div>
                      <div>
                        <span className="font-medium text-red-600">Below {bookkeepingUpperThreshold}%:</span> {entry.clientsBelow85Percent} clients
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> {totalClients} clients
                      </div>
                    </div>

                    {entry.lowestScoreClientDetails && (
                      <div className="mt-2">
                        <span className="font-medium text-sm">Lowest Score Client Details:</span>
                        <p className="text-sm text-gray-600 mt-1">{entry.lowestScoreClientDetails}</p>
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
              No Client BK Quality Score data found. Add your first entry using the form above.
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
                const precisionScore = calculatePrecisionScore(latestWeek.clientsAbove85Percent, latestWeek.clientsBelow85Percent);
                const totalClients = latestWeek.clientsAbove85Percent + latestWeek.clientsBelow85Percent;
                
                return (
                  <Alert>
                    <Target className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Latest Week Performance:</strong> {precisionScore}% precision score
                      ({latestWeek.clientsAbove85Percent} of {totalClients} clients above {bookkeepingUpperThreshold}%).
                      {precisionScore >= bookkeepingUpperThreshold ? " Excellent performance!" : 
                       precisionScore >= bookkeepingUpperThreshold - 10 ? " Close to target - room for improvement." : 
                       " Below target - attention needed."}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Trend Analysis */}
              {sortedData.length >= 2 && (() => {
                const current = calculatePrecisionScore(sortedData[0].clientsAbove85Percent, sortedData[0].clientsBelow85Percent);
                const previous = calculatePrecisionScore(sortedData[1].clientsAbove85Percent, sortedData[1].clientsBelow85Percent);
                const trend = current - previous;
                
                return (
                  <Alert>
                    {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertDescription>
                      <strong>Week-over-Week Trend:</strong> 
                      {trend > 0 ? ` +${trend}% improvement` : trend < 0 ? ` ${trend}% decline` : " No change"} 
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