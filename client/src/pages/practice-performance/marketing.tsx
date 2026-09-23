import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, TrendingUp, Users, DollarSign, Target, Eye } from "lucide-react";
import { Link } from "wouter";

export default function Marketing() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Marketing</h1>
          <p className="text-gray-600">Marketing campaign performance and lead generation analytics</p>
        </div>
      </div>

      {/* Marketing Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marketing Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£4,250</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +5.2% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +12.5% from last month
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
            <div className="text-2xl font-bold">8.5%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +1.2% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost per Lead</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£90</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                -6.8% from last month
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Lead Generation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Lead generation trend chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketing ROI by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Marketing ROI comparison chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Channel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Google Ads</span>
                <span className="text-sm font-bold">18 leads</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">LinkedIn</span>
                <span className="text-sm font-bold">12 leads</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Referrals</span>
                <span className="text-sm font-bold">8 leads</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Website/SEO</span>
                <span className="text-sm font-bold">6 leads</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email Marketing</span>
                <span className="text-sm font-bold">3 leads</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Google Ads</span>
                <span className="text-sm font-bold">£1,800</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">LinkedIn Ads</span>
                <span className="text-sm font-bold">£1,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Content Marketing</span>
                <span className="text-sm font-bold">£650</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">SEO Tools</span>
                <span className="text-sm font-bold">£400</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email Platform</span>
                <span className="text-sm font-bold">£200</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketing Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Customer Acquisition Cost</span>
                <span className="text-sm font-bold">£1,062</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Marketing ROI</span>
                <span className="text-sm font-bold">420%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Lead to Customer Rate</span>
                <span className="text-sm font-bold">8.5%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Deal Size</span>
                <span className="text-sm font-bold">£4,450</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Customer Lifetime Value</span>
                <span className="text-sm font-bold">£18,750</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Payback Period</span>
                <span className="text-sm font-bold">2.9 months</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}