import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, CheckCircle, XCircle, Users, Trash2, Search, X } from "lucide-react";
import type { Rsvp } from "@shared/schema";

interface RsvpResponse {
  rsvps: Rsvp[];
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    guestCount: number;
    holyMatrimonyCount: number;
    receptionCount: number;
    holyMatrimonyGuestCount: number;
    receptionGuestCount: number;
  };
}

export default function RsvpPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const { data, isLoading } = useQuery<RsvpResponse>({
    queryKey: ["/api/rsvp"],
  });

  const deleteRsvpMutation = useMutation({
    mutationFn: (rsvpId: number) => {
      return apiRequest("DELETE", `/api/admin/rsvp/${rsvpId}`);
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

  // Search and filter state
  const [searchText, setSearchText] = useState("");
  const [attendingFilter, setAttendingFilter] = useState<
    "all" | "holy_matrimony" | "reception" | "both" | "declined"
  >("all");
  const debouncedSearch = useDebounce(searchText, 300);

  const filteredRsvps = useMemo(() => {
    return rsvps.filter((rsvp) => {
      const needle = debouncedSearch.toLowerCase();
      const matchesSearch =
        !debouncedSearch ||
        rsvp.name.toLowerCase().includes(needle) ||
        (rsvp.email ?? "").toLowerCase().includes(needle) ||
        (rsvp.phone ?? "").toLowerCase().includes(needle);

      let matchesFilter = true;
      if (attendingFilter === "holy_matrimony") {
        matchesFilter = rsvp.attendanceType === "both" || rsvp.attendanceType === "holy_matrimony";
      } else if (attendingFilter === "reception") {
        matchesFilter = rsvp.attendanceType === "both" || rsvp.attendanceType === "reception";
      } else if (attendingFilter === "both") {
        matchesFilter = rsvp.attendanceType === "both";
      } else if (attendingFilter === "declined") {
        matchesFilter = rsvp.attendanceType === "decline";
      }

      return matchesSearch && matchesFilter;
    });
  }, [rsvps, debouncedSearch, attendingFilter]);

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg" data-testid="stat-holy-matrimony">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.holyMatrimonyCount ?? 0}
            </CardTitle>
            <CardDescription className="text-rose-100">Holy Matrimony RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg" data-testid="stat-holy-matrimony-guests">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.holyMatrimonyGuestCount ?? 0}
            </CardTitle>
            <CardDescription className="text-rose-100">Matrimony Guests</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white shadow-lg" data-testid="stat-reception">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.receptionCount ?? 0}
            </CardTitle>
            <CardDescription className="text-purple-100">Reception RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg" data-testid="stat-reception-guests">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.receptionGuestCount ?? 0}
            </CardTitle>
            <CardDescription className="text-purple-100">Reception Guests</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg" data-testid="stat-declined">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.notAttending ?? 0}
            </CardTitle>
            <CardDescription className="text-gray-200">Declined</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone or email..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 pr-10"
            data-testid="rsvp-search-input"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Tabs
          value={attendingFilter}
          onValueChange={(v) => setAttendingFilter(v as typeof attendingFilter)}
        >
          <TabsList data-testid="rsvp-filter-tabs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="holy_matrimony">Holy Matrimony</TabsTrigger>
            <TabsTrigger value="reception">Reception</TabsTrigger>
            <TabsTrigger value="both">Both</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
          </TabsList>
        </Tabs>
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
            {filteredRsvps.map((rsvp) => (
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
                      {rsvp.phone && (
                        <p className="text-sm text-gray-600">{rsvp.phone}</p>
                      )}
                      {rsvp.email && (
                        <p className="text-sm text-gray-600">{rsvp.email}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(rsvp.attendanceType === "both" || rsvp.attendanceType === "holy_matrimony") && (
                        <Badge className="w-fit bg-rose-100 text-rose-800 border-rose-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Holy Matrimony
                          </div>
                        </Badge>
                      )}
                      {(rsvp.attendanceType === "both" || rsvp.attendanceType === "reception") && (
                        <Badge className="w-fit bg-purple-100 text-purple-800 border-purple-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Reception
                          </div>
                        </Badge>
                      )}
                      {rsvp.attendanceType === "decline" && (
                        <Badge className="w-fit bg-red-100 text-red-800 border-red-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Declined
                          </div>
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {rsvp.attendanceType !== "decline" && rsvp.guestCount ? (
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

            {filteredRsvps.length === 0 && rsvps.length > 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg">
                  No guests match your search
                </p>
                {attendingFilter !== "all" && (
                  <Button
                    variant="link"
                    className="text-sm mt-2"
                    onClick={() => {
                      setSearchText("");
                      setAttendingFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}

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
