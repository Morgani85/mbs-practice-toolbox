import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Brain, Users, Target, Home, Sparkles, Zap, Send, Activity, ListTodo, Play, HelpCircle, MessageSquare, Plus, Edit3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RiskAnalysis {
  id: number;
  analysisDate: string;
  teamId: number | null;
  moduleType: string;
  analysisType: string;
  aiAnalysis: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyFindings: string[];
  trends: string[];
  underperformingAreas: string[];
}

interface ActionRecommendation {
  id: number;
  riskAnalysisId: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  recommendation: string;
  expectedImpact: string;
  timeframe: string;
  estimatedEffort: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
  completedAt?: string;
}

interface ClarifyingQuestion {
  id: number;
  riskAnalysisId: number;
  question: string;
  context: string;
  category: string;
  priority: string;
  response?: string;
  respondedBy?: string;
}

interface AnalysisComment {
  id: number;
  riskAnalysisId: number;
  comment: string;
  commentType: 'feedback' | 'correction' | 'additional_context';
  commentedBy: string;
  createdAt: string;
}

interface DashboardData {
  latestAnalyses: RiskAnalysis[];
  pendingRecommendations: ActionRecommendation[];
  activeRecommendations: ActionRecommendation[];
  completedRecommendations: ActionRecommendation[];
  unansweredQuestions: ClarifyingQuestion[];
  summaryStats: {
    totalAnalyses: number;
    highRiskAreas: number;
    pendingActions: number;
    activeActions: number;
    completedActions: number;
    openQuestions: number;
  };
}

