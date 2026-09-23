import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { format, parseISO, subWeeks, startOfWeek } from "date-fns";
import type { Team, ClientDextPrecision, ClientOldestItems } from "@shared/schema";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useOrgSettings } from "@/hooks/use-org-settings";

export default function ClientBookkeepingDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const { platformName, bookkeepingUpperThreshold } = useOrgSettings();

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: dextPrecisionData, isLoading: dextLoading } = useQuery<ClientDextPrecision[]>({
    queryKey: ["/api/client-dext-precision", selectedTeam],
  });

  const { data: oldestItemsData, isLoading: oldestLoading } = useQuery<ClientOldestItems[]>({
    queryKey: ["/api/client-oldest-items", selectedTeam],
  });

  // Process data for last 6 weeks with memoization
  const getLast6WeeksData = useMemo(() => {
    if (!dextPrecisionData || !oldestItemsData) return [];

    // Get unique weeks from the actual data instead of generating them
    const allWeeks = new Set();
    
    dextPrecisionData.forEach(entry => allWeeks.add(entry.weekEnding));
    oldestItemsData.forEach(entry => allWeeks.add(entry.weekEnding));
    
    // Sort weeks and take the last 6
    const weeks = Array.from(allWeeks).sort().slice(-6);

    return weeks.map(week => {
      if (selectedTeam) {
        // Individual team data
        const dextEntry = dextPrecisionData.find(d => d.weekEnding === week && d.teamId === selectedTeam);
        const oldestEntry = oldestItemsData.find(o => o.weekEnding === week && o.teamId === selectedTeam);
        
        return {
          week: format(parseISO(week as string), "MMM dd"),
          fullDate: week,
          precisionAbove85: dextEntry?.clientsAbove85Percent || 0,
          precisionBelow85: dextEntry?.clientsBelow85Percent || 0,
          precisionTarget: 0, // Target is 0 clients below 85%
          oldestItemDays: oldestEntry?.oldestItemDays || 0,
          oldestItemTarget: oldestEntry?.target || 10,
        };
      } else {
        // Combined team data
        const weekDextEntries = dextPrecisionData.filter(d => d.weekEnding === week);
        const weekOldestEntries = oldestItemsData.filter(o => o.weekEnding === week);
        
        const totalAbove85 = weekDextEntries.reduce((sum, entry) => sum + entry.clientsAbove85Percent, 0);
        const totalBelow85 = weekDextEntries.reduce((sum, entry) => sum + entry.clientsBelow85Percent, 0);
        const avgOldestDays = weekOldestEntries.length > 0 
          ? Math.round(weekOldestEntries.reduce((sum, entry) => sum + entry.oldestItemDays, 0) / weekOldestEntries.length)
          : 0;
        
        return {
          week: format(parseISO(week as string), "MMM dd"),
          fullDate: week,
          precisionAbove85: totalAbove85,
          precisionBelow85: totalBelow85,
          precisionTarget: 0, // Target is 0 clients below 85%
          oldestItemDays: avgOldestDays,
          oldestItemTarget: 10,
        };
      }
    });
  }, [dextPrecisionData, oldestItemsData, selectedTeam]);

  // Calculate current week performance with memoization
  const currentPerformance = useMemo(() => {
    if (getLast6WeeksData.length === 0) return null;
    
    const currentWeek = getLast6WeeksData[getLast6WeeksData.length - 1];
    const totalClients = currentWeek.precisionAbove85 + currentWeek.precisionBelow85;
    const precisionPercentage = totalClients > 0 ? Math.round((currentWeek.precisionAbove85 / totalClients) * 100) : 0;
    
    // Dext precision: target is 0 clients below 85%, actual is clients below 85%
    const dextTarget = 0;
    const dextActual = currentWeek.precisionBelow85;
    
    return {
      precisionPercentage,
      dextTarget,
      dextActual,
      precisionStatus: dextActual === dextTarget ? 'good' : dextActual <= dextTarget + 2 ? 'warning' : 'poor',
      oldestItemDays: currentWeek.oldestItemDays,
      oldestItemStatus: currentWeek.oldestItemDays <= currentWeek.oldestItemTarget ? 'good' : 
                       currentWeek.oldestItemDays <= currentWeek.oldestItemTarget + 5 ? 'warning' : 'poor',
      totalClients,
    };
  }, [getLast6WeeksData]);

  const chartData = getLast6WeeksData;

  if (teamsLoading || dextLoading || oldestLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-lg">Loading client bookkeeping dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/area-selector">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Main Menu
            </Button>
          </Link>
          <div>
            <div className="flex items-center mb-2">
              <img 
                src="/attached_assets/Screenshot 2025-07-02 at 16.25.36_1751469958155.png" 
                alt="Practice Toolbox" 
                className="h-10 mr-3"
              />
              <h1 className="text-3xl font-bold text-gray-900">Client Bookkeeping Dashboard</h1>
            </div>
            <p className="text-gray-600">Monitor client bookkeeping performance and metrics</p>
          </div>
        </div>
        
        {/* Team Filter */}
        <div className="flex items-center space-x-4">
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
      </div>

      {/* Performance Alert */}
      {currentPerformance && (currentPerformance.precisionStatus === 'poor' || currentPerformance.oldestItemStatus === 'poor') && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="flex items-center space-x-2">
              <span className="font-semibold">Performance Alert:</span>
              <span>Client bookkeeping metrics are below target.</span>
            </div>
            <div className="mt-2 space-y-1">
              {currentPerformance.precisionStatus === 'poor' && (
                <div className="text-sm">• {platformName}: {currentPerformance.dextActual} clients below {bookkeepingUpperThreshold}% (target: {currentPerformance.dextTarget})</div>
              )}
              {currentPerformance.oldestItemStatus === 'poor' && (
                <div className="text-sm">• Oldest items: {currentPerformance.oldestItemDays} days (target: ≤10 days)</div>
              )}
            </div>
            <div className="mt-2 text-sm font-medium">Consider reviewing team workload and processes.</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Performance Cards */}
      {currentPerformance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BK Quality Score Card */}
          <Card className={
            currentPerformance.precisionStatus === 'good' ? 'border-green-200 bg-green-50' :
            currentPerformance.precisionStatus === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-red-200 bg-red-50'
          }>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">BK Quality Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {currentPerformance.dextActual} vs {currentPerformance.dextTarget}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clients below {bookkeepingUpperThreshold}% (actual vs target)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPerformance.totalClients} total clients
                  </p>
                </div>
                <Badge 
                  variant={currentPerformance.precisionStatus === 'good' ? 'default' : 
                          currentPerformance.precisionStatus === 'warning' ? 'secondary' : 'destructive'}
                  className={
                    currentPerformance.precisionStatus === 'good' ? 'bg-green-500 hover:bg-green-600 text-white' :
                    currentPerformance.precisionStatus === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                    'bg-red-500 hover:bg-red-600 text-white'
                  }
                >
                  {currentPerformance.precisionStatus === 'good' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {currentPerformance.precisionStatus === 'warning' && <Clock className="w-3 h-3 mr-1" />}
                  {currentPerformance.precisionStatus === 'poor' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {currentPerformance.precisionStatus === 'good' ? 'At Target' : 
                   currentPerformance.precisionStatus === 'warning' ? 'Near Target' : 'Above Target'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Oldest Items Card */}
          <Card className={
            currentPerformance.oldestItemStatus === 'good' ? 'border-green-200 bg-green-50' :
            currentPerformance.oldestItemStatus === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-red-200 bg-red-50'
          }>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Oldest Items</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{currentPerformance.oldestItemDays} days</div>
                  <p className="text-xs text-muted-foreground">
                    {currentPerformance.oldestItemDays} vs 10 day target
                  </p>
                </div>
                <Badge 
                  variant={currentPerformance.oldestItemStatus === 'good' ? 'default' : 
                          currentPerformance.oldestItemStatus === 'warning' ? 'secondary' : 'destructive'}
                  className={
                    currentPerformance.oldestItemStatus === 'good' ? 'bg-green-500 hover:bg-green-600 text-white' :
                    currentPerformance.oldestItemStatus === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                    'bg-red-500 hover:bg-red-600 text-white'
                  }
                >
                  {currentPerformance.oldestItemStatus === 'good' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {currentPerformance.oldestItemStatus === 'warning' && <Clock className="w-3 h-3 mr-1" />}
                  {currentPerformance.oldestItemStatus === 'poor' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {currentPerformance.oldestItemStatus === 'good' ? 'On Target' : 
                   currentPerformance.oldestItemStatus === 'warning' ? 'Near Target' : 'Above Target'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BK Quality Score Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              BK Quality Score Trend (Last 6 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        value,
                        name === 'precisionBelow85' ? `Results (Clients Below ${bookkeepingUpperThreshold}%)` : 'Target'
                      ]}
                      labelFormatter={(label) => `Week: ${label}`}
                    />
                    <Legend 
                      formatter={(value) => 
                        value === 'precisionBelow85' ? `Results (Clients Below ${bookkeepingUpperThreshold}%)` : 'Target (0 clients)'
                      }
                    />
                    <Line 
                      type="monotone" 
                      dataKey="precisionTarget" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="precisionTarget"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="precisionBelow85" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      name="precisionBelow85"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No precision data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Oldest Items Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Oldest Items Trend (Last 6 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value} days`,
                        name === 'oldestItemDays' ? 'Oldest Item Age' : 'Target'
                      ]}
                      labelFormatter={(label) => `Week: ${label}`}
                    />
                    <Legend 
                      formatter={(value) => 
                        value === 'oldestItemDays' ? 'Oldest Item Age' : 'Target (10 days)'
                      }
                    />
                    <Line 
                      type="monotone" 
                      dataKey="oldestItemDays" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="oldestItemTarget" 
                      stroke="#3b82f6" 
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No oldest items data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Data Entry & Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/client-bookkeeping/dext-precision">
              <Button className="w-full justify-start">
                <Target className="h-4 w-4 mr-2" />
                Manage BK Quality Score Data
              </Button>
            </Link>
            <Link href="/client-bookkeeping/oldest-items">
              <Button className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Manage Oldest Items Data
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}