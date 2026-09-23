import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamFilter } from "@/hooks/use-team-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subWeeks } from "date-fns";
import { ClipboardCheck, Clock, Calendar, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import type { Team, ConfirmationStatementTurnaround } from "@shared/schema";

// Helper function to get current week ending date
function getCurrentWeekEnding(): string {
  const today = new Date();
  const currentDay = today.getDay();
  const daysToSaturday = currentDay === 0 ? -1 : 6 - currentDay; // 0 = Sunday
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysToSaturday);
  return saturday.toISOString().split('T')[0];
}

// Helper function to get traffic light color based on turnaround days
function getTurnaroundStatus(days: number) {
  if (days <= 7) return { color: "green", label: "Ideal", bgColor: "bg-green-100", textColor: "text-green-800" };
  if (days <= 10) return { color: "yellow", label: "Good", bgColor: "bg-yellow-100", textColor: "text-yellow-800" };
  if (days <= 14) return { color: "orange", label: "OK", bgColor: "bg-orange-100", textColor: "text-orange-800" };
  return { color: "red", label: "Not Good", bgColor: "bg-red-100", textColor: "text-red-800" };
}

interface TurnaroundData {
  weekEnding: string;
  averageTurnaround: number;
  notes?: string;
}

export default function ConfirmationStatementsDashboard() {
  const { selectedTeam, setSelectedTeam } = useTeamFilter();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  // Get turnaround time data
  const { data: turnaroundData, isLoading, error } = useQuery<ConfirmationStatementTurnaround[]>({
    queryKey: ["/api/confirmation-statement-turnaround", selectedTeam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('teamId', selectedTeam.toString());
      const response = await fetch(`/api/confirmation-statement-turnaround?${params}`);
      return response.json();
    },
  });

  // Process data for the 8-week chart (newest week on left, oldest on right)
  const processChartData = (): TurnaroundData[] => {
    if (!turnaroundData) return [];
    
    // Group data by week ending date and calculate averages
    const weeklyAverages = new Map<string, { totalDays: number; count: number; notes: string[] }>();
    
    turnaroundData.forEach(data => {
      const existing = weeklyAverages.get(data.weekEnding) || { totalDays: 0, count: 0, notes: [] };
      existing.totalDays += data.turnaroundTimeDays;
      existing.count += 1;
      if (data.notes) existing.notes.push(data.notes);
      weeklyAverages.set(data.weekEnding, existing);
    });
    
    // Convert to array and sort by date descending (newest first)
    const aggregatedData = Array.from(weeklyAverages.entries())
      .map(([weekEnding, data]) => ({
        weekEnding,
        averageTurnaround: Math.round((data.totalDays / data.count) * 10) / 10, // Round to 1 decimal place
        notes: data.notes.length > 0 ? data.notes.join('; ') : undefined
      }))
      .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime())
      .slice(0, 8); // Take most recent 8 weeks
    
    return aggregatedData;
  };

  // Get current week data
  const getCurrentWeekData = () => {
    if (!turnaroundData || turnaroundData.length === 0) return null;
    // Get the most recent entry instead of looking for exact current week match
    const sortedData = [...turnaroundData]
      .sort((a, b) => new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime());
    return sortedData[0];
  };

  // Generate trend analysis
  const generateTrendAnalysis = (): string => {
    const chartData = processChartData();
    if (chartData.length < 2) return "Insufficient data for trend analysis";
    
    const recentWeeks = chartData.slice(-3);
    const olderWeeks = chartData.slice(0, -3);
    
    const recentAvg = recentWeeks.reduce((sum, week) => sum + week.averageTurnaround, 0) / recentWeeks.length;
    const olderAvg = olderWeeks.length > 0 ? olderWeeks.reduce((sum, week) => sum + week.averageTurnaround, 0) / olderWeeks.length : recentAvg;
    
    const trend = recentAvg - olderAvg;
    const currentWeekData = getCurrentWeekData();
    
    let analysis = "";
    
    if (trend > 1) {
      analysis = "⚠️ Turnaround times are increasing. ";
    } else if (trend < -1) {
      analysis = "✅ Turnaround times are improving. ";
    } else {
      analysis = "📊 Turnaround times are stable. ";
    }
    
    if (currentWeekData) {
      const status = getTurnaroundStatus(currentWeekData.turnaroundTimeDays);
      analysis += `Current week: ${currentWeekData.turnaroundTimeDays} days (${status.label}).`;
    }
    
    return analysis;
  };

  const chartData = processChartData();
  const currentWeekData = getCurrentWeekData();
  const trendAnalysis = generateTrendAnalysis();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded"></div>
            <div className="h-80 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Connection Error</h2>
          <p className="text-red-700">Unable to load turnaround time data. Please check your database connection.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-purple-900 mb-1">CONFIRMATION STATEMENTS MODULE</h1>
            <h2 className="text-xl font-semibold text-purple-800 mb-2">Turnaround Time Dashboard</h2>
            <p className="text-purple-700">Tracking filing turnaround times</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Current Week: {format(new Date(getCurrentWeekEnding()), "MMM dd, yyyy")}
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

      {/* Current Week Result - Single Box with Traffic Light */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Current Week Turnaround Time</CardTitle>
            <Clock className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            {currentWeekData ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-purple-600">
                    {currentWeekData.turnaroundTimeDays} days
                  </div>
                  <p className="text-sm text-gray-600">
                    Week ending {format(new Date(currentWeekData.weekEnding), "MMM dd, yyyy")}
                  </p>
                  {currentWeekData.notes && (
                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Notes:</span> {currentWeekData.notes}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  {(() => {
                    const status = getTurnaroundStatus(currentWeekData.turnaroundTimeDays);
                    return (
                      <div className={`px-4 py-2 rounded-full ${status.bgColor}`}>
                        <div className={`text-lg font-bold ${status.textColor}`}>
                          {status.label}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="text-xs text-gray-500 mt-2">
                    Targets: ≤7 Ideal, ≤10 Good, ≤14 OK, {'>'}14 Not Good
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500">No data for current week</div>
                <p className="text-sm text-gray-400 mt-1">Add turnaround time data to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 8-Week Turnaround Time Trend */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              8-Week Turnaround Time Trend
            </CardTitle>
            <p className="text-sm text-gray-600">8-week turnaround time performance trend</p>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="weekEnding" 
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                  />
                  <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    labelFormatter={(value) => `Week ending ${format(new Date(value), "MMM dd, yyyy")}`}
                    formatter={(value: number) => [
                      `${value} days`,
                      "Turnaround Time"
                    ]}
                  />
                  {/* Target lines */}
                  <Line type="monotone" dataKey={() => 7} stroke="#22c55e" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Ideal (7 days)" />
                  <Line type="monotone" dataKey={() => 10} stroke="#eab308" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Good (10 days)" />
                  <Line type="monotone" dataKey={() => 14} stroke="#f97316" strokeDasharray="5 5" strokeWidth={1} dot={false} name="OK (14 days)" />
                  
                  {/* Actual data */}
                  <Line 
                    type="monotone" 
                    dataKey="averageTurnaround" 
                    stroke="#7c3aed" 
                    strokeWidth={3}
                    dot={{ fill: "#7c3aed", strokeWidth: 2, r: 4 }}
                    name="Actual Turnaround"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500">No turnaround time data available</div>
                <p className="text-sm text-gray-400 mt-1">Start entering weekly turnaround times to see trends</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Analysis & Action Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Trend Analysis & Action Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Current Status</h4>
              <p className="text-blue-800">{trendAnalysis}</p>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-2">Recommended Actions</h4>
              <ul className="text-amber-800 space-y-1">
                {currentWeekData && getTurnaroundStatus(currentWeekData.turnaroundTimeDays).color === 'red' && (
                  <li>• Immediate review needed - turnaround time exceeds 14 days</li>
                )}
                {chartData.length >= 3 && chartData.slice(-3).every(week => week.averageTurnaround > 10) && (
                  <li>• Consider process improvements - consistent delays over 10 days</li>
                )}
                <li>• Target: Keep turnaround times under 7 days for optimal performance</li>
                <li>• Monitor weekly trends and investigate any sudden increases</li>
              </ul>
            </div>

            {/* Show recent notes */}
            {chartData.filter(week => week.notes).length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Recent Notes</h4>
                <div className="space-y-2">
                  {chartData
                    .filter(week => week.notes)
                    .slice(-3)
                    .map((week, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">
                          {format(new Date(week.weekEnding), "MMM dd")}:
                        </span>
                        <span className="text-gray-700 ml-2">{week.notes}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}