import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Media, Rsvp } from "@shared/schema";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("media");
  const [, navigate] = useLocation();
  
  // Check if user is authenticated
  useEffect(() => {
    const adminKey = localStorage.getItem("adminKey");
    if (!adminKey) {
      toast({
        title: "Authentication required",
        description: "Please login to access the admin dashboard",
        variant: "destructive",
      });
      navigate("/admin-login");
    }
  }, [navigate, toast]);

  // Fetch all media regardless of approval status
  const { 
    data: allMedia,
    isLoading: mediaLoading,
    error: mediaError
  } = useQuery({
    queryKey: ["/api/admin/media"],
    enabled: !!localStorage.getItem("adminKey"), // Only fetch if authenticated
  });

  // Fetch all RSVPs
  const {
    data: rsvps,
    isLoading: rsvpLoading
  } = useQuery({
    queryKey: ["/api/rsvp"],
  });

  // Mutation for approving/rejecting media
  const approvalMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number, approved: boolean }) => {
      return apiRequest("PATCH", `/api/admin/media/${id}`, { approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Success",
        description: "Media approval status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update approval status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleApproval = (id: number, approved: boolean) => {
    approvalMutation.mutate({ id, approved });
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
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage RSVPs, media submissions, and messages.</p>
      </div>
      
      <Tabs defaultValue="media" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="media">Media Submissions</TabsTrigger>
          <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>
        
        {/* Media Management Tab */}
        <TabsContent value="media">
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">Media Management</h2>
            
            {mediaLoading ? (
              <div className="flex justify-center my-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : allMedia?.media ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allMedia.media.map((media: Media) => (
                  <Card key={media.id} className="overflow-hidden">
                    <div className="aspect-video relative overflow-hidden">
                      {media.mediaType === "video" ? (
                        <iframe 
                          src={media.mediaUrl} 
                          className="absolute inset-0 w-full h-full object-cover"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <img 
                          src={media.mediaUrl} 
                          alt={media.caption || "User uploaded media"} 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 right-2" variant={media.approved ? "default" : "outline"}>
                        {media.approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{media.name}</p>
                          <p className="text-sm text-muted-foreground">{media.email}</p>
                          {media.caption && <p className="mt-2">{media.caption}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant={media.approved ? "ghost" : "default"} 
                            size="icon" 
                            onClick={() => handleApproval(media.id, true)}
                            disabled={media.approved}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant={!media.approved ? "ghost" : "destructive"} 
                            size="icon" 
                            onClick={() => handleApproval(media.id, false)}
                            disabled={!media.approved}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {allMedia.media.length === 0 && (
                  <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">No media submissions yet.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">
                  {mediaError ? "Error loading media. Please check your authentication." : "No media data available."}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* RSVPs Tab */}
        <TabsContent value="rsvps">
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">RSVP Responses</h2>
            
            {rsvpLoading ? (
              <div className="flex justify-center my-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {rsvps?.rsvps?.map((rsvp: Rsvp) => (
                  <Card key={rsvp.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle>{rsvp.firstName} {rsvp.lastName}</CardTitle>
                        <Badge variant={rsvp.attending ? "default" : "secondary"}>
                          {rsvp.attending ? "Attending" : "Not Attending"}
                        </Badge>
                      </div>
                      <CardDescription>{rsvp.email}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rsvp.attending && (
                          <>
                            <div>
                              <p className="text-sm font-medium">Additional Guests</p>
                              <p>{rsvp.guestCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Dietary Restrictions</p>
                              <p>{rsvp.dietaryRestrictions || "None"}</p>
                            </div>
                          </>
                        )}
                        {rsvp.message && (
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium">Message</p>
                            <p className="italic">{rsvp.message}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {rsvps?.rsvps?.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">No RSVPs submitted yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Stats Tab */}
        <TabsContent value="stats">
          <div className="grid gap-6">
            <h2 className="text-xl font-semibold">Attendance Statistics</h2>
            
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{stats.attending}</CardTitle>
                  <CardDescription>Attending Responses</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{stats.notAttending}</CardTitle>
                  <CardDescription>Not Attending</CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{stats.totalGuests}</CardTitle>
                  <CardDescription>Total Guests Expected</CardDescription>
                </CardHeader>
              </Card>
            </div>
            
            {/* Here you could add charts or more detailed statistics */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}