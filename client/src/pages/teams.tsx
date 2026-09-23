import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertTeamSchema, type Team, type InsertTeam } from "@shared/schema";
import { Plus, Users, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Teams() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const form = useForm<InsertTeam>({
    resolver: zodResolver(insertTeamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: InsertTeam) => {
      const response = await apiRequest("/api/teams", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team created successfully",
        description: "The new team has been added.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      form.reset();
      setShowForm(false);
    },
    onError: () => {
      toast({
        title: "Error creating team",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertTeam }) => {
      const response = await apiRequest(`/api/teams/${id}`, "PUT", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team updated successfully",
        description: "The team has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setEditingTeam(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error updating team",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/teams/${id}`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team deleted successfully",
        description: "The team has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
    onError: () => {
      toast({
        title: "Error deleting team",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTeam) => {
    if (editingTeam) {
      updateTeamMutation.mutate({ id: editingTeam.id, data });
    } else {
      createTeamMutation.mutate(data);
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    form.reset({
      name: team.name,
      description: team.description || "",
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    deleteTeamMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4 rounded-r-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">TEAM MANAGEMENT</h1>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Team Administration</h2>
            <p className="text-gray-700">Manage your accounting teams and their performance tracking</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-blue-700"
        >
          <Plus className="mr-2" size={16} />
          Add Team
        </Button>
      </div>

      {/* Create Team Form */}
      {showForm && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Create New Team</h3>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input
                  placeholder="e.g. Team Alpha"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  rows={3}
                  placeholder="Brief description of the team's role..."
                  {...form.register("description")}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <Button 
                  type="submit" 
                  disabled={createTeamMutation.isPending}
                  className="bg-primary hover:bg-blue-700"
                >
                  <Plus className="mr-2" size={16} />
                  {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams?.map((team) => (
          <Card key={team.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-primary/10 rounded-lg mr-3">
                    <Users className="text-primary" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                    <p className="text-sm text-gray-500">Team ID: {team.id}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEdit(team)}
                  >
                    <Edit size={14} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Team</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{team.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(team.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {team.description && (
                <p className="text-gray-600 mb-4">{team.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{format(new Date(team.createdAt), "MMM dd, yyyy")}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  View Performance
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teams && teams.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
          <p className="text-gray-500 mb-4">Create your first team to start tracking performance</p>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-primary hover:bg-blue-700"
          >
            <Plus className="mr-2" size={16} />
            Create First Team
          </Button>
        </div>
      )}
    </div>
  );
}