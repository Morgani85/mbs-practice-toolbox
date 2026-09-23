import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamStats {
  teamName: string;
  accountsDue: number;
  accountsDuePrev: number;
  accountsDueInProgress: number;
  accountsDueInProgressPrev: number;
  taxPercent: number;
  taxPercentPrev: number;
  taxStillToDo: number;
  taxStillToDoPrev: number;
  vatStillToFile: number;
  vatStillToFilePrev: number;
  mbsBelow85: number;
  mbsBelow85Prev: number;
  mbsBelow70: number;
  mbsBelow70Prev: number;
  clientBelow85: number;
  clientBelow85Prev: number;
  csTurnaround: number;
  csTurnaroundPrev: number;
  healthChecksDue: number;
  healthChecksDuePrev: number;
}

interface OverallStats {
  accountsDue: number;
  accountsDuePrev: number;
  accountsDueInProgress: number;
  accountsDueInProgressPrev: number;
  taxPercent: number;
  taxPercentPrev: number;
  taxStillToDo: number;
  taxStillToDoPrev: number;
  vatStillToFile: number;
  vatStillToFilePrev: number;
  mbsBelow85: number;
  mbsBelow85Prev: number;
  mbsBelow70: number;
  mbsBelow70Prev: number;
  clientBelow85: number;
  clientBelow85Prev: number;
  csTurnaround: number;
  csTurnaroundPrev: number;
  healthChecksDue: number;
  healthChecksDuePrev: number;
}

interface PeriodData {
  overall: OverallStats;
  byTeam: Record<number, TeamStats>;
}

interface OverviewStats {
  thisWeek: string;
  lastWeek: string;
  oneMonthAgo: string;
  threeMonthsAgo: string;
  teams: { id: number; name: string }[];
  shortTerm: PeriodData;
  mediumTerm: PeriodData;
  longTerm: PeriodData;
  // Backwards compatibility
  overall: OverallStats;
  byTeam: Record<number, TeamStats>;
}

type MetricConfig = {
  key: string;
  label: string;
  field: string;
  prevField: string;
  higherIsBad: boolean;
  suffix?: string;
};

const metrics: MetricConfig[] = [
  { key: 'accountsDue', label: 'Accounts due in 3 months', field: 'accountsDue', prevField: 'accountsDuePrev', higherIsBad: true },
  { key: 'accountsDueInProgress', label: 'Accounts due (not started/WIP)', field: 'accountsDueInProgress', prevField: 'accountsDueInProgressPrev', higherIsBad: true },
  { key: 'taxPercent', label: 'Tax % complete', field: 'taxPercent', prevField: 'taxPercentPrev', higherIsBad: false, suffix: '%' },
  { key: 'taxStillToDo', label: 'Tax still to do', field: 'taxStillToDo', prevField: 'taxStillToDoPrev', higherIsBad: true },
  { key: 'vatStillToFile', label: 'VAT still to file', field: 'vatStillToFile', prevField: 'vatStillToFilePrev', higherIsBad: true },
  { key: 'mbsBelow85', label: 'Internal bookkeeping below 85%', field: 'mbsBelow85', prevField: 'mbsBelow85Prev', higherIsBad: true },
  { key: 'mbsBelow70', label: 'Internal bookkeeping below 70%', field: 'mbsBelow70', prevField: 'mbsBelow70Prev', higherIsBad: true },
  { key: 'clientBelow85', label: 'Client bookkeeping below 85%', field: 'clientBelow85', prevField: 'clientBelow85Prev', higherIsBad: true },
  { key: 'csTurnaround', label: 'Confirmation statement turnaround (days)', field: 'csTurnaround', prevField: 'csTurnaroundPrev', higherIsBad: true },
  { key: 'healthChecksDue', label: 'Management accounts remaining', field: 'healthChecksDue', prevField: 'healthChecksDuePrev', higherIsBad: true },
];

