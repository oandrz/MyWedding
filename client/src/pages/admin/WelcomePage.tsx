import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import type { WelcomeScreen } from "@shared/schema";

export default function WelcomePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [welcomeForm, setWelcomeForm] = useState({
    headingText: "",
    headingTextId: "",
    deliveryLabel: "",
    deliveryLabelId: "",
    fallbackName: "",
  });

  const { data: welcomeScreenData, isLoading } = useQuery<{
    welcomeScreen: WelcomeScreen;
  }>({
    queryKey: ["/api/welcome-screen"],
  });

  useEffect(() => {
    if (welcomeScreenData?.welcomeScreen) {
      const ws = welcomeScreenData.welcomeScreen;
      setWelcomeForm({
        headingText: ws.headingText,
        headingTextId: ws.headingTextId ?? "",
        deliveryLabel: ws.deliveryLabel,
        deliveryLabelId: ws.deliveryLabelId ?? "",
        fallbackName: ws.fallbackName,
      });
    }
  }, [welcomeScreenData]);

  const welcomeScreenMutation = useMutation({
    mutationFn: (data: typeof welcomeForm & { enabled: boolean }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const enabled = welcomeScreenData?.welcomeScreen?.enabled ?? true;
    welcomeScreenMutation.mutate({ ...welcomeForm, enabled });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-rose-600" />
          <div>
            <CardTitle className="text-xl">
              Welcome Screen Configuration
            </CardTitle>
            <CardDescription>
              Customize the personalized greeting overlay for your guests
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">
              Loading welcome screen configuration...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Heading Text */}
            <div className="space-y-2">
              <Label htmlFor="headingText">Main Heading</Label>
              <Input
                id="headingText"
                type="text"
                value={welcomeForm.headingText}
                onChange={(e) =>
                  setWelcomeForm({
                    ...welcomeForm,
                    headingText: e.target.value,
                  })
                }
                placeholder="e.g., The Wedding of James & Olivia"
                className="w-full"
                data-testid="input-heading-text"
              />
              <p className="text-xs text-muted-foreground">
                The main title shown on the welcome overlay (large serif font)
              </p>
            </div>

            {/* Heading Text (Bahasa) */}
            <div className="space-y-2">
              <Label htmlFor="headingTextId">Main Heading (Bahasa Indonesia)</Label>
              <Input
                id="headingTextId"
                type="text"
                value={welcomeForm.headingTextId}
                onChange={(e) => setWelcomeForm({ ...welcomeForm, headingTextId: e.target.value })}
                placeholder="e.g., Pernikahan James & Olivia"
                className="w-full"
                data-testid="input-heading-text-id"
              />
              <p className="text-xs text-muted-foreground">
                Heading shown when guests select Bahasa Indonesia
              </p>
            </div>

            {/* Delivery Label */}
            <div className="space-y-2">
              <Label htmlFor="deliveryLabel">Delivery Label</Label>
              <Input
                id="deliveryLabel"
                type="text"
                value={welcomeForm.deliveryLabel}
                onChange={(e) =>
                  setWelcomeForm({
                    ...welcomeForm,
                    deliveryLabel: e.target.value,
                  })
                }
                placeholder="e.g., Kindly Delivered to"
                className="w-full"
                data-testid="input-delivery-label"
              />
              <p className="text-xs text-muted-foreground">
                The label shown above the guest's name (small uppercase text)
              </p>
            </div>

            {/* Delivery Label (Bahasa) */}
            <div className="space-y-2">
              <Label htmlFor="deliveryLabelId">Delivery Label (Bahasa Indonesia)</Label>
              <Input
                id="deliveryLabelId"
                type="text"
                value={welcomeForm.deliveryLabelId}
                onChange={(e) => setWelcomeForm({ ...welcomeForm, deliveryLabelId: e.target.value })}
                placeholder="e.g., Kepada Yth."
                className="w-full"
                data-testid="input-delivery-label-id"
              />
              <p className="text-xs text-muted-foreground">
                Label shown above guest name when guests select Bahasa Indonesia
              </p>
            </div>

            {/* Fallback Name */}
            <div className="space-y-2">
              <Label htmlFor="fallbackName">Fallback Guest Name</Label>
              <Input
                id="fallbackName"
                type="text"
                value={welcomeForm.fallbackName}
                onChange={(e) =>
                  setWelcomeForm({
                    ...welcomeForm,
                    fallbackName: e.target.value,
                  })
                }
                placeholder="e.g., Our Dearest Guest"
                className="w-full"
                data-testid="input-fallback-name"
              />
              <p className="text-xs text-muted-foreground">
                Default name shown when no ?to= parameter is in the URL
              </p>
            </div>

            {/* Preview */}
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gradient-to-br from-rose-50 to-pink-50">
              <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                Preview
              </p>
              <div className="text-center space-y-2">
                <p className="font-cormorant text-2xl text-foreground">
                  {welcomeForm.headingText || "The Wedding of..."}
                </p>
                <p className="font-montserrat text-[10px] uppercase tracking-widest text-muted-foreground">
                  {welcomeForm.deliveryLabel || "Kindly Delivered to"}
                </p>
                <p className="font-cormorant text-xl italic text-primary">
                  {welcomeForm.fallbackName || "Guest Name"}
                </p>
              </div>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={welcomeScreenMutation.isPending}
              data-testid="button-save-welcome"
            >
              {welcomeScreenMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>

            {/* Usage Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">How to Use</h4>
              <p className="text-sm text-blue-700 mb-2">
                When sharing your invitation, add the guest's name to the URL:
              </p>
              <code className="block bg-white p-2 rounded text-xs text-blue-800 border border-blue-300">
                https://your-site.com/?to=Olivia
              </code>
              <p className="text-xs text-blue-600 mt-2">
                The welcome screen will display "
                {welcomeForm.deliveryLabel}" followed by "Olivia" in an
                elegant overlay.
              </p>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
