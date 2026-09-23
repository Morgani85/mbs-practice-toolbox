import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target, 
  BarChart3, 
  PieChart, 
  ArrowLeft,
  Calculator,
  CreditCard,
  Building
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function PracticePerformanceSelector() {
  const { user } = useAuth();

  // Allow admin and manager access
  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600 mb-4">This section is accessible to managers and administrators only.</p>
          <p className="text-sm text-red-500">Your current role: {user?.role}</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Main Menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const dashboards = [
    {
      id: "client-value-manager",
      name: "Client Value Manager",
      description: "Track client fees, service levels, CCR pipeline and revenue opportunities",
      icon: DollarSign,
      color: "bg-teal-600",
      available: true,
    },
    {
      id: "revenue-analytics",
      name: "Revenue Analytics",
      description: "Monthly and quarterly revenue analysis with trends and forecasts",
      icon: TrendingUp,
      color: "bg-blue-600",
      available: false,
    },
    {
      id: "cash-cashflow",
      name: "Cash & Cashflow",
      description: "Cash flow monitoring, forecasting, and working capital management",
      icon: CreditCard,
      color: "bg-cyan-600",
      available: false,
    },
    {
      id: "upgrades",
      name: "Upgrades",
      description: "Client service upgrades and upselling opportunities tracking",
      icon: Target,
      color: "bg-purple-600",
      available: false,
    },
    {
      id: "marketing",
      name: "Marketing",
      description: "Marketing campaign performance and lead generation analytics",
      icon: BarChart3,
      color: "bg-orange-600",
      available: false,
    },
    {
      id: "sales",
      name: "Sales",
      description: "Sales pipeline management and conversion tracking",
      icon: Users,
      color: "bg-green-600",
      available: false,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sections
            </Button>
          </Link>
        </div>
        
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Practice Performance</h1>
          <p className="text-gray-600">Financial performance dashboards and key business metrics for practice owners</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboards.map((dashboard) => {
          const IconComponent = dashboard.icon;
          
          return (
            <Card key={dashboard.id} className={`transition-all duration-200 hover:shadow-lg ${!dashboard.available ? 'opacity-50' : 'hover:scale-105'}`}>
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`${dashboard.color} p-3 rounded-lg flex-shrink-0`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{dashboard.name}</h3>
                    <p className="text-gray-600 text-sm">{dashboard.description}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  {dashboard.available ? (
                    <Link href={`/practice-performance/${dashboard.id}`}>
                      <Button className="w-full">
                        Open Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      Coming Soon
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}