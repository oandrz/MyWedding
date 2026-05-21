import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { useDeleteConfirmation } from "@/hooks/useDeleteConfirmation";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check, Upload, FileSpreadsheet,
  AlertTriangle, Users, Phone, MessageCircle, Send, ChevronDown, ChevronUp, SkipForward, Pause, Undo2, Pencil,
} from "lucide-react";
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
const PHONE_HEADERS = ["phone", "phone number", "whatsapp", "wa", "no hp", "nomor hp", "mobile"];
const SIDE_HEADERS = ["side", "pihak", "from"];

function parseSide(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === "groom" || v === "pengantin pria") return "groom";
  if (v === "bride" || v === "pengantin wanita") return "bride";
  return null;
}

type ImportEntry = { name: string; phone: string; side: string | null; checked: boolean; dupType: "none" | "existing" | "inFile" };

type ImportState =
  | { step: "upload" }
  | {
      step: "preview";
      headers: string[];
      rawRows: string[][];
      nameColumnIndex: number;
      phoneColumnIndex: number | null;
      sideColumnIndex: number | null;
      entries: ImportEntry[];
    }
  | { step: "importing" };

function isValidE164(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ""));
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/^["']+|["']+$/g, "");
  if (!trimmed.startsWith("+")) return trimmed;
  return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
}

const DEFAULT_TEMPLATE = "Hi {name}, you're invited to our wedding! RSVP here: {link}";

