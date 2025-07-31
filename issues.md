# Wedding E-Invitation Platform - Issues & Solutions

## Overview
This document tracks all issues encountered and resolved during the development of the wedding e-invitation platform. Each entry includes the issue description, root cause analysis, and the solution implemented.

---

## Issue #1: RSVP Count Calculation Bug
**Date:** January 18, 2025  
**Severity:** Critical

### Problem
The RSVP count was incorrectly calculating total guests. It was only counting the number of RSVP responses instead of accounting for additional guests each respondent might bring.

### Root Cause
The calculation logic was using `rsvps.length` instead of summing up the main attendee plus `additionalGuests` field for each RSVP.

### Solution
Modified the calculation logic in `AdminDashboard.tsx` to properly count:
```javascript
const totalGuests = rsvps.reduce((total, rsvp) => {
  return total + 1 + (rsvp.additionalGuests || 0);
}, 0);
```

---

## Issue #2: Admin and Guest Gallery Confusion
**Date:** January 18, 2025  
**Severity:** High

### Problem
Admin-uploaded images were appearing in the guest memories gallery, causing confusion about the source of images.

### Root Cause
All uploaded images were being displayed together without distinguishing between admin configuration images and guest-submitted memories.

### Solution
- Separated admin configuration images from guest memories
- Auto-approve admin uploads while requiring approval for guest submissions
- Created distinct sections for each type of content

---

## Issue #3: Banner Image Flash/Glitch
**Date:** January 18, 2025  
**Severity:** Medium

### Problem
When navigating between pages, the banner image would briefly show the previous image before loading the new one, creating a visual glitch.

### Root Cause
Images were not being preloaded, causing a delay in rendering the new image while the old one remained in the browser cache.

### Solution
Implemented image preloading in `HeroSection.tsx`:
```javascript
useEffect(() => {
  if (bannerImageUrl) {
    const img = new Image();
    img.src = bannerImageUrl;
  }
}, [bannerImageUrl]);
```

---

## Issue #4: Navigation Scrolling Not Working
**Date:** January 31, 2025  
**Severity:** High

### Problem
Clicking on navigation links (Gallery, RSVP, etc.) was not scrolling to the respective sections on the homepage.

### Root Cause
The navigation links were using basic anchor tags without smooth scrolling behavior, and preventDefault wasn't implemented to handle the scrolling programmatically.

### Solution
Added smooth scrolling functionality to navigation links:
```javascript
onClick={(e) => {
  e.preventDefault();
  const element = document.getElementById('gallery');
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}}
```

---

## Issue #5: Admin Dashboard Tabs Breaking on Mobile
**Date:** January 31, 2025  
**Severity:** High

### Problem
Admin dashboard tabs were overflowing and getting cut off on small screen devices, making some tabs inaccessible.

### Root Cause
The tabs were trying to display full text on small screens without responsive design considerations, causing horizontal overflow.

### Solution
Implemented icon-only tabs on mobile devices:
```javascript
<TabsTrigger value="media" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4">
  <Image className="h-4 w-4" />
  <span className="hidden md:inline">Media</span>
</TabsTrigger>
```

---

## Issue #6: Empty Gallery Section Showing
**Date:** January 18, 2025  
**Severity:** Low

### Problem
The gallery section was displaying even when no images were configured, showing an empty section to users.

### Root Cause
No conditional rendering was implemented to hide the gallery when empty.

### Solution
Added conditional rendering in `GallerySection.tsx`:
```javascript
if (!images || images.length === 0) {
  return null;
}
```

---

## Issue #7: Banner Delete Button Confusion
**Date:** January 18, 2025  
**Severity:** Low

### Problem
Having a delete button for banner images was causing users to accidentally remove their hero section image.

### Root Cause
The delete functionality was too easily accessible and didn't align with the goal of always having a hero image.

### Solution
- Removed the delete button for banner images
- Changed to a replace-only model where users can update but not remove the banner
- Shows "Add Banner" button only when no banner exists

---

## Issue #8: Security Vulnerabilities (CVE-2025-48997 & CVE-2025-30208)
**Date:** January 16, 2025  
**Severity:** Critical

