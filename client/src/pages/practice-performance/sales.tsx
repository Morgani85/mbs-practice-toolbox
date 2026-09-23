import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, TrendingUp, DollarSign, Target, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function Sales() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Sales</h1>
          <p className="text-gray-600">Sales pipeline management and conversion tracking</p>
        </div>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£187,500</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +15.3% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.5%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +3.2% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">34</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600">In pipeline</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£5,515</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +8.7% from last month
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Sales pipeline funnel chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Monthly sales trend chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Pipeline Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Initial Contact</span>
                <span className="text-sm font-bold">12 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Needs Assessment</span>
                <span className="text-sm font-bold">8 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Proposal Sent</span>
                <span className="text-sm font-bold">6 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Negotiation</span>
                <span className="text-sm font-bold">4 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Closing</span>
                <span className="text-sm font-bold">4 prospects</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">ABC Manufacturing Ltd</span>
                <span className="text-sm font-bold text-green-600">£7,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Smith & Partners</span>
                <span className="text-sm font-bold text-green-600">£4,800</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Digital Solutions Co</span>
                <span className="text-sm font-bold text-green-600">£6,500</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Green Energy Ltd</span>
                <span className="text-sm font-bold text-green-600">£3,900</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total This Month</span>
                  <span className="text-sm font-bold text-green-600">£22,400</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Sales Cycle</span>
                <span className="text-sm font-bold">42 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Win Rate</span>
                <span className="text-sm font-bold">24.5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Follow-up Rate</span>
                <span className="text-sm font-bold">87.3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Proposal Success Rate</span>
                <span className="text-sm font-bold">68.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Avg Response Time</span>
                <span className="text-sm font-bold">2.3 hours</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Monthly Target</span>
                <span className="text-sm font-bold">£45,000</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}