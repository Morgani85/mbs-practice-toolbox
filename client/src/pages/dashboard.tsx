import { useState, memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Target, CheckCircle, Percent, Calendar, Edit, TrendingDown, Users, AlertTriangle, ArrowLeft, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { type Team } from "@shared/schema";
import { getPreviousCompletedWeekEnding } from "@/lib/utils";

interface DashboardData {
  performanceData: Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    accountsDue: number | null;
    accountsDueInProgress: number | null;
  }>;
  teams: Array<{
    teamId: number;
    teamName: string;
    totalCompleted: number;
    currentWeekTarget: number;
    currentWeekActual: number;
    currentAccountsDue: number;
    currentAccountsDueInProgress: number;
    currentAccountsDueNotes: string | null;
    achievementRate: number;
  }>;
  summary: {
    teamId: number;
    teamName: string;
    totalCompleted: number;
    currentWeekTarget: number;
    currentWeekActual: number;
    currentAccountsDue: number;
    currentAccountsDueInProgress: number;
    currentAccountsDueNotes: string | null;
    achievementRate: number;
  };
}

export default function Dashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Get the previous completed week automatically
  const targetWeekEnding = getPreviousCompletedWeekEnding();

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", selectedTeam, targetWeekEnding],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('teamId', selectedTeam.toString());
      params.append('weekEnding', targetWeekEnding);
      params.append('includeHistory', 'true'); // Request 8 weeks of data
      const response = await fetch(`/api/dashboard?${params}`);
      if (!response.ok) {
        throw new Error(`Dashboard API failed: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    select: (data) => data, // Memoize the data
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-2/3"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg p-6 border">
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg font-medium">Failed to load dashboard data</div>
        <p className="text-gray-600 mt-2">Please try refreshing the page</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 text-lg">No data available</div>
        <p className="text-gray-500 mt-2">Start by creating teams and setting weekly targets</p>
      </div>
    );
  }

  const { summary, performanceData, teams: teamSummaries } = dashboardData;

  // Traffic light system functions
  const getTrafficLightStyle = (status: string) => {
    switch (status) {
      case 'green':
        return 'border-green-500 bg-green-50 text-green-900';
      case 'amber':
        return 'border-yellow-500 bg-yellow-50 text-yellow-900';
      case 'red':
        return 'border-red-500 bg-red-50 text-red-900';
      default:
        return 'border-gray-300 bg-gray-50 text-gray-900';
    }
  };

  // Calculate traffic light summaries - Add null check
  const accountsDueSummary = {
    count: summary?.currentAccountsDue || 0,
    status: (summary?.currentAccountsDue || 0) === 0 ? 'green' : 
            (summary?.currentAccountsDue || 0) <= 2 ? 'amber' : 'red',
    trend: (summary?.currentAccountsDue || 0) === 0 ? 
      "Excellent progress maintaining zero accounts due." :
      (summary?.currentAccountsDue || 0) <= 2 ? 
      "Manageable workload but monitor closely." :
      "High workload requires immediate attention."
  };

  const performanceSummary = {
    percentage: summary?.achievementRate || 0,
    status: (summary?.achievementRate || 0) >= 90 ? 'green' : 
            (summary?.achievementRate || 0) >= 70 ? 'amber' : 'red',
    trend: (summary?.achievementRate || 0) >= 90 ? 
      "Strong performance meeting targets consistently." :
      (summary?.achievementRate || 0) >= 70 ? 
      "Moderate performance with room for improvement." :
      "Performance below expectations, review processes."
  };

  // Format chart data for selected team or all teams - show last 8 weeks
  // Only include weeks that have already passed (not future dates)
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today for comparison
  
  const chartData = (() => {
    if (selectedTeam) {
      // Show data for selected team only - most recent first (left side)
      // Filter out future week endings
      return performanceData
        .filter(week => week.teamId === selectedTeam && new Date(week.weekEnding) <= today)
        .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
        .slice(0, 8)
        .map(week => ({
          week: format(new Date(week.weekEnding), "MMM dd"),
          target: week.rollingFourWeekTarget || 0,
          actual: week.rollingFourWeekActual || 0,
          weeklyActual: week.weeklyActual || 0,
          accountsDue: week.accountsDue || 0,
          accountsDueInProgress: week.accountsDueInProgress || 0,
          team: week.teamName,
        }));
    } else {
      // Aggregate data for all teams by week
      // Filter out future week endings
      const weeklyAggregates = new Map<string, {
        weekEnding: string;
        target: number;
        actual: number;
        weeklyActual: number;
        accountsDue: number;
        accountsDueInProgress: number;
      }>();

      (performanceData || []).filter(week => new Date(week.weekEnding) <= today).forEach(week => {
        const weekKey = week.weekEnding;
        const existing = weeklyAggregates.get(weekKey) || {
          weekEnding: week.weekEnding,
          target: 0,
          actual: 0,
          weeklyActual: 0,
          accountsDue: 0,
          accountsDueInProgress: 0,
        };

        existing.target += week.rollingFourWeekTarget || 0;
        existing.actual += week.rollingFourWeekActual || 0;
        existing.weeklyActual += week.weeklyActual || 0;
        existing.accountsDue += week.accountsDue || 0;
        existing.accountsDueInProgress += week.accountsDueInProgress || 0;

        weeklyAggregates.set(weekKey, existing);
      });

      return Array.from(weeklyAggregates.values())
        .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
        .slice(0, 8)
        .map(week => ({
          week: format(new Date(week.weekEnding), "MMM dd"),
          target: week.target,
          actual: week.actual,
          weeklyActual: week.weeklyActual,
          accountsDue: week.accountsDue,
          accountsDueInProgress: week.accountsDueInProgress,
          team: "All Teams",
        }));
    }
  })();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-blue-900 mb-1">ACCOUNTS MODULE</h1>
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Team Performance Dashboard</h2>
            <p className="text-blue-700">Week ending {format(new Date(targetWeekEnding), "MMMM dd, yyyy")} (Previous completed week)</p>
            <p className="text-blue-700">Track account preparation performance and manage workflow targets</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <ArrowLeft size={16} />
              <span>Back to Main Menu</span>
            </Button>
          </Link>
          <Select
            value={selectedTeam?.toString() || "all"}
            onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select team..." />
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

      {/* Traffic Light Summary Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accounts Due in Next 3 Months */}
        <Card className={`border-l-4 ${getTrafficLightStyle(accountsDueSummary.status)}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-full bg-white bg-opacity-20">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium opacity-90">Accounts Due in Next 3 Months</h3>
                  <p className="text-3xl font-bold">{accountsDueSummary.count}</p>
                </div>
              </div>
              <div className="text-right">
                {accountsDueSummary.status === 'green' && <CheckCircle className="h-8 w-8 text-green-600" />}
                {accountsDueSummary.status === 'amber' && <AlertCircle className="h-8 w-8 text-yellow-600" />}
                {accountsDueSummary.status === 'red' && <AlertCircle className="h-8 w-8 text-red-600" />}
              </div>
            </div>
            <div className="mt-4 p-3 bg-white bg-opacity-30 rounded-lg">
              <p className="text-sm font-medium">Trend Analysis:</p>
              <p className="text-sm mt-1">{accountsDueSummary.trend}</p>
            </div>
            {summary?.currentAccountsDueNotes ? (
              <div className="mt-4 p-3 bg-white bg-opacity-30 rounded-lg">
                <p className="text-sm font-medium">Notes:</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{summary.currentAccountsDueNotes}</p>
              </div>
            ) : selectedTeam === null ? (
              <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
                <p className="text-xs text-gray-700 opacity-75 italic">Select a team to view notes</p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
                <p className="text-xs text-gray-700 opacity-75 italic">No notes recorded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last 4 Weeks Actual vs Target */}
        <Card className={`border-l-4 ${getTrafficLightStyle(performanceSummary.status)}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-full bg-white bg-opacity-20">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium opacity-90">Last 4 Weeks Actual vs Target</h3>
                  <p className="text-3xl font-bold">{performanceSummary.percentage}%</p>
                </div>
              </div>
              <div className="text-right">
                {performanceSummary.status === 'green' && <CheckCircle className="h-8 w-8 text-green-600" />}
                {performanceSummary.status === 'amber' && <AlertCircle className="h-8 w-8 text-yellow-600" />}
                {performanceSummary.status === 'red' && <AlertCircle className="h-8 w-8 text-red-600" />}
              </div>
            </div>
            <div className="mt-4 p-3 bg-white bg-opacity-30 rounded-lg">
              <p className="text-sm font-medium">Trend Analysis:</p>
              <p className="text-sm mt-1">{performanceSummary.trend}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Comparison */}
      {!selectedTeam && teamSummaries.length > 1 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Performance Comparison</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamSummaries.map((team) => (
                <div key={team.teamId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">{team.teamName}</h4>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      team.achievementRate >= 100 ? "bg-green-100 text-green-800" : 
                      team.achievementRate >= 80 ? "bg-yellow-100 text-yellow-800" : 
                      "bg-red-100 text-red-800"
                    }`}>
                      {team.achievementRate}%
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target:</span>
                      <span className="font-medium">{team.currentWeekTarget}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual:</span>
                      <span className="font-medium">{team.currentWeekActual}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accounts Due in 3 Months:</span>
                      <span className={`font-medium ${
                        team.currentAccountsDue === 0 ? "text-green-600" : 
                        team.currentAccountsDue <= 2 ? "text-orange-600" : "text-red-600"
                      }`}>
                        {team.currentAccountsDue}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">In Progress / Not Started:</span>
                      <span className="font-medium text-gray-900">
                        {team.currentAccountsDueInProgress}
                      </span>
                    </div>
                    {team.currentAccountsDueNotes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600 font-medium mb-1">Notes:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{team.currentAccountsDueNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Performance Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="accountsDue" 
                  fill="#dc2626"
                  fillOpacity={0.6}
                  name="Accounts Due in 3 Months"
                />
                <Bar 
                  dataKey="accountsDueInProgress" 
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="In Progress / Not Started"
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#16a34a"
                  strokeWidth={3}
                  name="Actual Accounts Done"
                />
                <Line type="monotone" dataKey="target" stroke="#2563eb" name="Target to Do" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Weeks Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Team Performance</h3>
          </div>
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
                    Last 4 Weeks Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts Due in 3 Months
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Achievement
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {performanceData.map((week) => {
                  const target = week.rollingFourWeekTarget || 0;
                  const actual = week.rollingFourWeekActual || 0;
                  const accountsDue = week.accountsDue || 0;
                  const accountsDueInProgress = week.accountsDueInProgress || 0;
                  const hasResult = week.rollingFourWeekActual !== null;
                  const achievement = target > 0 && hasResult ? Math.round((actual / target) * 100) : 0;
                  const metTarget = hasResult && actual >= target;

                  return (
                    <tr key={`${week.teamId}-${week.weekEnding}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {week.teamName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(week.weekEnding), "MMM dd, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {target || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hasResult ? actual : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span className={
                          accountsDue === 0 ? "text-green-600" : 
                          accountsDue <= 2 ? "text-orange-600" : 
                          "text-red-600"
                        }>
                          {accountsDue}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {accountsDueInProgress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {hasResult ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              metTarget
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            <CheckCircle className="mr-1" size={12} />
                            {metTarget ? "Met Target" : "Below Target"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {hasResult ? (
                          <span className={metTarget ? "text-green-600" : "text-red-600"}>
                            {achievement}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
