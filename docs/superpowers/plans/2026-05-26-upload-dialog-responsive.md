# Upload Dialog Responsive Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin image upload dialog usable on all screen sizes by removing unused title/description fields and restructuring it into a three-zone flex layout with a permanently visible footer button.

**Architecture:** Two sequential changes to a single component. Task 1 removes the title/description form fields and updates mutation payloads to preserve existing values on edit. Task 2 restructures the dialog into a flex column — pinned header, scrollable middle (drag zone + guidelines), pinned footer (Upload/Add buttons always visible) — using the HTML5 `form` attribute to link footer buttons to their forms by id.

**Tech Stack:** React 18, TypeScript, react-hook-form + Zod, TanStack React Query, Shadcn UI (Dialog, Tabs), Vitest + Testing Library (jsdom)

---

## File Map

| File | Change |
|------|--------|
| `client/src/components/ImageUploadModal.tsx` | Remove title/description schema fields + FormFields; update mutations; restructure layout |
| `client/src/components/__tests__/ImageUploadModal.test.tsx` | New file — one test verifying footer button linkage |

---

## Task 1: Remove title and description fields

**Files:**
- Modify: `client/src/components/ImageUploadModal.tsx:18-70` (schemas, types, form defaults, mutations)

- [ ] **Step 1: Simplify both Zod schemas**

In `client/src/components/ImageUploadModal.tsx`, replace lines 18–28:

```tsx
const urlImageSchema = z.object({
  imageUrl: z.string().url("Must be a valid URL"),
});

const fileUploadSchema = z.object({
  file: z.any().refine((file) => file instanceof File || file === undefined, "Please select a file"),
});

type UrlImageForm = z.infer<typeof urlImageSchema>;
type FileUploadForm = z.infer<typeof fileUploadSchema>;
```

- [ ] **Step 2: Update `urlForm` defaultValues**

Replace the `urlForm` `useForm` call (around line 52):

```tsx
const urlForm = useForm<UrlImageForm>({
  resolver: zodResolver(urlImageSchema),
  defaultValues: {
    imageUrl: editingImage?.imageUrl || "",
  }
});
```

- [ ] **Step 3: Update `fileForm` defaultValues**

Replace the `fileForm` `useForm` call (around line 61):

```tsx
const fileForm = useForm<FileUploadForm>({
  resolver: zodResolver(fileUploadSchema),
  defaultValues: {
    file: undefined,
  }
});
```

- [ ] **Step 4: Update `urlMutation` mutation payloads**

In `urlMutation.mutationFn` (around lines 74–91), replace both the edit and create `apiRequest` calls so title/description come from `editingImage` (not from form data):

```tsx
mutationFn: async (data: UrlImageForm) => {
  if (editingImage) {
    return apiRequest("PUT", `/api/admin/config-images/${editingImage.imageKey}`, {
      imageUrl: data.imageUrl,
      imageKey: editingImage.imageKey,
      imageType,
      isActive: true,
      title: editingImage.title ?? "",
      description: editingImage.description ?? "",
    });
  } else {
    const imageKey = imageType === "banner" ? "banner" : `gallery_${Date.now()}`;
    return apiRequest("POST", "/api/admin/config-images", {
      imageUrl: data.imageUrl,
      imageKey,
      imageType,
      isActive: true,
      title: "",
      description: "",
    });
  }
},
```

- [ ] **Step 5: Update `fileMutation` complete step payload**

In `fileMutation.mutationFn` (around lines 143–152), replace the `apiRequest` call for `/api/admin/upload/complete`:

```tsx
const completeRes = await apiRequest('POST', '/api/admin/upload/complete', {
  storagePath,
  imageKey,
  imageType,
  title: editingImage?.title ?? '',
  description: editingImage?.description ?? '',
});
```

- [ ] **Step 6: Remove title FormField from the upload tab**

In `client/src/components/ImageUploadModal.tsx`, delete the `<FormField>` block for `name="title"` inside `<TabsContent value="upload">` (around lines 435–447):

```tsx
// DELETE this entire block:
<FormField
  control={fileForm.control}
  name="title"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Title (Optional)</FormLabel>
      <FormControl>
        <Input {...field} placeholder="Image title" />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 7: Remove description FormField from the upload tab**

Delete the `<FormField>` block for `name="description"` inside `<TabsContent value="upload">` (around lines 449–461):

```tsx
// DELETE this entire block:
<FormField
  control={fileForm.control}
  name="description"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Description (Optional)</FormLabel>
      <FormControl>
        <Textarea {...field} placeholder="Image description" />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 8: Remove title and description FormFields from the URL tab**

