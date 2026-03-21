import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Flag, Loader2 } from "lucide-react";
import type { FeatureFlag, WelcomeScreen } from "@shared/schema";

export default function FlagsPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  // Welcome screen local state for the toggle
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);

  // Fetch feature flags
  const {
    data: featureFlagsData,
    isLoading: featureFlagsLoading,
    error: featureFlagsError,
  } = useQuery<{ featureFlags: FeatureFlag[] }>({
    queryKey: ["/api/feature-flags"],
    retry: (failureCount, error) => {
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        handleAutoLogout(error);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Fetch welcome screen configuration
  const { data: welcomeScreenData } = useQuery<{ welcomeScreen: WelcomeScreen }>({
    queryKey: ["/api/welcome-screen"],
  });

  // Sync welcome screen enabled state when data loads
  useEffect(() => {
    if (welcomeScreenData?.welcomeScreen) {
      setWelcomeEnabled(welcomeScreenData.welcomeScreen.enabled ?? true);
    }
  }, [welcomeScreenData]);

  // Mutation for toggling feature flags
  const featureFlagMutation = useMutation({
    mutationFn: ({ featureKey, enabled }: { featureKey: string; enabled: boolean }) => {
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

  // Mutation for toggling welcome screen
  const welcomeScreenMutation = useMutation({
    mutationFn: (data: { headingText: string; deliveryLabel: string; fallbackName: string; enabled: boolean }) => {
      return apiRequest("PATCH", "/api/admin/welcome-screen", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/welcome-screen"] });
      toast({
        title: "Success",
        description: "Welcome screen updated successfully",
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update welcome screen: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFeatureFlagToggle = (featureKey: string, enabled: boolean) => {
    featureFlagMutation.mutate({ featureKey, enabled });
  };

  const handleWelcomeToggle = (checked: boolean) => {
    setWelcomeEnabled(checked);
    const ws = welcomeScreenData?.welcomeScreen;
    welcomeScreenMutation.mutate({
      headingText: ws?.headingText ?? "",
      deliveryLabel: ws?.deliveryLabel ?? "",
      fallbackName: ws?.fallbackName ?? "",
      enabled: checked,
    });
  };

  if (featureFlagsLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading feature flags...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (featureFlagsError) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-16">
            <p className="text-red-500">Failed to load feature flags</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
        <div className="space-y-6">
          {/* Welcome Screen Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-medium text-gray-900">Enable Welcome Screen</h3>
                <Badge
                  variant={welcomeEnabled ? "default" : "secondary"}
                  className={welcomeEnabled ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}
                >
                  {welcomeEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">Show the personalized welcome overlay to guests on page load</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={welcomeEnabled}
                onCheckedChange={handleWelcomeToggle}
                disabled={welcomeScreenMutation.isPending}
                className="data-[state=checked]:bg-rose-600"
                data-testid="switch-welcome-enabled"
              />
            </div>
          </div>

          {/* Feature Flags */}
          {featureFlagsData?.featureFlags && featureFlagsData.featureFlags.length > 0 ? (
            <>
              <div className="border-t pt-6" />
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
            </>
          ) : (
            <div className="text-center py-8">
              <Flag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No additional feature flags configured</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
