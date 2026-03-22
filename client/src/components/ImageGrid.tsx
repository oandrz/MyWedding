import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, GripVertical, Plus } from "lucide-react";
import type { ConfigImage } from "@shared/schema";
import {
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------------------------------------------------------------------------
// SortableGalleryItem — a single draggable card in the gallery grid
// ---------------------------------------------------------------------------

const SortableGalleryItem = memo(function SortableGalleryItem({
  image,
  onEdit,
  onDelete,
  isDragActive,
}: {
  image: ConfigImage;
  onEdit: (image: ConfigImage) => void;
  onDelete: (image: ConfigImage) => void;
  isDragActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.imageKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragActive && !isDragging ? "none" : transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const cardClassName = isDragging
    ? "overflow-hidden ring-2 ring-pink-400 shadow-lg"
    : isDragActive
      ? "overflow-hidden transition-none"
      : "overflow-hidden";

  return (
    <Card ref={setNodeRef} style={style} className={cardClassName}>
      <div className="relative h-48">
        <img
          src={image.thumbnailUrl || image.imageUrl}
          alt={image.title || "Config image"}
          className="w-full h-full object-cover"
          loading="lazy"
          style={{ backgroundColor: "#f3f4f6", minHeight: "192px" }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.backgroundColor = "transparent";
          }}
        />
        <div className="absolute top-2 left-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing bg-white/80 hover:bg-white rounded p-1.5 shadow-sm"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-gray-600" />
          </div>
        </div>
        <div className="absolute top-2 right-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(image)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(image)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm">
          {image.title || image.imageKey}
        </h3>
        {image.description && (
          <p className="text-xs text-gray-600 mt-1">{image.description}</p>
        )}
        <p className="text-xs text-gray-500 mt-2">Key: {image.imageKey}</p>
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// ImageCard — a non-draggable card used by banner / profile / verse tabs
// ---------------------------------------------------------------------------

export const ImageCard = memo(function ImageCard({
  image,
  onEdit,
  onDelete,
}: {
  image: ConfigImage;
  onEdit: (image: ConfigImage) => void;
  onDelete?: (image: ConfigImage) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-48">
        <img
          src={image.imageUrl}
          alt={image.title || "Config image"}
          className="w-full h-full object-cover"
          loading="lazy"
          style={{ backgroundColor: "#f3f4f6", minHeight: "192px" }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.backgroundColor = "transparent";
          }}
        />
        <div className="absolute top-2 right-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(image)}>
            <Edit className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(image)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm">
          {image.title || image.imageKey}
        </h3>
        {image.description && (
          <p className="text-xs text-gray-600 mt-1">{image.description}</p>
        )}
        <p className="text-xs text-gray-500 mt-2">Key: {image.imageKey}</p>
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// AddImageCard — the dashed "click to upload" placeholder
// ---------------------------------------------------------------------------

export function AddImageCard({
  label,
  colorScheme,
  onClick,
}: {
  label: string;
  colorScheme: "rose" | "pink" | "purple" | "blue" | "amber";
  onClick: () => void;
}) {
  return (
    <Card
      className={`overflow-hidden border-2 border-dashed border-${colorScheme}-300 hover:border-${colorScheme}-400 transition-colors cursor-pointer group`}
    >
      <div
        className={`relative h-48 flex items-center justify-center bg-${colorScheme}-50 hover:bg-${colorScheme}-100 transition-colors`}
        onClick={onClick}
      >
        <div className="text-center">
          <div
            className={`w-12 h-12 mx-auto mb-3 rounded-full bg-${colorScheme}-600 flex items-center justify-center group-hover:bg-${colorScheme}-700 transition-colors`}
          >
            <Plus className="h-6 w-6 text-white" />
          </div>
          <p className={`text-${colorScheme}-700 font-medium`}>{label}</p>
          <p className={`text-${colorScheme}-600 text-sm mt-1`}>
            Click to upload
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SortableImageGrid — gallery grid with drag-and-drop support
// ---------------------------------------------------------------------------

export interface SortableImageGridProps {
  images: ConfigImage[];
  itemIds: string[];
  sensors: SensorDescriptor<SensorOptions>[];
  collisionDetection: CollisionDetection;
  isDragActive: boolean;
  activeDragImage: ConfigImage | null;
  onDragStart: (event: any) => void;
  onDragEnd: (event: any) => void;
  onEdit: (image: ConfigImage) => void;
  onDelete: (image: ConfigImage) => void;
  onAdd: () => void;
}

export function SortableImageGrid({
  images,
  itemIds,
  sensors,
  collisionDetection,
  isDragActive,
  activeDragImage,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onAdd,
}: SortableImageGridProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image) => (
            <SortableGalleryItem
              key={image.imageKey}
              image={image}
              onEdit={onEdit}
              onDelete={onDelete}
              isDragActive={isDragActive}
            />
          ))}

          <AddImageCard
            label="Add Gallery Image"
            colorScheme="pink"
            onClick={onAdd}
          />

          {images.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No gallery images configured. Default images will be used.
            </div>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeDragImage ? (
          <Card className="overflow-hidden ring-2 ring-pink-400 shadow-xl rotate-2">
            <div className="relative h-48">
              <img
                src={activeDragImage.thumbnailUrl || activeDragImage.imageUrl}
                alt={activeDragImage.title || "Dragging image"}
                className="w-full h-full object-cover"
                style={{ backgroundColor: "#f3f4f6", minHeight: "192px" }}
              />
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm">
                {activeDragImage.title || activeDragImage.imageKey}
              </h3>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// StaticImageGrid — simple grid for non-sortable image tabs
// ---------------------------------------------------------------------------

export function StaticImageGrid({
  images,
  onEdit,
  onDelete,
  emptyLabel,
  emptyColorScheme,
  onAdd,
}: {
  images: ConfigImage[];
  onEdit: (image: ConfigImage) => void;
  onDelete?: (image: ConfigImage) => void;
  emptyLabel: string;
  emptyColorScheme: "rose" | "pink" | "purple" | "blue" | "amber";
  onAdd: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      {images.length === 0 && (
        <AddImageCard
          label={emptyLabel}
          colorScheme={emptyColorScheme}
          onClick={onAdd}
        />
      )}
    </div>
  );
}
