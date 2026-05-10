import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { WEDDING_DATE } from "@/lib/constants";
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
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2 } from "lucide-react";

function getDefaultDeadline(): string {
  const d = new Date(WEDDING_DATE);
  d.setDate(d.getDate() - 10);
  return d.toISOString().split("T")[0];
}

function computeStatus(deadlineValue: string | null): {
  isPast: boolean;
  daysFromToday: number | null;
} {
  if (!deadlineValue) return { isPast: false, daysFromToday: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineValue + "T00:00:00");
  const isPast = deadline <= today;
  const daysFromToday = Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return { isPast, daysFromToday };
}

export default function RsvpDeadlinePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [deadlineInput, setDeadlineInput] = useState<string>(getDefaultDeadline());
  const [savedDeadline, setSavedDeadline] = useState<string | null>(null);

  const { data: appSettingsData, isLoading } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (appSettingsData?.settings) {
      const setting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_deadline"
      );
      if (setting) {
        setSavedDeadline(setting.settingValue);
        setDeadlineInput(setting.settingValue);
      }
    }
  }, [appSettingsData]);

  const mutation = useMutation({
    mutationFn: async (dateValue: string) => {
      await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [
          {
            settingKey: "rsvp_deadline",
            settingValue: dateValue,
            settingType: "date",
            description: "Date on which RSVP submissions close (inclusive)",
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Success", description: "RSVP deadline updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update deadline: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const { isPast, daysFromToday } = computeStatus(savedDeadline);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-rose-600" />
          <div>
            <CardTitle className="text-xl">RSVP Deadline</CardTitle>
            <CardDescription>
              Configure when RSVP submissions automatically close
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        {savedDeadline && (
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <span className="text-sm font-medium text-gray-700">Current Status:</span>
            {isPast ? (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                CLOSED — closed {Math.abs(daysFromToday!)} day{Math.abs(daysFromToday!) !== 1 ? "s" : ""} ago
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                OPEN — closes in {daysFromToday} day{daysFromToday !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* Warning banner when past */}
        {savedDeadline && isPast && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Deadline is in the past.</strong> RSVP is currently closed for guests. Update the date to reopen.
            </p>
          </div>
        )}

        {/* Deadline Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="rsvp-deadline">
            Deadline Date
          </Label>
          <p className="text-xs text-muted-foreground">
            RSVP closes on this date (inclusive). Change to any past date to test the closed state.
          </p>
          <div className="flex items-center gap-3">
            <Input
              id="rsvp-deadline"
              type="date"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="max-w-[200px]"
              data-testid="input-rsvp-deadline"
            />
            <Button
              onClick={() => mutation.mutate(deadlineInput)}
              disabled={mutation.isPending || !deadlineInput}
              data-testid="button-save-rsvp-deadline"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        {/* Info box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Testing:</strong> Set the deadline to yesterday to verify guests see the closed message, then restore it to the intended date.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
