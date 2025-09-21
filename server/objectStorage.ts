import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service for wedding platform
export class WeddingObjectStorageService {
  private bucketName: string;

  constructor() {
    // Use the correct Replit object storage bucket ID
    this.bucketName = "replit-objstore-30de2592-4295-4164-8745-22a43455c0ca";
  }

  // Upload a file to object storage and return the public URL
  async uploadFile(buffer: Buffer, filename: string, contentType: string, directory: string = "uploads"): Promise<string> {
    const bucket = objectStorageClient.bucket(this.bucketName);
    const objectName = `${directory}/${filename}`;
    const file = bucket.file(objectName);

    await file.save(buffer, {
      metadata: {
        contentType,
      },
      // Don't make public - Replit object storage handles access
    });

    // Return the Replit object storage URL  
    return `/storage/${objectName}`;
  }

  // Upload a file for admin images
  async uploadAdminImage(buffer: Buffer, filename: string, contentType: string, imageType: "banner" | "gallery"): Promise<string> {
    const directory = imageType === "banner" ? "admin/banner" : "admin/gallery";
    return this.uploadFile(buffer, filename, contentType, directory);
  }

  // Generate a presigned URL for direct uploads
  async getUploadUrl(filename: string, contentType: string, directory: string = "uploads"): Promise<string> {
    const bucket = objectStorageClient.bucket(this.bucketName);
    const objectName = `${directory}/${filename}`;
    const file = bucket.file(objectName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    return url;
  }

  // Download and stream a file
  async downloadFile(objectPath: string, res: Response): Promise<void> {
    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(objectPath);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new ObjectNotFoundError();
      }

      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "File not found" });
      } else if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Delete a file from object storage
  async deleteFile(objectPath: string): Promise<boolean> {
    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(objectPath);

      await file.delete();
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }

  // Convert a public URL back to object path for internal operations
  parsePublicUrl(publicUrl: string): string | null {
    const urlPattern = new RegExp(`/storage/(.+)`);
    const match = publicUrl.match(urlPattern);
    return match ? match[1] : null;
  }
}

export const weddingObjectStorage = new WeddingObjectStorageService();