const getRiskLevelColor = (level: string) => {
  switch (level) {
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function RisksActionsDashboard() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | undefined>();
  const [selectedModule, setSelectedModule] = useState("overall");
  const [questionResponses, setQuestionResponses] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState("analyses");
  const [isTabChanging, setIsTabChanging] = useState(false);
  const [newComments, setNewComments] = useState<Record<number, string>>({});
  const [commentorNames, setCommentorNames] = useState<Record<number, string>>({});
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [expandedAnalyses, setExpandedAnalyses] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  // Enhanced tab change handler with smooth transitions
  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      setIsTabChanging(true);
      setTimeout(() => {
        setActiveTab(newTab);
        setIsTabChanging(false);
      }, 150);
    }
  };

  // Keyboard navigation for tabs
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const tabs = ['analyses', 'recommendations', 'active', 'questions'];
      
      if (event.key >= '1' && event.key <= '4') {
        event.preventDefault();
        const tabIndex = parseInt(event.key) - 1;
        if (tabs[tabIndex]) {
          handleTabChange(tabs[tabIndex]);
        }
      }
      
      // Arrow key navigation
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const currentIndex = tabs.indexOf(activeTab);
        let nextIndex;
        
        if (event.key === 'ArrowLeft') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }
        
        handleTabChange(tabs[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, handleTabChange]);

  const { data: teams } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    }
  });

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['/api/risks-actions/dashboard', selectedTeamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTeamId) params.set('teamId', selectedTeamId.toString());
      
      const response = await fetch(`/api/risks-actions/dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    }
  });

  const generateAnalysisMutation = useMutation({
    mutationFn: async ({ teamId, moduleType }: { teamId?: number; moduleType: string }) => {
      return await apiRequest('/api/risks-actions/generate-analysis', 'POST', {
        teamId,
        moduleType
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risks-actions/dashboard'] });
    }
  });

  const updateRecommendationMutation = useMutation({
    mutationFn: async ({ id, status, assignedTo }: { id: number; status: string; assignedTo?: string }) => {
      return await apiRequest(`/api/risks-actions/recommendations/${id}`, 'PUT', {
        status,
        assignedTo,
        ...(status === 'completed' && { completedAt: new Date() })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risks-actions/dashboard'] });
    }
  });

  const answerQuestionMutation = useMutation({
    mutationFn: async ({ id, response }: { id: number; response: string }) => {
      return await apiRequest(`/api/risks-actions/questions/${id}/respond`, 'PUT', {
        response,
        respondedBy: 'Current User' // In a real app, this would be the authenticated user
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risks-actions/dashboard'] });
    }
  });

  const handleGenerateAnalysis = () => {
    generateAnalysisMutation.mutate({
      teamId: selectedTeamId,
      moduleType: selectedModule
    });
  };

  const handleUpdateRecommendation = (id: number, status: string) => {
    updateRecommendationMutation.mutate({ id, status });
  };

  const handleAnswerQuestion = (id: number, response: string) => {
    answerQuestionMutation.mutate({ id, response });
    // Clear the response from state after submitting
    setQuestionResponses(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const handleQuestionResponseChange = (questionId: number, value: string) => {
    setQuestionResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmitQuestion = (questionId: number) => {
    const response = questionResponses[questionId]?.trim();
    if (response) {
      handleAnswerQuestion(questionId, response);
    }
  };

  const toggleAnalysisExpansion = (analysisId: number) => {
    setExpandedAnalyses(prev => ({
      ...prev,
      [analysisId]: !prev[analysisId]
    }));
  };

  // Comment management functions
  const addCommentMutation = useMutation({
    mutationFn: async ({ analysisId, comment, commentType, commentedBy }: { 
      analysisId: number; 
      comment: string; 
      commentType: string; 
      commentedBy: string 
    }) => {
      return await apiRequest(`/api/risks-actions/analyses/${analysisId}/comments`, 'POST', { 
        comment, 
        commentType, 
        commentedBy 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/risks-actions/analyses', variables.analysisId, 'comments'] });
      setNewComments(prev => ({ ...prev, [variables.analysisId]: '' }));
      setCommentorNames(prev => ({ ...prev, [variables.analysisId]: '' }));
    }
  });

  const handleAddComment = (analysisId: number) => {
    const comment = newComments[analysisId]?.trim();
    const commentedBy = commentorNames[analysisId]?.trim() || 'Anonymous User';
    
    if (comment) {
      addCommentMutation.mutate({
        analysisId,
        comment,
        commentType: 'feedback',
        commentedBy
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Advanced Module Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white rounded-lg p-4 md:p-6 border-2 border-purple-300 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Risks & Actions Analysis</h1>
                <Badge className="bg-yellow-400 text-yellow-900 hover:bg-yellow-300 w-fit mt-1 sm:mt-0">
                  <Zap className="w-3 h-3 mr-1" />
                  ADVANCED
                </Badge>
              </div>
              <p className="text-white/90 text-sm md:text-base">
                AI-powered performance analysis and risk assessment across all modules
              </p>
            </div>
          </div>
          
          <div className="flex flex-row space-x-2 sm:space-x-3">
            <Link to="/">
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs sm:text-sm px-2 sm:px-4">
                <Home className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Main Menu</span>
                <span className="sm:hidden">Menu</span>
              </Button>
            </Link>
            <Link to="/area-selector">
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-xs sm:text-sm px-2 sm:px-4">
                <Target className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Module Selector</span>
                <span className="sm:hidden">Modules</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div></div>
        
        <div className="flex items-center space-x-4">
          <Select value={selectedTeamId?.toString() || "all"} onValueChange={(value) => 
            setSelectedTeamId(value === "all" ? undefined : parseInt(value))
          }>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams?.map((team: any) => (
                <SelectItem key={team.id} value={team.id.toString()}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overall">Overall Analysis</SelectItem>
              <SelectItem value="accounts">Accounts</SelectItem>
              <SelectItem value="vat">VAT</SelectItem>
              <SelectItem value="health_checks">Management Accounts</SelectItem>
              <SelectItem value="confirmation_statements">Confirmation Statements</SelectItem>
              <SelectItem value="mbs">Internal Bookkeeping</SelectItem>
              <SelectItem value="client_bookkeeping">Client Bookkeeping</SelectItem>
              <SelectItem value="dext_precision">Dext Precision</SelectItem>
              <SelectItem value="turnover_checks">VAT Turnover Checks</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            onClick={handleGenerateAnalysis}
            disabled={generateAnalysisMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Brain className="w-4 h-4 mr-2" />
            {generateAnalysisMutation.isPending ? 'Analyzing...' : 'Generate AI Analysis'}
          </Button>
        </div>
      </div>

      {/* Navigation Alert Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-auto p-4 flex flex-col items-start space-y-2 bg-white hover:bg-gray-50 border border-gray-200"
          onClick={() => handleTabChange("analyses")}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Total Analyses</span>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{dashboardData?.summaryStats.totalAnalyses || 0}</div>
        </Button>

        <Button
          variant="outline"
          className={`h-auto p-4 flex flex-col items-start space-y-2 border ${
            (dashboardData?.summaryStats.highRiskAreas || 0) > 0 
              ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-800' 
              : 'bg-white hover:bg-gray-50 border-gray-200'
          }`}
          onClick={() => {
            handleTabChange("analyses");
            setTimeout(() => {
              const highRiskElement = document.querySelector('[data-risk="high"], [data-risk="critical"]');
              if (highRiskElement) {
                highRiskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 200);
          }}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">High Risk Areas</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {dashboardData?.summaryStats.highRiskAreas || 0}
          </div>
        </Button>

        <Button
          variant="outline"
          className={`h-auto p-4 flex flex-col items-start space-y-2 border ${
            (dashboardData?.summaryStats.pendingActions || 0) > 0 
              ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800' 
              : 'bg-white hover:bg-gray-50 border-gray-200'
          }`}
          onClick={() => handleTabChange("recommendations")}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Pending Actions</span>
            <Clock className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {dashboardData?.summaryStats.pendingActions || 0}
          </div>
        </Button>

        <Button
          variant="outline"
          className={`h-auto p-4 flex flex-col items-start space-y-2 border ${
            (dashboardData?.summaryStats.openQuestions || 0) > 0 
              ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800' 
              : 'bg-white hover:bg-gray-50 border-gray-200'
          }`}
          onClick={() => handleTabChange("questions")}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Open Questions</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {dashboardData?.summaryStats.openQuestions || 0}
          </div>
        </Button>
      </div>

      <Tabs defaultValue="analyses" value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Enhanced Navigation Header */}
        <div className="mb-8 p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 rounded-xl border border-slate-200 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-md">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Risk Analysis Dashboard</h2>
                  <p className="text-sm text-gray-600">Navigate between sections to explore different aspects</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 text-sm font-semibold">AI Analysis Active</span>
              </div>
              
              {/* Navigation Progress Indicator */}
              <div className="flex items-center space-x-1">
                <div className="text-xs text-gray-500 font-medium">Section:</div>
                <div className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold capitalize">
                  {activeTab === 'analyses' ? 'Latest Analyses' : 
                   activeTab === 'recommendations' ? 'All Actions' :
                   activeTab === 'active' ? 'Active Actions' : 'Questions'}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Tab Navigation */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-gray-50 via-blue-50 to-indigo-50">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-1 bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="analyses" 
                  className="group relative flex flex-col sm:flex-row items-center justify-center gap-2 h-16 sm:h-14 px-3 rounded-lg transition-all duration-300 ease-in-out
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 
                    data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200
                    data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50
                    data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:shadow-md"
                >
                  <Activity className="w-5 h-5 transition-transform group-data-[state=active]:scale-110" />
                  <div className="text-center sm:text-left">
                    <div className="font-semibold text-sm">Latest</div>
                    <div className="text-xs opacity-75">Analyses</div>
                  </div>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="recommendations" 
                  className="group relative flex flex-col sm:flex-row items-center justify-center gap-2 h-16 sm:h-14 px-3 rounded-lg transition-all duration-300 ease-in-out
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 
                    data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200
                    data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50
                    data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:shadow-md"
                >
                  <div className="relative">
                    <ListTodo className="w-5 h-5 transition-transform group-data-[state=active]:scale-110" />
                    {(dashboardData?.summaryStats?.pendingActions || 0) > 0 && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
                        {dashboardData?.summaryStats?.pendingActions}
                      </div>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="font-semibold text-sm">All</div>
                    <div className="text-xs opacity-75">Actions</div>
                  </div>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="active" 
                  className="group relative flex flex-col sm:flex-row items-center justify-center gap-2 h-16 sm:h-14 px-3 rounded-lg transition-all duration-300 ease-in-out
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 
                    data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200
                    data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50
                    data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:shadow-md"
                >
                  <div className="relative">
                    <Play className="w-5 h-5 transition-transform group-data-[state=active]:scale-110" />
                    {(dashboardData?.summaryStats?.activeActions || 0) > 0 && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {dashboardData?.summaryStats?.activeActions}
                      </div>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="font-semibold text-sm">Active</div>
                    <div className="text-xs opacity-75">Actions</div>
                  </div>
                </TabsTrigger>
                
                <TabsTrigger 
                  value="questions" 
                  className="group relative flex flex-col sm:flex-row items-center justify-center gap-2 h-16 sm:h-14 px-3 rounded-lg transition-all duration-300 ease-in-out
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 
                    data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200
                    data-[state=inactive]:bg-white data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:bg-gray-50
                    data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:shadow-md"
                >
                  <div className="relative">
                    <HelpCircle className="w-5 h-5 transition-transform group-data-[state=active]:scale-110" />
                    {(dashboardData?.summaryStats?.openQuestions || 0) > 0 && (
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {dashboardData?.summaryStats?.openQuestions}
                      </div>
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="font-semibold text-sm">Open</div>
                    <div className="text-xs opacity-75">Questions</div>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          
          {/* Navigation Breadcrumb */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Risk Analysis</span>
              <span>→</span>
              <span className="text-orange-600 font-medium">
                {activeTab === 'analyses' ? 'Latest Analyses' : 
                 activeTab === 'recommendations' ? 'All Actions' :
                 activeTab === 'active' ? 'Active Actions' : 'Open Questions'}
              </span>
            </div>
            
            {/* Quick Navigation Shortcuts */}
            <div className="hidden lg:flex items-center space-x-1 text-xs text-gray-400">
              <span>Quick nav:</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded shadow-sm border border-gray-200">1</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded shadow-sm border border-gray-200">2</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded shadow-sm border border-gray-200">3</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded shadow-sm border border-gray-200">4</kbd>
              <span className="text-gray-300 mx-2">|</span>
              <span>← →</span>
            </div>
          </div>
        </div>

        <TabsContent value="analyses" className="space-y-4">
          {dashboardData?.latestAnalyses?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No analyses available. Generate your first AI analysis to get started.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.latestAnalyses?.map((analysis) => (
              <Card key={analysis.id} data-risk={analysis.riskLevel}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span className="capitalize">{analysis.moduleType.replace('_', ' ')} Module</span>
                        <Badge className={getRiskLevelColor(analysis.riskLevel)}>
                          {analysis.riskLevel.toUpperCase()} RISK
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Analysis Date: {new Date(analysis.analysisDate).toLocaleDateString()}
                        {analysis.teamId && ` • Team ${analysis.teamId}`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAnalysisExpansion(analysis.id)}
                      className="flex items-center space-x-2"
                    >
                      <span>{expandedAnalyses[analysis.id] ? 'Collapse' : 'Expand'}</span>
                      <div className={`transition-transform ${expandedAnalyses[analysis.id] ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary View - Always Visible */}
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <h4 className="font-semibold mb-2 text-gray-800">Executive Summary</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {analysis.aiAnalysis.length > 200 
                        ? analysis.aiAnalysis.substring(0, 200) + "..." 
                        : analysis.aiAnalysis}
                    </p>
                    
                    {/* Key Metrics in Summary */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.keyFindings.slice(0, 2).map((finding, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {finding.length > 50 ? finding.substring(0, 50) + "..." : finding}
                        </Badge>
                      ))}
                      {analysis.keyFindings.length > 2 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          +{analysis.keyFindings.length - 2} more findings
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Detailed View - Collapsible */}
                  {expandedAnalyses[analysis.id] && (
                    <div className="space-y-4 border-t pt-4">
                      <div>
                        <h4 className="font-semibold mb-2">Complete AI Analysis</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.aiAnalysis}</p>
                      </div>
                      
                      {analysis.keyFindings.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Key Findings & Improvements (80%)</span>
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {analysis.keyFindings.map((finding, index) => (
                              <li key={index} className="text-sm">{finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.underperformingAreas.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <span>Areas for Improvement</span>
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.underperformingAreas.map((area, index) => (
                              <Badge key={index} variant="destructive" className="text-xs">{area}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.trends.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center space-x-2">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <span>Performance Trends</span>
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.trends.map((trend, index) => (
                              <Badge key={index} variant="outline" className="flex items-center space-x-1 text-xs">
                                {trend.includes('increasing') || trend.includes('improving') ? 
                                  <TrendingUp className="w-3 h-3 text-green-600" /> : 
                                  <TrendingDown className="w-3 h-3 text-red-600" />
                                }
                                <span>{trend}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments Section for Iterative Feedback */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Provide Feedback</h4>
                      <Badge variant="outline" className="text-xs">
                        Improves AI Analysis
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Your name (optional)"
                          value={commentorNames[analysis.id] || ''}
                          onChange={(e) => setCommentorNames(prev => ({
                            ...prev,
                            [analysis.id]: e.target.value
                          }))}
                          className="w-32"
                        />
                        <Textarea
                          placeholder="Share your insights, corrections, or additional context about this analysis..."
                          value={newComments[analysis.id] || ''}
                          onChange={(e) => setNewComments(prev => ({
                            ...prev,
                            [analysis.id]: e.target.value
                          }))}
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleAddComment(analysis.id)}
                          disabled={!newComments[analysis.id]?.trim() || addCommentMutation.isPending}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded border">
                        <strong>💡 Tip:</strong> Your feedback helps the AI learn and provide better analysis in future assessments. 
                        Share specific insights about business context, process details, or data accuracy.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          {/* Priority Information Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900">AI-Prioritized Recommendations</h4>
                <p className="text-sm text-blue-700">
                  Showing top 5 highest-priority actions based on business impact and urgency. AI analysis focuses on the most critical items requiring immediate attention.
                </p>
              </div>
            </div>
          </div>

          {dashboardData?.pendingRecommendations?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending recommendations. All action items are complete!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.pendingRecommendations?.map((rec) => (
              <Card key={rec.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <span className="capitalize">{rec.category}</span>
                    </CardTitle>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateRecommendation(rec.id, 'in_progress')}
                        disabled={updateRecommendationMutation.isPending}
                      >
                        Start
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleUpdateRecommendation(rec.id, 'completed')}
                        disabled={updateRecommendationMutation.isPending}
                      >
                        Complete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{rec.recommendation}</p>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Expected Impact:</span>
                      <p className="text-muted-foreground">{rec.expectedImpact}</p>
                    </div>
                    <div>
                      <span className="font-medium">Timeframe:</span>
                      <p className="text-muted-foreground capitalize">{rec.timeframe.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="font-medium">Effort:</span>
                      <p className="text-muted-foreground capitalize">{rec.estimatedEffort}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {!dashboardData?.activeRecommendations || dashboardData?.activeRecommendations?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No actions currently in progress. Start working on recommended actions to track them here.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.activeRecommendations?.map((rec) => (
              <Card key={rec.id} className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(rec.priority)}>
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <span className="capitalize">{rec.category} Action</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        <Clock className="w-3 h-3 mr-1" />
                        IN PROGRESS
                      </Badge>
                    </CardTitle>
                    <Button 
                      size="sm"
                      onClick={() => handleUpdateRecommendation(rec.id, 'completed')}
                      disabled={updateRecommendationMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Complete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">{rec.recommendation}</p>
                  
                  <div className="bg-white p-3 rounded border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-orange-700">Expected Impact:</span>
                        <p className="text-gray-700">{rec.expectedImpact}</p>
                      </div>
                      <div>
                        <span className="font-medium text-orange-700">Timeframe:</span>
                        <p className="text-gray-700 capitalize">{rec.timeframe.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-orange-600 bg-orange-100 p-2 rounded">
                    <strong>Reminder:</strong> This action is currently in progress. Complete it when finished to track your accomplishments.
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          {/* Priority Information Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <HelpCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-purple-900">Strategic Clarifying Questions</h4>
                <p className="text-sm text-purple-700">
                  Top 5 most critical questions prioritized by business impact. Your responses help refine AI analysis and improve future recommendations.
                </p>
              </div>
            </div>
          </div>

          {dashboardData?.unansweredQuestions?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending questions. All clarifications have been provided!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            dashboardData?.unansweredQuestions?.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{question.question}</span>
                    <Badge className={getPriorityColor(question.priority)}>
                      {question.priority.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{question.context}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <textarea 
                      placeholder="Provide your response..."
                      className="w-full p-3 border rounded-md resize-none"
                      rows={3}
                      value={questionResponses[question.id] || ''}
                      onChange={(e) => handleQuestionResponseChange(question.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          handleSubmitQuestion(question.id);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Press Ctrl+Enter or click Submit to send your response
                      </p>
                      <Button 
                        size="sm"
                        onClick={() => handleSubmitQuestion(question.id)}
                        disabled={!questionResponses[question.id]?.trim() || answerQuestionMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Submit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {generateAnalysisMutation.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to generate analysis. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}