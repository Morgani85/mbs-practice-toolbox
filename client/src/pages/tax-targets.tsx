import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, RotateCcw } from "lucide-react";
import type { Team } from "@shared/schema";

export default function TaxTargets() {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
  });

  // Load monthly targets from localStorage or use defaults
  const loadTargets = () => {
    try {
      const saved = localStorage.getItem('tax-monthly-targets');
      return saved ? JSON.parse(saved) : [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    } catch {
      return [15, 20, 25, 30, 35, 40, 50, 60, 70, 80];
    }
  };

  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(loadTargets);

  // Save targets to localStorage
  const saveTargetsMutation = useMutation({
    mutationFn: async (targets: number[]) => {
      localStorage.setItem('tax-monthly-targets', JSON.stringify(targets));
      return targets;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Monthly targets saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save targets",
        variant: "destructive",
      });
    },
  });

  const handleTargetChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0 && numValue <= 100) {
      const newTargets = [...monthlyTargets];
      newTargets[index] = numValue;
      setMonthlyTargets(newTargets);
    }
  };

  const handleSave = () => {
    saveTargetsMutation.mutate(monthlyTargets);
  };

  const handleReset = () => {
    setMonthlyTargets([15, 20, 25, 30, 35, 40, 50, 60, 70, 80]);
  };

  const months = [
    'April', 'May', 'June', 'July', 'August', 
    'September', 'October', 'November', 'December', 'January'
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Targets</h1>
          <p className="text-gray-600 mt-2">Set monthly completion percentage targets for the tax year (April to January)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Monthly Percentage Targets
          </CardTitle>
          <p className="text-sm text-gray-600">
            These targets are updated each March for the new tax year. Set the target percentage to complete by the end of each month.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {months.map((month, index) => (
              <div key={month} className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  {month}
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={monthlyTargets[index]}
                    onChange={(e) => handleTargetChange(index, e.target.value)}
                    className="text-center pr-8"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Visualization */}
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Target Progression</h3>
            <div className="space-y-2">
              {months.map((month, index) => (
                <div key={month} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium">{month}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${monthlyTargets[index]}%` }}
                    ></div>
                  </div>
                  <div className="w-12 text-sm text-gray-600">{monthlyTargets[index]}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Target Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-800 font-medium">Q1 Target:</span>
                <div className="text-blue-700">{monthlyTargets[9]}% (Jan)</div>
              </div>
              <div>
                <span className="text-blue-800 font-medium">Q2 Target:</span>
                <div className="text-blue-700">{monthlyTargets[2]}% (Jun)</div>
              </div>
              <div>
                <span className="text-blue-800 font-medium">Q3 Target:</span>
                <div className="text-blue-700">{monthlyTargets[5]}% (Sep)</div>
              </div>
              <div>
                <span className="text-blue-800 font-medium">Q4 Target:</span>
                <div className="text-blue-700">{monthlyTargets[8]}% (Dec)</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveTargetsMutation.isPending}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saveTargetsMutation.isPending ? 'Saving...' : 'Save Targets'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}