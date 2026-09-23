import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Settings, PoundSterling } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function SectionSelector() {
  const { user } = useAuth();
  
  const sections = [
    {
      id: "staff-scorecards",
      name: "Staff Scorecards",
      description: "Track team performance metrics, targets, and results across all business modules",
      icon: Users,
      color: "bg-blue-600",
      available: true,
      adminOnly: false,
    },
    {
      id: "strategic-planning",
      name: "Strategic Planning",
      description: "Strategic planning tools and business intelligence dashboards",
      icon: TrendingUp,
      color: "bg-purple-600",
      available: true,
      adminOnly: false,
    },
    {
      id: "practice-performance",
      name: "Practice Performance",
      description: "Financial performance dashboards and key business metrics for practice owners",
      icon: PoundSterling,
      color: "bg-green-600",
      available: true,
      adminOnly: true,
    },
    {
      id: "admin",
      name: "Admin & Settings",
      description: "Manage teams, users, and system configuration",
      icon: Settings,
      color: "bg-gray-600",
      available: true,
      adminOnly: false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Practice Toolbox</h1>
          <p className="text-gray-600">Select a section to access your business management tools</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => {
          const IconComponent = section.icon;
          const isAdminOnly = section.adminOnly && user?.role !== 'admin' && user?.role !== 'manager';
          
          return (
            <Card key={section.id} className={`transition-all duration-200 hover:shadow-lg ${!section.available || isAdminOnly ? 'opacity-50' : 'hover:scale-105'}`}>
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`${section.color} p-3 rounded-lg flex-shrink-0`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{section.name}</h3>
                    <p className="text-gray-600">{section.description}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  {section.available && !isAdminOnly ? (
                    <Link href={
                      section.id === 'staff-scorecards' ? '/staff-scorecards' :
                      section.id === 'strategic-planning' ? '/strategic-planning' :
                      section.id === 'practice-performance' ? '/practice-performance' :
                      section.id === 'admin' ? '/admin/settings' :
                      `/${section.id}`
                    }>
                      <Button className="w-full">
                        Enter Section
                      </Button>
                    </Link>
                  ) : isAdminOnly ? (
                    <Button disabled className="w-full">
                      Administrator Access Required
                    </Button>
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