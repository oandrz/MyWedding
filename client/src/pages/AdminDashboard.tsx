import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Users, BarChart3, LogOut, Settings, Calendar, Flag, Music } from "lucide-react";
import { Rsvp } from "@shared/schema";
import { useLocation } from "wouter";
import ImageManager from "@/components/ImageManager";
import MusicManager from "@/components/MusicManager";

interface FeatureFlag {
  id: number;
  featureKey: string;
  featureName: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rsvps");
  const [, navigate] = useLocation();
  
  // Auto-logout helper function
  const handleAutoLogout = (error: Error) => {
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      sessionStorage.removeItem("csrfToken");
      toast({
        title: "Session expired",
        description: "Your admin session has expired. Please log in again.",
        variant: "destructive",
      });
      navigate("/admin-login");
    }
  };


  // Fetch all RSVPs
  const {
    data: rsvps,
    isLoading: rsvpLoading
  } = useQuery<{ rsvps: Rsvp[], stats: { attending: number, guestCount: number, notAttending: number } }>({
    queryKey: ["/api/rsvp"],
  });

  // Fetch all feature flags
  const { 
    data: featureFlagsData,
    isLoading: featureFlagsLoading,
    error: featureFlagsError
  } = useQuery<{ featureFlags: FeatureFlag[] }>({
    queryKey: ["/api/feature-flags"],
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        handleAutoLogout(error);
        return false;
      }
      return failureCount < 3;
    },
  });


  // Mutation for updating feature flags
  const featureFlagMutation = useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: string, enabled: boolean }) => {
      return apiRequest("PATCH", `/api/admin/feature-flags/${featureKey}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
      toast({
        title: "Success",
        description: "Feature flag updated successfully",
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update feature flag: ${error.message}`,
        variant: "destructive",
      });
    },
  });


  const handleFeatureFlagToggle = (featureKey: string, enabled: boolean) => {
    featureFlagMutation.mutate({ featureKey, enabled });
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/admin/logout');
      sessionStorage.removeItem("csrfToken");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      navigate("/admin-login");
    } catch (error) {
      sessionStorage.removeItem("csrfToken");
      navigate("/admin-login");
    }
  };

  // Helper function to count attending guests from RSVPs
  const calculateAttendance = () => {
    if (!rsvps?.rsvps) return { attending: 0, notAttending: 0, totalGuests: 0 };
    
    let attending = 0;
    let notAttending = 0;
    let totalGuests = 0;
    
    rsvps.rsvps.forEach((rsvp: Rsvp) => {
      if (rsvp.attending) {
        attending++;
        // Add additional guests if present
        totalGuests += 1 + (rsvp.guestCount || 0);
      } else {
        notAttending++;
      }
    });
    
    return { attending, notAttending, totalGuests };
  };
  
  const stats = calculateAttendance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center py-4">
          <div className="pl-4">
            <h1 className="text-2xl font-bold text-gray-900">Wedding Admin</h1>
            <p className="text-sm text-gray-600">Andreas & Christine's Wedding Dashboard</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Stats Overview */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-white">{stats.attending}</CardTitle>
                  <CardDescription className="text-rose-100">Attending</CardDescription>
                </div>
                <Users className="h-8 w-8 text-rose-200" />
              </div>
            </CardHeader>
          </Card>
          
          <Card className="bg-gradient-to-r from-pink-400 to-rose-500 text-white shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold text-white">{stats.totalGuests}</CardTitle>
                  <CardDescription className="text-pink-100">Total Guests</CardDescription>
                </div>
                <Calendar className="h-8 w-8 text-pink-200" />
              </div>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="rsvps" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="config" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Configuration</span>
            </TabsTrigger>
            <TabsTrigger value="rsvps" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3">
              <Users className="h-4 w-4" />
              <span className="hidden md:inline">RSVP</span>
            </TabsTrigger>
            <TabsTrigger value="flags" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3">
              <Flag className="h-4 w-4" />
              <span className="hidden md:inline">Flags</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Stats</span>
            </TabsTrigger>
          </TabsList>
        
        {/* Configuration Tab */}
        <TabsContent value="config">
          <div className="space-y-6">
            {/* Google Drive Configuration */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-blue-600" />
                  <div>
                    <CardTitle className="text-xl">Google Drive Integration</CardTitle>
                    <CardDescription>Configure Google Drive for guest photo uploads</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Enable guests to upload photos directly to your Google Drive folder. Requires one-time OAuth setup.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button asChild className="flex-1">
                      <a href="/google-drive-setup" target="_blank" rel="noopener noreferrer">
                        Configure Google Drive OAuth
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <a href="/google-drive-instructions" target="_blank" rel="noopener noreferrer">
                        Setup Instructions
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Image Configuration */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-xl">Image Configuration</CardTitle>
                    <CardDescription>Configure banner and gallery images</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ImageManager />
              </CardContent>
            </Card>

            {/* Music Configuration */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Music className="h-6 w-6 text-purple-600" />
                  <div>
                    <CardTitle className="text-xl">Music Configuration</CardTitle>
                    <CardDescription>Upload and manage background music for your wedding website</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MusicManager onAutoLogout={handleAutoLogout} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* RSVPs Tab */}
        <TabsContent value="rsvps">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-pink-600" />
                <div>
                  <CardTitle className="text-xl">RSVP Responses</CardTitle>
                  <CardDescription>Guest responses and attendance information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rsvpLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
                  <p className="text-gray-500">Loading RSVP responses...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rsvps?.rsvps?.map((rsvp: Rsvp) => (
                    <Card key={rsvp.id} className="shadow-sm border-l-4 border-l-rose-500">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">
                              {rsvp.name}
                            </h3>
                            <p className="text-sm text-gray-600">{rsvp.email}</p>
                          </div>
                          <Badge 
                            className={`w-fit ${
                              rsvp.attending 
                                ? "bg-green-100 text-green-800 border-green-200" 
                                : "bg-red-100 text-red-800 border-red-200"
                            }`}
                            variant="outline"
                          >
                            {rsvp.attending ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Attending
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                Not Attending
                              </div>
                            )}
                          </Badge>
                        </div>
                        
                        {rsvp.attending && rsvp.guestCount && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm font-medium text-blue-900">Number of Guests</p>
                            <p className="text-lg font-semibold text-blue-700">{rsvp.guestCount}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {rsvps?.rsvps?.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users className="h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 text-lg">No RSVP responses yet</p>
                      <p className="text-sm text-gray-400">Responses will appear here when guests submit their RSVPs</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Stats Tab */}
        <TabsContent value="stats">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-rose-600" />
                <div>
                  <CardTitle className="text-xl">Detailed Statistics</CardTitle>
                  <CardDescription>Comprehensive wedding attendance analytics</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-3xl font-bold text-white">{stats.attending}</CardTitle>
                        <CardDescription className="text-emerald-100">Confirmed Attending</CardDescription>
                      </div>
                      <CheckCircle className="h-8 w-8 text-emerald-200" />
                    </div>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-3xl font-bold text-white">{stats.notAttending}</CardTitle>
                        <CardDescription className="text-red-100">Not Attending</CardDescription>
                      </div>
                      <XCircle className="h-8 w-8 text-red-200" />
                    </div>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-3xl font-bold text-white">{stats.totalGuests}</CardTitle>
                        <CardDescription className="text-blue-100">Total Expected Guests</CardDescription>
                      </div>
                      <Users className="h-8 w-8 text-blue-200" />
                    </div>
                  </CardHeader>
                </Card>
              </div>

              {/* Response Rate Summary */}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Summary</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.attending + stats.notAttending > 0 
                        ? Math.round((stats.attending / (stats.attending + stats.notAttending)) * 100)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-600">Attendance Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{stats.attending + stats.notAttending}</p>
                    <p className="text-sm text-gray-600">Total Responses</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags Management Tab */}
        <TabsContent value="flags">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Flag className="h-6 w-6 text-rose-600" />
                <div>
                  <CardTitle className="text-xl">Feature Flags</CardTitle>
                  <CardDescription>Control which features are visible to your wedding guests</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {featureFlagsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
                  <p className="text-gray-500">Loading feature flags...</p>
                </div>
              ) : featureFlagsError ? (
                <div className="text-center py-16">
                  <p className="text-red-500">Failed to load feature flags</p>
                </div>
              ) : featureFlagsData?.featureFlags && featureFlagsData.featureFlags.length > 0 ? (
                <div className="space-y-6">
                  {featureFlagsData.featureFlags.map((flag: FeatureFlag) => (
                    <div key={flag.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{flag.featureName}</h3>
                          <Badge 
                            variant={flag.enabled ? "default" : "secondary"}
                            className={flag.enabled ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}
                          >
                            {flag.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{flag.description}</p>
                        <p className="text-xs text-gray-400">
                          Key: <code className="bg-gray-100 px-1 rounded">{flag.featureKey}</code>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(enabled) => handleFeatureFlagToggle(flag.featureKey, enabled)}
                          disabled={featureFlagMutation.isPending}
                          className="data-[state=checked]:bg-rose-600"
                        />
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">How Feature Flags Work</h4>
                        <p className="text-sm text-blue-800">
                          Toggle these switches to show or hide features on your wedding invitation. 
                          Changes take effect immediately for all your guests.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <Flag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No feature flags configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}