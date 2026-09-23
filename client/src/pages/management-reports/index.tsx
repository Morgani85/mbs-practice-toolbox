import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, BarChart2, Calendar, Building2, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import type { ReportClient } from "@shared/schema";

function HealthBadge({ score }: { score?: number | null }) {
  if (score == null) return <Badge variant="outline" className="text-gray-400 border-gray-200">No report</Badge>;
  if (score >= 86) return <Badge className="bg-teal-100 text-teal-700 border-0">{score} — Strong</Badge>;
  if (score >= 66) return <Badge className="bg-green-100 text-green-700 border-0">{score} — Good</Badge>;
  if (score >= 41) return <Badge className="bg-amber-100 text-amber-700 border-0">{score} — Needs attention</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0">{score} — Critical</Badge>;
}

function industryLabel(industry: string) {
  const map: Record<string, string> = {
    professional_services: "Professional Services",
    hospitality_retail: "Hospitality & Retail",
    property: "Property",
    sme_general: "SME General",
    manufacturing: "Manufacturing",
    other: "Other",
  };
  return map[industry] ?? industry;
}

function frequencyLabel(freq: string) {
  return freq === "12_weekly" ? "12-Weekly" : freq.charAt(0).toUpperCase() + freq.slice(1);
}

export default function ManagementReportsIndex() {
  const { data: clients = [], isLoading } = useQuery<ReportClient[]>({
    queryKey: ["/api/report-clients"],
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-teal-600" />
            Management Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered management accounts for your clients</p>
        </div>
        <Link href="/management-reports/clients/new">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        </Link>
      </div>

      {/* Client grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20">
          <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No clients yet</h3>
          <p className="text-gray-500 text-sm mb-6">Add your first report client to get started</p>
          <Link href="/management-reports/clients/new">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Link key={client.id} href={`/management-reports/clients/${client.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200 hover:border-teal-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{client.clientName}</h3>
                        <p className="text-xs text-gray-500">{client.companyName}</p>
                      </div>
                    </div>
                    <HealthBadge score={null} />
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-gray-400" />
                      <span>{industryLabel(client.industry)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      <span>{frequencyLabel(client.reportFrequency)} reports</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
