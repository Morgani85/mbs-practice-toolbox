import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { format, parseISO, subWeeks, startOfWeek } from "date-fns";
import type { Team, MbsDextPrecision, MbsOldestItems } from "@shared/schema";
import { useOrgSettings } from "@/hooks/use-org-settings";

export default function MbsDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const { platformName, bookkeepingUpperThreshold, bookkeepingLowerThreshold } = useOrgSettings();

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: dextPrecisionData, isLoading: dextLoading } = useQuery<MbsDextPrecision[]>({
    queryKey: ["/api/mbs-dext-precision", selectedTeam],
  });

  const { data: oldestItemsData, isLoading: oldestLoading } = useQuery<MbsOldestItems[]>({
    queryKey: ["/api/mbs-oldest-items", selectedTeam],
  });

  // Process data for last 6 weeks
  const getLast6WeeksData = () => {
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
          dextPrecisionTarget: 0,
          dextPrecisionActual: dextEntry ? dextEntry.clientsBelow85Percent : null,
          clientsBelow70Percent: dextEntry ? (dextEntry.clientsBelow70Percent || 0) : null,
          oldestItemsTarget: oldestEntry?.target || 10,
          oldestItemsActual: oldestEntry?.oldestItemDays || null,
        };
      } else {
        // Combined data for all teams
        const weekDextEntries = dextPrecisionData.filter(d => d.weekEnding === week);
        const weekOldestEntries = oldestItemsData.filter(o => o.weekEnding === week);
        
        // Calculate totals for combined view (not averages)
        const totalDextPrecision = weekDextEntries.length > 0 ? 
          weekDextEntries.reduce((sum, entry) => sum + entry.clientsBelow85Percent, 0) : null;
        
        const totalBelow70 = weekDextEntries.length > 0 ? 
          weekDextEntries.reduce((sum, entry) => sum + (entry.clientsBelow70Percent || 0), 0) : null;
        
        const avgOldestItems = weekOldestEntries.length > 0 ? 
          weekOldestEntries.reduce((sum, entry) => sum + entry.oldestItemDays, 0) / weekOldestEntries.length : null;
        
        const avgTarget = weekOldestEntries.length > 0 ? 
          weekOldestEntries.reduce((sum, entry) => sum + (entry.target || 10), 0) / weekOldestEntries.length : 10;
        
        return {
          week: format(parseISO(week as string), "MMM dd"),
          fullDate: week,
          dextPrecisionTarget: 0,
          dextPrecisionActual: totalDextPrecision !== null ? Math.round(totalDextPrecision) : null,
          clientsBelow70Percent: totalBelow70 !== null ? Math.round(totalBelow70) : null,
          oldestItemsTarget: avgTarget,
          oldestItemsActual: avgOldestItems,
        };
      }
    });
  };

  const chartData = getLast6WeeksData().reverse(); // Most recent week on left

  // Get most recent entries for performance analysis
  const getRecentPerformance = () => {
    if (!dextPrecisionData || !oldestItemsData) return null;

    if (selectedTeam) {
      // Individual team performance
      const teamDextData = dextPrecisionData.filter(d => d.teamId === selectedTeam);
      const teamOldestData = oldestItemsData.filter(o => o.teamId === selectedTeam);

      const sortedDext = [...teamDextData].sort((a, b) => 
        new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
      );
      const sortedOldest = [...teamOldestData].sort((a, b) => 
        new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime()
      );

      const latestDext = sortedDext[0];
      const previousDext = sortedDext[1];
      const latestOldest = sortedOldest[0];
      const previousOldest = sortedOldest[1];

      return {
        dext: {
          current: latestDext,
          previous: previousDext,
          trend: latestDext && previousDext ? 
            previousDext.clientsBelow85Percent - latestDext.clientsBelow85Percent : 0
        },
        oldest: {
          current: latestOldest,
          previous: previousOldest,
          trend: latestOldest && previousOldest ? 
            previousOldest.oldestItemDays - latestOldest.oldestItemDays : 0
        }
      };
    } else {
      // Combined team performance - get averages by week
      const allWeeks = Array.from(new Set([...dextPrecisionData.map(d => d.weekEnding), ...oldestItemsData.map(o => o.weekEnding)]));
      const sortedWeeks = allWeeks.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (sortedWeeks.length < 2) return null;

      const latestWeek = sortedWeeks[0];
      const previousWeek = sortedWeeks[1];

      // Calculate averages for latest week
      const latestDextEntries = dextPrecisionData.filter(d => d.weekEnding === latestWeek);
      const latestOldestEntries = oldestItemsData.filter(o => o.weekEnding === latestWeek);

      // Calculate averages for previous week
      const previousDextEntries = dextPrecisionData.filter(d => d.weekEnding === previousWeek);
      const previousOldestEntries = oldestItemsData.filter(o => o.weekEnding === previousWeek);

      const latestDextTotal = latestDextEntries.length > 0 ? 
        latestDextEntries.reduce((sum, entry) => sum + entry.clientsBelow85Percent, 0) : 0;
      
      const latestBelow70Total = latestDextEntries.length > 0 ? 
        latestDextEntries.reduce((sum, entry) => sum + (entry.clientsBelow70Percent || 0), 0) : 0;
      
      const previousDextTotal = previousDextEntries.length > 0 ? 
        previousDextEntries.reduce((sum, entry) => sum + entry.clientsBelow85Percent, 0) : 0;
      
      const previousBelow70Total = previousDextEntries.length > 0 ? 
        previousDextEntries.reduce((sum, entry) => sum + (entry.clientsBelow70Percent || 0), 0) : 0;

      const latestOldestAvg = latestOldestEntries.length > 0 ? 
        latestOldestEntries.reduce((sum, entry) => sum + entry.oldestItemDays, 0) / latestOldestEntries.length : 0;
      
      const previousOldestAvg = previousOldestEntries.length > 0 ? 
        previousOldestEntries.reduce((sum, entry) => sum + entry.oldestItemDays, 0) / previousOldestEntries.length : 0;

      return {
        dext: {
          current: { 
            weekEnding: latestWeek, 
            clientsBelow85Percent: latestDextTotal,
            clientsBelow70Percent: latestBelow70Total,
            lowestScoreClientDetails: latestDextEntries.map(entry => 
              entry.lowestScoreClientDetails ? `${teams?.find(t => t.id === entry.teamId)?.name}: ${entry.lowestScoreClientDetails}` : null
            ).filter(Boolean).join(' | ') || "No client details available"
          },
          previous: { 
            weekEnding: previousWeek, 
            clientsBelow85Percent: previousDextTotal,
            clientsBelow70Percent: previousBelow70Total,
            lowestScoreClientDetails: previousDextEntries.map(entry => 
              entry.lowestScoreClientDetails ? `${teams?.find(t => t.id === entry.teamId)?.name}: ${entry.lowestScoreClientDetails}` : null
            ).filter(Boolean).join(' | ') || "No client details available"
          },
          trend: previousDextTotal - latestDextTotal
        },
        oldest: {
          current: { 
            weekEnding: latestWeek, 
            oldestItemDays: latestOldestAvg,
            target: 10,
            worstPerformingClients: latestOldestEntries.map(entry => 
              entry.worstPerformingClients ? `${teams?.find(t => t.id === entry.teamId)?.name}: ${entry.worstPerformingClients}` : null
            ).filter(Boolean).join(' | ') || "No client details available"
          },
          previous: { 
            weekEnding: previousWeek, 
            oldestItemDays: previousOldestAvg,
            target: 10,
            worstPerformingClients: previousOldestEntries.map(entry => 
              entry.worstPerformingClients ? `${teams?.find(t => t.id === entry.teamId)?.name}: ${entry.worstPerformingClients}` : null
            ).filter(Boolean).join(' | ') || "No client details available"
          },
          trend: previousOldestAvg - latestOldestAvg
        }
      };
    }
  };

  const performance = getRecentPerformance();

  // Calculate target achievement with color coding
  const getTargetAchievement = () => {
    if (!performance) return null;

    const dextActual = performance.dext.current?.clientsBelow85Percent || 0;
    const dextTarget = 0;
    
    const oldestActual = performance.oldest.current?.oldestItemDays || 0;
    const oldestTarget = performance.oldest.current?.target || 10;

    // Color coding logic
    const getDextStatus = (actual: number, target: number) => {
      if (actual <= target) return 'good'; // At or better than target
      if (actual <= target + 2) return 'warning'; // Near target (within 2 clients)
      return 'bad'; // Significantly over target
    };

    const getOldestStatus = (actual: number, target: number) => {
      if (actual <= target) return 'good'; // At or better than target
      if (actual <= target + 3) return 'warning'; // Near target (within 3 days)
      return 'bad'; // Significantly over target
    };

    return {
      dextPrecision: {
        actual: dextActual,
        target: dextTarget,
        status: getDextStatus(dextActual, dextTarget)
      },
      oldestItems: {
        actual: oldestActual,
        target: oldestTarget,
        status: getOldestStatus(oldestActual, oldestTarget)
      }
    };
  };

  const targetAchievement = getTargetAchievement();

  // Show loading state while data is being fetched
  if (teamsLoading || dextLoading || oldestLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">INTERNAL BOOKKEEPING MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Performance Dashboard</h2>
          <p className="text-blue-700">Monitor BK Quality scores and reconciliation performance</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show no teams message only after loading is complete
  if (!teams || teams.length === 0) {
    return (
      <div className="space-y-8">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">INTERNAL BOOKKEEPING MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Performance Dashboard</h2>
          <p className="text-blue-700">Monitor BK Quality scores and reconciliation performance</p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No teams found. Please create teams in the Admin section first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">INTERNAL BOOKKEEPING MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">Performance Dashboard</h2>
          <p className="text-blue-700">Monitor BK Quality scores and reconciliation performance</p>
        </div>
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <ArrowLeft size={16} />
              <span>Back to Main Menu</span>
            </Button>
          </Link>
          <Select value={selectedTeam?.toString() || "all"} onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target Achievement Section */}
      {dextPrecisionData && oldestItemsData && (
        <>
          {targetAchievement && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className={`border-l-4 ${
                targetAchievement.dextPrecision.status === 'good' ? 'border-green-500 bg-green-50' :
                targetAchievement.dextPrecision.status === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                'border-red-500 bg-red-50'
              }`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">BK Quality Score Target Achievement</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    targetAchievement.dextPrecision.status === 'good' ? 'text-green-700' :
                    targetAchievement.dextPrecision.status === 'warning' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {targetAchievement.dextPrecision.actual} vs {targetAchievement.dextPrecision.target}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Actual vs Target (clients below {bookkeepingUpperThreshold}%)
                  </div>
                  <Badge 
                    className={`mt-2 ${
                      targetAchievement.dextPrecision.status === 'good' ? 'bg-green-600 hover:bg-green-700' :
                      targetAchievement.dextPrecision.status === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                      'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {targetAchievement.dextPrecision.status === 'good' ? 'Target Met' :
                     targetAchievement.dextPrecision.status === 'warning' ? 'Near Target' :
                     'Below Target'}
                  </Badge>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${
                targetAchievement.oldestItems.status === 'good' ? 'border-green-500 bg-green-50' :
                targetAchievement.oldestItems.status === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                'border-red-500 bg-red-50'
              }`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Oldest Items Target Achievement</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${
                    targetAchievement.oldestItems.status === 'good' ? 'text-green-700' :
                    targetAchievement.oldestItems.status === 'warning' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {targetAchievement.oldestItems.actual} vs {targetAchievement.oldestItems.target}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Actual vs Target (days outstanding)
                  </div>
                  <Badge 
                    className={`mt-2 ${
                      targetAchievement.oldestItems.status === 'good' ? 'bg-green-600 hover:bg-green-700' :
                      targetAchievement.oldestItems.status === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                      'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {targetAchievement.oldestItems.status === 'good' ? 'Target Met' :
                     targetAchievement.oldestItems.status === 'warning' ? 'Near Target' :
                     'Below Target'}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Alerts */}
          {performance && (
            <div className="space-y-4">
              {performance.dext.trend !== 0 && (
                <Alert className={performance.dext.trend > 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {performance.dext.trend > 0 ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <AlertDescription className={performance.dext.trend > 0 ? "text-green-800" : "text-red-800"}>
                    <strong>BK Quality Score Performance:</strong> {performance.dext.trend > 0 ? "Improved" : "Worsened"} by {Math.abs(performance.dext.trend)} clients compared to last week
                  </AlertDescription>
                </Alert>
              )}

              {performance.oldest.trend !== 0 && (
                <Alert className={performance.oldest.trend > 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {performance.oldest.trend > 0 ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  }
                  <AlertDescription className={performance.oldest.trend > 0 ? "text-green-800" : "text-red-800"}>
                    <strong>Reconciliation Performance:</strong> {performance.oldest.trend > 0 ? "Improved" : "Worsened"} by {Math.abs(performance.oldest.trend)} days compared to last week
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Oldest Items Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 size={20} />
                  <span>Reconciliation Performance (6 Weeks)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value, name) => [value, name === 'oldestItemsActual' ? 'Actual Days' : 'Target Days']} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="oldestItemsTarget" 
                        stroke="#3b82f6" 
                        strokeDasharray="5 5" 
                        name="Target" 
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="oldestItemsActual" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        name="Actual" 
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* BK Quality Score Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp size={20} />
                  <span>BK Quality Score - Clients Below Threshold (6 Weeks)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis label={{ value: 'Number of Clients', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value, name) => {
                        if (name === 'dextPrecisionActual') return [value + ' clients', `Below ${bookkeepingUpperThreshold}%`];
                        if (name === 'clientsBelow70Percent') return [value + ' clients', `Below ${bookkeepingLowerThreshold}%`];
                        return [value, name];
                      }} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="dextPrecisionActual" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        name={`Below ${bookkeepingUpperThreshold}%`}
                        connectNulls={true}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="clientsBelow70Percent" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        name={`Below ${bookkeepingLowerThreshold}%`}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Performance Data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Worst Performing Clients */}
            {performance?.oldest.current && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Worst Performing Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Week ending: {format(parseISO(performance.oldest.current.weekEnding), "MMM dd, yyyy")}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm font-medium">Top 2 Worst Performing Clients:</p>
                      <p className="text-sm mt-1">{performance.oldest.current.worstPerformingClients}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      Oldest item: {performance.oldest.current.oldestItemDays} days
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lowest BK Quality Score Client */}
            {performance?.dext.current && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lowest BK Quality Score Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Week ending: {format(parseISO(performance.dext.current.weekEnding), "MMM dd, yyyy")}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm font-medium">Lowest Score Client Details:</p>
                      <p className="text-sm mt-1">{performance.dext.current.lowestScoreClientDetails}</p>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Clients below {bookkeepingUpperThreshold}%: {performance.dext.current.clientsBelow85Percent}</div>
                      <div>Clients below {bookkeepingLowerThreshold}%: {performance.dext.current.clientsBelow70Percent || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Data Entry & Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/mbs-bookkeeping/dext-precision">
                  <Button className="w-full justify-start">
                    <Target className="h-4 w-4 mr-2" />
                    Manage BK Quality Score Data
                  </Button>
                </Link>
                <Link href="/mbs-bookkeeping/oldest-items">
                  <Button className="w-full justify-start">
                    <Clock className="h-4 w-4 mr-2" />
                    Manage Oldest Items Data
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}