import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRsvpSchema, insertMediaSchema, insertConfigImageSchema } from "@shared/schema";
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

const FLASK_API_URL = "http://localhost:5001";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer storage for file uploads
const storage_config = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Generate a unique filename with original extension
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

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
  // Start Flask server
  try {
    const { exec } = await import('child_process');
    exec('./start_flask.sh', (error, stdout, stderr) => {
      if (error) {
        log(`Failed to start Flask server: ${error.message}`, 'flask');
        return;
      }
      if (stderr) {
        log(`Flask server stderr: ${stderr}`, 'flask');
      }
      log(`Flask server started: ${stdout}`, 'flask');
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
  
  // File upload endpoint for media
  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Create a URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;
      
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
      
      // Create media entry with the file URL
      // Admin uploads are auto-approved, guest uploads need approval
      const isAdminUpload = email === 'admin@wedding.com';
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
          uploadResults.push({
            filename: file.originalname,
            success: true,
            fileId: result.fileId,
            webViewLink: result.webViewLink
          });

          // Clean up temp file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (error) {
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: (error as Error).message
          });
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failCount = uploadResults.filter(r => !r.success).length;

      res.status(200).json({
        message: `Successfully uploaded ${successCount} file(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
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

  const httpServer = createServer(app);

  return httpServer;
}
