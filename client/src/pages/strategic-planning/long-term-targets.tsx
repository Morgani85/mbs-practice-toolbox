import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Target, Plus, Shield, Calendar, Archive, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/permissions";
import { useState, useEffect } from "react";

export default function LongTermTargets() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'1year' | '3year' | '5year'>('1year');
  const [targetDates, setTargetDates] = useState(() => {
    const saved = localStorage.getItem('longTermTargetDates');
    return saved ? JSON.parse(saved) : {
      '1year': '',
      '3year': '',
      '5year': ''
    };
  });
  const [showResults, setShowResults] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState({
    strategic: false,
    financial: false,
    client: false,
    team: false,
    service: false,
    growth: false,
    culture: false
  });
  
  // Initial data structure for targets and results
  const initialTargetsData = {
    '1year': {
      strategicGoal: 'To have successfully onboarded one acquisition and built a playbook for future ones',
      financial: { revenue: '715000', operatingProfit: '41', netProfit: '415000', recurringRevenue: '99', cashAtBank: '100000' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    },
    '3year': {
      strategicGoal: '',
      financial: { revenue: '', operatingProfit: '', netProfit: '', recurringRevenue: '', cashAtBank: '' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    },
    '5year': {
      strategicGoal: '',
      financial: { revenue: '', operatingProfit: '', netProfit: '', recurringRevenue: '', cashAtBank: '' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    }
  };

  // Load data from localStorage or use initial data
  const [targets, setTargets] = useState(() => {
    const saved = localStorage.getItem('longTermTargets');
    return saved ? JSON.parse(saved) : initialTargetsData;
  });
  
  const initialResultsData = {
    '1year': {
      strategicGoal: '',
      financial: { revenue: '', operatingProfit: '', netProfit: '', recurringRevenue: '', cashAtBank: '' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    },
    '3year': {
      strategicGoal: '',
      financial: { revenue: '', operatingProfit: '', netProfit: '', recurringRevenue: '', cashAtBank: '' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    },
    '5year': {
      strategicGoal: '',
      financial: { revenue: '', operatingProfit: '', netProfit: '', recurringRevenue: '', cashAtBank: '' },
      client: { activeClients: '', avgFee: '', retention: '', idealClient: '' },
      team: { teamMembers: '', revenuePerMember: '', deliveryHours: '', maturityScore: '' },
      service: { advisoryVsCompliance: '', newServices: '', techMaturity: '', deliveryModel: '' },
      growth: { leadSource: '', monthlyLeads: '', conversionRate: '', costPerAcquisition: '' },
      culture: { teamValues: '', culturalFit: '', engagementScore: '', zoneOfGenius: '' }
    }
  };

  const [results, setResults] = useState(() => {
    const saved = localStorage.getItem('longTermResults');
    return saved ? JSON.parse(saved) : initialResultsData;
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('longTermTargets', JSON.stringify(targets));
  }, [targets]);

  useEffect(() => {
    localStorage.setItem('longTermResults', JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem('longTermTargetDates', JSON.stringify(targetDates));
  }, [targetDates]);

  // Debug: Log current data on mount
  useEffect(() => {
    console.log('Current targets data:', targets);
    console.log('Current results data:', results);
    console.log('Current target dates:', targetDates);
  }, []);
  
  // Check if user has permission to view this page
  if (!hasPermission(user, 'strategic-planning-long-term')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50">
        {/* Header Section */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto p-6">
            <Link href="/strategic-planning">
              <Button variant="outline" size="sm" className="mb-4">
                <ArrowLeft className="mr-2" size={16} />
                Back to Strategic Planning
              </Button>
            </Link>
            <div className="flex items-center mb-2">
              <Shield className="mr-3 text-red-600" size={32} />
              <h1 className="text-4xl font-bold text-gray-900">Access Restricted</h1>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-6">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm text-center">
            <CardContent className="p-8">
              <Shield className="mx-auto mb-4 text-red-400" size={64} />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Long Term Targets</h2>
              <p className="text-gray-600 mb-4 text-lg">
                This section is only available to Managers and Administrators.
              </p>
              <p className="text-sm text-gray-500">
                Current role: <span className="font-semibold">{user?.role || 'Not logged in'}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto p-6">
          <Link href="/strategic-planning">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2" size={16} />
              Back to Strategic Planning
            </Button>
          </Link>
          <div className="flex items-center mb-2">
            <Target className="mr-3 text-green-600" size={32} />
            <h1 className="text-4xl font-bold text-gray-900">Long Term Targets</h1>
          </div>
          <p className="text-lg text-gray-600">Set and track long-term business objectives and performance targets</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">

        {/* Time Period Tabs */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('1year')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === '1year' 
                  ? 'text-white bg-gradient-to-r from-green-600 to-green-700 shadow-sm' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              1 Year Targets
            </button>
            <button 
              onClick={() => setActiveTab('3year')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === '3year' 
                  ? 'text-white bg-gradient-to-r from-green-600 to-green-700 shadow-sm' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              3 Year Targets
            </button>
            <button 
              onClick={() => setActiveTab('5year')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === '5year' 
                  ? 'text-white bg-gradient-to-r from-green-600 to-green-700 shadow-sm' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              5 Year Targets
            </button>
          </div>
        </div>

        {/* Target Date Setting Section */}
        <div className="mb-8">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Calendar className="mr-2" size={20} />
                Target Date for {activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Set target completion date for your {activeTab === '1year' ? '1 year' : activeTab === '3year' ? '3 year' : '5 year'} goals
                  </label>
                  <Input
                    type="date"
                    value={targetDates[activeTab]}
                    onChange={(e) => setTargetDates(prev => ({ ...prev, [activeTab]: e.target.value }))}
                    className="w-full"
                    placeholder="Select target date"
                  />
                </div>
                <Button className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-md">
                  Save Date
                </Button>
              </div>
              {targetDates[activeTab] && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <p className="text-sm text-green-700">
                    Target date set: {new Date(targetDates[activeTab]).toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results/Targets Toggle */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => setShowResults(false)}
              className={`px-6 py-2 ${!showResults 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <Target className="mr-2" size={16} />
              Set Targets
            </Button>
            <Button
              onClick={() => setShowResults(true)}
              className={`px-6 py-2 ${showResults 
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              <TrendingUp className="mr-2" size={16} />
              Enter Results
            </Button>
          </div>
        </div>

        {/* Strategic Goal Section */}
        <div className="mb-8">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Overall Strategic Goal (Vision Headline)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 mb-2">Vision Statement</p>
                  <p className="text-gray-800 italic">
                    {targets[activeTab].strategicGoal 
                      ? `"${targets[activeTab].strategicGoal}"`
                      : '"We\'re the go-to finance function for scaling service businesses under £10m"'
                    }
                  </p>
                </div>
                <Dialog open={dialogOpen.strategic} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, strategic: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      Set Strategic Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Set Strategic Goal - {activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan</DialogTitle>
                      <DialogDescription>
                        Define your overarching vision statement for this planning period
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="strategic-goal">Vision Statement</Label>
                        <Textarea
                          id="strategic-goal"
                          value={targets[activeTab].strategicGoal}
                          onChange={(e) => setTargets(prev => ({
                            ...prev,
                            [activeTab]: {
                              ...prev[activeTab],
                              strategicGoal: e.target.value
                            }
                          }))}
                          placeholder="e.g., We're the go-to finance function for scaling service businesses under £10m"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, strategic: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                          onClick={() => {
                            console.log('Strategic goal saved:', targets[activeTab].strategicGoal);
                            setDialogOpen(prev => ({ ...prev, strategic: false }));
                          }}
                        >
                          Save Strategic Goal
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Financial Targets */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Financial Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Revenue</span>
                  <span className="text-gray-600">£{targets[activeTab].financial.revenue || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Operating Profit %</span>
                  <span className="text-gray-600">{targets[activeTab].financial.operatingProfit || '0'}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Net Profit (EBITDA)</span>
                  <span className="text-gray-600">£{targets[activeTab].financial.netProfit || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Recurring Revenue %</span>
                  <span className="text-gray-600">{targets[activeTab].financial.recurringRevenue || '0'}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Cash at Bank Target</span>
                  <span className="text-gray-600">£{targets[activeTab].financial.cashAtBank || '0'}</span>
                </div>
                <Dialog open={dialogOpen.financial} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, financial: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      Set Financial Targets
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Set Financial Targets - {activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan</DialogTitle>
                      <DialogDescription>
                        Set your financial performance targets for this planning period
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="revenue">Revenue (£)</Label>
                          <Input
                            id="revenue"
                            type="number"
                            value={targets[activeTab].financial.revenue}
                            onChange={(e) => setTargets(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                financial: { ...prev[activeTab].financial, revenue: e.target.value }
                              }
                            }))}
                            placeholder="e.g., 1000000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="operating-profit">Operating Profit %</Label>
                          <Input
                            id="operating-profit"
                            type="number"
                            value={targets[activeTab].financial.operatingProfit}
                            onChange={(e) => setTargets(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                financial: { ...prev[activeTab].financial, operatingProfit: e.target.value }
                              }
                            }))}
                            placeholder="e.g., 20"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="net-profit">Net Profit (EBITDA) (£)</Label>
                          <Input
                            id="net-profit"
                            type="number"
                            value={targets[activeTab].financial.netProfit}
                            onChange={(e) => setTargets(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                financial: { ...prev[activeTab].financial, netProfit: e.target.value }
                              }
                            }))}
                            placeholder="e.g., 200000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="recurring-revenue">Recurring Revenue %</Label>
                          <Input
                            id="recurring-revenue"
                            type="number"
                            value={targets[activeTab].financial.recurringRevenue}
                            onChange={(e) => setTargets(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                financial: { ...prev[activeTab].financial, recurringRevenue: e.target.value }
                              }
                            }))}
                            placeholder="e.g., 80"
                            className="mt-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="cash-at-bank">Cash at Bank Target (£)</Label>
                          <Input
                            id="cash-at-bank"
                            type="number"
                            value={targets[activeTab].financial.cashAtBank}
                            onChange={(e) => setTargets(prev => ({
                              ...prev,
                              [activeTab]: {
                                ...prev[activeTab],
                                financial: { ...prev[activeTab].financial, cashAtBank: e.target.value }
                              }
                            }))}
                            placeholder="e.g., 250000"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, financial: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                          onClick={() => {
                            console.log('Financial targets saved:', targets[activeTab].financial);
                            setDialogOpen(prev => ({ ...prev, financial: false }));
                          }}
                        >
                          Save Financial Targets
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Client Metrics */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Client Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Number of Active Clients</span>
                  <span className="text-gray-600">{targets[activeTab].client.activeClients || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Average Fee per Client</span>
                  <span className="text-gray-600">£{targets[activeTab].client.avgFee || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Client Retention %</span>
                  <span className="text-gray-600">{targets[activeTab].client.retention || '0'}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Ideal Client %</span>
                  <span className="text-gray-600">{targets[activeTab].client.idealClient || '0'}%</span>
                </div>
                <Dialog open={dialogOpen.client} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, client: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      {showResults ? 'Enter Results' : 'Set Client Metrics'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{showResults ? 'Enter Results' : 'Set Targets'} - Client Metrics ({activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan)</DialogTitle>
                      <DialogDescription>
                        {showResults ? 'Enter actual results for client metrics' : 'Set your client-related performance targets'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="active-clients">Number of Active Clients</Label>
                          <Input
                            id="active-clients"
                            type="number"
                            value={showResults ? results[activeTab].client.activeClients : targets[activeTab].client.activeClients}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  client: { ...prev[activeTab].client, activeClients: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 150"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="avg-fee">Average Fee per Client (£)</Label>
                          <Input
                            id="avg-fee"
                            type="number"
                            value={showResults ? results[activeTab].client.avgFee : targets[activeTab].client.avgFee}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  client: { ...prev[activeTab].client, avgFee: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 5000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="client-retention">Client Retention %</Label>
                          <Input
                            id="client-retention"
                            type="number"
                            value={showResults ? results[activeTab].client.retention : targets[activeTab].client.retention}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  client: { ...prev[activeTab].client, retention: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 95"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ideal-client">Ideal Client %</Label>
                          <Input
                            id="ideal-client"
                            type="number"
                            value={showResults ? results[activeTab].client.idealClient : targets[activeTab].client.idealClient}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  client: { ...prev[activeTab].client, idealClient: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 80"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, client: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                          onClick={() => {
                            const data = showResults ? results[activeTab].client : targets[activeTab].client;
                            console.log('Client metrics saved:', data);
                            setDialogOpen(prev => ({ ...prev, client: false }));
                          }}
                        >
                          Save {showResults ? 'Results' : 'Targets'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Team Structure & Capacity */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Team Structure & Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Number of Team Members</span>
                  <span className="text-gray-600">{targets[activeTab].team.teamMembers || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Revenue per Team Member</span>
                  <span className="text-gray-600">£{targets[activeTab].team.revenuePerMember || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Delivery Hours per Role Type</span>
                  <span className="text-gray-600">{targets[activeTab].team.deliveryHours || '0h'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Leadership Team Maturity Score</span>
                  <span className="text-gray-600">{targets[activeTab].team.maturityScore || '0'}/10</span>
                </div>
                <Dialog open={dialogOpen.team} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, team: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      {showResults ? 'Enter Results' : 'Set Team Targets'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{showResults ? 'Enter Results' : 'Set Targets'} - Team Structure ({activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan)</DialogTitle>
                      <DialogDescription>
                        {showResults ? 'Enter actual team performance results' : 'Set your team structure and capacity targets'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="team-members">Number of Team Members</Label>
                          <Input
                            id="team-members"
                            type="number"
                            value={showResults ? results[activeTab].team.teamMembers : targets[activeTab].team.teamMembers}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  team: { ...prev[activeTab].team, teamMembers: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 15"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="revenue-per-member">Revenue per Team Member (£)</Label>
                          <Input
                            id="revenue-per-member"
                            type="number"
                            value={showResults ? results[activeTab].team.revenuePerMember : targets[activeTab].team.revenuePerMember}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  team: { ...prev[activeTab].team, revenuePerMember: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 100000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="delivery-hours">Delivery Hours per Role Type</Label>
                          <Input
                            id="delivery-hours"
                            type="text"
                            value={showResults ? results[activeTab].team.deliveryHours : targets[activeTab].team.deliveryHours}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  team: { ...prev[activeTab].team, deliveryHours: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 1500h"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="maturity-score">Leadership Team Maturity Score (1-10)</Label>
                          <Input
                            id="maturity-score"
                            type="number"
                            min="1"
                            max="10"
                            value={showResults ? results[activeTab].team.maturityScore : targets[activeTab].team.maturityScore}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  team: { ...prev[activeTab].team, maturityScore: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 8"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, team: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800"
                          onClick={() => {
                            const data = showResults ? results[activeTab].team : targets[activeTab].team;
                            console.log('Team metrics saved:', data);
                            setDialogOpen(prev => ({ ...prev, team: false }));
                          }}
                        >
                          Save {showResults ? 'Results' : 'Targets'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Service Model Evolution */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Service Model Evolution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">% Revenue Advisory vs Compliance</span>
                  <span className="text-gray-600">{targets[activeTab].service.advisoryVsCompliance || '0% / 0%'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">New Services Launched</span>
                  <span className="text-gray-600">{targets[activeTab].service.newServices || '0'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Tech Stack Maturity Score</span>
                  <span className="text-gray-600">{targets[activeTab].service.techMaturity || '0'}/10</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Delivery Model Score</span>
                  <span className="text-gray-600">{targets[activeTab].service.deliveryModel || '0'}/10</span>
                </div>
                <Dialog open={dialogOpen.service} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, service: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      {showResults ? 'Enter Results' : 'Set Service Model Targets'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{showResults ? 'Enter Results' : 'Set Targets'} - Service Model ({activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan)</DialogTitle>
                      <DialogDescription>
                        {showResults ? 'Enter actual service model performance results' : 'Set your service model evolution targets'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="advisory-compliance">Advisory vs Compliance %</Label>
                          <Input
                            id="advisory-compliance"
                            type="text"
                            value={showResults ? results[activeTab].service.advisoryVsCompliance : targets[activeTab].service.advisoryVsCompliance}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  service: { ...prev[activeTab].service, advisoryVsCompliance: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 60% / 40%"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="new-services">New Services Launched</Label>
                          <Input
                            id="new-services"
                            type="number"
                            value={showResults ? results[activeTab].service.newServices : targets[activeTab].service.newServices}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  service: { ...prev[activeTab].service, newServices: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 3"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="tech-maturity">Tech Stack Maturity Score (1-10)</Label>
                          <Input
                            id="tech-maturity"
                            type="number"
                            min="1"
                            max="10"
                            value={showResults ? results[activeTab].service.techMaturity : targets[activeTab].service.techMaturity}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  service: { ...prev[activeTab].service, techMaturity: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 7"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="delivery-model">Delivery Model Score (1-10)</Label>
                          <Input
                            id="delivery-model"
                            type="number"
                            min="1"
                            max="10"
                            value={showResults ? results[activeTab].service.deliveryModel : targets[activeTab].service.deliveryModel}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  service: { ...prev[activeTab].service, deliveryModel: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 8"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, service: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                          onClick={() => {
                            const data = showResults ? results[activeTab].service : targets[activeTab].service;
                            console.log('Service model saved:', data);
                            setDialogOpen(prev => ({ ...prev, service: false }));
                          }}
                        >
                          Save {showResults ? 'Results' : 'Targets'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Growth Engine & Funnel */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Growth Engine & Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Lead Source Split</span>
                  <span className="text-gray-600">0% / 0% / 0%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Monthly Leads</span>
                  <span className="text-gray-600">0</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Conversion Rate</span>
                  <span className="text-gray-600">0%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Cost per Acquisition</span>
                  <span className="text-gray-600">£0</span>
                </div>
                <Dialog open={dialogOpen.growth} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, growth: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      {showResults ? 'Enter Results' : 'Set Growth Targets'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{showResults ? 'Enter Results' : 'Set Targets'} - Growth Engine ({activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan)</DialogTitle>
                      <DialogDescription>
                        {showResults ? 'Enter actual growth engine performance results' : 'Set your growth funnel and acquisition targets'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="lead-source">Lead Source Split</Label>
                          <Input
                            id="lead-source"
                            type="text"
                            value={showResults ? results[activeTab].growth.leadSource : targets[activeTab].growth.leadSource}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  growth: { ...prev[activeTab].growth, leadSource: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 40% / 30% / 30%"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="monthly-leads">Monthly Leads</Label>
                          <Input
                            id="monthly-leads"
                            type="number"
                            value={showResults ? results[activeTab].growth.monthlyLeads : targets[activeTab].growth.monthlyLeads}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  growth: { ...prev[activeTab].growth, monthlyLeads: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 50"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="conversion-rate">Conversion Rate %</Label>
                          <Input
                            id="conversion-rate"
                            type="number"
                            value={showResults ? results[activeTab].growth.conversionRate : targets[activeTab].growth.conversionRate}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  growth: { ...prev[activeTab].growth, conversionRate: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 20"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cost-per-acquisition">Cost per Acquisition (£)</Label>
                          <Input
                            id="cost-per-acquisition"
                            type="number"
                            value={showResults ? results[activeTab].growth.costPerAcquisition : targets[activeTab].growth.costPerAcquisition}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  growth: { ...prev[activeTab].growth, costPerAcquisition: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 500"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, growth: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                          onClick={() => {
                            const data = showResults ? results[activeTab].growth : targets[activeTab].growth;
                            console.log('Growth engine saved:', data);
                            setDialogOpen(prev => ({ ...prev, growth: false }));
                          }}
                        >
                          Save {showResults ? 'Results' : 'Targets'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Culture, Vision & Values Alignment */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Target className="mr-2" size={20} />
                Culture, Vision & Values Alignment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">% Team Living Core Values</span>
                  <span className="text-gray-600">{targets[activeTab].culture.teamValues || '0'}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Cultural Fit of Clients</span>
                  <span className="text-gray-600">{targets[activeTab].culture.culturalFit || '0'}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Team Engagement Survey Score</span>
                  <span className="text-gray-600">{targets[activeTab].culture.engagementScore || '0'}/10</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Time in Zone of Genius</span>
                  <span className="text-gray-600">{targets[activeTab].culture.zoneOfGenius || '0'}%</span>
                </div>
                <Dialog open={dialogOpen.culture} onOpenChange={(open) => setDialogOpen(prev => ({ ...prev, culture: open }))}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white shadow-md">
                      <Plus className="mr-2" size={16} />
                      {showResults ? 'Enter Results' : 'Set Culture Targets'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{showResults ? 'Enter Results' : 'Set Targets'} - Culture & Values ({activeTab === '1year' ? '1 Year' : activeTab === '3year' ? '3 Year' : '5 Year'} Plan)</DialogTitle>
                      <DialogDescription>
                        {showResults ? 'Enter actual culture and values alignment results' : 'Set your culture and values alignment targets'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="team-values">% Team Living Core Values</Label>
                          <Input
                            id="team-values"
                            type="number"
                            min="0"
                            max="100"
                            value={showResults ? results[activeTab].culture.teamValues : targets[activeTab].culture.teamValues}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  culture: { ...prev[activeTab].culture, teamValues: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 85"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cultural-fit">Cultural Fit of Clients %</Label>
                          <Input
                            id="cultural-fit"
                            type="number"
                            min="0"
                            max="100"
                            value={showResults ? results[activeTab].culture.culturalFit : targets[activeTab].culture.culturalFit}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  culture: { ...prev[activeTab].culture, culturalFit: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 75"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="engagement-score">Team Engagement Survey Score (1-10)</Label>
                          <Input
                            id="engagement-score"
                            type="number"
                            min="1"
                            max="10"
                            value={showResults ? results[activeTab].culture.engagementScore : targets[activeTab].culture.engagementScore}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  culture: { ...prev[activeTab].culture, engagementScore: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 8"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="zone-genius">Time in Zone of Genius %</Label>
                          <Input
                            id="zone-genius"
                            type="number"
                            value={showResults ? results[activeTab].culture.zoneOfGenius : targets[activeTab].culture.zoneOfGenius}
                            onChange={(e) => {
                              const setter = showResults ? setResults : setTargets;
                              setter(prev => ({
                                ...prev,
                                [activeTab]: {
                                  ...prev[activeTab],
                                  culture: { ...prev[activeTab].culture, zoneOfGenius: e.target.value }
                                }
                              }));
                            }}
                            placeholder="e.g., 75"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(prev => ({ ...prev, culture: false }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          className="bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800"
                          onClick={() => {
                            const data = showResults ? results[activeTab].culture : targets[activeTab].culture;
                            console.log('Culture metrics saved:', data);
                            setDialogOpen(prev => ({ ...prev, culture: false }));
                          }}
                        >
                          Save {showResults ? 'Results' : 'Targets'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Archive Section */}
        <div className="mt-8">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-t-lg">
              <CardTitle className="flex items-center">
                <Archive className="mr-2" size={20} />
                Archive & Historical Data
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">Archive Current Targets</h4>
                  <p className="text-sm text-gray-600">Save current targets and results for historical tracking</p>
                </div>
                <Button 
                  onClick={() => {
                    // Archive current targets logic would go here
                    console.log('Archiving current targets...');
                  }}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
                >
                  <Archive className="mr-2" size={16} />
                  Archive Current Plan
                </Button>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800">View Archived Targets</h4>
                    <p className="text-sm text-gray-600">Access previously archived strategic plans</p>
                  </div>
                  <Button 
                    onClick={() => setShowArchive(!showArchive)}
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {showArchive ? 'Hide' : 'Show'} Archive
                  </Button>
                </div>
                
                {showArchive && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded border">
                        <div>
                          <p className="font-medium">Q4 2024 Strategic Plan</p>
                          <p className="text-sm text-gray-600">Archived: 1st January 2025</p>
                        </div>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded border">
                        <div>
                          <p className="font-medium">Q3 2024 Strategic Plan</p>
                          <p className="text-sm text-gray-600">Archived: 1st October 2024</p>
                        </div>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                      <div className="text-center py-2">
                        <Button variant="ghost" size="sm">
                          Load More Archives
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Informational Section */}
        <div className="mt-8 text-center">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <Target className="mx-auto mb-4 h-12 w-12 text-green-400" />
              <h3 className="text-2xl font-semibold mb-2 text-gray-800">Strategic Planning Framework</h3>
              <p className="text-gray-600 mb-4 text-lg">
                Set comprehensive targets across 1, 3, and 5-year horizons. Track financial performance, 
                client metrics, team development, service evolution, growth channels, and cultural alignment.
              </p>
              <p className="text-sm text-gray-500">
                Use the time period tabs above to switch between different planning horizons and set targets for each metric category.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}