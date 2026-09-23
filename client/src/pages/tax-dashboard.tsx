import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subWeeks } from "date-fns";
import { Receipt, TrendingUp, TrendingDown, Calendar, Clock, AlertTriangle, FileText, Target } from "lucide-react";
import type { Team, TaxData } from "@shared/schema";

// Helper function to get current week ending date
function getCurrentWeekEnding(): string {
  const today = new Date();
  const currentDay = today.getDay();
  const daysToSaturday = currentDay === 0 ? -1 : 6 - currentDay; // 0 = Sunday
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysToSaturday);
  return saturday.toISOString().split('T')[0];
}

// Helper function to get traffic light color based on performance
function getPerformanceStatus(percentage: number) {
  if (percentage >= 90) return { color: "green", label: "Excellent", bgColor: "bg-green-100", textColor: "text-green-800" };
  if (percentage >= 70) return { color: "yellow", label: "Good", bgColor: "bg-yellow-100", textColor: "text-yellow-800" };
  if (percentage >= 50) return { color: "orange", label: "Needs Attention", bgColor: "bg-orange-100", textColor: "text-orange-800" };
  return { color: "red", label: "Critical", bgColor: "bg-red-100", textColor: "text-red-800" };
}

export default function TaxDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  // Get current month for target calculation
  const getCurrentMonth = () => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    if (month >= 3) return month - 3; // April=0, May=1, ..., March=11
    return month + 9; // Jan=10, Feb=11, Mar=12 (but we use 0-8 for Apr-Dec, 9-11 for Jan-Mar)
  };

  // Load monthly targets from localStorage or use defaults
  const loadTargets = () => {
    try {
      const saved = localStorage.getItem('tax-monthly-targets');
      return saved ? JSON.parse(saved) : [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    } catch {
      return [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    }
  };
  
  const monthlyTargets = loadTargets(); // Apr-Jan percentages
  
  // Fetch actual tax data
  const { data: taxData = [] } = useQuery<TaxData[]>({
    queryKey: ['/api/tax-data', selectedTeam],
    queryFn: async () => {
      const url = selectedTeam ? `/api/tax-data?teamId=${selectedTeam}` : '/api/tax-data';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tax data');
      return response.json();
    },
  });

  // Fetch tax progress data with auto-calculated cumulative totals
  const { data: taxProgress } = useQuery({
    queryKey: ['/api/tax-progress', selectedTeam],
    queryFn: async () => {
      const url = selectedTeam ? `/api/tax-progress?teamId=${selectedTeam}` : '/api/tax-progress';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tax progress data');
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Calculate dashboard metrics from tax progress data (with auto-calculated cumulative totals)
  const calculateDashboardMetrics = () => {
    if (!taxProgress?.progressData || taxProgress.progressData.length === 0) {
      return {
        personalTaxCompleted: 0,
        personalTaxTotalToComplete: 0,
        currentMonthTargetPercentage: monthlyTargets[getCurrentMonth()],
        actualCompletedPercentage: 0,
        calculatedTarget: 0
      };
    }

    // Get the most recent entry for each team to sum their totals
    const latestEntryByTeam = new Map<number, any>();
    
    taxProgress.progressData.forEach((entry: any) => {
      const existing = latestEntryByTeam.get(entry.teamId);
      if (!existing || new Date(entry.weekEnding) > new Date(existing.weekEnding)) {
        latestEntryByTeam.set(entry.teamId, entry);
      }
    });

    // Sum the total to complete from each team's most recent entry
    const totalToComplete = Array.from(latestEntryByTeam.values())
      .reduce((sum: number, entry: any) => sum + (entry.totalTarget || 0), 0);
    const currentMonthTargetPercentage = monthlyTargets[getCurrentMonth()];
    const calculatedTarget = Math.round((totalToComplete * currentMonthTargetPercentage) / 100);
    
    // Sum the most recent cumulative totals from each team (auto-calculated)
    const totalCompleted = Array.from(latestEntryByTeam.values())
      .reduce((sum: number, entry: any) => sum + (entry.cumulativeCompleted || 0), 0);
    
    const actualCompletedPercentage = totalToComplete > 0 ? Math.round((totalCompleted / totalToComplete) * 100) : 0;

    return {
      personalTaxCompleted: totalCompleted,
      personalTaxTotalToComplete: totalToComplete,
      currentMonthTargetPercentage,
      actualCompletedPercentage,
      calculatedTarget
    };
  };

  const currentWeekData = calculateDashboardMetrics();

  // Generate trend data from actual tax data entries (last 8 weeks, most recent first)
  const generateWeeklyTrend = () => {
    if (!taxData || taxData.length === 0) return [];

    // Get unique week endings from the data and sort by date (most recent first)
    const weekEndingsMap = new Map<string, boolean>();
    taxData.forEach(entry => weekEndingsMap.set(entry.weekEnding, true));
    const uniqueWeeks = Array.from(weekEndingsMap.keys())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 8); // Take last 8 weeks

    return uniqueWeeks.map(weekEnding => {
      // Sum all completed this week only across all teams (if viewing all teams)
      // or just the selected team data
      const weekEntries = taxData.filter(entry => entry.weekEnding === weekEnding);
      const weeklyCompleted = weekEntries.reduce((sum, entry) => sum + (entry.personalTaxCompletedThisWeek || 0), 0);
      
      return {
        week: format(new Date(weekEnding), 'MMM dd'),
        personalTax: weeklyCompleted,
        weekEnding
      };
    });
  };

  const weeklyTrend = generateWeeklyTrend();

  // Load monthly targets from localStorage (same as tax targets page)
  const loadMonthlyTargets = () => {
    try {
      const saved = localStorage.getItem('tax-monthly-targets');
      return saved ? JSON.parse(saved) : [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    } catch {
      return [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    }
  };

  // Generate cumulative percentage data for last 3 months using tax progress data
  const generateCumulativeProgress = () => {
    if (!taxProgress?.progressData || taxProgress.progressData.length === 0) return [];

    const savedTargets = loadMonthlyTargets();
    // Tax year months mapping (April = index 0, May = index 1, etc.)
    const taxYearMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January'];

    // Get unique week endings sorted chronologically from progress data
    const weekEndingsMap = new Map<string, boolean>();
    taxProgress.progressData.forEach((entry: any) => weekEndingsMap.set(entry.weekEnding, true));
    const allWeeks = Array.from(weekEndingsMap.keys())
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Filter to last 3 months (approximately 12-13 weeks)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentWeeks = allWeeks.filter(week => new Date(week) >= threeMonthsAgo);

    const result = recentWeeks.map(weekEnding => {
      // Get progress data for this week across all teams
      const weekEntries = taxProgress.progressData.filter((entry: any) => entry.weekEnding === weekEnding);
      
      // Sum cumulative totals and annual targets across teams
      const totalCumulative = weekEntries.reduce((sum: number, entry: any) => sum + (entry.cumulativeCompleted || 0), 0);
      const totalAnnualTarget = weekEntries.reduce((sum: number, entry: any) => sum + (entry.totalTarget || 0), 0);
      
      // Calculate percentage
      const actualPercentage = totalAnnualTarget > 0 ? Math.round((totalCumulative / totalAnnualTarget) * 100) : 0;
      
      // Get target percentage for this month from saved targets
      const weekDate = new Date(weekEnding);
      const monthName = format(weekDate, 'MMMM');
      const taxYearIndex = taxYearMonths.indexOf(monthName);
      const targetPercentage = taxYearIndex >= 0 ? (savedTargets[taxYearIndex] || 0) : 0;

      return {
        week: format(weekDate, 'MMM dd'),
        actual: actualPercentage,
        target: targetPercentage,
        weekEnding
      };
    });

    // Reverse to show most recent on the left
    return result.reverse();
  };

  const cumulativeProgress = generateCumulativeProgress();

  const calculateCompletionRate = (completed: number, target: number) => {
    return target > 0 ? Math.round((completed / target) * 100) : 0;
  };

  const taxYearInfo = taxProgress?.taxYearInfo;
  const taxYearLabel = taxYearInfo?.label ?? taxYearInfo?.taxYearDisplay ?? "";

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
            <div className="flex items-center mb-3">
              <img 
                src="/attached_assets/Screenshot 2025-07-02 at 16.25.36_1751469958155.png" 
                alt="Practice Toolbox" 
                className="h-10 mr-3"
              />
              <h1 className="text-3xl font-bold text-blue-900 mb-1">TAX MODULE</h1>
            </div>
            <h2 className="text-xl font-semibold text-blue-800 mb-2">
              Tax Preparation Dashboard
              {taxYearLabel && (
                <span className="ml-3 text-base font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                  Filing {taxYearLabel} returns
                </span>
              )}
            </h2>
            <p className="text-blue-700">Tracking progress on {taxYearLabel ? `${taxYearLabel} self-assessment returns` : "tax returns"} — deadline 31 January</p>
          </div>

          {/* Grace period banner */}
          {taxYearInfo?.isGracePeriod && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded-r-md flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">31 January deadline has passed</p>
                <p className="text-sm text-amber-700">
                  The filing deadline for {taxYearLabel} returns has passed. The totals below are your final figures for this filing season.
                  Data entry reopens from 6 April when filing of the next year's returns begins.
                </p>
              </div>
            </div>
          )}

          {/* No data yet this filing season */}
          {taxYearInfo?.isActive && !taxYearInfo.isGracePeriod && taxYearLabel &&
           (!taxProgress?.progressData || taxProgress.progressData.length === 0) && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 rounded-r-md flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">New filing season — {taxYearLabel} returns</p>
                <p className="text-sm text-green-700">
                  The counter has reset. Start entering weekly completions to track your {taxYearLabel} self-assessment progress.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Week ending: {format(new Date(getCurrentWeekEnding()), "MMM dd, yyyy")}
            </span>
          </div>
          
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



      {/* Summary Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tax Year Progress Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Tax Year Progress Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{currentWeekData.personalTaxCompleted}</div>
                <div className="text-sm text-gray-600">Total Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{currentWeekData.personalTaxTotalToComplete}</div>
                <div className="text-sm text-gray-600">Total to Complete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{currentWeekData.actualCompletedPercentage}%</div>
                <div className="text-sm text-gray-600">Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Target Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              Monthly Target Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{currentWeekData.currentMonthTargetPercentage}%</div>
                <div className="text-sm text-gray-600">Target This Month</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{currentWeekData.actualCompletedPercentage}%</div>
                <div className="text-sm text-gray-600">Current Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{Math.max(0, currentWeekData.calculatedTarget - currentWeekData.personalTaxCompleted)}</div>
                <div className="text-sm text-gray-600">Needed to Reach Target</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              8-Week Personal Tax Weekly Completion (Most Recent Left)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="personalTax" stroke="#16a34a" strokeWidth={2} name="Personal Tax Completed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative Progress vs Target */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              3-Month Cumulative % Complete vs Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cumulativeProgress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                <Line type="monotone" dataKey="actual" stroke="#16a34a" strokeWidth={2} name="Actual %" />
                <Line type="monotone" dataKey="target" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" name="Target %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>




    </div>
  );
}