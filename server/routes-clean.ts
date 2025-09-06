import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { DIContainer } from "./src/infrastructure/DIContainer";

// Initialize dependency injection container
const container = DIContainer.getInstance();

// Initialize controllers
const rsvpController = container.createRsvpController();
const featureFlagController = container.createFeatureFlagController();
const mediaController = container.createMediaController();
const configImageController = container.createConfigImageController();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Admin middleware following Clean Architecture
const adminAuth = (req: any, res: any, next: any) => {
  const adminKey = req.query.adminKey || req.body.adminKey;
  const validAdminKey = process.env.ADMIN_KEY || 'wedding2024admin';
  
  if (adminKey === validAdminKey) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export async function registerRoutesClean(app: Express): Promise<Server> {
  // RSVP Routes
  app.post('/api/rsvp', (req, res) => rsvpController.createRsvp(req, res));
  app.get('/api/admin/rsvps', adminAuth, (req, res) => rsvpController.getAllRsvps(req, res));
  
  // Feature Flag Routes
  app.get('/api/feature-flags', (req, res) => featureFlagController.getAllFeatureFlags(req, res));
  app.patch('/api/admin/feature-flags/:featureKey', adminAuth, (req, res) => 
    featureFlagController.toggleFeatureFlag(req, res)
  );
  
  // Media Routes
  app.post('/api/media/upload', upload.single('media'), (req, res) => 
    mediaController.createMedia(req, res)
  );
  
  // Legacy upload route for compatibility with ImageUploadModal
  app.post('/api/upload', upload.single('file'), async (req, res) => {
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
      
      // Use the media controller to create the media entry
      req.body = mediaData;
      req.file.mimetype = `${mediaType}/*`; // Set appropriate mimetype for controller
      
      // Store the media entry using the controller
      await mediaController.createMedia(req, res);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });
  
  app.get('/api/media', (req, res) => mediaController.getApprovedMedia(req, res));
  app.get('/api/admin/media', adminAuth, (req, res) => mediaController.getAllMedia(req, res));
  app.patch('/api/admin/media/:id/approve', adminAuth, (req, res) => 
    mediaController.approveMedia(req, res)
  );
  
  // Config Image Routes
  app.get('/api/config-images', (req, res) => 
    configImageController.getAllConfigImages(req, res)
  );
  app.get('/api/config-images/:imageType', (req, res) => 
    configImageController.getConfigImagesByType(req, res)
  );
  app.delete('/api/admin/config-images/:imageKey', adminAuth, (req, res) => 
    configImageController.deleteConfigImage(req, res)
  );
  app.post('/api/admin/config-images', adminAuth, upload.single('image'), async (req, res) => {
    try {
      // Handle both file upload and URL
      let imageUrl = req.body.imageUrl;
      
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }
      
      if (!imageUrl) {
        res.status(400).json({ error: 'Either image file or URL is required' });
        return;
      }
      
      req.body.imageUrl = imageUrl;
      await configImageController.createOrUpdateConfigImage(req, res);
    } catch (error) {
      console.error('Error handling config image:', error);
      res.status(500).json({ error: 'Failed to process config image' });
    }
  });
  
  // Admin authentication endpoint
  app.post('/api/admin/auth', (req, res) => {
    const { adminKey } = req.body;
    const validAdminKey = process.env.ADMIN_KEY || 'wedding2024admin';
    
    if (adminKey === validAdminKey) {
      res.json({ success: true, message: 'Admin authenticated' });
    } else {
      res.status(401).json({ error: 'Invalid admin key' });
    }
  });
  
  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      architecture: 'clean',
      timestamp: new Date().toISOString() 
    });
  });
  
  const httpServer = createServer(app);
  return httpServer;
}