Delete both `<FormField>` blocks for `name="title"` and `name="description"` inside `<TabsContent value="url">` (around lines 561–587). Same structure as the blocks removed in Steps 6–7, just inside the URL tab form.

- [ ] **Step 9: Remove unused `Textarea` import**

In `client/src/components/ImageUploadModal.tsx` line 9, remove `Textarea` from the import (it was only used by the removed description field):

```tsx
// Before:
import { Textarea } from "@/components/ui/textarea";

// After: delete this line entirely
```

- [ ] **Step 10: Run TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -15
```

Expected: no type errors. If you see errors referencing `title` or `description` on `data.title`, verify the mutation payloads from Steps 4–5 use `editingImage?.title` instead.

- [ ] **Step 11: Commit**

```bash
git add client/src/components/ImageUploadModal.tsx
git commit -m "refactor: remove unused title and description fields from upload dialog"
```

---

## Task 2: Flex-column layout with pinned footer

**Files:**
- Modify: `client/src/components/ImageUploadModal.tsx` (JSX structure only, no logic changes)
- Create: `client/src/components/__tests__/ImageUploadModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/__tests__/ImageUploadModal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ImageUploadModal from "../ImageUploadModal";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/hooks/useImageAnalysis", () => ({
  useImageAnalysis: () => ({
    processedImage: null,
    isProcessing: false,
    optimizeImage: vi.fn().mockResolvedValue({
      file: new File([""], "photo.jpg", { type: "image/jpeg" }),
      optimized: false,
      analysis: { isOptimalSize: true, isOptimalRatio: true },
    }),
    clearProcessedImage: vi.fn(),
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/components/ImagePreview", () => ({
  ImagePreview: () => null,
}));

