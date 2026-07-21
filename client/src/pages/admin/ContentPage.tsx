import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CONTENT_REGISTRY, CONTENT_SECTIONS, type ContentField } from "@/content/registry";
import { en } from "@/locales/en";
import { id } from "@/locales/id";
import { WEDDING_DATE, VENUES } from "@/lib/constants";

type OverrideRow = { key: string; locale: string; value: string };
type FormState = Record<string, string>; // fieldId = `${key}|${locale}` -> value

function defaultFor(field: ContentField, locale: "en" | "id" | "*"): string {
  if (field.bilingual && field.localeKey) {
    return (locale === "id" ? id : en)[field.localeKey] ?? "";
  }
  // Structural / venue defaults from constants.
  switch (field.key) {
    case "wedding.date":
      return WEDDING_DATE.toISOString();
    case "venue.matrimony.mapUrl":
      return "https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z/data=!3m1!4b1!4m9!3m8!1s0x2e69f22adf2c9a27:0x118d6eaa20e4454b!5m2!4m1!1i2!8m2!3d-6.2594469!4d106.8204341!16s%2Fg%2F11bccm83__";
    case "venue.location":
      return VENUES[0].location;
    case "venue.address":
      return VENUES[0].address;
    default:
      return "";
  }
}

function localesFor(field: ContentField): Array<"en" | "id" | "*"> {
  return field.bilingual ? ["en", "id"] : ["*"];
}

export default function ContentPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [form, setForm] = useState<FormState>({});

  const { data } = useQuery<{ overrides: OverrideRow[] }>({
    queryKey: ["/api/content-overrides"],
  });

  // Seed form: override value if present, else compiled/constant default.
  useEffect(() => {
    const overrides = data?.overrides ?? [];
    const byId: Record<string, string> = {};
    for (const o of overrides) byId[`${o.key}|${o.locale}`] = o.value;
    const next: FormState = {};
    for (const field of CONTENT_REGISTRY) {
      for (const loc of localesFor(field)) {
        const fid = `${field.key}|${loc}`;
        next[fid] = byId[fid] ?? defaultFor(field, loc);
        // Seed the datetime-local field from an ISO override (RFC3339 -> YYYY-MM-DDTHH:mm).
        if (field.key === "wedding.date" && next[fid]) {
          const d = new Date(next[fid]);
          if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, "0");
            next[fid] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }
        }
      }
    }
    setForm(next);
  }, [data]);

  const bySection = useMemo(() => {
    const groups: Record<string, ContentField[]> = {};
    for (const f of CONTENT_REGISTRY) (groups[f.section] ??= []).push(f);
    return groups;
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      // Send EVERY field's current value. Empty string = revert (tombstone):
      // buildOverrideMap skips empty values so the read path falls back to the
      // compiled/constant default. Rows equal to the default are harmless (the
      // read path returns the same text). Do NOT diff against default — a
      // datetime-local value never string-equals the ISO default, and typing a
      // default string back must still clear a stale row. ~140 rows < 500 cap.
      const overrides: OverrideRow[] = [];
      for (const field of CONTENT_REGISTRY) {
        for (const loc of localesFor(field)) {
          const fid = `${field.key}|${loc}`;
          let value = form[fid] ?? "";
          // Convert datetime-local -> RFC3339 for the wedding date (see Step 3b).
          if (field.key === "wedding.date" && value) {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) value = d.toISOString();
          }
          overrides.push({ key: field.key, locale: loc, value });
        }
      }
      await apiRequest("PATCH", "/api/admin/content-overrides/bulk", { overrides });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-overrides"] });
      toast({ title: "Success", description: "Content saved" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to save: ${error.message}`, variant: "destructive" });
    },
  });

  const setField = (fid: string, value: string) =>
    setForm((prev) => ({ ...prev, [fid]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Site Content</h2>
          <p className="text-sm text-gray-600">Edit invitation text. Blank/default fields fall back to the built-in copy.</p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="content-save">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All
        </Button>
      </div>

      {CONTENT_SECTIONS.map((section) => (
        <Card key={section}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{section}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {bySection[section].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <div className={field.bilingual ? "grid gap-3 md:grid-cols-2" : ""}>
                  {localesFor(field).map((loc) => {
                    const fid = `${field.key}|${loc}`;
                    const inputType =
                      field.type === "date" ? "datetime-local" : field.type === "url" ? "url" : "text";
                    return (
                      <div key={fid} className="space-y-1">
                        {field.bilingual && (
                          <span className="text-xs uppercase tracking-wide text-gray-400">
                            {loc === "en" ? "English" : "Indonesian"}
                          </span>
                        )}
                        {field.type === "textarea" ? (
                          <textarea
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            rows={3}
                            value={form[fid] ?? ""}
                            onChange={(e) => setField(fid, e.target.value)}
                            data-testid={`content-${field.key}-${loc}`}
                          />
                        ) : (
                          <Input
                            type={inputType}
                            value={form[fid] ?? ""}
                            onChange={(e) => setField(fid, e.target.value)}
                            data-testid={`content-${field.key}-${loc}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
