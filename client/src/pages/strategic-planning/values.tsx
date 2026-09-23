import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Heart, Plus, Edit, Save, X, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

// Types for values and principles
interface Value {
  id: number;
  title: string;
  description: string;
  type: 'core_value' | 'principle';
  colorScheme: string;
  createdAt: string;
  updatedAt: string;
}

// Form validation schemas
const valueSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  colorScheme: z.string().min(1, "Color scheme is required")
});

type ValueFormData = z.infer<typeof valueSchema>;

const colorSchemes = [
  { name: 'Blue', value: 'blue', bgClass: 'bg-blue-50', borderClass: 'border-blue-500', titleClass: 'text-blue-900', descClass: 'text-blue-700' },
  { name: 'Green', value: 'green', bgClass: 'bg-green-50', borderClass: 'border-green-500', titleClass: 'text-green-900', descClass: 'text-green-700' },
  { name: 'Purple', value: 'purple', bgClass: 'bg-purple-50', borderClass: 'border-purple-500', titleClass: 'text-purple-900', descClass: 'text-purple-700' },
  { name: 'Orange', value: 'orange', bgClass: 'bg-orange-50', borderClass: 'border-orange-500', titleClass: 'text-orange-900', descClass: 'text-orange-700' },
  { name: 'Teal', value: 'teal', bgClass: 'bg-teal-50', borderClass: 'border-teal-500', titleClass: 'text-teal-900', descClass: 'text-teal-700' },
  { name: 'Red', value: 'red', bgClass: 'bg-red-50', borderClass: 'border-red-500', titleClass: 'text-red-900', descClass: 'text-red-700' },
];

