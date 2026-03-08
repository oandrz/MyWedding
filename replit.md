# Wedding E-Invitation Platform

## Overview

This project is a comprehensive wedding e-invitation platform designed to provide an interactive digital experience for wedding guests. It features RSVP management, message boards for well-wishes, photo galleries with guest upload capabilities, and an administrative dashboard for content management. The platform aims to streamline wedding planning by digitizing guest interactions and memory collection, offering a modern alternative to traditional paper invitations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application utilizes a full-stack architecture with distinct frontend and backend components.

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS, enhanced with ShadCN UI components.
- **Animations**: Framer Motion for dynamic user interfaces.
- **Routing**: Wouter for client-side navigation.
- **State Management**: React Query (TanStack Query) for server state handling.
- **Form Handling**: React Hook Form with Zod for validation.

### Backend Architecture
The system supports a dual-backend approach:
- **Flask Backend (Python)**: Serves as the primary production backend.
- **Express.js Backend (Node.js)**: Used for development and serving static assets.

### Database Strategy
- **Development**: Utilizes in-memory storage for rapid development cycles.
- **Production**: Configured with Drizzle ORM for PostgreSQL, allowing for robust data persistence. RSVP and message board data are persisted via PostgreSQL.

### UI/UX Decisions
- The design incorporates wedding-themed aesthetics, utilizing heart motifs and rose/pink color palettes.
- Guest-friendly interfaces for photo galleries and RSVP forms.
- Admin dashboard features icon-only tabs on mobile for improved responsiveness.

### Core Features
- **Hero Section**: Includes background music and a countdown timer.
- **RSVP Management**: Allows guests to respond with attendance details.
- **Message Board**: Guests can post congratulatory messages.
- **Photo Gallery**: Supports guest photo uploads directly to an embedded Google Drive folder with real-time display and admin approval. Gallery images have a `displayOrder` field for custom ordering.
- **Admin Dashboard**: Provides tools for managing RSVPs, moderating content, and overseeing platform settings. Gallery images support drag-and-drop reordering via `@dnd-kit`.

### Design Patterns
- **Repository Pattern**: Utilizes abstract repository interfaces for data access, supporting multiple implementations (in-memory, database) for flexibility and testing.

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React, React DOM, React Query.
- **UI Libraries**: Radix UI, ShadCN UI.
- **Animation**: Framer Motion.
- **Form Management**: React Hook Form, Zod.
- **Styling**: Tailwind CSS, PostCSS.

### Backend Dependencies
- **Python**: Flask, Flask-CORS, Pydantic.
- **Node.js**: Express, Multer (for file uploads), http-proxy-middleware.
- **Database**: Drizzle ORM, @neondatabase/serverless, PostgreSQL.

### Development Tools
- **Build Tool**: Vite.
- **Language**: TypeScript.
- **Linting**: ESLint.
- **Package Management**: npm.
- **Testing**: Vitest (config at `vitest.config.ts`, tests in `tests/` directory).

### Drag-and-Drop
- **@dnd-kit/core**, **@dnd-kit/sortable**, **@dnd-kit/utilities**: Used for gallery image reordering in the admin panel.
- Performance optimized: `SortableGalleryItem` is wrapped in `React.memo` with stable `useCallback` handlers, uses thumbnail images in the grid, applies simplified CSS during active drag, and uses optimistic cache updates (TanStack Query `onMutate`) for instant reorder feedback.

### Integrated Services
- **Google Drive API**: Used for guest photo uploads and gallery management.