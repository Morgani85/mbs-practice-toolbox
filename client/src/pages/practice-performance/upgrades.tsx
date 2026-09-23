import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, TrendingUp, Users, DollarSign, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

export default function Upgrades() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Upgrades</h1>
          <p className="text-gray-600">Client service upgrades and upselling opportunities tracking</p>
        </div>
      </div>

      {/* Upgrade Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upgrade Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£23,450</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +18.5% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upgrade Rate</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.3%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +2.1% from last month
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Upgraded</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">This month</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upgrade Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-blue-600">Active prospects</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Upgrade performance trend chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade Revenue by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">Upgrade revenue breakdown chart will be implemented here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Service Upgrades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Basic → Premium Bookkeeping</span>
                <span className="text-sm font-bold">£8,750</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Accounts → Accounts + Advisory</span>
                <span className="text-sm font-bold">£6,200</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Monthly → Weekly Reporting</span>
                <span className="text-sm font-bold">£3,400</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Standard → Management Pack</span>
                <span className="text-sm font-bold">£2,900</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Other Upgrades</span>
                <span className="text-sm font-bold">£2,200</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Advisory Services</span>
                <span className="text-sm font-bold text-blue-600">23 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Premium Bookkeeping</span>
                <span className="text-sm font-bold text-blue-600">12 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Management Reporting</span>
                <span className="text-sm font-bold text-blue-600">8 prospects</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tax Planning</span>
                <span className="text-sm font-bold text-blue-600">4 prospects</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Opportunities</span>
                  <span className="text-sm font-bold text-blue-600">47 prospects</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upgrade Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Upgrade Value</span>
                <span className="text-sm font-bold">£1,302</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Upgrade Conversion Rate</span>
                <span className="text-sm font-bold">12.3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Time to Upgrade</span>
                <span className="text-sm font-bold">4.2 months</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Upgrade Retention Rate</span>
                <span className="text-sm font-bold">94.7%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Cross-sell Success Rate</span>
                <span className="text-sm font-bold">28.4%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Upgrade ROI</span>
                <span className="text-sm font-bold">340%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}