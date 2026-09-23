import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { useOrgSettings } from "@/hooks/use-org-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Target, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface HealthChecksDashboardData {
  monthlyPerformance: {
    totalCompleted: number;
    totalRemaining: number;
    percentageComplete: number;
    targetDate: string; // 15th of current month
  };
  currentMonthData: Array<{
    date: string;
    remainingChecks: number;
    teamId?: number;
    teamName?: string;
  }>;
  sixMonthHistory: Array<{
    month: string;
    monthEnding: string; // 15th of each month
    remainingChecks: number;
    teamId?: number;
    teamName?: string;
  }>;
  teams: Array<{
    teamId: number;
    teamName: string;
    currentRemaining: number;
    monthlyTarget: number; // Always 0
    percentageComplete: number;
  }>;
}

export default function HealthChecksDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const { mgmtAccountsDay } = useOrgSettings();
  const currentDate = new Date();
  const currentMonth = format(currentDate, "MMMM yyyy");
  const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), mgmtAccountsDay);

  const { data: dashboardData, isLoading, error } = useQuery<HealthChecksDashboardData>({
    queryKey: [selectedTeam ? `/api/health-checks/dashboard?teamId=${selectedTeam}` : '/api/health-checks/dashboard', selectedTeam],
    enabled: true,
  });

  const { data: teams } = useQuery({
    queryKey: ['/api/teams'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  const monthlyPerformance = dashboardData?.monthlyPerformance || {
    totalCompleted: 0,
    totalRemaining: 0,
    percentageComplete: 0,
    targetDate: format(targetDate, "yyyy-MM-dd")
  };

  const currentMonthData = dashboardData?.currentMonthData || [];
  const sixMonthHistory = dashboardData?.sixMonthHistory || [];
  const teamData = dashboardData?.teams || [];

  // Prepare current month chart data (from 1st to 15th)
  const currentMonthChartData = currentMonthData
    .filter(item => selectedTeam ? item.teamId === selectedTeam : true)
    .map(item => ({
      date: format(new Date(item.date), "MMM dd"),
      remainingChecks: item.remainingChecks,
      target: 0 // Target is always 0
    }));

  console.log("Dashboard data:", dashboardData);
  console.log("Current month data:", currentMonthData);
  console.log("Chart data:", currentMonthChartData);

  // Prepare 6-month history chart data (15th of each month)
  const sixMonthChartData = sixMonthHistory
    .filter(item => selectedTeam ? item.teamId === selectedTeam : true)
    .map(item => ({
      month: item.month,
      remainingChecks: item.remainingChecks,
      target: 0 // Target is always 0
    }));

  // Calculate traffic light status for completed
  const getCompletedStatus = () => {
    const total = monthlyPerformance.totalCompleted + monthlyPerformance.totalRemaining;
    const percentComplete = total > 0 ? Math.round((monthlyPerformance.totalCompleted / total) * 100) : 0;
    
    if (percentComplete >= 90) return 'green';
    if (percentComplete >= 70) return 'amber';
    return 'red';
  };

  // Calculate traffic light status for remaining
  const getRemainingStatus = () => {
    if (monthlyPerformance.totalRemaining === 0) return 'green';
    if (monthlyPerformance.totalRemaining <= 5) return 'amber';
    return 'red';
  };

  const completedStatus = getCompletedStatus();
  const remainingStatus = getRemainingStatus();
  const total = monthlyPerformance.totalCompleted + monthlyPerformance.totalRemaining;
  const percentComplete = total > 0 ? Math.round((monthlyPerformance.totalCompleted / total) * 100) : 0;
  const percentRemaining = 100 - percentComplete;

  // Calculate weekly progress summary
  const getWeeklyProgressSummary = () => {
    const currentDay = currentDate.getDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const targetDay = mgmtAccountsDay; // Target completion day (configurable per org)
    
    if (currentDay >= targetDay) {
      if (monthlyPerformance.totalRemaining === 0) {
        return `Target achieved - all management accounts completed by the ${targetDay}th!`;
      } else {
        return `${monthlyPerformance.totalRemaining} management accounts overdue - completion was due by ${targetDay}th`;
      }
    } else {
      // Calculate daily rate needed
      const daysRemaining = targetDay - currentDay;
      const dailyRate = daysRemaining > 0 ? Math.ceil(monthlyPerformance.totalRemaining / daysRemaining) : monthlyPerformance.totalRemaining;
      
      if (monthlyPerformance.totalRemaining === 0) {
        return "Excellent progress - ahead of schedule with no remaining management accounts";
      } else if (dailyRate <= 1) {
        return `On track - need ${monthlyPerformance.totalRemaining} more by ${targetDay}th (${daysRemaining} days remaining)`;
      } else {
        return `Need ${dailyRate} per day for next ${daysRemaining} days to complete ${monthlyPerformance.totalRemaining} remaining by ${targetDay}th`;
      }
    }
  };

  const progressSummary = getWeeklyProgressSummary();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-purple-900 mb-1">MANAGEMENT ACCOUNTS MODULE</h1>
            <h2 className="text-xl font-semibold text-purple-800 mb-2">Monthly Performance Dashboard</h2>
            <p className="text-purple-700">{currentMonth} - Target: 0 remaining by 15th</p>
            <p className="text-purple-700">Track monthly management accounts completion progress</p>
            <div className="mt-3 p-2 bg-purple-100 rounded border-l-2 border-purple-500">
              <p className="text-sm font-medium text-purple-800">{progressSummary}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Select
            value={selectedTeam?.toString() || "all"}
            onValueChange={(value) => setSelectedTeam(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {(teams as any[])?.map((team: any) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Performance KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={`${
          completedStatus === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
          completedStatus === 'amber' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' :
          'bg-gradient-to-br from-red-500 to-red-600 text-white'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium opacity-90">Total Completed This Month</h3>
                <p className="text-3xl font-bold">{monthlyPerformance.totalCompleted} <span className="text-lg opacity-75">({percentComplete}% complete)</span></p>
              </div>
              <div className="text-right">
                {completedStatus === 'green' && <CheckCircle className="h-8 w-8 text-green-100" />}
                {completedStatus === 'amber' && <AlertCircle className="h-8 w-8 text-yellow-100" />}
                {completedStatus === 'red' && <XCircle className="h-8 w-8 text-red-100" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${
          remainingStatus === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
          remainingStatus === 'amber' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' :
          'bg-gradient-to-br from-red-500 to-red-600 text-white'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium opacity-90">Amount Still Remaining</h3>
                <p className="text-3xl font-bold">{monthlyPerformance.totalRemaining} <span className="text-lg opacity-75">({percentRemaining}% remaining)</span></p>
              </div>
              <div className="text-right">
                {remainingStatus === 'green' && <CheckCircle className="h-8 w-8 text-green-100" />}
                {remainingStatus === 'amber' && <AlertCircle className="h-8 w-8 text-yellow-100" />}
                {remainingStatus === 'red' && <XCircle className="h-8 w-8 text-red-100" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graph 1: This Month's Performance */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            This Month's Performance ({currentMonth})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Management accounts remaining from 1st to 15th of the month (Target: 0 by 15th)
          </p>
          <div className="h-80">
            {currentMonthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentMonthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 'dataMax+1']} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    name="Target (0)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="remainingChecks" 
                    stroke="#EF4444" 
                    strokeWidth={3} 
                    name="Remaining Management Accounts" 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
                  <p className="text-gray-600">No management accounts data recorded for this month yet.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Graph 2: Last 6 Months Performance */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Last 6 Months Performance
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Management accounts outstanding as at the 15th of each month (Target: 0)
          </p>
          <div className="h-80">
            {sixMonthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sixMonthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 'dataMax+1']} />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="remainingChecks" 
                    fill="#EF4444" 
                    name="Outstanding Management Accounts" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#10B981" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    name="Target (0)" 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Historical Data</h3>
                  <p className="text-gray-600">No management accounts history available yet.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}