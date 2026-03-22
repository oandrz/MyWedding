import { useState, useMemo, useCallback } from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export interface UseDragAndDropOptions<T> {
  /** The items to sort — must be a stable reference or memoised array */
  items: T[];
  /** Extract a unique string id from each item */
  getId: (item: T) => string;
  /** Called with the new ordered list of ids after a successful drop */
  onReorder: (orderedIds: string[]) => void;
}

export function useDragAndDrop<T>({
  items,
  getId,
  onReorder,
}: UseDragAndDropOptions<T>) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const itemIds = useMemo(() => items.map(getId), [items, getId]);

  const activeDragItem = activeDragId
    ? items.find((item) => getId(item) === activeDragId) ?? null
    : null;

  const isDragActive = activeDragId !== null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => getId(item) === active.id);
      const newIndex = items.findIndex((item) => getId(item) === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(reordered.map(getId));
    },
    [items, getId, onReorder],
  );

  return {
    sensors,
    collisionDetection: closestCenter,
    activeDragId,
    activeDragItem,
    isDragActive,
    itemIds,
    handleDragStart,
    handleDragEnd,
  };
}
