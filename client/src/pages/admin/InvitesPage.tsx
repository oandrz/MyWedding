import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check } from "lucide-react";
import type { Invite } from "@shared/schema";

interface InvitesResponse {
  invites: (Invite & { rsvp?: { id: number; attendanceType: string; guestCount: number | null } | null })[];
}

export default function InvitesPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [newInviteName, setNewInviteName] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<InvitesResponse>({
    queryKey: ["/api/admin/invites"],
  });

  const createInviteMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/admin/invites", { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setNewInviteName("");
      toast({ title: "Success", description: "Invite created successfully" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to create invite: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: (inviteId: number) => {
      return apiRequest("DELETE", `/api/admin/invites/${inviteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rsvp"] });
      toast({ title: "Success", description: "Invite deleted successfully" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to delete invite: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const { itemToDelete, requestDelete, confirmDelete, cancelDelete } =
    useDeleteConfirmation((id) => deleteInviteMutation.mutate(id));

  const invites = data?.invites ?? [];

  // Search state
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 300);

  const filteredInvites = useMemo(() => {
    if (!debouncedSearch) return invites;
    return invites.filter((invite) =>
      invite.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      invite.code.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [invites, debouncedSearch]);

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newInviteName.trim();
    if (!trimmed) return;
    createInviteMutation.mutate(trimmed);
  };

  const copyInviteLink = async (invite: Invite) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?code=${invite.code}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied!", description: "Invite link copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy link" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
        <p className="text-gray-500">Loading invites...</p>
      </div>
    );
  }

  const rsvpCount = invites.filter((i) => i.rsvp).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">{invites.length}</CardTitle>
            <CardDescription className="text-amber-100">Total Invites</CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">{rsvpCount}</CardTitle>
            <CardDescription className="text-emerald-100">RSVPs Received</CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">{invites.length - rsvpCount}</CardTitle>
            <CardDescription className="text-sky-100">Pending RSVPs</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Create Invite */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Create New Invite</CardTitle>
          <CardDescription>Enter a guest name to generate a unique invite code</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateInvite} className="flex gap-3">
            <Input
              placeholder="Guest name..."
              value={newInviteName}
              onChange={(e) => setNewInviteName(e.target.value)}
              className="flex-1"
              data-testid="invite-name-input"
            />
            <Button
              type="submit"
              disabled={!newInviteName.trim() || createInviteMutation.isPending}
              className="gap-2"
            >
              {createInviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      {invites.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or code..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 pr-10"
            data-testid="invite-search-input"
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
      )}

      {/* Invites List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <TicketCheck className="h-6 w-6 text-amber-600" />
            <div>
              <CardTitle className="text-xl">Guest Invites</CardTitle>
              <CardDescription>Manage invite codes and track RSVPs</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvites.map((invite) => (
              <Card key={invite.id} className="shadow-sm border-l-4 border-l-amber-500">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">{invite.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                          {invite.code}
                        </code>
                        <button
                          onClick={() => copyInviteLink(invite)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy invite link"
                        >
                          {copiedId === invite.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {invite.rsvp ? (
                        <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                          RSVP: {invite.rsvp.attendanceType === "decline" ? "Declined" :
                            invite.rsvp.attendanceType === "both" ? "Both Events" :
                            invite.rsvp.attendanceType === "holy_matrimony" ? "Holy Matrimony" : "Reception"}
                        </span>
                      ) : (
                        <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                          Pending
                        </span>
                      )}

                      {itemToDelete === invite.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Delete?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={confirmDelete}
                            disabled={deleteInviteMutation.isPending}
                          >
                            {deleteInviteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Yes"
                            )}
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelDelete}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestDelete(invite.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredInvites.length === 0 && invites.length > 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg">No invites match your search</p>
              </div>
            )}

            {invites.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <TicketCheck className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-lg">No invites yet</p>
                <p className="text-sm text-gray-400">Create an invite above to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
