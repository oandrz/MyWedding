import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { MessageSquare, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Message } from "@shared/schema";

export default function MessagesPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const {
    data: messagesData,
    isLoading,
    error,
  } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/messages"],
    retry: (failureCount, err) => {
      if (err.message.includes("401") || err.message.includes("Unauthorized")) {
        handleAutoLogout(err);
        return false;
      }
      return failureCount < 3;
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: number) =>
      apiRequest("DELETE", `/api/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({ title: "Success", description: "Message deleted successfully" });
    },
    onError: (err: Error) => {
      handleAutoLogout(err);
      toast({
        title: "Error",
        description: `Failed to delete message: ${err.message}`,
        variant: "destructive",
      });
    },
  });

  const { itemToDelete, requestDelete, confirmDelete, cancelDelete } =
    useDeleteConfirmation((id) => deleteMessageMutation.mutate(id));

  const messages = messagesData?.messages ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading messages...</p>
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
            <p className="text-red-500">Failed to load messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-rose-600" />
          <div>
            <CardTitle className="text-xl">Guest Messages</CardTitle>
            <CardDescription>View and manage guest messages</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Total messages: {messages.length}
            </p>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-gray-900">{msg.name}</h4>
                      <span className="text-xs text-gray-400">&bull;</span>
                      <span className="text-sm text-gray-500">{msg.email}</span>
                    </div>
                    <p className="text-gray-700 mb-2">{msg.content}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4">
                    {itemToDelete === msg.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={confirmDelete}
                          disabled={deleteMessageMutation.isPending}
                        >
                          {deleteMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelDelete}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => requestDelete(msg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Messages from your guests will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