function renderTemplate(template: string, invite: { name: string; code: string }): string {
  const link = `${window.location.origin}/?code=${invite.code}`;
  return template
    .replace(/\{name\}/g, invite.name)
    .replace(/\{code\}/g, invite.code)
    .replace(/\{link\}/g, link);
}

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function InvitesPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [newInviteName, setNewInviteName] = useState("");
  const [newInvitePhone, setNewInvitePhone] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Inline edit state (name + phone)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editPhoneValue, setEditPhoneValue] = useState("");

  // Template editor state
  const [templateExpanded, setTemplateExpanded] = useState(false);
  const [templateText, setTemplateText] = useState(DEFAULT_TEMPLATE);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  // Send All dialog state
  const [sendAllOpen, setSendAllOpen] = useState(false);
  const [sendAllTotal, setSendAllTotal] = useState(0);
  const [sendAllSentCount, setSendAllSentCount] = useState(0);
  const [sendAllSkipCount, setSendAllSkipCount] = useState(0);
  const [lastSentInviteId, setLastSentInviteId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<InvitesResponse>({
    queryKey: ["/api/admin/invites"],
  });

  const { data: templateData } = useQuery<{ setting: { settingValue: string } }>({
    queryKey: ["/api/settings/wa_message_template"],
    retry: false,
  });

  // Sync fetched template
  useEffect(() => {
    if (templateData?.setting?.settingValue) {
      setTemplateText(templateData.setting.settingValue);
    }
  }, [templateData]);

  const createInviteMutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone?: string }) => {
      const response = await apiRequest("POST", "/api/admin/invites", {
        name,
        ...(phone ? { phone } : {}),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setNewInviteName("");
      setNewInvitePhone("");
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

  const updateInviteMutation = useMutation({
    mutationFn: async ({ id, name, phone }: { id: number; name: string; phone: string | null }) => {
      const response = await apiRequest("PATCH", `/api/admin/invites/${id}`, { name, phone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setEditingId(null);
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to update invite: ${error.message}`, variant: "destructive" });
    },
  });

  const markWaSentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PUT", `/api/admin/invites/${id}/wa-sent`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to mark sent: ${error.message}`, variant: "destructive" });
    },
  });

  const unmarkWaSentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/invites/${id}/wa-sent`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to update status: ${error.message}`, variant: "destructive" });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: string) => {
      const response = await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [{ settingKey: "wa_message_template", settingValue: template, settingType: "text" }],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/wa_message_template"] });
      toast({ title: "Saved", description: "Message template updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to save template: ${error.message}`, variant: "destructive" });
    },
  });

  const { itemToDelete, requestDelete, confirmDelete, cancelDelete } =
    useDeleteConfirmation((id) => deleteInviteMutation.mutate(id));

  const [importState, setImportState] = useState<ImportState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const bulkCreateMutation = useMutation({
    mutationFn: async (entries: { name: string; phone?: string; side?: string }[]) => {
      const response = await apiRequest("POST", "/api/admin/invites/bulk", {
        invites: entries.map((e) => ({
          name: e.name,
          ...(e.phone ? { phone: e.phone } : {}),
          ...(e.side ? { side: e.side } : {}),
        })),
      });
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

  /** Derive entries from raw CSV rows for given column indices. */
  const deriveEntries = useCallback(
    (rawRows: string[][], colIndex: number, phoneColIndex: number | null, sideColIndex: number | null = null): ImportEntry[] => {
      const existingNames = new Set(
        (data?.invites ?? []).map((inv) => inv.name.toLowerCase().trim())
      );
      const seenNames = new Set<string>();

      /** Skip values that aren't plausible names: empty, purely numeric, or summary rows. */
      const isValidName = (val: string) =>
        val.length > 0 && !/^\d+$/.test(val) && !/^total\b/i.test(val);

      return rawRows
        .map((row) => ({
          name: (row[colIndex]?.trim() ?? ""),
          phone: phoneColIndex !== null ? (row[phoneColIndex]?.trim() ?? "") : "",
          side: sideColIndex !== null ? parseSide(row[sideColIndex] ?? "") : null,
        }))
        .filter(({ name }) => isValidName(name))
        .map(({ name, phone, side }) => {
          const lower = name.toLowerCase();
          let dupType: "none" | "existing" | "inFile" = "none";
          if (existingNames.has(lower)) {
            dupType = "existing";
          } else if (seenNames.has(lower)) {
            dupType = "inFile";
          }
          seenNames.add(lower);
          return { name, phone, side, checked: dupType === "none", dupType };
        });
    },
    [data]
  );

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast({ title: "Error", description: "CSV has no data rows", variant: "destructive" });
          return;
        }
        const headers = rows[0].map((h) => h.trim());
        let nameCol = headers.findIndex((h) => NAME_HEADERS.includes(h.toLowerCase()));
        if (nameCol === -1) nameCol = 0;
        let phoneCol: number | null = headers.findIndex((h) => PHONE_HEADERS.includes(h.toLowerCase()));
        if (phoneCol === -1) phoneCol = null;
        const sideColIdx = headers.findIndex(h =>
          SIDE_HEADERS.includes(h.toLowerCase().trim())
        );
        const resolvedSideIdx = sideColIdx >= 0 ? sideColIdx : null;
        const rawRows = rows.slice(1);
        const entries = deriveEntries(rawRows, nameCol, phoneCol, resolvedSideIdx);
        if (entries.length === 0) {
          toast({ title: "Error", description: "No names found in CSV", variant: "destructive" });
          return;
        }
        setImportState({ step: "preview", headers, rawRows, nameColumnIndex: nameCol, phoneColumnIndex: phoneCol, sideColumnIndex: resolvedSideIdx, entries });
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
      };
      reader.readAsText(file);
    },
    [toast, deriveEntries]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounterRef.current = 0;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

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

  const handleToggleAll = (checked: boolean) => {
    setImportState((prev) => {
      if (prev.step !== "preview") return prev;
      return {
        ...prev,
        entries: prev.entries.map((entry) => ({ ...entry, checked })),
      };
    });
  };

  const handleColumnChange = (newIndex: number) => {
    setImportState((prev) => {
      if (prev.step !== "preview") return prev;
      const entries = deriveEntries(prev.rawRows, newIndex, prev.phoneColumnIndex, prev.sideColumnIndex);
      return { ...prev, nameColumnIndex: newIndex, entries };
    });
  };

  const handlePhoneColumnChange = (newIndex: number | null) => {
    setImportState((prev) => {
      if (prev.step !== "preview") return prev;
      const entries = deriveEntries(prev.rawRows, prev.nameColumnIndex, newIndex, prev.sideColumnIndex);
      return { ...prev, phoneColumnIndex: newIndex, entries };
    });
  };

  const handleImport = () => {
    if (importState.step !== "preview") return;
    const selected = importState.entries
      .filter((e) => e.checked)
      .map((e) => {
        const phone = e.phone ? normalizePhone(e.phone) : "";
        return { name: e.name, ...(phone ? { phone } : {}), ...(e.side ? { side: e.side } : {}) };
      });
    if (selected.length === 0) return;
    setImportState({ step: "importing" });
    bulkCreateMutation.mutate(selected);
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
    const q = debouncedSearch.toLowerCase();
    return invites.filter((invite) =>
      invite.name.toLowerCase().includes(q) ||
      invite.code.toLowerCase().includes(q) ||
      (invite.phone && invite.phone.includes(q))
    );
  }, [invites, debouncedSearch]);

  // WA stats
  const sentCount = invites.filter((i) => i.waSentAt).length;
  const withPhone = invites.filter((i) => i.phone).length;

  // Send All: unsent invites with phone
  const unsentWithPhone = useMemo(
    () => invites
      .filter((i) => i.phone && !i.waSentAt)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [invites]
  );

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newInviteName.trim();
    if (!trimmed) return;
    createInviteMutation.mutate({
      name: trimmed,
      ...(newInvitePhone.trim() ? { phone: normalizePhone(newInvitePhone.trim()) } : {}),
    });
  };

  const handleEditSave = (inviteId: number) => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName) {
      toast({ title: "Invalid name", description: "Name cannot be empty", variant: "destructive" });
      return;
    }
    const trimmedPhone = editPhoneValue.trim();
    let phone: string | null = null;
    if (trimmedPhone) {
      const normalized = normalizePhone(trimmedPhone);
      if (!isValidE164(normalized)) {
        toast({ title: "Invalid phone", description: "Phone must be in international format (e.g. +6281234567890)", variant: "destructive" });
        return;
      }
      phone = normalized;
    }
    updateInviteMutation.mutate({ id: inviteId, name: trimmedName, phone });
  };

  const insertTemplateVar = (varName: string) => {
    const textarea = templateRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = templateText.slice(0, start);
    const after = templateText.slice(end);
    setTemplateText(before + varName + after);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    });
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

  // Send All handlers
  const currentSendInvite = sendAllOpen
    ? unsentWithPhone.find((i) => !sentIds.has(i.id) && !skippedIds.has(i.id))
    : undefined;
  const sendInFlightRef = useRef(false);

  const handleSendAndNext = () => {
    if (!currentSendInvite || sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    // Open wa.me deep link
    const msg = renderTemplate(templateText, currentSendInvite);
    const result = window.open(buildWaLink(currentSendInvite.phone!, msg), "_blank");
    if (!result) {
      toast({ title: "Popup blocked", description: "Please allow popups for this site", variant: "destructive" });
    }

    // Track for undo
    setLastSentInviteId(currentSendInvite.id);

    // Mark sent and advance
    markWaSentMutation.mutate(currentSendInvite.id, {
      onSuccess: () => {
        setSendAllSentCount((c) => c + 1);
        setSentIds((prev) => { const next = new Set(prev); next.add(currentSendInvite.id); return next; });
      },
      onSettled: () => {
        sendInFlightRef.current = false;
      },
    });
  };

  const handleSendAllSkip = () => {
    if (!currentSendInvite) return;
    setSendAllSkipCount((c) => c + 1);
    setSkippedIds((prev) => { const next = new Set(prev); next.add(currentSendInvite.id); return next; });
  };

  const handleUndo = () => {
    if (lastSentInviteId === null) return;
    const idToUndo = lastSentInviteId;
    unmarkWaSentMutation.mutate(idToUndo, {
      onSuccess: () => {
        setSendAllSentCount((c) => Math.max(0, c - 1));
        setSentIds((prev) => {
          const next = new Set(prev);
          next.delete(idToUndo);
          return next;
        });
        setLastSentInviteId(null);
      },
    });
  };

  // Refs for stable keyboard shortcut access to handlers
  const handleSendAndNextRef = useRef(handleSendAndNext);
  handleSendAndNextRef.current = handleSendAndNext;
  const handleSendAllSkipRef = useRef(handleSendAllSkip);
  handleSendAllSkipRef.current = handleSendAllSkip;
  const isPendingRef = useRef(false);
  isPendingRef.current = markWaSentMutation.isPending || unmarkWaSentMutation.isPending;

  // Keyboard shortcuts for Send All dialog
  useEffect(() => {
    if (!sendAllOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;

      if (isPendingRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleSendAndNextRef.current();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSendAllSkipRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sendAllOpen]);

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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
        <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">{sentCount}</CardTitle>
            <CardDescription className="text-green-100">WA Sent</CardDescription>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">{withPhone - sentCount}</CardTitle>
            <CardDescription className="text-gray-200">WA Unsent</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Send All button */}
      {unsentWithPhone.length > 0 && (
        <Button
          onClick={() => { setSendAllTotal(unsentWithPhone.length); setSentIds(new Set()); setSkippedIds(new Set()); setSendAllSentCount(0); setSendAllSkipCount(0); setLastSentInviteId(null); setSendAllOpen(true); }}
          className="gap-2"
          variant="outline"
        >
          <MessageCircle className="h-4 w-4" />
          Send All Unsent ({unsentWithPhone.length})
        </Button>
      )}

      {/* Message Template Editor */}
      <Card>
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setTemplateExpanded(!templateExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle className="text-lg">WhatsApp Message Template</CardTitle>
                <CardDescription>Customize the message sent via WhatsApp</CardDescription>
              </div>
            </div>
            {templateExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
        </CardHeader>
        {templateExpanded && (
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["{name}", "{code}", "{link}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertTemplateVar(v)}
                  className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-mono"
                >
                  {v}
                </button>
              ))}
            </div>
            <Textarea
              ref={templateRef}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Preview (sample data):</p>
              <p className="text-sm whitespace-pre-wrap">
                {renderTemplate(templateText, { name: "John Doe", code: "abc12" })}
              </p>
            </div>
            <Button
              onClick={() => saveTemplateMutation.mutate(templateText)}
              disabled={saveTemplateMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {saveTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Template
            </Button>
          </CardContent>
        )}
      </Card>

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
            <Input
              placeholder="Phone (optional, e.g. +62...)"
              value={newInvitePhone}
              onChange={(e) => setNewInvitePhone(e.target.value)}
              className="w-48"
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

      {/* Import from CSV — drag-and-drop zone */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-lg">Bulk Import</CardTitle>
              <CardDescription>
                Drop a CSV file or click to browse — supports name and phone columns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload CSV file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            className={`
              w-full rounded-lg border-2 border-dashed p-8
              flex flex-col items-center gap-3
              transition-all duration-200 cursor-pointer
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              ${isDragging
                ? "border-amber-400 bg-amber-50 scale-[1.01]"
                : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/50"
              }
            `}
          >
            {importState.step === "importing" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <span className="text-sm font-medium text-gray-600">Creating invites...</span>
              </>
            ) : (
              <>
                <div className={`rounded-full p-3 transition-colors ${isDragging ? "bg-amber-100" : "bg-gray-100"}`}>
                  <Upload className={`h-6 w-6 ${isDragging ? "text-amber-600" : "text-gray-400"}`} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">
                    {isDragging ? "Drop your CSV file here" : "Drag & drop a CSV file"}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">or click to browse your files</p>
                </div>
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* CSV Preview Dialog */}
      <Dialog
        open={importState.step === "preview"}
        onOpenChange={(open) => { if (!open) handleCancelImport(); }}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              Review Import
            </DialogTitle>
            <DialogDescription>
              Select which guests to import. Duplicates are unchecked by default.
            </DialogDescription>
          </DialogHeader>

          {importState.step === "preview" && (() => {
            const checkedCount = importState.entries.filter((e) => e.checked).length;
            const dupCount = importState.entries.filter((e) => e.dupType !== "none").length;
            const allChecked = checkedCount === importState.entries.length;
            const phonesDetected = importState.phoneColumnIndex !== null;
            const groomCount = importState.entries.filter(e => e.checked && e.side === "groom").length;
            const brideCount = importState.entries.filter(e => e.checked && e.side === "bride").length;
            const noSideCount = importState.entries.filter(e => e.checked && !e.side).length;

            return (
              <div className="flex flex-col gap-4 min-h-0">
                {/* Column selectors */}
                {importState.headers.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor="csv-name-column" className="text-sm text-muted-foreground whitespace-nowrap">
                        Name column:
                      </label>
                      <Select
                        value={String(importState.nameColumnIndex)}
                        onValueChange={(v) => handleColumnChange(Number(v))}
                      >
                        <SelectTrigger id="csv-name-column" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {importState.headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {h || `Column ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="csv-phone-column" className="text-sm text-muted-foreground whitespace-nowrap">
                        Phone column:
                      </label>
                      <Select
                        value={importState.phoneColumnIndex !== null ? String(importState.phoneColumnIndex) : "none"}
                        onValueChange={(v) => handlePhoneColumnChange(v === "none" ? null : Number(v))}
                      >
                        <SelectTrigger id="csv-phone-column" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {importState.headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {h || `Column ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Stats bar */}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{importState.entries.length}</span>
                    <span className="text-muted-foreground">found</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">{checkedCount}</span>
                    <span className="text-muted-foreground">selected</span>
                  </div>
                  {dupCount > 0 && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-amber-600">{dupCount}</span>
                        <span className="text-muted-foreground">duplicates</span>
                      </div>
                    </>
                  )}
                  {phonesDetected && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-600">
                          {importState.entries.filter((e) => e.phone && isValidE164(normalizePhone(e.phone))).length}
                        </span>
                        <span className="text-muted-foreground">with phone</span>
                      </div>
                    </>
                  )}
                  {importState.sideColumnIndex !== null && (
                    <>
                      {groomCount > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span>🤵 <strong>{groomCount}</strong> groom</span>
                        </>
                      )}
                      {brideCount > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span>👰 <strong>{brideCount}</strong> bride</span>
                        </>
                      )}
                      {noSideCount > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="text-amber-600">⚠️ <strong>{noSideCount}</strong> no side</span>
                        </>
                      )}
                    </>
                  )}
                </div>

                <Separator />

                {/* Select all toggle */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(checked) => handleToggleAll(!!checked)}
                    />
                    <span className="text-muted-foreground">Select all</span>
                  </label>
                </div>

                {/* Name + phone list */}
                <div className="max-h-[40vh] overflow-y-auto rounded-md border">
                  <div className="divide-y">
                    {importState.entries.map((entry, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={entry.checked}
                          onCheckedChange={() => handleToggleEntry(i)}
                        />
                        <span className={`flex-1 text-sm ${entry.dupType !== "none" ? "text-muted-foreground" : ""}`}>
                          {entry.name}
                        </span>
                        {entry.phone && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {entry.phone}
                            {!isValidE164(normalizePhone(entry.phone)) && (
                              <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />
                            )}
                          </span>
                        )}
                        {importState.sideColumnIndex !== null && (
                          <>
                            {entry.side === "groom" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🤵 groom</span>
                            )}
                            {entry.side === "bride" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">👰 bride</span>
                            )}
                            {entry.side === null && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⚠️ no side</span>
                            )}
                          </>
                        )}
                        {entry.dupType === "existing" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                            Already exists
                          </Badge>
                        )}
                        {entry.dupType === "inFile" && (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-xs">
                            Duplicate in file
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {importState.sideColumnIndex !== null && noSideCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 mt-2">
                    ⚠️ {noSideCount} guest{noSideCount > 1 ? "s have" : " has"} no side — they'll be imported but skipped during automated WhatsApp sending.
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={handleCancelImport}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={checkedCount === 0}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import {checkedCount} {checkedCount === 1 ? "guest" : "guests"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}</DialogContent>
      </Dialog>

      {/* Send All Dialog */}
      <Dialog open={sendAllOpen} onOpenChange={setSendAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Send WhatsApp Messages
            </DialogTitle>
            <DialogDescription>
              Step through unsent invites one at a time
            </DialogDescription>
          </DialogHeader>

          {currentSendInvite && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{sendAllSentCount + sendAllSkipCount + 1} of {sendAllTotal}</span>
                <div className="flex gap-3">
                  <span className="text-green-600">Sent: {sendAllSentCount}</span>
                  <span className="text-gray-400">Skipped: {sendAllSkipCount}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((sendAllSentCount + sendAllSkipCount) / sendAllTotal) * 100}%` }}
                />
              </div>

              {/* Current invite */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{currentSendInvite.name}</h4>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{currentSendInvite.code}</code>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{currentSendInvite.phone}</p>
                </CardContent>
              </Card>

              {/* Message preview */}
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-green-700 mb-1 font-medium">Message preview:</p>
                <p className="text-sm whitespace-pre-wrap text-green-900">
                  {renderTemplate(templateText, currentSendInvite)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleSendAndNext}
                  disabled={markWaSentMutation.isPending}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                  autoFocus
                >
                  {markWaSentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send & Next
                </Button>
              </div>
              <div className="flex gap-2">
                {lastSentInviteId !== null && (
                  <Button
                    onClick={handleUndo}
                    disabled={unmarkWaSentMutation.isPending}
                    variant="ghost"
                    className="gap-2"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </Button>
                )}
                <Button onClick={handleSendAllSkip} disabled={markWaSentMutation.isPending} variant="ghost" className="gap-2">
                  <SkipForward className="h-4 w-4" />
                  Skip
                </Button>
                <Button onClick={() => setSendAllOpen(false)} variant="ghost" className="gap-2">
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Enter to send &middot; S to skip &middot; Esc to pause
              </p>
            </div>
          )}

          {!currentSendInvite && sendAllOpen && (
            <div className="text-center py-6">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold">All done!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sent: {sendAllSentCount}, Skipped: {sendAllSkipCount}
              </p>
              <div className="flex justify-center gap-2 mt-4">
                {lastSentInviteId !== null && (
                  <Button
                    onClick={handleUndo}
                    disabled={unmarkWaSentMutation.isPending}
                    variant="outline"
                    className="gap-2"
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo Last
                  </Button>
                )}
                <Button onClick={() => setSendAllOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search */}
      {invites.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, code, or phone..."
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
              <CardDescription>Manage invite codes, phone numbers, and track RSVPs</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!sendAllOpen && filteredInvites.map((invite) => (
              <Card key={invite.id} className={`shadow-sm border-l-4 border-l-amber-500 ${editingId === invite.id ? "border-indigo-300" : ""}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {editingId === invite.id ? (
                      /* ── Edit mode ── */
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="h-8 text-sm font-semibold"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(invite.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <div className="flex items-center gap-3">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                            {invite.code}
                          </code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <Input
                            value={editPhoneValue}
                            onChange={(e) => setEditPhoneValue(e.target.value)}
                            placeholder="+62..."
                            className="w-44 h-7 text-xs font-mono"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(invite.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditSave(invite.id)}
                            disabled={updateInviteMutation.isPending}
                          >
                            {updateInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
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
                        <div className="flex items-center gap-2 mt-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {invite.phone ? (
                            <span className="text-xs font-mono text-muted-foreground">{invite.phone}</span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">No phone</span>
                          )}
                          {invite.phone && (
                            <button
                              onClick={() => {
                                const msg = renderTemplate(templateText, invite);
                                window.open(buildWaLink(invite.phone!, msg), "_blank");
                              }}
                              className="text-green-600 hover:text-green-700 transition-colors"
                              title="Send via WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Status badges — faded during edit mode */}
                      <div className={`flex items-center gap-3 flex-wrap transition-opacity ${editingId === invite.id ? "opacity-40 pointer-events-none" : ""}`}>
                        {invite.waSentAt ? (
                          <button
                            onClick={() => unmarkWaSentMutation.mutate(invite.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200 transition-colors"
                            title="Click to mark as unsent"
                          >
                            WA Sent
                          </button>
                        ) : invite.phone ? (
                          <button
                            onClick={() => markWaSentMutation.mutate(invite.id)}
                            className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition-colors"
                            title="Click to mark as sent"
                          >
                            WA Unsent
                          </button>
                        ) : null}

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
                      </div>

                      {editingId !== invite.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(invite.id);
                            setEditNameValue(invite.name);
                            setEditPhoneValue(invite.phone ?? "");
                          }}
                          className="text-gray-400 hover:text-blue-500"
                          title="Edit guest"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
