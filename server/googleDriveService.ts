import { google } from 'googleapis';
import fs from 'fs';

// Google Drive folder ID for wedding memories
const WEDDING_FOLDER_ID = '1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC';

export class GoogleDriveService {
  private drive: any;
  
  constructor() {
    try {
      // Check if we have service account credentials
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      
      if (serviceAccountKey) {
        // Use service account authentication for direct uploads
        const serviceAccount = JSON.parse(serviceAccountKey);
        const auth = new google.auth.GoogleAuth({
          credentials: serviceAccount,
          scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        this.drive = google.drive({ version: 'v3', auth });
        console.log('Google Drive service initialized with service account');
      } else {
        // Fallback: Use OAuth2 client (requires user authentication)
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          'urn:ietf:wg:oauth:2.0:oob'
        );
        this.drive = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('Google Drive service initialized with OAuth2 (service account recommended)');
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      this.drive = null; // Set to null to indicate initialization failure
    }
  }

  async uploadFile(file: Express.Multer.File, guestName?: string): Promise<{ fileId: string; webViewLink: string }> {
    if (!this.drive) {
      throw new Error('Google Drive service not properly initialized. Service account credentials required.');
    }

    try {
      console.log(`Attempting real upload of ${file.originalname} for ${guestName || 'Anonymous'}`);
      
      const fileName = guestName ? `${guestName}_${file.originalname}` : file.originalname;
      
      const fileMetadata = {
        name: fileName,
        parents: [WEDDING_FOLDER_ID],
      };

      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      // Make the file publicly viewable
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Clean up the temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      console.log(`Successfully uploaded ${fileName} to Google Drive with ID: ${response.data.id}`);

      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      
      // Clean up the temporary file even on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      // Check for specific Google Drive errors
      if ((error as any).code === 403) {
        const errorMessage = (error as any).cause?.message || (error as Error).message;
        if (errorMessage.includes('Service Accounts do not have storage quota')) {
          throw new Error('Service account cannot upload to personal folders. Please use OAuth authentication or create a shared drive.');
        }
        throw new Error(`Permission denied: ${errorMessage}`);
      }
      
      if ((error as any).code === 401) {
        throw new Error('Authentication failed. Please check Google Drive service account credentials.');
      }
      
      throw new Error(`Failed to upload to Google Drive: ${(error as Error).message}`);
    }
  }

  async uploadFileFromBuffer(
    buffer: Buffer, 
    filename: string, 
    mimeType: string, 
    guestName?: string
  ): Promise<{ fileId: string; webViewLink: string }> {
    try {
      const fileMetadata = {
        name: `${guestName ? guestName + '_' : ''}${filename}`,
        parents: [WEDDING_FOLDER_ID],
      };

      // Create a readable stream from buffer
      const { Readable } = require('stream');
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const media = {
        mimeType: mimeType,
        body: stream,
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      // Make the file publicly viewable
      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw new Error(`Failed to upload to Google Drive: ${(error as Error).message}`);
    }
  }

  async getFolderContents(): Promise<any[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${WEDDING_FOLDER_ID}' in parents`,
        fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)',
        orderBy: 'createdTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error fetching Google Drive folder contents:', error);
      throw new Error(`Failed to fetch folder contents: ${(error as Error).message}`);
    }
  }
}

export const googleDriveService = new GoogleDriveService();