import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Users, UserPlus, CheckCircle, ArrowRight, ArrowLeft, Phone, MapPin, Globe, SlidersHorizontal } from "lucide-react";

const steps = [
  { id: 1, title: "Your Practice", description: "Tell us about your firm", icon: Building2 },
  { id: 2, title: "First Team", description: "Create your first team or pod", icon: Users },
  { id: 3, title: "Practice Standards", description: "Set your performance thresholds", icon: SlidersHorizontal },
  { id: 4, title: "Invite Team", description: "Invite your first team member", icon: UserPlus },
];

const PRACTICE_TYPES = [
  "General Practice",
  "Tax Specialist",
  "Audit & Assurance",
  "Payroll & HR",
  "Bookkeeping",
  "Business Advisory",
  "Corporate Finance",
  "Mixed Practice",
  "Other",
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const org = (user as any)?.organisation;

  const [step, setStep] = useState(1);

  // Step 1 — practice details
  const [firmName, setFirmName] = useState(org?.name || "");
  const [phone, setPhone] = useState(org?.phone || "");
  const [address, setAddress] = useState(org?.address || "");
  const [city, setCity] = useState(org?.city || "");
  const [postcode, setPostcode] = useState(org?.postcode || "");
  const [website, setWebsite] = useState(org?.website || "");
  const [practiceType, setPracticeType] = useState(org?.practiceType || "");

  // Sync state once org data loads (org may not be available on first render)
  useEffect(() => {
    if (org?.name && !firmName) setFirmName(org.name);
    if (org?.phone && !phone) setPhone(org.phone);
    if (org?.address && !address) setAddress(org.address);
    if (org?.city && !city) setCity(org.city);
    if (org?.postcode && !postcode) setPostcode(org.postcode);
    if (org?.website && !website) setWebsite(org.website);
    if (org?.practiceType && !practiceType) setPracticeType(org.practiceType);
  }, [org]);

  // Step 2 — team creation
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  // Step 3 — practice standards
  const [vatCompletionDay, setVatCompletionDay] = useState(28);
  const [mgmtAccountsDay, setMgmtAccountsDay] = useState(15);
  const [bookkeepingUpperThreshold, setBookkeepingUpperThreshold] = useState(85);
  const [bookkeepingLowerThreshold, setBookkeepingLowerThreshold] = useState(70);
  const [bookkeepingPlatform, setBookkeepingPlatform] = useState("Dext Precision");
  const [bookkeepingPlatformCustom, setBookkeepingPlatformCustom] = useState("");

  // Step 4 — invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/organisation", "PUT", {
        name: firmName.trim() || org?.name,
        phone: phone || null,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        website: website || null,
        practiceType: practiceType || null,
      });
      if (!res.ok) throw new Error("Failed to update practice details");
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save practice details.", variant: "destructive" });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/onboarding/team", "POST", { name: teamName, description: teamDescription });
      if (!res.ok) throw new Error("Failed to create team");
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create team.", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/users/invite", "POST", {
        email: inviteEmail,
        firstName: inviteFirstName,
        lastName: inviteLastName,
        role: "user",
        organisationId: user?.organisationId,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send invitation");
      }
      return res.json();
    },
    onError: (err: Error) => {
      toast({ title: "Invitation failed", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/onboarding/complete", "POST", {});
      if (!res.ok) throw new Error("Failed to complete onboarding");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete setup.", variant: "destructive" });
    },
  });

  const handleStep1Next = async () => {
    const nameToUse = firmName.trim() || org?.name?.trim();
    if (!nameToUse) {
      toast({ title: "Required", description: "Please enter your firm name.", variant: "destructive" });
      return;
    }
    if (!firmName.trim()) setFirmName(nameToUse);
    await updateOrgMutation.mutateAsync();
    setStep(2);
  };

  const handleStep2Next = async () => {
    if (!teamName.trim()) {
      toast({ title: "Required", description: "Please enter a team name.", variant: "destructive" });
      return;
    }
    await createTeamMutation.mutateAsync();
    setStep(3);
  };

  const handleStep2Skip = () => setStep(3);

  const saveStandardsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/organisation", "PUT", {
        vatCompletionDay,
        mgmtAccountsDay,
        bookkeepingUpperThreshold,
        bookkeepingLowerThreshold,
        bookkeepingPlatform,
        bookkeepingPlatformCustom: bookkeepingPlatformCustom || null,
      });
      if (!res.ok) throw new Error("Failed to save practice standards");
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save practice standards.", variant: "destructive" });
    },
  });

  const handleStep3Next = async () => {
    await saveStandardsMutation.mutateAsync();
    setStep(4);
  };

  const handleStep3Skip = () => setStep(4);

  const handleStep4Invite = async () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      toast({ title: "Required", description: "Please fill in all fields to send an invitation.", variant: "destructive" });
      return;
    }
    await inviteMutation.mutateAsync();
    toast({ title: "Invitation sent!", description: `An invitation email has been sent to ${inviteEmail}.` });
    completeMutation.mutate();
  };

  const handleFinish = () => {
    completeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold text-sm transition-all ${
                  step > s.id ? 'bg-green-500 border-green-500 text-white' :
                  step === s.id ? 'bg-blue-600 border-blue-600 text-white' :
                  'bg-white border-gray-300 text-gray-400'
                }`}>
                  {step > s.id ? <CheckCircle className="h-5 w-5" /> : s.id}
                </div>
                <div className="ml-3 hidden sm:block">
                  <p className={`text-sm font-medium ${step >= s.id ? 'text-gray-900' : 'text-gray-400'}`}>{s.title}</p>
                  <p className={`text-xs ${step >= s.id ? 'text-gray-500' : 'text-gray-300'}`}>{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${step > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Practice Details */}
        {step === 1 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Tell us about your practice</CardTitle>
                  <CardDescription>This information helps us set up your account and will appear throughout Practice Toolbox.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Firm name confirmation + practice type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Firm Name</Label>
                  <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700 font-medium">
                    {firmName}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Set when you created your account. You can change this later in settings.</p>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="practiceType">Type of Practice</Label>
                  <Select value={practiceType} onValueChange={setPracticeType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a practice type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Contact Details</span>
                  <span className="text-xs text-gray-400">(optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 01234 567890"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <div className="relative mt-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="www.yourfirm.co.uk"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Office Address</span>
                  <span className="text-xs text-gray-400">(optional)</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 12 High Street"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">Town / City</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Manchester"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        placeholder="e.g. M1 1AE"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleStep1Next}
                  disabled={updateOrgMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 px-8"
                >
                  {updateOrgMutation.isPending ? "Saving..." : (
                    <span className="flex items-center gap-2">Next <ArrowRight className="h-4 w-4" /></span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Create first team */}
        {step === 2 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Create your first team</CardTitle>
                  <CardDescription>Teams are groups of people who work on accounts together. You can add more later.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Accounts Team, Pod A, Client Services"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="teamDesc">Description <span className="text-gray-400">(optional)</span></Label>
                <Input
                  id="teamDesc"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="e.g. Handles all personal tax and accounts for clients A–M"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleStep2Skip}>
                    Skip for now
                  </Button>
                  <Button
                    onClick={handleStep2Next}
                    disabled={createTeamMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 px-8"
                  >
                    {createTeamMutation.isPending ? "Creating..." : (
                      <span className="flex items-center gap-2">Next <ArrowRight className="h-4 w-4" /></span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Practice Standards */}
        {step === 3 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <SlidersHorizontal className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Practice Standards</CardTitle>
                  <CardDescription>These are set to recommended defaults based on industry best practice. You can update them at any time in Admin &amp; Settings → Practice Standards.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="vatDay">VAT Completion Day</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Target day of month for 100% VAT completion</p>
                  <Input
                    id="vatDay"
                    type="number"
                    min={1}
                    max={31}
                    value={vatCompletionDay}
                    onChange={(e) => setVatCompletionDay(parseInt(e.target.value) || 28)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mgmtDay">Management Accounts Day</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Target day of month for management accounts completion</p>
                  <Input
                    id="mgmtDay"
                    type="number"
                    min={1}
                    max={31}
                    value={mgmtAccountsDay}
                    onChange={(e) => setMgmtAccountsDay(parseInt(e.target.value) || 15)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="upperThreshold">Bookkeeping Upper Threshold %</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Clients below this are flagged as at risk</p>
                  <Input
                    id="upperThreshold"
                    type="number"
                    min={1}
                    max={100}
                    value={bookkeepingUpperThreshold}
                    onChange={(e) => setBookkeepingUpperThreshold(parseInt(e.target.value) || 85)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lowerThreshold">Bookkeeping Lower Threshold %</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Clients below this are considered high risk</p>
                  <Input
                    id="lowerThreshold"
                    type="number"
                    min={1}
                    max={100}
                    value={bookkeepingLowerThreshold}
                    onChange={(e) => setBookkeepingLowerThreshold(parseInt(e.target.value) || 70)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bkPlatform">Bookkeeping Quality Platform</Label>
                <p className="text-xs text-gray-500 mt-0.5">The platform you use to measure bookkeeping quality scores</p>
                <Select value={bookkeepingPlatform} onValueChange={setBookkeepingPlatform}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dext Precision">Dext Precision</SelectItem>
                    <SelectItem value="AutoEntry">AutoEntry</SelectItem>
                    <SelectItem value="Hubdoc">Hubdoc</SelectItem>
                    <SelectItem value="Receipt Bank">Receipt Bank</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bookkeepingPlatform === "Other" && (
                <div>
                  <Label htmlFor="bkPlatformCustom">Platform Name</Label>
                  <Input
                    id="bkPlatformCustom"
                    value={bookkeepingPlatformCustom}
                    onChange={(e) => setBookkeepingPlatformCustom(e.target.value)}
                    placeholder="Enter your platform name"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleStep3Skip}>
                    Skip for now
                  </Button>
                  <Button
                    onClick={handleStep3Next}
                    disabled={saveStandardsMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 px-8"
                  >
                    {saveStandardsMutation.isPending ? "Saving..." : (
                      <span className="flex items-center gap-2">Next <ArrowRight className="h-4 w-4" /></span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Invite first team member */}
        {step === 4 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserPlus className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Invite your first team member</CardTitle>
                  <CardDescription>They'll receive an email to set up their account. You can invite more people later from Settings.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="invFN">First Name</Label>
                  <Input
                    id="invFN"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="Jane"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="invLN">Last Name</Label>
                  <Input
                    id="invLN"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Smith"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="invEmail">Email Address</Label>
                <Input
                  id="invEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@yourfirm.co.uk"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleFinish}
                    disabled={completeMutation.isPending}
                  >
                    Skip and finish
                  </Button>
                  <Button
                    onClick={handleStep4Invite}
                    disabled={inviteMutation.isPending || completeMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 px-8"
                  >
                    {inviteMutation.isPending ? "Sending..." : (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" /> Send invitation & finish
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Step {step} of {steps.length} — You can update these details later from Admin & Settings.
        </p>
      </div>
    </div>
  );
}
