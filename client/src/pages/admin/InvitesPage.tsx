import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { useDebounce } from "@/hooks/useDebounce";
import { Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check, Upload } from "lucide-react";
import type { Invite } from "@shared/schema";

interface InvitesResponse {
  invites: (Invite & { rsvp?: { id: number; attendanceType: string; guestCount: number | null } | null })[];
}

/** RFC 4180-aware CSV parser. Handles quoted fields and BOM. */
function parseCSV(text: string): string[][] {
  // Strip UTF-8 BOM
  const content = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(field);
        field = "";
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        if (ch === "\r") i++; // skip \n in \r\n
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

const NAME_HEADERS = ["full name", "name", "guest name", "guest", "nama", "nama lengkap"];

type ImportEntry = { name: string; checked: boolean; dupType: "none" | "existing" | "inFile" };

type ImportState =
  | { step: "upload" }
  | {
      step: "preview";
      headers: string[];
      rawRows: string[][];
      nameColumnIndex: number;
      entries: ImportEntry[];
    }
  | { step: "importing" };

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

  const [importState, setImportState] = useState<ImportState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreateMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const response = await apiRequest("POST", "/api/admin/invites/bulk", { names });
      return response.json();
    },
    onSuccess: (data: { invites: Invite[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setImportState({ step: "upload" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Success",
        description: `Created ${data.invites.length} invites`,
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      setImportState({ step: "upload" });
      toast({
        title: "Error",
        description: `Failed to import invites: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  /** Derive entries from raw CSV rows for a given column index. */
  const deriveEntries = useCallback(
    (rawRows: string[][], colIndex: number): ImportEntry[] => {
      const existingNames = new Set(
        (data?.invites ?? []).map((inv) => inv.name.toLowerCase().trim())
      );
      const seenNames = new Set<string>();

      return rawRows
        .map((row) => (row[colIndex]?.trim() ?? ""))
        .filter((name) => name.length > 0)
        .map((name) => {
          const lower = name.toLowerCase();
          let dupType: "none" | "existing" | "inFile" = "none";
          if (existingNames.has(lower)) {
            dupType = "existing";
          } else if (seenNames.has(lower)) {
            dupType = "inFile";
          }
          seenNames.add(lower);
          return { name, checked: dupType === "none", dupType };
        });
    },
    [data]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast({ title: "Error", description: "CSV has no data rows", variant: "destructive" });
          return;
        }

        const headers = rows[0].map((h) => h.trim());
        // Auto-detect name column
        let nameCol = headers.findIndex((h) =>
          NAME_HEADERS.includes(h.toLowerCase())
        );
        if (nameCol === -1) nameCol = 0; // fallback to first column

        const rawRows = rows.slice(1);
        const entries = deriveEntries(rawRows, nameCol);

        if (entries.length === 0) {
          toast({ title: "Error", description: "No names found in CSV", variant: "destructive" });
          return;
        }

        setImportState({ step: "preview", headers, rawRows, nameColumnIndex: nameCol, entries });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
      };
      reader.readAsText(file);
    },
    [data, toast, deriveEntries]
  );

  const handleToggleEntry = (index: number) => {
    setImportState((prev) => {
      if (prev.step !== "preview") return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry, i) =>
          i === index ? { ...entry, checked: !entry.checked } : entry
        ),
      };
    });
  };

  const handleColumnChange = (newIndex: number) => {
    setImportState((prev) => {
      if (prev.step !== "preview") return prev;
      const entries = deriveEntries(prev.rawRows, newIndex);
      return { ...prev, nameColumnIndex: newIndex, entries };
    });
  };

  const handleImport = () => {
    if (importState.step !== "preview") return;
    const selectedNames = importState.entries
      .filter((e) => e.checked)
      .map((e) => e.name);
    if (selectedNames.length === 0) return;
    setImportState({ step: "importing" });
    bulkCreateMutation.mutate(selectedNames);
  };

  const handleCancelImport = () => {
    setImportState({ step: "upload" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

      {/* Import from CSV */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Import from CSV</CardTitle>
          <CardDescription>
            Upload a CSV file exported from Google Sheets to bulk-create invites
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importState.step === "upload" && (
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
          )}

          {importState.step === "preview" && (
            <div className="space-y-4">
              {/* Column selector */}
              {importState.headers.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <label htmlFor="csv-name-column" className="text-gray-500">Name column:</label>
                  <select
                    id="csv-name-column"
                    value={importState.nameColumnIndex}
                    onChange={(e) => handleColumnChange(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {importState.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Summary */}
              <div className="text-sm text-gray-600">
                Found <strong>{importState.entries.length}</strong> names
                {importState.entries.filter((e) => e.dupType !== "none").length > 0 && (
                  <> — <strong className="text-amber-600">
                    {importState.entries.filter((e) => e.dupType !== "none").length} duplicates
                  </strong></>
                )}
              </div>

              {/* Name list */}
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {importState.entries.map((entry, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={entry.checked}
                      onChange={() => handleToggleEntry(i)}
                      className="rounded"
                    />
                    <span className={entry.dupType !== "none" ? "text-amber-600" : ""}>
                      {entry.name}
                    </span>
                    {entry.dupType === "existing" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Already exists
                      </span>
                    )}
                    {entry.dupType === "inFile" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Duplicate in file
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={!importState.entries.some((e) => e.checked)}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import {importState.entries.filter((e) => e.checked).length} Selected
                </Button>
                <Button variant="outline" onClick={handleCancelImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {importState.step === "importing" && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-gray-500">Creating invites...</span>
            </div>
          )}
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
