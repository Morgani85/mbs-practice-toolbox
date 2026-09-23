import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, TrendingUp, TrendingDown, Clock, Users, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function KPIDashboard() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/practice-performance">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Practice Performance
            </Button>
          </Link>
        </div>
        
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">KPI Dashboard</h1>
          <p className="text-gray-600">Key performance indicators and business metrics monitoring</p>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.4%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">Above target of 10%</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Retention</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.3%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+1.2% from last quarter</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20.0%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">-0.5% from last quarter</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.5%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+3.2% from last month</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial KPIs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Financial Performance KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Revenue Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Monthly Recurring Revenue</span>
                  <span className="text-sm font-bold">£634,200</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Average Revenue per Client</span>
                  <span className="text-sm font-bold">£3,485</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Revenue per Employee</span>
                  <span className="text-sm font-bold">£141,250</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Profitability</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Gross Profit Margin</span>
                  <span className="text-sm font-bold">50.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Net Profit Margin</span>
                  <span className="text-sm font-bold">20.0%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">EBITDA Margin</span>
                  <span className="text-sm font-bold">25.3%</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Cash Flow</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Operating Cash Flow</span>
                  <span className="text-sm font-bold">£195,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Days Sales Outstanding</span>
                  <span className="text-sm font-bold">28 days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Cash Conversion Cycle</span>
                  <span className="text-sm font-bold">35 days</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational KPIs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Operational Performance KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Client Metrics</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Client Acquisition Rate</span>
                  <span className="text-sm font-bold">8 per month</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Client Churn Rate</span>
                  <span className="text-sm font-bold">5.7%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Net Promoter Score</span>
                  <span className="text-sm font-bold">72</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Productivity</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Billable Hours Ratio</span>
                  <span className="text-sm font-bold">78.5%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Average Hours per Client</span>
                  <span className="text-sm font-bold">12.3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Task Completion Rate</span>
                  <span className="text-sm font-bold">92.1%</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Quality</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Client Satisfaction</span>
                  <span className="text-sm font-bold">4.6/5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">First-Time Quality Rate</span>
                  <span className="text-sm font-bold">88.2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Rework Rate</span>
                  <span className="text-sm font-bold">3.8%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>KPI Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">KPI trends chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Scorecard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Performance Score</span>
                <span className="text-lg font-bold text-green-600">85/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs">Financial Performance</span>
                  <span className="text-xs font-bold">92/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs">Operational Efficiency</span>
                  <span className="text-xs font-bold">78/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs">Client Satisfaction</span>
                  <span className="text-xs font-bold">89/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs">Growth Metrics</span>
                  <span className="text-xs font-bold">81/100</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}