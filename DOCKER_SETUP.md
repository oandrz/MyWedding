# Docker Setup for Wedding E-Invitation Platform

Docker provides the easiest way to run your wedding platform locally with zero configuration hassles.

## Quick Start (Super Simple!)

### 1. Install Docker

#### Option A: Colima (Recommended for macOS)
```bash
# Install with Homebrew
brew install colima docker docker-compose

# Start Colima
colima start
```

#### Option B: Docker Desktop
- **macOS/Windows**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux**: Install Docker and Docker Compose via your package manager

### 2. One-Command Setup
```bash
# Clone your repository (you already have this)
cd your-wedding-invitation-project

# Copy Docker environment file
cp docker/.env.docker .env

# Edit .env file - only need to add your Google token
nano .env  # or vim/code .env

# Start everything with one command!
docker-compose -f docker-compose.local.yml up
```

That's it! Your wedding platform will be running at:
- **Wedding App**: http://localhost:5000
- **Database Admin**: http://localhost:8080 (optional, run with `--profile admin`)

## What Docker Gives You

✅ **Automatic Database Setup** - PostgreSQL configured and ready  
✅ **No Manual Dependencies** - Node.js, Python, everything included  
✅ **Consistent Environment** - Same setup on any machine  
✅ **Easy Reset** - `docker-compose down -v` to start fresh  
✅ **Development Mode** - Hot reloading and live updates  

## Docker Commands

### Basic Operations
```bash
# Start everything
docker-compose -f docker-compose.local.yml up

# Start in background
docker-compose -f docker-compose.local.yml up -d

# Stop everything
docker-compose -f docker-compose.local.yml down

# Stop and remove data (fresh start)
docker-compose -f docker-compose.local.yml down -v

# View logs
docker-compose -f docker-compose.local.yml logs -f app
```

### Development Commands
```bash
# Rebuild after code changes
docker-compose -f docker-compose.local.yml up --build

# Run database migrations
docker-compose -f docker-compose.local.yml exec app npm run db:push

# Access database directly
docker-compose -f docker-compose.local.yml exec postgres psql -U wedding_user -d wedding_invitation_db

# Run shell in app container
docker-compose -f docker-compose.local.yml exec app sh
```

### With Database Admin
```bash
# Start with PgAdmin database management
docker-compose -f docker-compose.local.yml --profile admin up

# Access PgAdmin at http://localhost:8080
# Login: admin@wedding.local / admin123
```

## Environment Configuration

### Required Settings
Only edit these in your `.env` file:

```env
# Get this from your Replit secrets
GOOGLE_REFRESH_TOKEN=your_actual_token_here

# Optional: Google OAuth credentials (if regenerating tokens)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Database Connection
No setup needed! Docker automatically configures:
```env
DATABASE_URL=postgresql://wedding_user:wedding_password@postgres:5432/wedding_invitation_db
```

## File Structure

Your project files are automatically synced with the container:
```
project/
├── docker/                  # Docker configuration
│   ├── .env.docker         # Environment template
│   └── init.sql            # Database initialization
├── docker-compose.local.yml # Main Docker setup
├── Dockerfile              # App container definition
└── ...                     # Your existing project files
```

## Advantages Over Manual Setup

| Manual Setup | Docker Setup |
|--------------|--------------|
| Install Node.js 20 | ✅ Included |
| Install Python 3.10+ | ✅ Included |
| Install PostgreSQL | ✅ Auto-configured |
| Configure database | ✅ Ready to use |
| Manage dependencies | ✅ Automated |
| Environment sync | ✅ Identical everywhere |
| Reset/clean setup | ❌ Manual | ✅ One command |

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Check what's using ports
lsof -i :5000
lsof -i :5001
lsof -i :5432

# Stop conflicting services or change Docker ports
```

### Container Issues
```bash
# Rebuild containers
docker-compose -f docker-compose.local.yml build --no-cache

# Clean Docker system
docker system prune -a

# Reset everything
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up --build
```

### Colima-Specific Troubleshooting
```bash
# Check Colima status
colima status

# Restart Colima
colima stop
colima start

# Restart with more resources (if needed)
colima start --cpu 4 --memory 8

# Check Colima logs
colima logs
```

### Database Issues
```bash
# Reset database
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up postgres

# Check database logs
docker-compose -f docker-compose.local.yml logs postgres
```

## Production Deployment

For production, use the production target:
```bash
# Build production image
docker build --target production -t wedding-invitation:latest .

# Or use docker-compose.prod.yml (create as needed)
```

## Integration with Git

Your development workflow remains the same:
```bash
# Make changes to your code
git add .
git commit -m "Your changes"
git push

# Docker automatically picks up changes (hot reload)
# No need to restart unless you change dependencies
```

## Performance Tips

1. **Use Docker volumes** for node_modules (already configured)
2. **Use .dockerignore** to exclude unnecessary files
3. **Multi-stage builds** for smaller production images
4. **Health checks** ensure services are ready

## Next Steps

1. **Start Docker**: `docker-compose -f docker-compose.local.yml up`
2. **Test your wedding app**: http://localhost:5000
3. **Upload photos**: Test Google Drive integration
4. **Database admin**: Add `--profile admin` to explore data

Docker eliminates all the manual setup complexity while giving you a production-like environment locally!