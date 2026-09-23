import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { useOrgSettings } from "@/hooks/use-org-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Target, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { getCurrentWeekEnding, getPreviousCompletedWeekEnding } from "@/lib/utils";

interface VatDashboardData {
  performanceData: Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    rollingFourWeekTarget: number | null;
    rollingFourWeekActual: number | null;
    weeklyActual: number | null;
    vatDue: number | null;
  }>;
  teams: Array<{
    teamId: number;
    teamName: string;
    totalCompleted: number;
    currentWeekTarget: number;
    currentWeekActual: number;
    currentVatDue: number;
    achievementRate: number;
  }>;
  summary: {
    teamId: number;
    teamName: string;
    totalCompleted: number;
    currentWeekTarget: number;
    currentWeekActual: number;
    currentVatDue: number;
    achievementRate: number;
  };
  vatReturnsRemaining: Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    vatDue: number;
  }>;
  monthEndPositions: Array<{
    teamId: number;
    teamName: string;
    monthEnd: string;
    vatDue: number;
  }>;
  turnoverChecksData: Array<{
    teamId: number;
    teamName: string;
    weekEnding: string;
    percentageComplete: number;
  }>;
}

// Helper function for ordinal suffixes
const getOrdinalSuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Helper function to get available quarter endings (same logic as VAT Due page)
const getQuarterEndingOptions = (): Array<{label: string, value: string}> => {
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const options: Array<{label: string, value: string}> = [];
  const now = new Date();
  // Start from the previous completed month and go back 24 months
  let year = now.getFullYear();
  let month = now.getMonth() - 1; // 0-based, previous month
  if (month < 0) { month = 11; year -= 1; }
  for (let i = 0; i < 24; i++) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    options.push({ label: `${monthNames[month]} ${year}`, value: dateValue });
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return options;
};

