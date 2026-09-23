import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, TrendingUp, TrendingDown, AlertCircle, Calendar } from "lucide-react";
import { Link } from "wouter";

export default function CashCashflow() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Cash & Cashflow</h1>
          <p className="text-gray-600">Cash flow monitoring, forecasting, and working capital management</p>
        </div>
      </div>

      {/* Cash Flow Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cash Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£156,750</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +8.2% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cash Flow</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£42,500</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                Positive cash flow
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Receivables</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£87,300</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +12.5% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Run Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.2 months</div>
            <p className="text-xs text-muted-foreground">
              At current burn rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>12-Month Cash Flow Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Cash flow trend chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">3-month cash flow forecast will be implemented here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Working Capital Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cash Inflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Client Payments</span>
                <span className="text-sm font-bold text-green-600">£68,400</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Recurring Fees</span>
                <span className="text-sm font-bold text-green-600">£45,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">One-time Services</span>
                <span className="text-sm font-bold text-green-600">£23,100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Interest Income</span>
                <span className="text-sm font-bold text-green-600">£850</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Inflows</span>
                  <span className="text-sm font-bold text-green-600">£137,550</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash Outflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Salaries & Benefits</span>
                <span className="text-sm font-bold text-red-600">£67,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Office Expenses</span>
                <span className="text-sm font-bold text-red-600">£8,400</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Software & Technology</span>
                <span className="text-sm font-bold text-red-600">£4,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Marketing & Business Dev</span>
                <span className="text-sm font-bold text-red-600">£3,800</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Professional Services</span>
                <span className="text-sm font-bold text-red-600">£2,100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Other Expenses</span>
                <span className="text-sm font-bold text-red-600">£8,350</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Outflows</span>
                  <span className="text-sm font-bold text-red-600">£94,050</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working Capital Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Days Sales Outstanding</span>
                <span className="text-sm font-bold">28 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Collection Period</span>
                <span className="text-sm font-bold">32 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cash Conversion Cycle</span>
                <span className="text-sm font-bold">35 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current Ratio</span>
                <span className="text-sm font-bold">2.4</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Quick Ratio</span>
                <span className="text-sm font-bold">1.8</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cash Ratio</span>
                <span className="text-sm font-bold">0.6</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}