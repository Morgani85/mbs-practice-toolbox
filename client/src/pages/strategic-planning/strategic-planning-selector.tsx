import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Heart, Calendar, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";

export default function StrategicPlanningSelector() {
  const { user } = useAuth();
  
  const sections = [
    {
      id: "long-term-targets",
      name: "Long Term Targets",
      description: "Set and track long-term business objectives and performance targets",
      icon: Target,
      color: "bg-blue-600",
      available: hasPermission(user, 'strategic-planning-long-term'),
      restricted: true,
    },
    {
      id: "values",
      name: "Values",
      description: "Define and manage organizational values and cultural principles",
      icon: Heart,
      color: "bg-purple-600",
      available: true,
      restricted: false,
    },
    {
      id: "quarterly-goals",
      name: "Quarterly Goals",
      description: "Set and monitor quarterly business goals and milestones",
      icon: Calendar,
      color: "bg-green-600",
      available: true,
      restricted: false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="mb-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2" size={16} />
              Back to Practice Toolbox
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Strategic Planning</h1>
          <p className="text-gray-600">Select a strategic planning tool to manage your business objectives</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => {
          const IconComponent = section.icon;
          
          return (
            <Card key={section.id} className={`transition-all duration-200 hover:shadow-lg ${!section.available ? 'opacity-50' : 'hover:scale-105'}`}>
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
                  {section.available ? (
                    <Link href={`/strategic-planning/${section.id}`}>
                      <Button className="w-full">
                        Enter Section
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      {section.restricted ? 'Manager/Admin Only' : 'Coming Soon'}
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