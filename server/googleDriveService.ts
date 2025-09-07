import { google } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

// Google Drive folder ID for wedding memories
const WEDDING_FOLDER_ID = '1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC';

export class GoogleDriveService {
  private drive: any;
  private oauth2Client: any;
  
  constructor() {
    try {
      // Primary approach: OAuth2 for personal folders (works with personal Drive folders)
      // Auto-detect the correct redirect URI based on environment
      const defaultRedirectUri = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/callback`
        : 'http://localhost:5000/auth/google/callback';
      
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri
      );

      // Check if we have stored refresh token for the user
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      if (refreshToken) {
        this.oauth2Client.setCredentials({
          refresh_token: refreshToken
        });
        console.log('Google Drive service initialized with OAuth2 refresh token');
      } else {
        console.log('Google Drive service initialized - OAuth2 setup required');
      }

      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
      this.drive = null;
    }
  }

  async getAuthUrl(): Promise<string> {
    const scopes = ['https://www.googleapis.com/auth/drive.file'];
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
    
    return authUrl;
  }

  async handleAuthCallback(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  async checkIfSharedDrive(folderId: string): Promise<boolean> {
    try {
      const response = await this.drive.drives.get({
        driveId: folderId,
        fields: 'id,name'
      });
      return !!response.data;
    } catch (error) {
      // If we get an error, it's likely not a shared drive
      return false;
    }
  }

  async uploadFile(file: Express.Multer.File, guestName?: string): Promise<{ fileId: string; webViewLink: string }> {
    if (!this.drive) {
      throw new Error('Google Drive service not properly initialized. Service account credentials required.');
    }

    // Check if we have valid credentials
    if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.refresh_token) {
      throw new Error('No access, refresh token, API key or refresh handler callback is set. Please complete OAuth2 authorization first.');
    }

    try {
      console.log(`Attempting real upload of ${file.originalname} for ${guestName || 'Anonymous'}`);
      console.log(`File details: size=${file.size} bytes, mimetype=${file.mimetype}, buffer=${file.buffer ? 'present' : 'missing'}`);
      
      const fileName = guestName ? `${guestName}_${file.originalname}` : file.originalname;
      
      // Check if this is a shared drive
      const isSharedDrive = await this.checkIfSharedDrive(WEDDING_FOLDER_ID);
      
      const fileMetadata: any = {
        name: fileName,
        parents: [WEDDING_FOLDER_ID],
      };

      // If it's a shared drive, we need to specify the driveId
      const requestBody: any = {
        requestBody: fileMetadata,
        media: {
          mimeType: file.mimetype,
          body: file.buffer ? Readable.from(file.buffer) : fs.createReadStream(file.path),
        },
        fields: 'id,webViewLink',
      };

      if (isSharedDrive) {
        requestBody.supportsAllDrives = true;
        console.log('Uploading to shared drive');
      }

      const response = await this.drive.files.create(requestBody);

      // Make the file publicly viewable
      const permissionRequest: any = {
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      };

      if (isSharedDrive) {
        permissionRequest.supportsAllDrives = true;
      }

      await this.drive.permissions.create(permissionRequest);

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
      if ((error as any).code === 401) {
        throw new Error('OAUTH_REQUIRED: Please authorize the application to access your Google Drive.');
      }
      
      if ((error as any).code === 403) {
        const errorMessage = (error as any).cause?.message || (error as Error).message;
        if (errorMessage.includes('Service Accounts do not have storage quota')) {
          throw new Error('OAUTH_REQUIRED: Please authorize the application to access your Google Drive.');
        }
        throw new Error(`Permission denied: ${errorMessage}`);
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