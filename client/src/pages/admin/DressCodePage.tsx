import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Loader2 } from "lucide-react";

interface DressCodeColor {
  hex: string;
  label: string;
}

export default function DressCodePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const hasInitializedRef = useRef(false);

  const [colors, setColors] = useState<DressCodeColor[]>([]);
  const [newHex, setNewHex] = useState("#FFFFFF");
  const [newLabel, setNewLabel] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editHex, setEditHex] = useState("#FFFFFF");
  const [editLabel, setEditLabel] = useState("");

  const { data: settingsData } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (settingsData?.settings && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const raw = settingsData.settings.find(s => s.settingKey === "dress_code_colors")?.settingValue ?? "[]";
      try {
        const parsed = JSON.parse(raw);
        setColors(Array.isArray(parsed) ? parsed : []);
      } catch {
        setColors([]);
      }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: (updatedColors: DressCodeColor[]) =>
      apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [{
          settingKey: "dress_code_colors",
          settingValue: JSON.stringify(updatedColors),
          settingType: "json",
          description: "Forbidden attire colors for dress code section",
        }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Saved", description: "Dress code colors updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to save: ${error.message}`, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    setColors(prev => [...prev, { hex: newHex, label: newLabel.trim() }]);
    setNewLabel("");
    setNewHex("#FFFFFF");
  };

  const handleRemove = (index: number) => {
    setColors(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditHex(colors[index].hex);
    setEditLabel(colors[index].label);
  };

  const handleEditSave = () => {
    if (editingIndex === null || !editLabel.trim()) return;
    setColors(prev =>
      prev.map((c, i) => i === editingIndex ? { hex: editHex, label: editLabel.trim() } : c)
    );
    setEditingIndex(null);
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditHex("#FFFFFF");
    setEditLabel("");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-rose-500" />
          <div>
            <CardTitle className="text-xl">Dress Code Colors</CardTitle>
            <CardDescription>Add or remove colors guests should avoid wearing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add new color */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Add Color</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
              <input
                type="color"
                value={newHex}
                onChange={e => setNewHex(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
                data-testid="input-new-hex"
              />
              <span className="text-sm text-muted-foreground font-mono">{newHex}</span>
            </div>
            <Input
              placeholder="Color name (e.g. White)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="flex-1 min-w-[160px]"
              data-testid="input-new-label"
            />
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              data-testid="button-add-color"
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Color list */}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Current Colors</p>

        {colors.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-rose-200 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground italic" data-testid="empty-state">
              No colors yet — use the form above to add some
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {colors.map((color, index) =>
              index === editingIndex ? (
                <div
                  key={index}
                  className="flex flex-col gap-2 px-4 py-3 border-2 border-rose-400 rounded-lg bg-rose-50/50"
                  data-testid={`color-row-${index}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
                      <input
                        type="color"
                        value={editHex}
                        onChange={e => setEditHex(e.target.value)}
                        className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-sm text-muted-foreground font-mono">{editHex}</span>
                    </div>
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleEditSave();
                        if (e.key === "Escape") handleEditCancel();
                      }}
                      className="flex-1 min-w-[160px]"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleEditSave} disabled={!editLabel.trim()}>
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleEditCancel}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="flex items-center justify-between px-4 py-3 border rounded-lg bg-white"
                  data-testid={`color-row-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full border-2 border-primary/30 shadow-sm flex-shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{color.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{color.hex}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditStart(index)}
                      data-testid={`button-edit-${index}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      className="text-rose-500 border-rose-200 hover:bg-rose-50"
                      data-testid={`button-remove-${index}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <Button
          onClick={() => saveMutation.mutate(colors)}
          disabled={saveMutation.isPending}
          className="w-full"
          data-testid="button-save"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