function formatChange(current: number, previous: number, higherIsBad: boolean): { text: string; color: string; icon: 'up' | 'down' | 'same' } {
  const diff = current - previous;
  if (diff === 0) {
    return { text: 'No change', color: 'text-gray-500', icon: 'same' };
  }
  
  const absChange = Math.abs(diff);
  const isBad = (diff > 0 && higherIsBad) || (diff < 0 && !higherIsBad);
  const color = isBad ? 'text-red-600' : 'text-green-600';
  
  const arrow = diff > 0 ? '↑' : '↓';
  return { text: `${arrow} ${absChange}`, color, icon: diff > 0 ? 'up' : 'down' };
}

function MetricCell({ current, previous, higherIsBad, suffix = '' }: { current: number; previous: number; higherIsBad: boolean; suffix?: string }) {
  const change = formatChange(current, previous, higherIsBad);
  
  return (
    <div className="text-center">
      <div className="font-semibold text-lg">{current}{suffix}</div>
      <div className={`text-sm flex items-center justify-center gap-1 ${change.color}`}>
        {change.icon === 'up' && <TrendingUp className="h-3 w-3" />}
        {change.icon === 'down' && <TrendingDown className="h-3 w-3" />}
        {change.icon === 'same' && <Minus className="h-3 w-3" />}
        <span>{change.text}</span>
      </div>
    </div>
  );
}

function MetricsTable({ data, teams }: { data: PeriodData; teams: { id: number; name: string }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[250px]">Metric</TableHead>
          <TableHead className="text-center min-w-[120px]">Overall</TableHead>
          {teams.map((team) => (
            <TableHead key={team.id} className="text-center min-w-[120px]">
              {team.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((metric) => (
          <TableRow key={metric.key}>
            <TableCell className="font-medium">{metric.label}</TableCell>
            <TableCell>
              <MetricCell
                current={(data.overall as any)[metric.field]}
                previous={(data.overall as any)[metric.prevField]}
                higherIsBad={metric.higherIsBad}
                suffix={metric.suffix}
              />
            </TableCell>
            {teams.map((team) => {
              const teamData = data.byTeam[team.id];
              if (!teamData) return <TableCell key={team.id}>-</TableCell>;
              return (
                <TableCell key={team.id}>
                  <MetricCell
                    current={(teamData as any)[metric.field]}
                    previous={(teamData as any)[metric.prevField]}
                    higherIsBad={metric.higherIsBad}
                    suffix={metric.suffix}
                  />
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function OverviewDashboard() {
  const [activeTab, setActiveTab] = useState("short");
  
  const { data: stats, isLoading, error } = useQuery<OverviewStats>({
    queryKey: ['/api/overview-stats'],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Failed to load overview data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getComparisonLabel = () => {
    switch (activeTab) {
      case "short":
        return `Comparing to last week (${stats.lastWeek})`;
      case "medium":
        return `Comparing to 4 weeks ago (${stats.oneMonthAgo})`;
      case "long":
        return `Comparing to 12 weeks ago (${stats.threeMonthsAgo})`;
      default:
        return "";
    }
  };

  const getCurrentData = (): PeriodData => {
    switch (activeTab) {
      case "short":
        return stats.shortTerm || { overall: stats.overall, byTeam: stats.byTeam };
      case "medium":
        return stats.mediumTerm || { overall: stats.overall, byTeam: stats.byTeam };
      case "long":
        return stats.longTerm || { overall: stats.overall, byTeam: stats.byTeam };
      default:
        return stats.shortTerm || { overall: stats.overall, byTeam: stats.byTeam };
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/staff-scorecards">
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="mr-2" size={16} />
            Back to Staff Scorecards
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Performance Overview</h1>
        <p className="text-gray-600">
          Current week: {stats.thisWeek} | {getComparisonLabel()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="short">Short Term (1 Week)</TabsTrigger>
              <TabsTrigger value="medium">Medium Term (4 Weeks)</TabsTrigger>
              <TabsTrigger value="long">Long Term (12 Weeks)</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="overflow-x-auto">
            <MetricsTable data={getCurrentData()} teams={stats.teams} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
