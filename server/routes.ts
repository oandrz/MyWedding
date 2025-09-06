import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRsvpSchema, insertMediaSchema, insertConfigImageSchema, insertFeatureFlagSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { log } from './vite';
import { createProxyMiddleware } from "http-proxy-middleware";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { adminAuthMiddleware } from "./middleware/auth";
import { googleDriveService } from "./googleDriveService";
import { weddingObjectStorage, ObjectNotFoundError } from "./objectStorage";

const FLASK_API_URL = "http://localhost:5001";

// Keep uploads directory for backward compatibility (existing files)
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer storage for file uploads - using memory storage for App Storage
const storage_config = multer.memoryStorage();

// Create multer upload middleware
const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allow only images and videos
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.') as any);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Start Flask server with improved error handling
  try {
    const { exec } = await import('child_process');
    exec('chmod +x ./start_flask.sh && ./start_flask.sh', (error, stdout, stderr) => {
      if (error) {
        log(`Failed to start Flask server: ${error.message}`, 'flask');
        log(`Consider running the app without Flask integration if this continues to fail`, 'flask');
        return;
      }
      if (stderr) {
        log(`Flask server stderr: ${stderr}`, 'flask');
      }
      if (stdout) {
        log(`Flask server: ${stdout.trim()}`, 'flask');
      }
    });
  } catch (err) {
    log(`Failed to start Flask server: ${err}`, 'flask');
  }

  // Try using the Flask API first, if available
  app.post("/api/rsvp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = `${FLASK_API_URL}/api/rsvp`;
      const flaskOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      };

      const flaskResponse = await fetch(flaskUrl, flaskOptions).catch((err) => {
        log(`Failed to connect to Flask server: ${err.message}`, 'flask-proxy');
        return null;
      });
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, use the Node.js implementation
      log("Flask server not available, using Node.js implementation", 'flask-proxy');
      return handleRsvpSubmission(req, res);
    } catch (error) {
      log(`Error proxying to Flask: ${error}`, 'flask-proxy');
      return handleRsvpSubmission(req, res);
    }
  });

  app.get("/api/rsvp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = `${FLASK_API_URL}/api/rsvp`;
      const flaskResponse = await fetch(flaskUrl).catch(() => null);
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, use the Node.js implementation
      log("Flask server not available for GET /api/rsvp, using Node.js implementation", 'flask-proxy');
      return handleGetRsvps(req, res);
    } catch (error) {
      log(`Error proxying to Flask: ${error}`, 'flask-proxy');
      return handleGetRsvps(req, res);
    }
  });

  // Add message board routes that proxy to Flask
  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = `${FLASK_API_URL}/api/messages`;
      const flaskOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      };

      const flaskResponse = await fetch(flaskUrl, flaskOptions).catch(() => null);
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, return an error
      return res.status(503).json({ 
        message: "Message board service is temporarily unavailable."
      });
    } catch (error) {
      log(`Error proxying to Flask message board: ${error}`, 'flask-proxy');
      return res.status(500).json({ 
        message: "Failed to submit message."
      });
    }
  });

  app.get("/api/messages", async (req: Request, res: Response) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = `${FLASK_API_URL}/api/messages`;
      const flaskResponse = await fetch(flaskUrl).catch(() => null);
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, return an empty array
      return res.status(200).json({ 
        messages: []
      });
    } catch (error) {
      log(`Error proxying to Flask message board: ${error}`, 'flask-proxy');
      return res.status(500).json({ 
        message: "Failed to fetch messages."
      });
    }
  });

  // Add individual RSVP lookup by email
  app.get("/api/rsvp/:email", async (req: Request, res: Response) => {
    const email = req.params.email;
    try {
      // Try forwarding to Flask server
      const flaskUrl = `${FLASK_API_URL}/api/rsvp/${email}`;
      const flaskResponse = await fetch(flaskUrl).catch(() => null);
      
      if (flaskResponse) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, use the Node.js implementation
      const rsvp = await storage.getRsvpByEmail(email);
      
      if (rsvp) {
        return res.status(200).json({ rsvp });
      } else {
        return res.status(404).json({ message: "RSVP not found" });
      }
    } catch (error) {
      log(`Error getting RSVP by email: ${error}`, 'flask-proxy');
      return res.status(500).json({ 
        message: "Failed to fetch RSVP."
      });
    }
  });
  
  // Helper function to detect media type from URL
  function detectMediaTypeFromUrl(url: string): string {
    // YouTube detection
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
      return 'video';
    }
    
    // File extension detection
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
    const videoExtensions = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i;
    
    if (imageExtensions.test(url)) {
      return 'image';
    } else if (videoExtensions.test(url)) {
      return 'video';
    }
    
    // Default to image for unknown URLs
    return 'image';
  }

  // Media endpoints
  app.post("/api/media", async (req: Request, res: Response) => {
    try {
      // Auto-detect media type from URL if not provided
      let { mediaType, mediaUrl, ...otherData } = req.body;
      
      if (!mediaType && mediaUrl) {
        mediaType = detectMediaTypeFromUrl(mediaUrl);
      }
      
      // Validate the request body using zod with auto-detected media type
      const validatedData = insertMediaSchema.parse({
        ...otherData,
        mediaType,
        mediaUrl
      });
      
      // Admin uploads are auto-approved, guest uploads need approval
      const isAdminUpload = validatedData.email === 'admin@wedding.com';
      const mediaWithApproval = {
        ...validatedData,
        approved: isAdminUpload
      };
      
      // Store the media
      const media = await storage.createMedia(mediaWithApproval);
      
      res.status(201).json({ 
        message: "Thank you for sharing your memory!",
        media 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Media submission error:", error);
        res.status(500).json({ message: "Failed to upload media" });
      }
    }
  });
  
  // File upload endpoint for media - now uses App Storage
  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Auto-detect media type from file MIME type
      let mediaType: string;
      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      } else {
        return res.status(400).json({ message: 'Unsupported file type' });
      }
      
      // Parse form data
      const { name, email, caption } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Generate unique filename to prevent conflicts
      const fileExtension = req.file.originalname.split('.').pop() || '';
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
      
      // Upload file to App Storage
      const isAdminUpload = email === 'admin@wedding.com';
      let fileUrl: string;
      
      if (isAdminUpload) {
        // Admin uploads go to admin directory
        const imageType = mediaType === 'image' ? 'gallery' : 'gallery'; // Default to gallery for admin uploads
        fileUrl = await weddingObjectStorage.uploadAdminImage(
          req.file.buffer, 
          uniqueFilename, 
          req.file.mimetype,
          imageType as "banner" | "gallery"
        );
      } else {
        // Guest uploads go to regular uploads directory
        fileUrl = await weddingObjectStorage.uploadFile(
          req.file.buffer,
          uniqueFilename,
          req.file.mimetype,
          'uploads'
        );
      }
      
      // Create media entry with the App Storage URL
      const mediaData = {
        name,
        email,
        mediaType,
        mediaUrl: fileUrl,
        caption: caption || undefined,
        approved: isAdminUpload // Auto-approve only admin uploads
      };
      
      // Store the media entry
      const media = await storage.createMedia(mediaData);
      
      res.status(201).json({
        message: 'File uploaded successfully!',
        media
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        message: 'Failed to upload file',
        error: (error as Error).message
      });
    }
  });

  // Google Drive upload endpoint
  app.post('/api/upload-to-drive', upload.array('files'), async (req: Request, res: Response) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const files = req.files as Express.Multer.File[];
      const { guestName } = req.body;
      const uploadResults = [];

      for (const file of files) {
        try {
          const result = await googleDriveService.uploadFile(file, guestName);
          
          // Create a direct viewable URL for the Google Drive file
          const directImageUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
          
          // Determine media type
          let mediaType: string;
          if (file.mimetype.startsWith('image/')) {
            mediaType = 'image';
          } else if (file.mimetype.startsWith('video/')) {
            mediaType = 'video';
          } else {
            mediaType = 'image'; // Default to image
          }
          
          // Save to local media database so it appears in gallery
          const mediaData = {
            name: guestName || 'Wedding Guest',
            email: 'guest@wedding.com',
            mediaType,
            mediaUrl: directImageUrl,
            caption: `Shared via Google Drive`,
            approved: true // Auto-approve Google Drive uploads
          };
          
          const media = await storage.createMedia(mediaData);
          
          uploadResults.push({
            filename: file.originalname,
            success: true,
            fileId: result.fileId,
            webViewLink: result.webViewLink,
            mediaId: media.id
          });

          // Clean up temp file safely
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (cleanupError) {
            console.warn(`Failed to clean up temp file ${file.path}:`, cleanupError);
          }
        } catch (error) {
          console.error(`Google Drive upload failed for ${file.originalname}:`, error);
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: (error as Error).message
          });
          
          // Still clean up temp file even if upload failed
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (cleanupError) {
            console.warn(`Failed to clean up temp file ${file.path} after failed upload:`, cleanupError);
          }
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failCount = uploadResults.filter(r => !r.success).length;

      res.status(200).json({
        message: `Successfully uploaded ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
        successCount,
        results: uploadResults
      });
    } catch (error) {
      console.error('Google Drive upload error:', error);
      res.status(500).json({
        message: 'Failed to upload files to Google Drive',
        error: (error as Error).message
      });
    }
  });

  // Google OAuth2 authorization URL
  app.get('/api/google-auth-url', async (req: Request, res: Response) => {
    try {
      const authUrl = await googleDriveService.getAuthUrl();
      res.status(200).json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({
        message: 'Failed to generate authentication URL',
        error: (error as Error).message
      });
    }
  });

  // Google OAuth2 callback
  app.get('/auth/google/callback', async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).send('Authorization code missing');
      }

      const tokens = await googleDriveService.handleAuthCallback(code);
      
      // In production, you'd want to store the refresh token securely
      // For now, we'll show it to the user to add to environment variables
      res.send(`
        <html>
          <body>
            <h2>Google Drive Authorization Successful!</h2>
            <p>Please add this refresh token to your environment variables:</p>
            <code>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</code>
            <p>Then restart your application.</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).send('Authorization failed');
    }
  });

  // Get Google Drive folder contents
  app.get('/api/drive-folder-contents', async (req: Request, res: Response) => {
    try {
      const files = await googleDriveService.getFolderContents();
      res.status(200).json({ files });
    } catch (error) {
      console.error('Error fetching Google Drive contents:', error);
      res.status(500).json({
        message: 'Failed to fetch folder contents',
        error: (error as Error).message
      });
    }
  });
  
  // Get approved media only (excludes admin uploads for guest memories gallery)
  app.get("/api/media", async (req: Request, res: Response) => {
    try {
      const mediaItems = await storage.getApprovedMedia();
      // Filter out admin uploads from guest memories gallery
      const guestMedia = mediaItems.filter(media => media.email !== 'admin@wedding.com');
      res.status(200).json({ media: guestMedia });
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });
  
  // Admin route to get all media (approved and unapproved)
  app.get("/api/admin/media", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const mediaItems = await storage.getAllMedia();
      res.status(200).json({ media: mediaItems });
    } catch (error) {
      console.error("Error fetching all media:", error);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });
  
  // Admin route to approve/reject media
  app.patch("/api/admin/media/:id", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { approved } = req.body;
      
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ message: "Approved status must be a boolean" });
      }
      
      const updatedMedia = await storage.updateMediaApproval(id, approved);
      
      if (!updatedMedia) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      res.status(200).json({ 
        message: approved ? "Media approved successfully" : "Media rejected",
        media: updatedMedia 
      });
    } catch (error) {
      console.error("Error updating media:", error);
      res.status(500).json({ message: "Failed to update media" });
    }
  });

  // Configurable Images API Routes
  
  // Get all configurable images (public endpoint)
  app.get("/api/config-images", async (req: Request, res: Response) => {
    try {
      const images = await storage.getAllConfigImages();
      res.status(200).json({ images });
    } catch (error) {
      console.error("Error fetching config images:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Get configurable images by type (public endpoint)
  app.get("/api/config-images/:type", async (req: Request, res: Response) => {
    try {
      const imageType = req.params.type;
      const images = await storage.getConfigImagesByType(imageType);
      res.status(200).json({ images });
    } catch (error) {
      console.error("Error fetching config images by type:", error);
      res.status(500).json({ message: "Failed to fetch images" });
    }
  });

  // Upload and create configurable image from file (admin only)
  app.post("/api/admin/config-images-upload", adminAuthMiddleware, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: 'Only images are allowed for config images' });
      }

      // Parse form data
      const { imageKey, imageType, title, description } = req.body;
      
      if (!imageKey || !imageType) {
        return res.status(400).json({ message: 'Image key and type are required' });
      }

      // Generate unique filename
      const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
      const uniqueFilename = `${imageKey}-${Date.now()}.${fileExtension}`;

      // Upload to App Storage
      const imageUrl = await weddingObjectStorage.uploadAdminImage(
        req.file.buffer,
        uniqueFilename,
        req.file.mimetype,
        imageType as "banner" | "gallery"
      );

      // Create config image data
      const configImageData = {
        imageKey,
        imageUrl,
        imageType,
        title: title || undefined,
        description: description || undefined,
        isActive: true
      };

      // Check if image key already exists and update or create
      const existingImage = await storage.getConfigImage(imageKey);
      let image;
      
      if (existingImage) {
        image = await storage.updateConfigImage(imageKey, configImageData);
      } else {
        image = await storage.createConfigImage(configImageData);
      }

      res.status(201).json({
        message: "Config image uploaded successfully",
        image
      });
    } catch (error) {
      console.error("Config image upload error:", error);
      res.status(500).json({ message: "Failed to upload config image" });
    }
  });

  // Update or create configurable image (admin only)
  app.post("/api/admin/config-images", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const validatedData = insertConfigImageSchema.parse(req.body);
      
      // Check if image key already exists
      const existingImage = await storage.getConfigImage(validatedData.imageKey);
      
      let image;
      if (existingImage) {
        // Update existing image
        image = await storage.updateConfigImage(validatedData.imageKey, validatedData);
      } else {
        // Create new image
        image = await storage.createConfigImage(validatedData);
      }
      
      res.status(201).json({ 
        message: "Image configuration updated successfully",
        image 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Config image update error:", error);
        res.status(500).json({ message: "Failed to update image configuration" });
      }
    }
  });

  // Update existing configurable image (admin only)
  app.put("/api/admin/config-images/:imageKey", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const imageKey = req.params.imageKey;
      const validatedData = insertConfigImageSchema.parse(req.body);
      
      const image = await storage.updateConfigImage(imageKey, validatedData);
      
      res.status(200).json({ 
        message: "Image configuration updated successfully",
        image 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Config image update error:", error);
        res.status(500).json({ message: "Failed to update image configuration" });
      }
    }
  });

  // Delete configurable image (admin only)
  app.delete("/api/admin/config-images/:imageKey", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const imageKey = req.params.imageKey;
      
      const success = await storage.deleteConfigImage(imageKey);
      
      if (!success) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      res.status(200).json({ 
        message: "Image deleted successfully" 
      });
    } catch (error) {
      console.error("Config image delete error:", error);
      res.status(500).json({ message: "Failed to delete image configuration" });
    }
  });

  // Feature Flags API Routes
  
  // Get all feature flags (public endpoint for frontend)
  app.get("/api/feature-flags", async (req: Request, res: Response) => {
    try {
      const featureFlags = await storage.getAllFeatureFlags();
      res.status(200).json({ featureFlags });
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });

  // Get specific feature flag (public endpoint)
  app.get("/api/feature-flags/:featureKey", async (req: Request, res: Response) => {
    try {
      const featureKey = req.params.featureKey;
      const featureFlag = await storage.getFeatureFlag(featureKey);
      
      if (!featureFlag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }
      
      res.status(200).json({ featureFlag });
    } catch (error) {
      console.error("Error fetching feature flag:", error);
      res.status(500).json({ message: "Failed to fetch feature flag" });
    }
  });

  // Update feature flag (admin only)
  app.patch("/api/admin/feature-flags/:featureKey", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const featureKey = req.params.featureKey;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "Enabled status must be a boolean" });
      }
      
      const updatedFeatureFlag = await storage.updateFeatureFlag(featureKey, enabled);
      
      if (!updatedFeatureFlag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }
      
      res.status(200).json({ 
        message: `Feature flag '${updatedFeatureFlag.featureName}' ${enabled ? 'enabled' : 'disabled'} successfully`,
        featureFlag: updatedFeatureFlag 
      });
    } catch (error) {
      console.error("Error updating feature flag:", error);
      res.status(500).json({ message: "Failed to update feature flag" });
    }
  });

  // Create new feature flag (admin only)
  app.post("/api/admin/feature-flags", adminAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const validatedData = insertFeatureFlagSchema.parse(req.body);
      
      // Check if feature flag already exists
      const existingFeatureFlag = await storage.getFeatureFlag(validatedData.featureKey);
      
      if (existingFeatureFlag) {
        return res.status(409).json({ message: "Feature flag already exists" });
      }
      
      const featureFlag = await storage.createFeatureFlag(validatedData);
      
      res.status(201).json({ 
        message: "Feature flag created successfully",
        featureFlag 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Feature flag creation error:", error);
        res.status(500).json({ message: "Failed to create feature flag" });
      }
    }
  });

  // Fallback API handlers for RSVP submission (used if Flask server is not available)
  async function handleRsvpSubmission(req: Request, res: Response) {
    try {
      // Validate the request body using zod
      const validatedData = insertRsvpSchema.parse(req.body);
      
      // Check if this email has already RSVP'd
      const existingRsvp = await storage.getRsvpByEmail(validatedData.email);
      
      if (existingRsvp) {
        // Update existing RSVP instead of creating a new one
        // But for now, let's just return a message
        return res.status(200).json({ 
          message: "Your RSVP has been updated successfully!",
          rsvp: existingRsvp 
        });
      }
      
      // Store the RSVP
      const rsvp = await storage.createRsvp(validatedData);
      
      res.status(201).json({ 
        message: "Thank you for your RSVP!",
        rsvp 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("RSVP submission error:", error);
        res.status(500).json({ message: "Failed to submit RSVP" });
      }
    }
  }

  // Fallback API handlers for getting all RSVPs (used if Flask server is not available)
  async function handleGetRsvps(_req: Request, res: Response) {
    try {
      const rsvps = await storage.getRsvps();
      
      // Calculate attendance stats
      const attending = rsvps.filter(rsvp => rsvp.attending).length;
      const notAttending = rsvps.filter(rsvp => !rsvp.attending).length;
      
      // Calculate total guests (including the main attendee + additional guests)
      const totalGuests = rsvps
        .filter(rsvp => rsvp.attending)
        .reduce((sum, current) => sum + (current.guestCount || 1), 0);
      
      res.status(200).json({ 
        rsvps,
        stats: {
          total: rsvps.length,
          attending,
          notAttending,
          guestCount: totalGuests
        }
      });
    } catch (error) {
      console.error("Error fetching RSVPs:", error);
      res.status(500).json({ message: "Failed to fetch RSVPs" });
    }
  }

  // Validate admin credentials (for login validation)
  app.post("/api/admin/validate", adminAuthMiddleware, (req: Request, res: Response) => {
    // If middleware passed, credentials are valid
    res.status(200).json({ 
      message: "Admin credentials are valid",
      valid: true 
    });
  });

  // Serve files from App Storage (for backward compatibility and direct access)
  app.get('/storage/:directory/:filename', async (req: Request, res: Response) => {
    try {
      const { directory, filename } = req.params;
      const objectPath = `${directory}/${filename}`;
      
      await weddingObjectStorage.downloadFile(objectPath, res);
    } catch (error) {
      console.error('Error serving file from App Storage:', error);
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.status(500).json({ error: 'Error serving file' });
      }
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
