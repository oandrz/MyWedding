# Wedding E-Invitation Platform

## Overview

This is a comprehensive wedding e-invitation platform that creates an interactive digital experience for wedding guests. The application combines a React frontend with multiple backend options (Flask and Express.js) to provide features like RSVP management, message boards, photo galleries, and admin functionality.

## Recent Changes

**Image Management System Enhancements:**

**January 16, 2025:**
- ✓ Created Google Drive-style image upload interface with drag-and-drop functionality
- ✓ Added dual upload options: file upload and URL-based image addition
- ✓ Removed confusing "Image Key" field - now auto-generated for better UX
- ✓ Fixed file upload API integration with proper required fields
- ✓ Implemented modal-based image management for cleaner interface
- ✓ Added visual feedback for drag operations and file selection
- ✓ Fixed accessibility warnings with proper dialog descriptions

**Security Updates:**
- ✓ Fixed critical security vulnerability CVE-2025-48997 in Multer
- ✓ Upgraded Multer from 1.4.5-lts.2 to 2.0.1 (patched DoS vulnerability)
- ✓ Updated @types/multer to 2.0.0 for compatibility
- ✓ Verified file upload functionality remains working after upgrade

- ✓ Fixed critical security vulnerability CVE-2025-30208 in Vite
- ✓ Upgraded Vite from 5.4.14 to 5.4.15 (patched file access bypass vulnerability)
- ✓ Vulnerability was exploitable due to network-exposed dev server (host: 0.0.0.0)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a full-stack architecture with separate frontend and backend components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with ShadCN UI component library
- **Animations**: Framer Motion for smooth interactions
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (TanStack Query) for server state
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
The project supports dual backend implementations:
1. **Flask Backend** (Python) - Main production backend
2. **Express.js Backend** (Node.js) - Development server and static file serving

### Database Strategy
- **Development**: In-memory storage using Python dictionaries and JavaScript Maps
- **Production Ready**: Drizzle ORM configured for PostgreSQL (schema defined but not yet connected)
- **Migration Path**: The application is structured to easily migrate from in-memory to PostgreSQL

## Key Components

### Frontend Components
- **Page Components**: Home, Messages, Gallery, Admin Dashboard, Admin Login
- **Feature Components**: 
  - Hero section with background music
  - Countdown timer to wedding date
  - RSVP form with validation
  - Message board for guest wishes
  - Photo gallery with upload functionality
  - Admin dashboard for content management

### Backend Services
- **RSVP Service**: Handles guest responses and attendance tracking
- **Message Service**: Manages guest messages and well-wishes
- **Media Service**: Handles photo/video uploads and approval workflow
- **Admin Service**: Provides administrative functions

### Repository Pattern
- **Interface-based Design**: Abstract repository interfaces for data access
- **Multiple Implementations**: In-memory repositories for development, ready for database repositories
- **Easy Testing**: Repository pattern enables easy mocking and testing

## Data Flow

### Guest Interaction Flow
1. **Landing Page**: Guests arrive at the wedding invitation
2. **RSVP Submission**: Guests fill out attendance form with validation
3. **Message Board**: Guests can leave congratulatory messages
4. **Gallery Upload**: Guests can submit photos/videos for approval
5. **Real-time Updates**: Content updates dynamically via React Query

### Admin Management Flow
1. **Authentication**: Simple password-based admin access
2. **RSVP Management**: View all responses and attendance statistics
3. **Content Moderation**: Approve/reject user-submitted media
4. **Dashboard Analytics**: Overview of engagement metrics

### Data Persistence
- **Development**: All data stored in memory (resets on restart)
- **Production Ready**: Database schema defined for PostgreSQL migration
- **API Design**: RESTful endpoints support both storage strategies

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React, React DOM, React Query
- **UI Framework**: Radix UI primitives, ShadCN components
- **Animation**: Framer Motion
- **Form Management**: React Hook Form, Zod validation
- **Styling**: Tailwind CSS, PostCSS

### Backend Dependencies
- **Python**: Flask, Flask-CORS, Pydantic
- **Node.js**: Express, Multer (file uploads), http-proxy-middleware
- **Database**: Drizzle ORM, @neondatabase/serverless

### Development Tools
- **Build System**: Vite with React plugin
- **TypeScript**: Full type safety across frontend and shared schemas
- **Linting**: ESLint configuration
- **Package Management**: npm with lockfile

## Deployment Strategy

### Development Environment
- **Dual Server Setup**: Flask backend (port 5001) + Express frontend (default Vite port)
- **Hot Reloading**: Vite HMR for frontend development
- **Proxy Configuration**: Express proxies API requests to Flask
- **Asset Serving**: Express serves static assets and uploads

### Production Considerations
- **Database Migration**: Switch from in-memory to PostgreSQL using existing Drizzle schema
- **File Storage**: Currently using local filesystem, ready for cloud storage integration
- **Authentication**: Basic password auth suitable for private family events
- **Scaling**: Repository pattern and service layer support horizontal scaling

### Build Process
- **Frontend Build**: Vite builds to `dist/public` directory
- **Backend Build**: esbuild bundles Express server
- **Static Assets**: Images, music, and uploads served from public directories
- **Environment Configuration**: Support for environment-specific settings

### Security Features
- **Input Validation**: Zod schemas validate all user inputs
- **File Upload Security**: Multer with file type and size restrictions
- **Admin Protection**: Password-based access to administrative functions
- **CORS Configuration**: Properly configured for cross-origin requests

The architecture prioritizes maintainability and scalability while keeping the complexity appropriate for a wedding invitation application. The modular design allows for easy feature additions and backend migrations as needed.