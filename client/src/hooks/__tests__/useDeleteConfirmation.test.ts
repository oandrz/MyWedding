// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteConfirmation } from "../useDeleteConfirmation";

describe("useDeleteConfirmation", () => {
  it("initially has no item to delete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    expect(result.current.itemToDelete).toBeNull();
  });

  it("requestDelete sets the item to delete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    expect(result.current.itemToDelete).toBe(42);
  });

  it("confirmDelete calls onDelete with the item and clears it", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenCalledWith(42);
    expect(result.current.itemToDelete).toBeNull();
  });

  it("confirmDelete does nothing if no item is set", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.confirmDelete());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("cancelDelete clears the item without calling onDelete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    act(() => result.current.cancelDelete());
    expect(result.current.itemToDelete).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
