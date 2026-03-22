import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import ImageManager from "@/components/ImageManager";
import MusicManager from "@/components/MusicManager";
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
import {
  Settings,
  Music,
  Gift,
  Loader2,
} from "lucide-react";

export default function ConfigPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  // E-Gift form state
  const [egiftForm, setEgiftForm] = useState({
    groomName: "",
    groomBank: "",
    groomAccount: "",
    brideName: "",
    brideBank: "",
    brideAccount: "",
  });

  // Fetch app settings for e-gift
  const { data: appSettingsData } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  // Update e-gift form when settings are loaded
  useEffect(() => {
    if (appSettingsData?.settings) {
      const getSettingValue = (key: string) => {
        const setting = appSettingsData.settings.find(
          (s: any) => s.settingKey === key
        );
        return setting?.settingValue || "";
      };
      setEgiftForm({
        groomName: getSettingValue("egift_groom_name"),
        groomBank: getSettingValue("egift_groom_bank"),
        groomAccount: getSettingValue("egift_groom_account"),
        brideName: getSettingValue("egift_bride_name"),
        brideBank: getSettingValue("egift_bride_bank"),
        brideAccount: getSettingValue("egift_bride_account"),
      });
    }
  }, [appSettingsData]);

  // Mutation for updating e-gift settings
  const egiftSettingsMutation = useMutation({
    mutationFn: async (data: typeof egiftForm) => {
      const settings = [
        {
          settingKey: "egift_groom_name",
          settingValue: data.groomName,
          settingType: "text",
          description: "Groom account holder name",
        },
        {
          settingKey: "egift_groom_bank",
          settingValue: data.groomBank,
          settingType: "text",
          description: "Groom bank name",
        },
        {
          settingKey: "egift_groom_account",
          settingValue: data.groomAccount,
          settingType: "text",
          description: "Groom account number",
        },
        {
          settingKey: "egift_bride_name",
          settingValue: data.brideName,
          settingType: "text",
          description: "Bride account holder name",
        },
        {
          settingKey: "egift_bride_bank",
          settingValue: data.brideBank,
          settingType: "text",
          description: "Bride bank name",
        },
        {
          settingKey: "egift_bride_account",
          settingValue: data.brideAccount,
          settingType: "text",
          description: "Bride account number",
        },
      ];

      await apiRequest("PATCH", "/api/admin/app-settings/bulk", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({
        title: "Success",
        description: "E-Gift settings updated successfully",
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update e-gift settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEgiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    egiftSettingsMutation.mutate(egiftForm);
  };

  return (
    <div className="space-y-6">
      {/* Google Drive Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-xl">
                Google Drive Integration
              </CardTitle>
              <CardDescription>
                Configure Google Drive for guest photo uploads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Enable guests to upload photos directly to your Google Drive
              folder. Requires one-time OAuth setup.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild className="flex-1">
                <a
                  href="/google-drive-setup"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Configure Google Drive OAuth
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a
                  href="/google-drive-instructions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
              <CardDescription>
                Configure banner and gallery images
              </CardDescription>
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
              <CardDescription>
                Upload and manage background music for your wedding website
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MusicManager onAutoLogout={handleAutoLogout} />
        </CardContent>
      </Card>

      {/* E-Gift / Bank Transfer Configuration */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-amber-600" />
            <div>
              <CardTitle className="text-xl">E-Gift Bank Accounts</CardTitle>
              <CardDescription>
                Configure bank account details for guest monetary gifts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEgiftSubmit} className="space-y-6">
            {/* Groom Account */}
            <div className="p-4 border rounded-lg bg-blue-50/50">
              <h3 className="font-medium text-gray-900 mb-4">
                Groom's Bank Account
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="groomName">Account Holder Name</Label>
                  <Input
                    id="groomName"
                    value={egiftForm.groomName}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        groomName: e.target.value,
                      })
                    }
                    placeholder="Andreas"
                    data-testid="input-egift-groom-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groomBank">Bank Name</Label>
                  <Input
                    id="groomBank"
                    value={egiftForm.groomBank}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        groomBank: e.target.value,
                      })
                    }
                    placeholder="Bank BCA"
                    data-testid="input-egift-groom-bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groomAccount">Account Number</Label>
                  <Input
                    id="groomAccount"
                    value={egiftForm.groomAccount}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        groomAccount: e.target.value,
                      })
                    }
                    placeholder="1234567890"
                    data-testid="input-egift-groom-account"
                  />
                </div>
              </div>
            </div>

            {/* Bride Account */}
            <div className="p-4 border rounded-lg bg-pink-50/50">
              <h3 className="font-medium text-gray-900 mb-4">
                Bride's Bank Account
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="brideName">Account Holder Name</Label>
                  <Input
                    id="brideName"
                    value={egiftForm.brideName}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        brideName: e.target.value,
                      })
                    }
                    placeholder="Christine"
                    data-testid="input-egift-bride-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brideBank">Bank Name</Label>
                  <Input
                    id="brideBank"
                    value={egiftForm.brideBank}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        brideBank: e.target.value,
                      })
                    }
                    placeholder="Bank BCA"
                    data-testid="input-egift-bride-bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brideAccount">Account Number</Label>
                  <Input
                    id="brideAccount"
                    value={egiftForm.brideAccount}
                    onChange={(e) =>
                      setEgiftForm({
                        ...egiftForm,
                        brideAccount: e.target.value,
                      })
                    }
                    placeholder="0987654321"
                    data-testid="input-egift-bride-account"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={egiftSettingsMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-save-egift"
            >
              {egiftSettingsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save E-Gift Settings"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