export default function Values() {
  const queryClient = useQueryClient();
  const [editingValues, setEditingValues] = useState(false);
  const [editingPrinciples, setEditingPrinciples] = useState(false);
  const [showAddValueDialog, setShowAddValueDialog] = useState(false);
  const [showAddPrincipleDialog, setShowAddPrincipleDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Value | null>(null);

  // Fetch values and principles
  const { data: values = [], isLoading: valuesLoading } = useQuery({
    queryKey: ['/api/values'],
    queryFn: async () => {
      const response = await fetch('/api/values');
      if (!response.ok) throw new Error('Failed to fetch values');
      return response.json();
    }
  });

  const coreValues = values.filter((v: Value) => v.type === 'core_value');
  const principles = values.filter((v: Value) => v.type === 'principle');

  // Mutations
  const createValueMutation = useMutation({
    mutationFn: async (data: ValueFormData & { type: 'core_value' | 'principle' }) => {
      return await apiRequest('/api/values', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/values'] });
      setShowAddValueDialog(false);
      setShowAddPrincipleDialog(false);
    }
  });

  const updateValueMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<ValueFormData> }) => {
      return await apiRequest(`/api/values/${data.id}`, 'PUT', data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/values'] });
      setEditingItem(null);
    }
  });

  const deleteValueMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/values/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/values'] });
    }
  });

  const getColorClasses = (colorScheme: string) => {
    return colorSchemes.find(c => c.value === colorScheme) || colorSchemes[0];
  };

  const ValueForm = ({ value, type, onSubmit, onCancel }: { 
    value?: Value, 
    type: 'core_value' | 'principle', 
    onSubmit: (data: ValueFormData) => void,
    onCancel: () => void
  }) => {
    const form = useForm<ValueFormData>({
      resolver: zodResolver(valueSchema),
      defaultValues: {
        title: value?.title || '',
        description: value?.description || '',
        colorScheme: value?.colorScheme || 'blue'
      }
    });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="colorScheme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color Scheme</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {colorSchemes.map((scheme) => (
                    <div 
                      key={scheme.value}
                      className={`p-2 rounded border-2 cursor-pointer ${
                        field.value === scheme.value ? 'border-gray-800' : 'border-gray-200'
                      } ${scheme.bgClass}`}
                      onClick={() => field.onChange(scheme.value)}
                    >
                      <div className={`font-medium ${scheme.titleClass}`}>{scheme.name}</div>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex gap-2">
            <Button type="submit" disabled={createValueMutation.isPending || updateValueMutation.isPending}>
              <Save className="mr-2" size={16} />
              {value ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-2" size={16} />
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  const ValueCard = ({ value, isEditing, onEdit, onDelete }: { 
    value: Value, 
    isEditing: boolean, 
    onEdit: () => void,
    onDelete: () => void
  }) => {
    const colors = getColorClasses(value.colorScheme);
    
    if (isEditing && editingItem?.id === value.id) {
      return (
        <div className={`p-4 ${colors.bgClass} rounded-lg border-l-4 ${colors.borderClass}`}>
          <ValueForm 
            value={value}
            type={value.type}
            onSubmit={(data) => {
              updateValueMutation.mutate({ id: value.id, updates: data });
            }}
            onCancel={() => setEditingItem(null)}
          />
        </div>
      );
    }
    
    return (
      <div className={`p-4 ${colors.bgClass} rounded-lg border-l-4 ${colors.borderClass}`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className={`font-semibold ${colors.titleClass}`}>{value.title}</h4>
            <p className={`text-sm mt-1 ${colors.descClass}`}>{value.description}</p>
          </div>
          {isEditing && (
            <div className="flex gap-1 ml-2">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-800">
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (valuesLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading values...</div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
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
            <Heart className="mr-3 text-blue-600" size={32} />
            <h1 className="text-4xl font-bold text-gray-900">Organisational Values</h1>
          </div>
          <p className="text-lg text-gray-600">Define and manage organisational values and cultural principles</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Core Values Section */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Heart className="mr-2" size={20} />
                  Core Values
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditingValues(!editingValues)}
                  className="text-white hover:bg-blue-800"
                >
                  <Edit className="mr-2" size={16} />
                  {editingValues ? 'Done' : 'Edit'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
            <div className="space-y-4">
              {coreValues.map((value) => (
                <ValueCard
                  key={value.id}
                  value={value}
                  isEditing={editingValues}
                  onEdit={() => setEditingItem(value)}
                  onDelete={() => deleteValueMutation.mutate(value.id)}
                />
              ))}
              
              {coreValues.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No core values yet. Add your first value below.
                </div>
              )}
              
              <Dialog open={showAddValueDialog} onOpenChange={setShowAddValueDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md">
                    <Plus className="mr-2" size={16} />
                    Add Core Value
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Core Value</DialogTitle>
                  </DialogHeader>
                  <ValueForm 
                    type="core_value"
                    onSubmit={(data) => {
                      createValueMutation.mutate({ ...data, type: 'core_value' });
                    }}
                    onCancel={() => setShowAddValueDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

          {/* Underlying Principles Section */}
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Heart className="mr-2" size={20} />
                  Underlying Principles
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditingPrinciples(!editingPrinciples)}
                  className="text-white hover:bg-purple-800"
                >
                  <Edit className="mr-2" size={16} />
                  {editingPrinciples ? 'Done' : 'Edit'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
            <div className="space-y-4">
              {principles.map((principle) => (
                <ValueCard
                  key={principle.id}
                  value={principle}
                  isEditing={editingPrinciples}
                  onEdit={() => setEditingItem(principle)}
                  onDelete={() => deleteValueMutation.mutate(principle.id)}
                />
              ))}
              
              {principles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No underlying principles yet. Add your first principle below.
                </div>
              )}
              
              <Dialog open={showAddPrincipleDialog} onOpenChange={setShowAddPrincipleDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md">
                    <Plus className="mr-2" size={16} />
                    Add Principle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Underlying Principle</DialogTitle>
                  </DialogHeader>
                  <ValueForm 
                    type="principle"
                    onSubmit={(data) => {
                      createValueMutation.mutate({ ...data, type: 'principle' });
                    }}
                    onCancel={() => setShowAddPrincipleDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
            </CardContent>
          </Card>
        </div>

        {/* Informational Section */}
        <div className="mt-8 text-center">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <Heart className="mx-auto mb-4 h-12 w-12 text-blue-400" />
              <h3 className="text-2xl font-semibold mb-2 text-gray-800">Organisational Values</h3>
              <p className="text-gray-600 mb-4 text-lg">
                This section helps you define and communicate your organisation's core values. 
                Create a strong foundation for your company culture and decision-making.
              </p>
              <p className="text-sm text-gray-500">
                Click the Edit buttons above to start adding your values and principles.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}