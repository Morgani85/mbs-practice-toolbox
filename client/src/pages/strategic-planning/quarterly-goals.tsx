import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Plus, Edit, Trash2, Clock, User, Target, CheckCircle, Lock } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { QuarterlyGoal, QuarterlyTarget, User as UserType } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Quarter {
  id: number;
  name: string;
  endDate: string;
  targets: QuarterlyTarget[];
}

export default function QuarterlyGoals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch current user
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ['/api/user'],
  });

  const isAdmin = currentUser?.role === 'admin';

  // Fetch quarterly goals
  const { data: quarterlyGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['/api/quarterly-goals'],
  });

  // Fetch quarterly targets
  const { data: quarterlyTargets = [], isLoading: targetsLoading, refetch: refetchTargets } = useQuery({
    queryKey: ['/api/quarterly-targets'],
    staleTime: 0, // Always refetch to get fresh data
    gcTime: 0, // Don't cache the data (renamed from cacheTime in v5)
  });

  // Fetch org members (slim list — available to all roles)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users/members'],
  });

  // Combine goals and targets with proper memoization
  const quarters: Quarter[] = useMemo(() => {
    return quarterlyGoals.map((goal: QuarterlyGoal) => ({
      id: goal.id,
      name: goal.name,
      endDate: goal.endDate,
      targets: quarterlyTargets.filter((target: QuarterlyTarget) => target.quarterlyGoalId === goal.id)
    }));
  }, [quarterlyGoals, quarterlyTargets]);

  // State for UI
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter | null>(null);
  
  // Update selectedQuarter when quarters data changes
  useEffect(() => {
    if (selectedQuarter && quarters.length > 0) {
      const updatedQuarter = quarters.find(q => q.id === selectedQuarter.id);
      if (updatedQuarter) {
        setSelectedQuarter(updatedQuarter);
      }
    }
  }, [quarters, selectedQuarter]);
  const [showNewQuarter, setShowNewQuarter] = useState(false);
  const [newQuarterName, setNewQuarterName] = useState("");
  const [newQuarterEndDate, setNewQuarterEndDate] = useState("");
  const [editingTarget, setEditingTarget] = useState<{ [key: number]: { title: string; details: string; progress: number; personResponsible: number; notes: string; comments: string } }>({});
  const [showNewTarget, setShowNewTarget] = useState(false);
  const [newTargetData, setNewTargetData] = useState({
    title: "",
    details: "",
    progress: 0,
    personResponsible: "",
    notes: "",
    comments: ""
  });
  const [editingQuarter, setEditingQuarter] = useState<{ id: number; name: string; endDate: string } | null>(null);
  const [deleteQuarterId, setDeleteQuarterId] = useState<number | null>(null);

  // Mutations
  const createQuarterMutation = useMutation({
    mutationFn: async (data: { name: string; endDate: string }) => {
      return await apiRequest('/api/quarterly-goals', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-goals'] });
      setShowNewQuarter(false);
      setNewQuarterName("");
      setNewQuarterEndDate("");
    },
    onError: () => {
      toast({
        title: "Permission denied",
        description: "Only administrators can create new quarters. Please contact your admin.",
        variant: "destructive",
      });
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<QuarterlyTarget> }) => {
      const response = await apiRequest(`/api/quarterly-targets/${data.id}`, 'PUT', data.updates);
      return response;
    },
    onSuccess: (data) => {
      // Force immediate refetch to get fresh data from server
      queryClient.refetchQueries({ queryKey: ['/api/quarterly-targets'] });
    },
    onError: (error) => {
      console.error('Update error:', error);
    }
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/quarterly-targets', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-targets'] });
      setShowNewTarget(false);
      setNewTargetData({
        title: "",
        details: "",
        progress: 0,
        personResponsible: "",
        notes: "",
        comments: ""
      });
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/quarterly-targets/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-targets'] });
    },
  });

  const updateQuarterMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; endDate: string }) => {
      return await apiRequest(`/api/quarterly-goals/${data.id}`, 'PUT', { name: data.name, endDate: data.endDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-goals'] });
      setEditingQuarter(null);
    },
  });

  const deleteQuarterMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/quarterly-goals/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quarterly-targets'] });
      setDeleteQuarterId(null);
    },
  });

  // Helper functions
  const getProgressBadge = (progress: number) => {
    const variants = {
      0: { label: "Not Started", color: "bg-gray-100 text-gray-800 border-gray-300" },
      25: { label: "Underway", color: "bg-blue-100 text-blue-800 border-blue-300" },
      50: { label: "Making Progress", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
      75: { label: "Closing In", color: "bg-orange-100 text-orange-800 border-orange-300" },
      95: { label: "Very Close", color: "bg-purple-100 text-purple-800 border-purple-300" },
      100: { label: "Done", color: "bg-green-100 text-green-800 border-green-300" }
    };
    const variant = variants[progress as keyof typeof variants] || variants[0];
    return <Badge className={`${variant.color} border font-medium`}>{variant.label}</Badge>;
  };

  const getProgressColor = (progress: number) => {
    if (progress === 0) return "bg-gray-200";
    if (progress <= 25) return "bg-blue-400";
    if (progress <= 50) return "bg-yellow-400";
    if (progress <= 75) return "bg-orange-400";
    if (progress <= 95) return "bg-purple-400";
    return "bg-green-400";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: "Ended", urgent: false };
    if (diffDays === 0) return { text: "Due today", urgent: true };
    if (diffDays === 1) return { text: "1 day remaining", urgent: true };
    if (diffDays <= 7) return { text: `${diffDays} days remaining`, urgent: true };
    return { text: `${diffDays} days remaining`, urgent: false };
  };

  const getUserName = (userId: number) => {
    const user = users.find((u: UserType) => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : "Unknown";
  };

  const getLastUpdated = (lastUpdated?: string) => {
    if (!lastUpdated) return "Never";
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB');
  };

  const handleCreateQuarter = () => {
    if (newQuarterName.trim() && newQuarterEndDate) {
      createQuarterMutation.mutate({
        name: newQuarterName,
        endDate: newQuarterEndDate
      });
    }
  };

  const handleUpdateTarget = (target: QuarterlyTarget, field: string, value: any) => {
    updateTargetMutation.mutate({
      id: target.id,
      updates: { [field]: value }
    });
  };

  const handleProgressChange = (target: QuarterlyTarget, newProgress: string) => {
    const progressValue = parseInt(newProgress);
    updateTargetMutation.mutate({
      id: target.id,
      updates: { progress: progressValue }
    });
  };

  const startEditingTarget = (target: QuarterlyTarget) => {
    setEditingTarget(prev => ({
      ...prev,
      [target.id]: {
        title: target.title,
        details: target.details || "",
        progress: target.progress,
        personResponsible: target.personResponsible,
        notes: target.notes || "",
        comments: target.comments || ""
      }
    }));
  };

  const cancelEditingTarget = (targetId: number) => {
    setEditingTarget(prev => {
      const newState = { ...prev };
      delete newState[targetId];
      return newState;
    });
  };

  const saveTargetChanges = async (target: QuarterlyTarget) => {
    const editData = editingTarget[target.id];
    if (editData) {
      try {
        await updateTargetMutation.mutateAsync({
          id: target.id,
          updates: {
            title: editData.title,
            details: editData.details,
            progress: editData.progress,
            personResponsible: editData.personResponsible,
            notes: editData.notes,
            comments: editData.comments
          }
        });
        
        // Only cancel editing after successful save
        cancelEditingTarget(target.id);
        
      } catch (error) {
        console.error('Failed to save changes:', error);
      }
    }
  };

  const updateEditingTarget = (targetId: number, field: string, value: any) => {
    setEditingTarget(prev => ({
      ...prev,
      [targetId]: {
        ...prev[targetId],
        [field]: value
      }
    }));
  };

  const handleCreateTarget = () => {
    if (selectedQuarter && newTargetData.title.trim()) {
      createTargetMutation.mutate({
        quarterlyGoalId: selectedQuarter.id,
        title: newTargetData.title,
        details: newTargetData.details,
        progress: newTargetData.progress,
        personResponsible: parseInt(newTargetData.personResponsible) || currentUser?.id,
        notes: newTargetData.notes,
        comments: newTargetData.comments
      });
    }
  };

  if (goalsLoading || targetsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/strategic-planning">
              <Button variant="ghost" size="sm" className="hover:bg-white/80">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Strategic Planning
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quarterly Goals</h1>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedQuarter) {
    const timeRemaining = getTimeRemaining(selectedQuarter.endDate);
    const completedTargets = selectedQuarter.targets.filter(t => t.progress === 100).length;
    const totalTargets = selectedQuarter.targets.length;
    const completionPercentage = totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" onClick={() => setSelectedQuarter(null)} className="hover:bg-white/80">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quarters
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{selectedQuarter.name}</h1>
              <div className="flex items-center gap-6 text-sm text-gray-600 mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Due: {formatDate(selectedQuarter.endDate)}
                </span>
                <span className={`flex items-center gap-1 ${timeRemaining.urgent ? 'text-red-600 font-medium' : ''}`}>
                  <Clock className="h-4 w-4" />
                  {timeRemaining.text}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {completionPercentage}% Complete ({completedTargets}/{totalTargets})
                </span>
              </div>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Quarter Progress</h2>
              <div className="text-sm text-gray-600">{completedTargets} of {totalTargets} targets completed</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="grid gap-6">
            {selectedQuarter.targets.map((target) => (
              <Card key={target.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 bg-white">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {editingTarget[target.id] ? (
                          <Input
                            value={editingTarget[target.id].title}
                            onChange={(e) => updateEditingTarget(target.id, 'title', e.target.value)}
                            className="text-lg font-semibold border-2 border-blue-200 focus:border-blue-400"
                            placeholder="Target title"
                          />
                        ) : (
                          <CardTitle className="text-lg text-gray-900">{target.title}</CardTitle>
                        )}
                        {target.progress === 100 && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                      {editingTarget[target.id] ? (
                        <Input
                          value={editingTarget[target.id].details}
                          onChange={(e) => updateEditingTarget(target.id, 'details', e.target.value)}
                          className="text-gray-600 border-2 border-blue-200 focus:border-blue-400"
                          placeholder="Target details"
                        />
                      ) : (
                        <p className="text-gray-600">{target.details}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getProgressBadge(editingTarget[target.id]?.progress ?? target.progress)}
                      {editingTarget[target.id] ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveTargetChanges(target)}
                            className="text-xs bg-blue-50 hover:bg-blue-100"
                            disabled={updateTargetMutation.isPending}
                          >
                            {updateTargetMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelEditingTarget(target.id)}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingTarget(target)}
                            className="text-xs"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTargetMutation.mutate(target.id)}
                            className="hover:bg-red-50 hover:text-red-600"
                            disabled={deleteTargetMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Progress</Label>
                      <div className="mt-1 space-y-2">
                        {editingTarget[target.id] ? (
                          <Select
                            value={editingTarget[target.id].progress.toString()}
                            onValueChange={(value) => updateEditingTarget(target.id, 'progress', parseInt(value))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Not Started</SelectItem>
                              <SelectItem value="25">Underway</SelectItem>
                              <SelectItem value="50">Making Progress</SelectItem>
                              <SelectItem value="75">Closing In</SelectItem>
                              <SelectItem value="95">Very Close</SelectItem>
                              <SelectItem value="100">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              {target.progress === 0 ? "Not Started" :
                               target.progress === 25 ? "Underway" :
                               target.progress === 50 ? "Making Progress" :
                               target.progress === 75 ? "Closing In" :
                               target.progress === 95 ? "Very Close" :
                               target.progress === 100 ? "Done" : "Unknown"}
                            </p>
                          </div>
                        )}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`${getProgressColor(editingTarget[target.id]?.progress ?? target.progress)} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${editingTarget[target.id]?.progress ?? target.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Person Responsible</Label>
                      {editingTarget[target.id] ? (
                        <Select
                          value={editingTarget[target.id].personResponsible.toString()}
                          onValueChange={(value) => updateEditingTarget(target.id, 'personResponsible', parseInt(value))}
                        >
                          <SelectTrigger className="mt-1 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user: UserType) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-900">{getUserName(target.personResponsible)}</span>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700">Notes</Label>
                      {editingTarget[target.id] ? (
                        <Textarea
                          value={editingTarget[target.id].notes}
                          onChange={(e) => updateEditingTarget(target.id, 'notes', e.target.value)}
                          placeholder="Add notes..."
                          className="mt-1 min-h-[60px] resize-none"
                        />
                      ) : (
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg min-h-[60px] flex items-start">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {target.notes || "No notes added yet."}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-gray-700">Comments</Label>
                      {editingTarget[target.id] ? (
                        <Textarea
                          value={editingTarget[target.id].comments}
                          onChange={(e) => updateEditingTarget(target.id, 'comments', e.target.value)}
                          placeholder="Add progress comments..."
                          className="mt-1 min-h-[80px] resize-none"
                        />
                      ) : (
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg min-h-[80px] flex items-start">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {target.comments || "No comments added yet."}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        Last updated: {getLastUpdated(target.lastUpdated)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {showNewTarget && (
              <Card className="bg-white border-2 border-dashed border-gray-300">
                <CardHeader>
                  <CardTitle className="text-gray-900">Add New Target</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newTargetData.title}
                        onChange={(e) => setNewTargetData({...newTargetData, title: e.target.value})}
                        placeholder="Target title"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="details">Details</Label>
                      <Input
                        id="details"
                        value={newTargetData.details}
                        onChange={(e) => setNewTargetData({...newTargetData, details: e.target.value})}
                        placeholder="Target details"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="progress">Progress</Label>
                      <Select
                        value={newTargetData.progress.toString()}
                        onValueChange={(value) => setNewTargetData({...newTargetData, progress: parseInt(value)})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Not Started</SelectItem>
                          <SelectItem value="25">Underway</SelectItem>
                          <SelectItem value="50">Making Progress</SelectItem>
                          <SelectItem value="75">Closing In</SelectItem>
                          <SelectItem value="95">Very Close</SelectItem>
                          <SelectItem value="100">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="person">Person Responsible</Label>
                      <Select
                        value={newTargetData.personResponsible}
                        onValueChange={(value) => setNewTargetData({...newTargetData, personResponsible: value})}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user: UserType) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newTargetData.notes}
                        onChange={(e) => setNewTargetData({...newTargetData, notes: e.target.value})}
                        placeholder="Additional notes..."
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="comments">Comments</Label>
                      <Textarea
                        id="comments"
                        value={newTargetData.comments}
                        onChange={(e) => setNewTargetData({...newTargetData, comments: e.target.value})}
                        placeholder="Initial comments..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <Button 
                      onClick={handleCreateTarget} 
                      disabled={!newTargetData.title.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Create Target
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewTarget(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!showNewTarget && (
              <Button
                onClick={() => setShowNewTarget(true)}
                className="w-full py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Target
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/strategic-planning">
            <Button variant="ghost" size="sm" className="hover:bg-white/80">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategic Planning
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quarterly Goals</h1>
            <p className="text-gray-600">Set and track quarterly business goals and milestones</p>
          </div>
        </div>

        <div className="grid gap-6">
          {quarters.map((quarter) => {
            const timeRemaining = getTimeRemaining(quarter.endDate);
            const completedTargets = quarter.targets.filter(t => t.progress === 100).length;
            const totalTargets = quarter.targets.length;
            const completionPercentage = totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0;
            const isEditing = editingQuarter?.id === quarter.id;

            if (isEditing) {
              return (
                <Card key={quarter.id} className="bg-white border-l-4 border-l-blue-500">
                  <CardHeader className="pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-name-${quarter.id}`}>Quarter Name</Label>
                        <Input
                          id={`edit-name-${quarter.id}`}
                          value={editingQuarter.name}
                          onChange={(e) => setEditingQuarter({ ...editingQuarter, name: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-date-${quarter.id}`}>End Date</Label>
                        <Input
                          id={`edit-date-${quarter.id}`}
                          type="date"
                          value={editingQuarter.endDate}
                          onChange={(e) => setEditingQuarter({ ...editingQuarter, endDate: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => updateQuarterMutation.mutate(editingQuarter)}
                        disabled={updateQuarterMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {updateQuarterMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingQuarter(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            }

            return (
              <Card key={quarter.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 bg-white border-l-4 border-l-blue-500" onClick={() => setSelectedQuarter(quarter)}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl text-gray-900 mb-2">{quarter.name}</CardTitle>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Due: {formatDate(quarter.endDate)}
                        </span>
                        <span className={`flex items-center gap-1 ${timeRemaining.urgent ? 'text-red-600 font-medium' : ''}`}>
                          <Clock className="h-4 w-4" />
                          {timeRemaining.text}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          {quarter.targets.length} targets
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingQuarter({ id: quarter.id, name: quarter.name, endDate: quarter.endDate });
                            }}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteQuarterId(quarter.id);
                            }}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{completionPercentage}% Complete</div>
                        <div className="text-xs text-gray-500">{completedTargets} / {totalTargets} targets</div>
                      </div>
                      <div className="w-16 h-16 relative">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="text-gray-200" />
                          <circle 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            fill="none" 
                            strokeDasharray={`${completionPercentage * 0.628} 62.8`}
                            className="text-blue-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-900">{completionPercentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}

          {showNewQuarter && (
            <Card className="bg-white border-2 border-dashed border-gray-300">
              <CardHeader>
                <CardTitle className="text-gray-900">Add New Quarter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quarter-name">Quarter Name</Label>
                    <Input
                      id="quarter-name"
                      value={newQuarterName}
                      onChange={(e) => setNewQuarterName(e.target.value)}
                      placeholder="e.g., Q1 2026"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={newQuarterEndDate}
                      onChange={(e) => setNewQuarterEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button 
                    onClick={handleCreateQuarter} 
                    disabled={!newQuarterName.trim() || !newQuarterEndDate}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Create Quarter
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewQuarter(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!showNewQuarter && (
            isAdmin ? (
              <Button
                onClick={() => setShowNewQuarter(true)}
                className="w-full py-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all duration-200"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Quarter
              </Button>
            ) : (
              <div className="w-full py-4 px-6 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center gap-3 text-gray-500">
                <Lock className="h-4 w-4 shrink-0" />
                <span className="text-sm">Only administrators can add new quarters. Contact your admin to set up a new quarter.</span>
              </div>
            )
          )}
        </div>
      </div>

      <AlertDialog open={deleteQuarterId !== null} onOpenChange={() => setDeleteQuarterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quarter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this quarter and all its targets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuarterId && deleteQuarterMutation.mutate(deleteQuarterId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteQuarterMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}