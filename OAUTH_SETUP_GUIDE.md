# Google Drive OAuth2 Setup Guide

## Problem Solved

You asked why Google Drive API restricts service accounts from uploading to personal folders. The answer is security and resource management - Google wants to prevent service accounts from consuming personal storage quotas.

**Solution**: We've implemented OAuth2 user authentication, which allows direct uploads to your personal Google Drive folder by authenticating as YOU, the actual owner.

## How OAuth2 Solves the Problem

- **Service Accounts**: Act as separate "robot" users with no storage quota
- **OAuth2**: Authenticates as the actual Google account owner (you)
- **Result**: Full access to upload files to your personal Drive folder

## One-Time Setup Process

### Step 1: Test Current State
1. Go to `/memories-upload` on your wedding site
2. Select a photo and click "Upload to Google Drive"
3. If authorization is needed, you'll see a message and an authorization popup will open

### Step 2: Complete Authorization
1. When the Google authorization page opens:
   - Sign in with your Google account (the one that owns the wedding folder)
   - Grant permissions to "See, edit, create, and delete your files on Google Drive"
   - Click "Allow"

### Step 3: Get Refresh Token
1. After authorization, you'll see a page with a refresh token
2. Copy the refresh token (long string starting with "1//...")
3. Add it to your Replit secrets as: `GOOGLE_REFRESH_TOKEN`

### Step 4: Restart Application
1. Restart your Replit application
2. The system will now authenticate automatically using your refresh token

## After Setup

✅ **Direct uploads will work**: Photos uploaded through the wedding site will go directly to your Google Drive folder  
✅ **Guest name prefixing**: Uploaded files will be prefixed with guest names for easy identification  
✅ **Automatic permissions**: Files will be made publicly viewable  
✅ **No manual intervention**: Guests won't need to open Google Drive manually  

## Technical Benefits

- **Real uploads**: No more simulation - actual files in your Google Drive
- **Personal folder support**: Works with your existing folder (no need for Shared Drives)
- **User permissions**: Uses your Google account permissions
- **Seamless experience**: Guests get true one-click upload

## Current Folder

Your wedding memories folder: `1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC`

This folder will work perfectly with OAuth2 authentication!