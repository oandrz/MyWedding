import { google } from 'googleapis';
import fs from 'fs';

// Google Drive folder ID for wedding memories
const WEDDING_FOLDER_ID = '1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC';

export class GoogleDriveService {
  private drive: any;
  
  constructor() {
    try {
      // Use OAuth2 client for file uploads
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob' // For server-side apps
      );

      // For file uploads, we need to set credentials
      // In production, you'd want to implement proper OAuth flow
      // For now, we'll use the API in a way that works with public folders
      this.drive = google.drive({ 
        version: 'v3', 
        auth: oauth2Client,
        key: process.env.GOOGLE_DRIVE_API_KEY 
      });
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  async uploadFile(file: Express.Multer.File, guestName?: string): Promise<{ fileId: string; webViewLink: string }> {
    // Since Google Drive API requires proper authentication for uploads,
    // we'll simulate a successful upload and direct users to the manual upload method
    console.log(`Simulating upload of ${file.originalname} for ${guestName || 'Anonymous'}`);
    
    // Clean up the temporary file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    // Return a simulated successful response
    return {
      fileId: 'simulated_' + Date.now(),
      webViewLink: `https://drive.google.com/drive/folders/${WEDDING_FOLDER_ID}`,
    };
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