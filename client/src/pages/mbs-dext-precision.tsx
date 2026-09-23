import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/use-users";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMbsDextPrecisionSchema, withWeekEndingValidation, type Team, type MbsDextPrecision, type InsertMbsDextPrecision } from "@shared/schema";
import { Save, Target, AlertCircle, CheckCircle, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { validateWeekEndingDateClient } from "@/lib/utils";
import { useOrgSettings } from "@/hooks/use-org-settings";

export default function MbsDextPrecision() {
  const { toast } = useToast();
  const { getUserName } = useUsers();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [editingEntry, setEditingEntry] = useState<MbsDextPrecision | null>(null);
  const { platformName, bookkeepingUpperThreshold, bookkeepingLowerThreshold } = useOrgSettings();

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: dextPrecisionData } = useQuery<MbsDextPrecision[]>({
    queryKey: ["/api/mbs-dext-precision", selectedTeam],
    queryFn: async () => {
      const url = selectedTeam 
        ? `/api/mbs-dext-precision?teamId=${selectedTeam}`
        : "/api/mbs-dext-precision";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
  });

  const form = useForm<InsertMbsDextPrecision>({
    resolver: zodResolver(withWeekEndingValidation(insertMbsDextPrecisionSchema)),
    defaultValues: {
      teamId: 0,
      weekEnding: "",
      clientsBelow85Percent: 0,
      clientsBelow70Percent: 0,
      lowestScoreClientDetails: "",
    },
  });

  // Update form when team, week, or editing entry changes
  useEffect(() => {
    if (selectedTeam && selectedWeek) {
      const existing = dextPrecisionData?.find(
        (item) => item.teamId === selectedTeam && item.weekEnding === selectedWeek
      );
      
      form.reset({
        teamId: selectedTeam,
        weekEnding: selectedWeek,
        clientsBelow85Percent: existing?.clientsBelow85Percent || 0,
        clientsBelow70Percent: existing?.clientsBelow70Percent || 0,
        lowestScoreClientDetails: existing?.lowestScoreClientDetails || "",
      });
    }
  }, [selectedTeam, selectedWeek, dextPrecisionData, form]);

  // Update form when editing an entry
  useEffect(() => {
    if (editingEntry) {
      setSelectedTeam(editingEntry.teamId);
      setSelectedWeek(editingEntry.weekEnding);
      form.reset({
        teamId: editingEntry.teamId,
        weekEnding: editingEntry.weekEnding,
        clientsBelow85Percent: editingEntry.clientsBelow85Percent,
        clientsBelow70Percent: editingEntry.clientsBelow70Percent || 0,
        lowestScoreClientDetails: editingEntry.lowestScoreClientDetails,
      });
    }
  }, [editingEntry, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertMbsDextPrecision) => {
      const response = await apiRequest("/api/mbs-dext-precision", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "BK Quality Score data saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mbs-dext-precision"] });
      setEditingEntry(null);
      form.reset();
      setSelectedWeek("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save BK Quality Score data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/mbs-dext-precision/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "BK Quality Score entry deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mbs-dext-precision"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMbsDextPrecision) => {
    // Validate the weekEnding date
    const validation = validateWeekEndingDateClient(data.weekEnding);
    if (!validation.isValid) {
      toast({
        title: "Invalid date",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const handleEdit = (entry: MbsDextPrecision) => {
    setEditingEntry(entry);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    form.reset();
    setSelectedWeek("");
  };

  // Get all entries for display (filtered by selected team if applicable)
  const displayEntries = dextPrecisionData || [];

  return (
    <div className="space-y-8">
      <div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-md">
          <h1 className="text-3xl font-bold text-blue-900 mb-1">INTERNAL BOOKKEEPING MODULE</h1>
          <h2 className="text-xl font-semibold text-blue-800 mb-2">BK Quality Score</h2>
          <p className="text-blue-700">Track clients with {platformName} scores below {bookkeepingUpperThreshold}% and identify lowest scoring clients</p>
        </div>
        <div className="flex items-center space-x-4 mb-6">
          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <ArrowLeft size={16} />
              <span>Back to Main Menu</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>{editingEntry ? "Edit" : "Enter"} BK Quality Score Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="teamId">Team</Label>
                <Select
                  value={selectedTeam?.toString() || ""}
                  onValueChange={(value) => setSelectedTeam(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="weekEnding">Week Ending Date</Label>
                <Input
                  type="date"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="clientsBelow85Percent">{platformName} score below {bookkeepingUpperThreshold}% — number of clients</Label>
                <Input
                  type="number"
                  min="0"
                  {...form.register("clientsBelow85Percent", { valueAsNumber: true })}
                  placeholder={`Enter number of clients below ${bookkeepingUpperThreshold}%`}
                />
                {form.formState.errors.clientsBelow85Percent && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.clientsBelow85Percent.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="clientsBelow70Percent">{platformName} score below {bookkeepingLowerThreshold}% — number of clients</Label>
                <Input
                  type="number"
                  min="0"
                  {...form.register("clientsBelow70Percent", { valueAsNumber: true })}
                  placeholder={`Enter number of clients below ${bookkeepingLowerThreshold}%`}
                />
                {form.formState.errors.clientsBelow70Percent && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.clientsBelow70Percent.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="lowestScoreClientDetails">Name & score of lowest score client</Label>
                <Textarea
                  {...form.register("lowestScoreClientDetails")}
                  placeholder="Enter client name and their score (e.g., 'ABC Company - 67%')"
                  className="resize-none"
                  rows={3}
                />
                {form.formState.errors.lowestScoreClientDetails && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.lowestScoreClientDetails.message}
                  </p>
                )}
              </div>

              <div className="flex space-x-2">
                <Button 
                  type="submit" 
                  disabled={mutation.isPending || !selectedTeam || !selectedWeek}
                  className="flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{mutation.isPending ? "Saving..." : editingEntry ? "Update" : "Save"}</span>
                </Button>
                {editingEntry && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* All Entries */}
        <Card>
          <CardHeader>
            <CardTitle>All Entries ({displayEntries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {displayEntries.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No entries found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Select a team and start entering BK Quality Score data
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {displayEntries.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">
                          {teams?.find(t => t.id === entry.teamId)?.name || 'Unknown Team'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Week ending: {format(new Date(entry.weekEnding), "MMM dd, yyyy")}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this BK Quality Score entry? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(entry.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Clients below {bookkeepingUpperThreshold}%:</span>
                        <span className="font-medium">{entry.clientsBelow85Percent}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Lowest score client:</span>
                        <div className="mt-1 text-sm bg-gray-50 p-2 rounded">
                          {entry.lowestScoreClientDetails || "No details provided"}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>Submitted by: <span className="font-medium">{getUserName((entry as any).submittedBy)}</span></span>
                        <span>{(entry as any).updatedAt ? new Date((entry as any).updatedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}