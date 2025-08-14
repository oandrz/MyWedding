# Using Colima with Wedding E-Invitation Platform

Colima is a lightweight alternative to Docker Desktop that works perfectly with this project.

## Why Colima?

✅ **Lightweight** - Uses less memory and CPU than Docker Desktop  
✅ **Fast startup** - Boots much quicker  
✅ **No licensing concerns** - Completely free and open source  
✅ **Native performance** - Better performance on Apple Silicon  
✅ **Same commands** - Uses standard Docker CLI  

## Quick Setup

### 1. Install Colima
```bash
# Install via Homebrew
brew install colima docker docker-compose

# Or install manually from: https://github.com/abiosoft/colima
```

### 2. Start Colima
```bash
# Basic start
colima start

# Start with more resources (recommended for development)
colima start --cpu 4 --memory 8 --disk 60
```

### 3. Verify Installation
```bash
# Check Colima status
colima status

# Test Docker
docker --version
docker-compose --version

# Test with hello-world
docker run hello-world
```

### 4. Run Wedding Platform
```bash
# Navigate to your project
cd your-wedding-invitation-project

# Use the same Docker commands as before
./docker-run.sh setup
./docker-run.sh start
```

## Colima Commands

### Basic Operations
```bash
colima start                 # Start Docker daemon
colima stop                  # Stop Docker daemon
colima restart               # Restart Docker daemon
colima status                # Check status
colima delete                # Delete and reset everything
```

### Advanced Configuration
```bash
# Start with custom resources
colima start --cpu 4 --memory 8 --disk 60

# Start with different architecture (if needed)
colima start --arch x86_64

# Start with custom VM type
colima start --vm-type qemu

# Mount additional directories
colima start --mount /your/local/path:/vm/path:w
```

## Performance Comparison

| Feature | Docker Desktop | Colima |
|---------|----------------|--------|
| Memory Usage | ~2-4 GB | ~500 MB - 1 GB |
| Startup Time | 30-60 seconds | 5-15 seconds |
| Performance | Good | Excellent (especially M1/M2) |
| License | Commercial use requires license | Free |
| Updates | Automatic, sometimes breaking | Manual, stable |

## Wedding App Configuration

Your wedding platform will work exactly the same with Colima:

```bash
# All these commands work identically
./docker-run.sh start        # Start wedding platform
./docker-run.sh stop         # Stop services
./docker-run.sh reset        # Reset everything
./docker-run.sh logs         # View logs
```

**App URLs remain the same:**
- Wedding Platform: http://localhost:5000
- Database Admin: http://localhost:8080

## Troubleshooting

### Colima Won't Start
```bash
# Check what's preventing start
colima logs

# Clean restart
colima delete
colima start

# Start with verbose logging
colima start --verbose
```

### Performance Issues
```bash
# Give Colima more resources
colima stop
colima start --cpu 4 --memory 8

# Check resource usage
colima status
docker system df
```

### Network Issues
```bash
# Reset network
colima stop
colima start

# Check network configuration
docker network ls
```

### Credential Helper Errors
```bash
# Fix "docker-credential-desktop not found" error
cp ~/.docker/config.json ~/.docker/config.json.backup
sed -i '' '/docker-credential-desktop/d' ~/.docker/config.json

# Or remove Docker config entirely and start fresh
rm ~/.docker/config.json
docker login  # if you need to login to registries
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :5000
lsof -i :5001
lsof -i :5432

# Or stop conflicting services
brew services stop postgresql  # if you have local postgres
```

## Migration from Docker Desktop

### 1. Stop Docker Desktop
- Quit Docker Desktop completely
- Remove from Login Items if auto-starting

### 2. Install and Start Colima
```bash
brew install colima
colima start
```

### 3. Test Your Wedding App
```bash
# Your existing Docker setup should work immediately
./docker-run.sh start
```

### 4. Clean Up Docker Desktop Config
```bash
# Fix credential helper conflicts
cp ~/.docker/config.json ~/.docker/config.json.backup
sed -i '' '/docker-credential-desktop/d' ~/.docker/config.json

# Optional: Completely remove Docker Desktop files
rm -rf ~/Library/Group\ Containers/group.com.docker
rm -rf ~/Library/Containers/com.docker.docker
```

## Best Practices with Colima

### Resource Allocation
```bash
# For development work (recommended)
colima start --cpu 4 --memory 8 --disk 60

# For light testing
colima start --cpu 2 --memory 4 --disk 30
```

### Auto-start Setup
```bash
# Add to your shell profile (.zshrc, .bashrc)
echo 'colima start --cpu 4 --memory 8 &>/dev/null &' >> ~/.zshrc

# Or use a startup agent
colima start --autostart
```

### Regular Maintenance
```bash
# Weekly cleanup
docker system prune -a

# Monthly reset (if needed)
colima delete
colima start --cpu 4 --memory 8
```

## Summary

Colima provides a superior Docker experience for macOS development. Your wedding platform Docker configuration works perfectly with Colima - just replace Docker Desktop with Colima and everything else stays the same!

**Quick migration checklist:**
1. ✅ Install Colima: `brew install colima`
2. ✅ Start: `colima start --cpu 4 --memory 8`
3. ✅ Test: `./docker-run.sh start`
4. ✅ Enjoy faster, lighter Docker development!