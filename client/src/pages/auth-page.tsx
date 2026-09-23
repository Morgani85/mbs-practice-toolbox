import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, loginMutation } = useAuth();
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState(false);
  
  // Invitation token handling
  const [invitationToken, setInvitationToken] = useState("");
  const [showInvitationSetup, setShowInvitationSetup] = useState(false);
  const [invitationData, setInvitationData] = useState({
    password: "",
    confirmPassword: ""
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("/api/forgot-password", "POST", { email });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check your email",
        description: data.message,
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await apiRequest("/api/reset-password", "POST", { token, password });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password updated",
        description: "Your password has been reset successfully. Please sign in.",
      });
      setShowForgotPassword(false);
      setShowResetForm(false);
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotPasswordEmail("");
      setTokenFromUrl(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Invitation setup mutation
  const invitationSetupMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await apiRequest("/api/complete-invitation", "POST", { token, password });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Welcome!",
        description: "Your account has been set up successfully. You can now log in.",
      });
      setShowInvitationSetup(false);
      setInvitationToken("");
      setInvitationData({ password: "", confirmPassword: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Check for invitation or password reset token in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invToken = urlParams.get('token');
    const resetTokenParam = urlParams.get('reset_token');
    const currentPath = window.location.pathname;

    if (invToken) {
      setInvitationToken(invToken);
      setShowInvitationSetup(true);
      window.history.replaceState({}, document.title, currentPath);
    } else if (resetTokenParam) {
      setResetToken(resetTokenParam);
      setTokenFromUrl(true);
      setShowResetForm(true);
      setShowForgotPassword(true);
      window.history.replaceState({}, document.title, currentPath);
    }
  }, []);


  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Missing fields",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Attempting login with:", { email: loginData.email });
      const result = await loginMutation.mutateAsync(loginData);
      console.log("Login successful, result:", result);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      // Error handling is done in the mutation
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    await forgotPasswordMutation.mutateAsync(forgotPasswordEmail);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    await resetPasswordMutation.mutateAsync({ token: resetToken, password: newPassword });
  };
  
  const handleInvitationSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationData.password || !invitationData.confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    if (invitationData.password !== invitationData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    await invitationSetupMutation.mutateAsync({ 
      token: invitationToken, 
      password: invitationData.password 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="hidden lg:block space-y-8">
          <div>
            <div className="flex items-center mb-6">
              <img 
                src="/attached_assets/Screenshot 2025-07-02 at 16.25.36_1751469958155.png" 
                alt="Practice Toolbox" 
                className="h-16 mr-4"
              />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Practice Toolbox
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Team Performance Management & Analytics
            </p>
            <p className="text-lg text-gray-700">
              Comprehensive performance tracking and AI-powered analysis for accounting practices. 
              Monitor progress across all business modules with real-time insights and recommendations.
            </p>
          </div>
          
          <div className="grid gap-6">
            <div className="flex items-start space-x-4">
              <div className="bg-blue-500 text-white p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Real-time Analytics</h3>
                <p className="text-gray-600">Track performance across accounts, VAT, bookkeeping, and tax operations</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-green-500 text-white p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">AI-Powered Insights</h3>
                <p className="text-gray-600">Get intelligent recommendations and risk analysis for your practice</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-purple-500 text-white p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Team Management</h3>
                <p className="text-gray-600">Role-based access and collaborative workflow tracking</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="w-full max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Sign in to your Practice Toolbox account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">New to Practice Toolbox?</span>
                </div>
              </div>

              <a href="https://www.practicetoolbox.co.uk/register-interest" className="block">
                <Button variant="outline" className="w-full">
                  Register your interest
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {!showResetForm 
                ? "Enter your email address and we'll send you a password reset link."
                : tokenFromUrl
                  ? "Enter and confirm your new password below."
                  : "Enter the reset token from your email and choose a new password."
              }
            </DialogDescription>
          </DialogHeader>
          
          {!showResetForm ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {!tokenFromUrl && (
                <div className="space-y-2">
                  <Label htmlFor="reset-token">Reset Token</Label>
                  <Input
                    id="reset-token"
                    placeholder="Paste the token from your reset email"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setShowResetForm(false);
                    setResetToken("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setForgotPasswordEmail("");
                    setTokenFromUrl(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Invitation Setup Dialog */}
      <Dialog open={showInvitationSetup} onOpenChange={setShowInvitationSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Account Setup</DialogTitle>
            <DialogDescription>
              Welcome! Please create a password to complete your account setup.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleInvitationSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invitation-password">Password</Label>
              <Input
                id="invitation-password"
                type="password"
                placeholder="Create a secure password"
                value={invitationData.password}
                onChange={(e) => setInvitationData(prev => ({ ...prev, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitation-confirm-password">Confirm Password</Label>
              <Input
                id="invitation-confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={invitationData.confirmPassword}
                onChange={(e) => setInvitationData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowInvitationSetup(false);
                  setInvitationToken("");
                  setInvitationData({ password: "", confirmPassword: "" });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={invitationSetupMutation.isPending}
              >
                {invitationSetupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}