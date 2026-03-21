import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { Loader2, CheckCircle, XCircle, Users, Calendar, Trash2 } from "lucide-react";
import type { Rsvp } from "@shared/schema";

interface RsvpResponse {
  rsvps: Rsvp[];
  stats: { attending: number; guestCount: number; notAttending: number };
}

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

export default function RsvpPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const { data, isLoading } = useQuery<RsvpResponse>({
    queryKey: ["/api/rsvp"],
  });

  const deleteRsvpMutation = useMutation({
    mutationFn: (rsvpId: number) => {
      return apiRequest("DELETE", `/api/rsvp/${rsvpId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rsvp"] });
      toast({
        title: "Success",
        description: "RSVP deleted successfully",
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to delete RSVP: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const { itemToDelete, requestDelete, confirmDelete, cancelDelete } =
    useDeleteConfirmation((id) => deleteRsvpMutation.mutate(id));

  const rsvps = data?.rsvps ?? [];
  const stats = calculateAttendance(rsvps);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
        <p className="text-gray-500">Loading RSVP responses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  {stats.attending}
                </CardTitle>
                <CardDescription className="text-rose-100">
                  Confirmed Attending
                </CardDescription>
              </div>
              <Users className="h-8 w-8 text-rose-200" />
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-pink-400 to-rose-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  {stats.totalGuests}
                </CardTitle>
                <CardDescription className="text-pink-100">
                  Total Expected Guests
                </CardDescription>
              </div>
              <Calendar className="h-8 w-8 text-pink-200" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* RSVP List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-pink-600" />
            <div>
              <CardTitle className="text-xl">RSVP Responses</CardTitle>
              <CardDescription>
                Guest responses and attendance information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rsvps.map((rsvp) => (
              <Card
                key={rsvp.id}
                className="shadow-sm border-l-4 border-l-rose-500"
              >
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

                  <div className="flex items-center justify-between">
                    {rsvp.attending && rsvp.guestCount ? (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">
                          Number of Guests
                        </p>
                        <p className="text-lg font-semibold text-blue-700">
                          {rsvp.guestCount}
                        </p>
                      </div>
                    ) : (
                      <div />
                    )}

                    {itemToDelete === rsvp.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Delete?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={confirmDelete}
                          disabled={deleteRsvpMutation.isPending}
                        >
                          {deleteRsvpMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Yes"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelDelete}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => requestDelete(rsvp.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {rsvps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg">
                  No RSVP responses yet
                </p>
                <p className="text-sm text-gray-400">
                  Responses will appear here when guests submit their RSVPs
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