export default function VatDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const { vatCompletionDay } = useOrgSettings();
  const targetWeekEnding = getPreviousCompletedWeekEnding();

  const { data: dashboardData, isLoading, error } = useQuery<VatDashboardData>({
    queryKey: ['/api/vat/dashboard', selectedTeam, selectedQuarter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('teamId', selectedTeam.toString());
      if (selectedQuarter) params.append('quarterEnding', selectedQuarter);
      
      const response = await fetch(`/api/vat/dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
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
      <div className="text-center py-12">
        <div className="text-red-600 text-lg font-medium">Failed to load VAT dashboard data</div>
        <p className="text-gray-600 mt-2">Please try refreshing the page</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 text-lg">No VAT data available</div>
        <p className="text-gray-500 mt-2">Start by creating teams and setting weekly VAT targets</p>
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

  // Calculate VAT progress tracking based on monthly milestones
  const calculateVatProgress = () => {
    const now = new Date();
    const currentDay = now.getDate();
    
    // Find the start-of-month VAT due count from vatReturnsRemaining data
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    
    // Get VAT returns remaining data for current month, sorted by date
    const currentMonthData = dashboardData?.vatReturnsRemaining?.filter(item => {
      const itemDate = new Date(item.weekEnding);
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime()) || [];
    
    // Use the earliest entry as the start-of-month total
    const startOfMonthVatDue = currentMonthData.length > 0 ? currentMonthData[0].vatDue : summary.currentVatDue;
    const currentVatDue = summary.currentVatDue;
    const totalVatDue = startOfMonthVatDue;
    
    // Milestone dates: 7th (10%), 15th (50%), vatCompletionDay (100%)
    const finalDay = vatCompletionDay;
    let expectedProgress = 0;
    let nextMilestone = '';
    let nextMilestoneProgress = 0;
    
    if (currentDay >= finalDay) {
      expectedProgress = 100;
      nextMilestone = 'All milestones passed';
      nextMilestoneProgress = 100;
    } else if (currentDay >= 15) {
      expectedProgress = 50;
      nextMilestone = `${finalDay}${getOrdinalSuffix(finalDay)} (100% target)`;
      nextMilestoneProgress = 100;
    } else if (currentDay >= 7) {
      expectedProgress = 10;
      nextMilestone = '15th (50% target)';
      nextMilestoneProgress = 50;
    } else {
      expectedProgress = 0;
      nextMilestone = '7th (10% target)';
      nextMilestoneProgress = 10;
    }
    
    // Calculate how many should be completed by now and for next milestone
    const expectedCompleted = Math.ceil((expectedProgress / 100) * totalVatDue);
    const nextMilestoneCompleted = Math.ceil((nextMilestoneProgress / 100) * totalVatDue);
    const actualCompleted = Math.max(0, totalVatDue - currentVatDue);
    const remaining = currentVatDue;
    const percentComplete = totalVatDue > 0 ? Math.round((actualCompleted / totalVatDue) * 100) : 0;
    
    // Determine status
    let status = 'green';
    let headline = '';
    
    if (currentDay >= finalDay) {
      // After final deadline
      if (remaining === 0) {
        status = 'green';
        headline = 'All VAT returns completed - excellent work!';
      } else {
        status = 'red';
        headline = `${remaining} VAT returns overdue - urgent action required`;
      }
    } else if (actualCompleted >= expectedCompleted) {
      status = 'green';
      headline = `On track - ${actualCompleted} of ${totalVatDue} completed, ${remaining} remaining`;
    } else {
      // Compare against next milestone instead of current
      const neededForNext = nextMilestoneCompleted - actualCompleted;
      if (neededForNext <= 2) {
        status = 'amber';
        headline = `Slightly behind - ${actualCompleted} of ${totalVatDue} completed, need ${neededForNext} more to reach ${nextMilestone}`;
      } else {
        status = 'red';
        headline = `Off track - ${actualCompleted} of ${totalVatDue} completed, need ${neededForNext} more to reach ${nextMilestone}`;
      }
    }
    
    return {
      status,
      headline,
      remaining,
      percentComplete,
      expectedCompleted,
      actualCompleted,
      nextMilestone,
      currentDay
    };
  };

  const vatProgress = calculateVatProgress();

  // Format chart data for selected team or all teams - show last 8 weeks
  const chartData = (() => {
    if (selectedTeam) {
      // Show data for selected team only - most recent first (left side)
      return performanceData
        .filter(week => week.teamId === selectedTeam)
        .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
        .slice(0, 8)
        .map(week => ({
          week: format(new Date(week.weekEnding), "MMM dd"),
          target: week.rollingFourWeekTarget || 0,
          actual: week.rollingFourWeekActual || 0,
          weeklyActual: week.weeklyActual || 0,
          vatDue: week.vatDue || 0,
          team: week.teamName,
        }));
    } else {
      // Aggregate data for all teams by week
      const weeklyAggregates = new Map<string, {
        weekEnding: string;
        target: number;
        actual: number;
        weeklyActual: number;
        vatDue: number;
      }>();

      performanceData.forEach(week => {
        const weekKey = week.weekEnding;
        const existing = weeklyAggregates.get(weekKey) || {
          weekEnding: week.weekEnding,
          target: 0,
          actual: 0,
          weeklyActual: 0,
          vatDue: 0,
        };

        existing.target += week.rollingFourWeekTarget || 0;
        existing.actual += week.rollingFourWeekActual || 0;
        existing.weeklyActual += week.weeklyActual || 0;
        existing.vatDue += week.vatDue || 0;

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
          vatDue: week.vatDue,
          team: "All Teams",
        }));
    }
  })();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-green-900 mb-1">VAT MODULE</h1>
            <h2 className="text-xl font-semibold text-green-800 mb-2">VAT Performance Tracker</h2>
            {selectedQuarter ? (
              <p className="text-green-700">Showing data for quarter ending {format(new Date(selectedQuarter), "MMMM dd, yyyy")}</p>
            ) : (
              <div>
                <p className="text-green-700">Overview: VAT returns still outstanding for previous month's quarter end</p>
                <p className="text-green-600 text-sm">Showing most recent data available for each team</p>
              </div>
            )}
            <p className="text-green-700">Track VAT return preparation, submissions, and returns due</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Select
            value={selectedQuarter || "all"}
            onValueChange={(value) => setSelectedQuarter(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select quarter ending" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              {getQuarterEndingOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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

      {/* VAT Progress Traffic Light Card */}
      <div className="grid grid-cols-1 gap-6">
        <Card className={`border-l-4 ${getTrafficLightStyle(vatProgress.status)}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-full bg-white bg-opacity-20">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-medium opacity-90">VAT Returns Remaining to Prepare & Send</h3>
                  <p className="text-3xl font-bold">{vatProgress.remaining} <span className="text-lg opacity-75">({vatProgress.percentComplete}% complete)</span></p>
                </div>
              </div>
              <div className="text-right">
                {vatProgress.status === 'green' && <CheckCircle className="h-8 w-8 text-green-600" />}
                {vatProgress.status === 'amber' && <AlertCircle className="h-8 w-8 text-yellow-600" />}
                {vatProgress.status === 'red' && <AlertCircle className="h-8 w-8 text-red-600" />}
              </div>
            </div>
            <div className="mt-4 p-3 bg-white bg-opacity-30 rounded-lg">
              <p className="text-sm font-medium">Progress Update:</p>
              <p className="text-sm mt-1">{vatProgress.headline}</p>
              <div className="mt-2 text-xs opacity-80">
                <p>Milestones: 10% by 7th • 50% by 15th • 100% by {vatCompletionDay}{getOrdinalSuffix(vatCompletionDay)}</p>
                <p>Today is the {vatProgress.currentDay}{getOrdinalSuffix(vatProgress.currentDay)} - Next: {vatProgress.nextMilestone}</p>
              </div>
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
              {teamSummaries
                .sort((a, b) => a.teamName.localeCompare(b.teamName)) // Sort by team name
                .map((team) => {
                  // Calculate percentage remaining to do
                  const totalDueAtStartOfMonth = team.totalCompleted + team.currentVatDue;
                  const percentageRemaining = totalDueAtStartOfMonth > 0 
                    ? Math.round((team.currentVatDue / totalDueAtStartOfMonth) * 100)
                    : 0;
                  
                  return (
                    <div key={team.teamId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-900">{team.teamName}</h4>
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          percentageRemaining <= 20 ? "bg-green-100 text-green-800" : 
                          percentageRemaining <= 50 ? "bg-yellow-100 text-yellow-800" : 
                          "bg-red-100 text-red-800"
                        }`}>
                          {percentageRemaining}% remaining
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Target:</span>
                          <span className="font-medium">0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Remaining to Prepare & Send:</span>
                          <span className="font-medium">{team.currentVatDue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">% Remaining to Prepare & Send:</span>
                          <span className={`font-medium ${
                            percentageRemaining <= 20 ? "text-green-600" : 
                            percentageRemaining <= 50 ? "text-orange-600" : "text-red-600"
                          }`}>
                            {percentageRemaining}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT Returns Remaining This Month Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">VAT Returns Remaining This Month</h3>
          <p className="text-gray-600 text-sm mb-4">Week-by-week VAT returns outstanding (max 5 weeks)</p>
          {dashboardData?.vatReturnsRemaining && dashboardData.vatReturnsRemaining.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dashboardData.vatReturnsRemaining.map(item => ({
                  week: format(new Date(item.weekEnding), "MMM dd"),
                  vatDue: item.vatDue,
                  team: item.teamName
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="vatDue" 
                    fill="#dc2626"
                    name="VAT Returns Due"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-center">
                <p className="text-amber-800 font-medium text-lg">No data for this month</p>
                <p className="text-amber-600 text-sm mt-1">VAT due entries need to be added for the current month</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month-End Positions Chart */}
      {dashboardData?.monthEndPositions && dashboardData.monthEndPositions.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Month-End VAT Positions</h3>
            <p className="text-gray-600 text-sm mb-4">VAT positions for the last 6 months</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dashboardData.monthEndPositions.map(item => ({
                  monthEnd: format(new Date(item.monthEnd), "MMM yyyy"),
                  vatDue: item.vatDue,
                  team: item.teamName
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="monthEnd" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="vatDue" 
                    fill="#2563eb"
                    name="VAT Due at Month End"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT Turnover Checks Progress Chart */}
      {dashboardData?.turnoverChecksData && dashboardData.turnoverChecksData.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">VAT Turnover Checks Progress</h3>
            <p className="text-gray-600 text-sm mb-4">Last 6 weeks completion percentage for turnover checks</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dashboardData.turnoverChecksData.map(item => ({
                  week: format(new Date(item.weekEnding), "MMM dd"),
                  percentageComplete: item.percentageComplete,
                  team: item.teamName
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Completion']} />
                  <Legend />
                  <Bar 
                    dataKey="percentageComplete" 
                    fill="#10b981"
                    name="Completion %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
}