import { useState } from "react";

export function useDeleteConfirmation(onDelete: (id: number) => void) {
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const requestDelete = (id: number) => setItemToDelete(id);

  const confirmDelete = () => {
    if (itemToDelete !== null) {
      onDelete(itemToDelete);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => setItemToDelete(null);

  return { itemToDelete, requestDelete, confirmDelete, cancelDelete };
}
