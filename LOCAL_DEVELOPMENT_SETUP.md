# Local Development Setup

This guide helps you replicate the Replit environment on your local machine for the Wedding E-Invitation Platform.

## Prerequisites

### Required Software
- **Node.js 20.x** (matches Replit environment)
- **Python 3.10+** 
- **PostgreSQL 14+**
- **Git** (already have this)

### Installation Commands

#### macOS (using Homebrew)
```bash
# Install Node.js
brew install node@20

# Install Python (if not already installed)
brew install python@3.11

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14
```

#### Windows (using Chocolatey)
```powershell
# Install Node.js
choco install nodejs --version=20.0.0

# Install Python
choco install python --version=3.11.0

# Install PostgreSQL
choco install postgresql14
```

#### Ubuntu/Debian
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python
sudo apt-get install python3.11 python3.11-pip python3.11-venv

# Install PostgreSQL
sudo apt-get install postgresql-14 postgresql-client-14
```

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone your repository (you already have this)
cd your-wedding-invitation-project

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install flask flask-cors pydantic
# OR using poetry (if you prefer)
pip install poetry
poetry install
```

### 2. Database Setup

```bash
# Start PostgreSQL service (if not already running)
# macOS: brew services start postgresql@14
# Ubuntu: sudo systemctl start postgresql
# Windows: Check services or use pgAdmin

# Create database
createdb wedding_invitation_db

# OR connect to PostgreSQL and create manually:
psql postgres
CREATE DATABASE wedding_invitation_db;
\q
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your actual values
# Update DATABASE_URL with your local PostgreSQL credentials
```

### 4. Google Drive Setup (if needed)

Your project uses Google Drive integration. You have two options:

**Option A: Use existing token (Recommended)**
- The `GOOGLE_REFRESH_TOKEN` from your Replit environment should work locally
- Just copy it to your `.env` file

**Option B: Set up new OAuth credentials**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth2 credentials
3. Add to `.env` file

### 5. Run the Application

```bash
# Start both Express and Flask servers
npm run dev

# This will start:
# - Express server on http://localhost:5000 (frontend + API proxy)
# - Flask server on http://localhost:5001 (backend API)
```

### 6. Database Migration

```bash
# Push your database schema
npm run db:push

# This uses Drizzle to sync your database schema
```

## Development Workflow

### File Structure Match
Your local structure should match Replit:
```
wedding-invitation/
├── client/           # React frontend
├── server/           # Express server & API
├── shared/           # Shared TypeScript schemas
├── app_modules/      # Flask backend modules
├── public/           # Static assets
├── attached_assets/  # User uploads & assets
├── package.json      # Node dependencies
├── pyproject.toml    # Python dependencies
└── .env              # Environment variables
```

### Key Differences from Replit
1. **Environment Variables**: Use `.env` file instead of Replit secrets
2. **Database**: Local PostgreSQL instead of managed Replit database
3. **File Uploads**: Stored in local `public/uploads/` directory
4. **Google Drive**: Same integration, just different OAuth flow setup

### Troubleshooting

#### Port Conflicts
If ports 5000 or 5001 are in use:
```bash
# Find processes using ports
lsof -i :5000
lsof -i :5001

# Kill processes if needed
kill -9 <PID>
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -d wedding_invitation_db -c "SELECT 1;"

# Check if PostgreSQL is running
# macOS: brew services list | grep postgresql
# Ubuntu: sudo systemctl status postgresql
```

#### Python/Flask Issues
```bash
# Check Python version
python3 --version

# Install Flask dependencies explicitly
pip install flask flask-cors pydantic

# Or use virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install flask flask-cors pydantic
```

## Production vs Development

### Environment Variables
- **Development**: Uses `.env` file
- **Production**: Set environment variables in hosting platform

### Database
- **Development**: Local PostgreSQL
- **Production**: Use managed database (Neon, Supabase, etc.)

### Google Drive
- **Development**: Can use same OAuth token
- **Production**: Should use production OAuth credentials

## Useful Commands

```bash
# Development
npm run dev          # Start development servers
npm run build        # Build for production
npm run check        # TypeScript type checking
npm run db:push      # Push database schema changes

# Python backend only (if needed)
cd app_modules
python -m flask run --port=5001

# Database management
npm run db:push      # Apply schema changes
psql wedding_invitation_db  # Connect to database directly
```

## VS Code Configuration (Optional)

Create `.vscode/settings.json` for optimal development:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

This setup should give you a development environment that matches your Replit setup perfectly!