import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, GripVertical, Pencil, Trash2, Loader2, Plus, X, Check } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  description: string;
  sortOrder: number;
  createdAt: string;
}

interface SortableRowProps {
  event: ScheduleEvent;
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function SortableRow({ event, onEdit, onDelete, isDeleting }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 px-4 py-3 border rounded-lg bg-white"
      data-testid={`schedule-row-${event.id}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{event.title}</p>
        <p className="text-xs text-muted-foreground">{event.time}</p>
        <p className="text-xs text-foreground/70 mt-0.5 line-clamp-2">{event.description}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(event)}
          data-testid={`button-edit-${event.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(event.id)}
          disabled={isDeleting}
          className="text-rose-500 border-rose-200 hover:bg-rose-50"
          data-testid={`button-delete-${event.id}`}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

const emptyForm = { title: "", time: "", description: "" };

export default function SchedulePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ scheduleEvents: ScheduleEvent[] }>({
    queryKey: ["/api/schedule"],
  });

  useEffect(() => {
    if (data?.scheduleEvents) {
      setEvents(data.scheduleEvents);
    }
  }, [data]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleMutationError = (error: Error) => {
    handleAutoLogout(error);
    toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const createMutation = useMutation({
    mutationFn: (body: typeof addForm) =>
      apiRequest("POST", "/api/admin/schedule", {
        ...body,
        sortOrder: events.length,
      }),
    onSuccess: async (res) => {
      const data = await res.json();
      setEvents(prev => [...prev, data.scheduleEvent]);
      setAddForm(emptyForm);
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Created", description: "Schedule event added" });
    },
    onError: handleMutationError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      apiRequest("PUT", `/api/admin/schedule/${id}`, body),
    onSuccess: async (res) => {
      const data = await res.json();
      setEvents(prev => prev.map(e => e.id === data.scheduleEvent.id ? data.scheduleEvent : e));
      setEditingEvent(null);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Saved", description: "Schedule event updated" });
    },
    onError: handleMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/schedule/${id}`),
    onSuccess: (_, id) => {
      setEvents(prev => prev.filter(e => e.id !== id));
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Deleted", description: "Schedule event removed" });
    },
    onError: (error: Error) => {
      setDeletingId(null);
      handleMutationError(error);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PATCH", "/api/admin/schedule/reorder", { events: items }),
    onError: (error: Error) => {
      if (data?.scheduleEvents) setEvents(data.scheduleEvents);
      handleMutationError(error);
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = events.findIndex(e => e.id === active.id);
    const newIndex = events.findIndex(e => e.id === over.id);
    const reordered = arrayMove(events, oldIndex, newIndex).map((e, i) => ({
      ...e,
      sortOrder: i,
    }));
    setEvents(reordered);
    reorderMutation.mutate(reordered.map(e => ({ id: e.id, sortOrder: e.sortOrder })));
  };

  const handleEditStart = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setEditForm({ title: event.title, time: event.time, description: event.description });
    setShowAddForm(false);
  };

  const handleEditSave = () => {
    if (!editingEvent || !editForm.title.trim() || !editForm.time.trim() || !editForm.description.trim()) return;
    updateMutation.mutate({ id: editingEvent.id, body: editForm });
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const handleAddSave = () => {
    if (!addForm.title.trim() || !addForm.time.trim() || !addForm.description.trim()) return;
    createMutation.mutate(addForm);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-rose-500" />
          <div>
            <CardTitle className="text-xl">Wedding Day Schedule</CardTitle>
            <CardDescription>Manage and reorder the events shown to guests</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : (
          <>
            {/* Event list with drag-and-drop */}
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Events ({events.length})
            </p>

            {events.length === 0 && !showAddForm ? (
              <div className="text-center py-8 border border-dashed border-rose-200 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground italic">
                  No events yet — add your first one below
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={events.map(e => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 mb-4">
                    {events.map(event =>
                      editingEvent?.id === event.id ? (
                        <div
                          key={event.id}
                          className="border-2 border-rose-400 rounded-lg p-4 bg-rose-50/50 space-y-3"
                          data-testid={`edit-form-${event.id}`}
                        >
                          <div className="space-y-1">
                            <Label htmlFor="edit-title">Title</Label>
                            <Input
                              id="edit-title"
                              value={editForm.title}
                              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-time">Time</Label>
                            <Input
                              id="edit-time"
                              value={editForm.time}
                              onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                              placeholder="e.g. 2:00 PM - 3:00 PM"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea
                              id="edit-description"
                              value={editForm.description}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleEditSave}
                              disabled={updateMutation.isPending || !editForm.title.trim() || !editForm.time.trim() || !editForm.description.trim()}
                            >
                              {updateMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                              Save
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingEvent(null)}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <SortableRow
                          key={event.id}
                          event={event}
                          onEdit={handleEditStart}
                          onDelete={handleDelete}
                          isDeleting={deletingId === event.id}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add event form */}
            {showAddForm ? (
              <div className="border-2 border-rose-300 rounded-lg p-4 bg-rose-50/30 space-y-3 mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New Event</p>
                <div className="space-y-1">
                  <Label htmlFor="add-title">Title</Label>
                  <Input
                    id="add-title"
                    value={addForm.title}
                    onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Holy Matrimony"
                    autoFocus
                    data-testid="input-add-title"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-time">Time</Label>
                  <Input
                    id="add-time"
                    value={addForm.time}
                    onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))}
                    placeholder="e.g. 2:00 PM - 3:00 PM"
                    data-testid="input-add-time"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-description">Description</Label>
                  <Textarea
                    id="add-description"
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this event"
                    rows={2}
                    data-testid="input-add-description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddSave}
                    disabled={createMutation.isPending || !addForm.title.trim() || !addForm.time.trim() || !addForm.description.trim()}
                    data-testid="button-save-add"
                  >
                    {createMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                    Add Event
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowAddForm(false); setAddForm(emptyForm); }}
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed border-rose-300 text-rose-600 hover:bg-rose-50"
                onClick={() => { setShowAddForm(true); setEditingEvent(null); }}
                data-testid="button-add-event"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
