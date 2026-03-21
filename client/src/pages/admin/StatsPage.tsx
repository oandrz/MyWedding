import { useQuery } from "@tanstack/react-query";
import { useAdminContext } from "./AdminContext";
import { BarChart3, Users, UserCheck, UserX, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Rsvp } from "@shared/schema";

function calculateAttendance(rsvps: Rsvp[]) {
  let attending = 0;
  let notAttending = 0;
  let totalGuests = 0;
  rsvps.forEach((rsvp) => {
    if (rsvp.attending) {
      attending++;
      totalGuests += rsvp.guestCount || 1;
    } else {
      notAttending++;
    }
  });
  return { attending, notAttending, totalGuests };
}

export default function StatsPage() {
  const { handleAutoLogout } = useAdminContext();

  const { data, isLoading, error } = useQuery<{ rsvps: Rsvp[] }>({
    queryKey: ["/api/rsvp"],
    retry: (failureCount, err) => {
      if (err.message.includes("401") || err.message.includes("Unauthorized")) {
        handleAutoLogout(err);
        return false;
      }
      return failureCount < 3;
    },
  });

  const rsvps = data?.rsvps ?? [];
  const { attending, notAttending, totalGuests } = calculateAttendance(rsvps);
  const total = rsvps.length;
  const attendanceRate = total > 0 ? `${Math.round((attending / total) * 100)}%` : "0%";

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading statistics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-16">
            <p className="text-red-500">Failed to load statistics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-rose-600" />
          <div>
            <CardTitle className="text-xl">Attendance Analytics</CardTitle>
            <CardDescription>Overview of RSVP responses and guest counts</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 border rounded-lg text-center">
            <UserCheck className="h-5 w-5 text-green-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-600">{attending}</div>
            <div className="text-sm text-gray-500 mt-1">Confirmed Attending</div>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <UserX className="h-5 w-5 text-red-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-red-500">{notAttending}</div>
            <div className="text-sm text-gray-500 mt-1">Not Attending</div>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <Users className="h-5 w-5 text-blue-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-blue-600">{totalGuests}</div>
            <div className="text-sm text-gray-500 mt-1">Total Expected Guests</div>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <Users className="h-5 w-5 text-purple-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-purple-600">{total}</div>
            <div className="text-sm text-gray-500 mt-1">Total Responses</div>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <BarChart3 className="h-5 w-5 text-amber-600 mx-auto mb-2" />
            <div className="text-3xl font-bold text-amber-600">{attendanceRate}</div>
            <div className="text-sm text-gray-500 mt-1">Attendance Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
