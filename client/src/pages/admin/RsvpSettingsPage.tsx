import { useState, useEffect, useRef } from "react";
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
import { CalendarClock, Loader2, Users } from "lucide-react";

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

export default function RsvpSettingsPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [deadlineInput, setDeadlineInput] = useState<string>(getDefaultDeadline());
  const [savedDeadline, setSavedDeadline] = useState<string | null>(null);
  const hasInitializedDeadlineRef = useRef(false);

  const [maxGuestsInput, setMaxGuestsInput] = useState<string>("4");
  const hasInitializedMaxGuestsRef = useRef(false);

  const { data: appSettingsData, isLoading } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (appSettingsData?.settings) {
      const deadlineSetting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_deadline"
      );
      if (deadlineSetting) {
        setSavedDeadline(deadlineSetting.settingValue);
        if (!hasInitializedDeadlineRef.current) {
          hasInitializedDeadlineRef.current = true;
          setDeadlineInput(deadlineSetting.settingValue);
        }
      }

      const maxGuestsSetting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_max_guests"
      );
      if (maxGuestsSetting && !hasInitializedMaxGuestsRef.current) {
        hasInitializedMaxGuestsRef.current = true;
        setMaxGuestsInput(maxGuestsSetting.settingValue);
      }
    }
  }, [appSettingsData]);

  const deadlineMutation = useMutation({
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

  const maxGuestsMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [
          {
            settingKey: "rsvp_max_guests",
            settingValue: value,
            settingType: "number",
            description: "Maximum number of guests allowed per RSVP",
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Success", description: "Max guests updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update max guests: ${error.message}`,
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
    <div className="space-y-6">
      {/* RSVP Deadline */}
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

          {savedDeadline && isPast && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Deadline is in the past.</strong> RSVP is currently closed for guests. Update the date to reopen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rsvp-deadline">Deadline Date</Label>
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
                onClick={() => deadlineMutation.mutate(deadlineInput)}
                disabled={deadlineMutation.isPending || !deadlineInput}
                data-testid="button-save-rsvp-deadline"
              >
                {deadlineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Testing:</strong> Set the deadline to yesterday to verify guests see the closed message, then restore it to the intended date.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Max Guests per RSVP */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-rose-600" />
            <div>
              <CardTitle className="text-xl">Max Guests per RSVP</CardTitle>
              <CardDescription>
                Controls how many guests a single RSVP can include
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rsvp-max-guests">Maximum guests</Label>
            <p className="text-xs text-muted-foreground">
              The guest count dropdown on the RSVP form will show options from 1 up to this number.
            </p>
            <div className="flex items-center gap-3">
              <Input
                id="rsvp-max-guests"
                type="number"
                min={1}
                max={20}
                value={maxGuestsInput}
                onChange={(e) => setMaxGuestsInput(e.target.value)}
                className="max-w-[120px]"
                data-testid="input-rsvp-max-guests"
              />
              <Button
                onClick={() => maxGuestsMutation.mutate(maxGuestsInput)}
                disabled={maxGuestsMutation.isPending || !maxGuestsInput}
                data-testid="button-save-rsvp-max-guests"
              >
                {maxGuestsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