### Problem
1. Multer had a DoS vulnerability (CVE-2025-48997)
2. Vite had a file access bypass vulnerability (CVE-2025-30208)

### Root Cause
Using outdated versions of dependencies with known security vulnerabilities.

### Solution
- Upgraded Multer from 1.4.5-lts.2 to 2.0.1
- Upgraded Vite from 5.4.14 to 5.4.15
- Updated related type definitions

---

## Issue #9: Memory Upload Flow Complexity
**Date:** January 18, 2025  
**Severity:** Medium

### Problem
The memory sharing form required too many fields (name, email) which slowed down uploads during wedding events.

### Root Cause
Over-engineering the form with required fields that weren't essential for the core functionality.

### Solution
Made name and email fields optional to streamline the upload process during live events.

---

## Issue #10: Google Drive Integration 404 Error
**Date:** January 31, 2025  
**Severity:** Medium

### Problem
The Google Drive integration page was showing a 404 error because it was using placeholder folder IDs.

### Root Cause
The code had placeholder values "YOUR_FOLDER_ID" instead of actual Google Drive folder IDs.

### Solution
- Updated with actual Google Drive folder ID provided by user
- Added admin setup notice to guide configuration
- Implemented proper error handling for missing configuration

---

## Issue #11: Google Drive Upload Not Actually Uploading Files
**Date:** January 31, 2025  
**Severity:** Critical

### Problem
Google Drive upload feature shows success messages but files are not actually uploaded to the Google Drive folder. The system logs show "Simulating upload" instead of real uploads.

### Root Cause Analysis
1. **Authentication Issue:** The Google Drive API service is not properly authenticated for file uploads
2. **API Implementation:** The `uploadFile` method in `googleDriveService.ts` is hardcoded to simulate uploads rather than make real API calls
3. **Credential Usage:** While Google API credentials are available, they're not being used in a way that supports direct file uploads
4. **Service Account Missing:** Google Drive API requires either OAuth2 user authentication or service account credentials for file uploads

### Technical Details
- Current implementation returns simulated responses with fake file IDs
- Files are cleaned up from temp storage but never uploaded to Google Drive
- The API endpoints exist but don't perform actual Google Drive operations

### Impact
Users believe their photos are uploaded but they never reach the Google Drive folder, causing confusion and loss of wedding memories.

### Solution Implemented
1. **Service Account Authentication:** Implemented proper service account-based authentication for Google Drive API
2. **Real Upload Implementation:** Replaced simulation with actual Google Drive API calls
3. **Error Handling:** Added comprehensive error handling for authentication and upload failures
4. **Fallback Flow:** Maintains user-friendly fallback that guides users to manual upload if API fails

### Status
✅ FULLY RESOLVED - Implemented OAuth2 authentication to solve the root cause.

**Root Cause Solved:** Instead of working around Google's service account limitation, implemented OAuth2 user authentication which allows direct uploads to personal folders by authenticating as the actual Google account owner.

**Solution Benefits:**
1. **Direct Personal Folder Access:** Works with existing personal Google Drive folders (no Shared Drive needed)
2. **OAuth2 Authentication:** Authenticates as the user, providing full access permissions
3. **Automatic Authorization Flow:** System guides users through one-time OAuth setup
4. **Persistent Access:** Uses refresh tokens for ongoing authentication
5. **Seamless User Experience:** True direct uploads with guest name prefixing

**Setup Required:** One-time OAuth authorization to obtain refresh token (see OAUTH_SETUP_GUIDE.md)

---

## Best Practices Learned

1. **Always implement responsive design from the start** - Mobile-first approach prevents overflow issues
2. **Preload critical assets** - Prevents visual glitches during navigation
3. **Keep security dependencies updated** - Regular security audits prevent vulnerabilities
4. **Simplify user flows for live events** - Reduce friction during time-sensitive operations
5. **Separate admin and user content clearly** - Prevents confusion and improves UX
6. **Use conditional rendering for empty states** - Prevents showing blank sections
7. **Test on multiple device sizes** - Catches responsive design issues early
8. **Implement proper TypeScript types** - Prevents runtime errors and improves code quality