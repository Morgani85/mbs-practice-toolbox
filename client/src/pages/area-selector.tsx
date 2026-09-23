import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, FileText, Users, BookOpen, ClipboardCheck, Receipt, Heart, ArrowLeft, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";

export default function AreaSelector() {
  const modules = [
    {
      id: "overview",
      name: "Overview Dashboard",
      description: "View weekly performance metrics across all modules with team comparisons",
      icon: LayoutDashboard,
      color: "bg-indigo-600",
      available: true,
      link: "/overview",
    },
    {
      id: "accounts",
      name: "Accounts",
      description: "Track account preparation targets, results, and accounts due",
      icon: Calculator,
      color: "bg-blue-500",
      available: true,
    },
    {
      id: "vat",
      name: "VAT",
      description: "Monitor VAT return preparation and submissions",
      icon: FileText,
      color: "bg-green-500",
      available: true,
    },
    {
      id: "mbs-bookkeeping",
      name: "Internal Bookkeeping",
      description: "Track internal bookkeeping tasks and completion rates",
      icon: BookOpen,
      color: "bg-purple-500",
      available: true,
    },
    {
      id: "client-bookkeeping",
      name: "Client Bookkeeping",
      description: "Track client bookkeeping tasks and completion rates",
      icon: BookOpen,
      color: "bg-cyan-500",
      available: true,
    },
    {
      id: "confirmation-statements",
      name: "Confirmation Statements",
      description: "Track confirmation statement preparation",
      icon: ClipboardCheck,
      color: "bg-purple-600",
      available: true,
    },
    {
      id: "tax",
      name: "Tax",
      description: "Track tax return preparation, submissions, and deadlines",
      icon: Receipt,
      color: "bg-red-500",
      available: true,
    },
    {
      id: "health-checks",
      name: "Management Accounts",
      description: "Monitor performance across Management Accounts preparation",
      icon: Heart,
      color: "bg-pink-500",
      available: true,
    },
    {
      id: "onboarding",
      name: "Onboarding",
      description: "Monitor client onboarding progress and milestones",
      icon: Users,
      color: "bg-orange-500",
      available: false,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="mb-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2" size={16} />
              Back to Practice Toolbox
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Staff Scorecards</h1>
          <p className="text-gray-600">Select a module to view and manage team performance metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const IconComponent = module.icon;
          
          return (
            <Card key={module.id} className={`transition-all duration-200 hover:shadow-lg ${!module.available ? 'opacity-50' : 'hover:scale-105'}`}>
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`${module.color} p-3 rounded-lg flex-shrink-0`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{module.name}</h3>
                    <p className="text-gray-600">{module.description}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  {module.available ? (
                    <Link href={(module as any).link || `/${module.id}/dashboard`}>
                      <Button className="w-full">
                        Enter Module
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