describe("ImageUploadModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("footer Upload Image button is linked to upload-form via form attribute and sits outside the form", () => {
    render(
      <ImageUploadModal
        isOpen={true}
        onClose={vi.fn()}
        imageType="gallery"
      />
    );

    const form = document.getElementById("upload-form");
    expect(form).not.toBeNull();

    const submitButton = screen.getByRole("button", { name: /upload image/i });
    expect(submitButton).toHaveAttribute("form", "upload-form");
    expect(form).not.toContainElement(submitButton);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/ImageUploadModal.test.tsx 2>&1 | tail -20
```

Expected: test fails — the form has no `id`, the button has no `form` attribute, and the button is currently inside the form.

- [ ] **Step 3: Restructure the dialog return statement**

In `client/src/components/ImageUploadModal.tsx`, replace the entire `return (...)` block (line 265 to end of component) with:

```tsx
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="flex flex-col max-h-[90vh] p-6">
          {/* Pinned header */}
          <DialogHeader className="shrink-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {editingImage ? "Edit" : "Add"} {imageType === "banner" ? "Banner" : "Gallery"} Image
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  {editingImage ? "Update the image details or replace the image" : "Upload a file or add an image URL"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Tabs: pinned tab bar + scrollable content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-2">
                <Link className="h-4 w-4" />
                Add URL
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto min-h-0 py-4">
              <TabsContent value="upload" className="space-y-4 mt-0">
                <Form {...fileForm}>
                  <form id="upload-form" onSubmit={fileForm.handleSubmit(onFileSubmit)} className="space-y-4">
                    {/* Drag and Drop Area */}
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? "border-blue-400 bg-blue-50"
                          : uploadedFile
                          ? "border-green-400 bg-green-50"
                          : "border-gray-300 bg-gray-50"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      {isProcessing ? (
                        <div className="space-y-3">
                          <Settings className="h-12 w-12 text-blue-600 mx-auto animate-spin" />
                          <div>
                            <p className="text-lg font-medium text-blue-800">Processing Image...</p>
                            <p className="text-sm text-blue-600">Optimizing size and format</p>
                          </div>
                        </div>
                      ) : uploadedFile ? (
                        <div className="space-y-3">
                          {processedImage?.analysis.isOptimalSize && processedImage?.analysis.isOptimalRatio ? (
                            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto" />
                          )}
                          <div>
                            <p className="text-lg font-medium text-green-800">
                              {processedImage?.optimized ? "Image Optimized!" : "File Ready"}
                            </p>
                            <p className="text-sm text-green-600">{uploadedFile.name}</p>
                            {processedImage && (
                              <ImagePreview processedImage={processedImage} imageType={imageType} />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUploadedFile(null);
                                clearProcessedImage();
                                fileForm.setValue("file", undefined);
                              }}
                              className="mt-2"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Upload className="h-12 w-12 text-blue-400 mx-auto" />
                          <div>
                            <p className="text-lg font-medium text-blue-600">Drag a file here</p>
                            <p className="text-sm text-gray-500">Or, if you prefer...</p>
                            <Button
                              type="button"
                              className="mt-3"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Select a file from your computer
                            </Button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {/* Image Guidelines */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-medium text-blue-800">
                          Recommended {imageType === "banner" ? "Banner" : "Gallery"} Image Guidelines
                        </h4>
                      </div>
                      {imageType === "banner" ? (
                        <div className="space-y-2 text-sm text-blue-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Optimal Dimensions:</span>
                              <div className="text-xs mt-1">
                                • 1920 x 1080px (16:9 ratio)<br/>
                                • 1600 x 900px (alternative)<br/>
                                • 1280 x 720px (minimum)
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Best Practices:</span>
                              <div className="text-xs mt-1">
                                • Keep file under 200KB<br/>
                                • Use JPEG or WebP format<br/>
                                • Position subjects in upper half
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm text-blue-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Optimal Dimensions:</span>
                              <div className="text-xs mt-1">
                                • 1080 x 1080px (square)<br/>
                                • 1080 x 1350px (portrait)<br/>
                                • 1350 x 1080px (landscape)
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Best Practices:</span>
                              <div className="text-xs mt-1">
                                • Keep file under 150KB<br/>
                                • Use JPEG or WebP format<br/>
                                • Square format works best
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="url" className="space-y-4 mt-0">
                <Form {...urlForm}>
                  <form id="url-form" onSubmit={urlForm.handleSubmit(onUrlSubmit)} className="space-y-4">
                    <FormField
                      control={urlForm.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://example.com/image.jpg"
                              type="url"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Image Guidelines */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <h4 className="text-sm font-medium text-blue-800">
                          Recommended {imageType === "banner" ? "Banner" : "Gallery"} Image Guidelines
                        </h4>
                      </div>
                      {imageType === "banner" ? (
                        <div className="space-y-2 text-sm text-blue-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Optimal Dimensions:</span>
                              <div className="text-xs mt-1">
                                • 1920 x 1080px (16:9 ratio)<br/>
                                • 1600 x 900px (alternative)<br/>
                                • 1280 x 720px (minimum)
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Best Practices:</span>
                              <div className="text-xs mt-1">
                                • Keep file under 200KB<br/>
                                • Use JPEG or WebP format<br/>
                                • Position subjects in upper half
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm text-blue-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Optimal Dimensions:</span>
                              <div className="text-xs mt-1">
                                • 1080 x 1080px (square)<br/>
                                • 1080 x 1350px (portrait)<br/>
                                • 1350 x 1080px (landscape)
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Best Practices:</span>
                              <div className="text-xs mt-1">
                                • Keep file under 150KB<br/>
                                • Use JPEG or WebP format<br/>
                                • Square format works best
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </div>
          </Tabs>

          {/* Pinned footer — always visible regardless of scroll position */}
          <div className="shrink-0 flex gap-2 pt-4 border-t mt-2">
            {activeTab === "upload" ? (
              <Button
                type="submit"
                form="upload-form"
                disabled={fileMutation.isPending || !uploadedFile}
                className="flex-1"
              >
                {fileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Image"
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                form="url-form"
                disabled={urlMutation.isPending}
                className="flex-1"
              >
                {urlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Image"
                )}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/ImageUploadModal.test.tsx 2>&1 | tail -20
```

Expected: 1 test passes.

- [ ] **Step 5: TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -10
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ImageUploadModal.tsx client/src/components/__tests__/ImageUploadModal.test.tsx
git commit -m "feat: responsive flex-column layout for upload dialog with pinned footer"
```

---

## Verification

- [ ] Start the dev server: from project root run `npm run dev`, from `go-server/` run `make run-dev`
- [ ] Open `http://localhost:5173` and navigate to the admin Config page
- [ ] Open the upload dialog (click "Add Gallery Image" or "Add Banner Image")
- [ ] Resize the browser window to a narrow height (600px) — the "Upload Image" / "Add Image" button must remain visible at the bottom
- [ ] On the Upload tab: select a file, confirm the Upload Image button in the footer is enabled and clickable
- [ ] On the URL tab: enter a URL, confirm the Add Image button in the footer is enabled and clickable
- [ ] Confirm the Cancel button always works (calls onClose)
- [ ] Confirm drag-and-drop zone still accepts files
