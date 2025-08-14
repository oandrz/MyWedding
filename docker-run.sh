#!/bin/bash

# Wedding E-Invitation Platform - Docker Quick Start Script
# This script provides easy Docker commands for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker Compose file
COMPOSE_FILE="docker-compose.local.yml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}🐳 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed."
        echo "Install options:"
        echo "  Colima (recommended): brew install colima docker docker-compose"
        echo "  Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed."
        echo "Install with: brew install docker-compose"
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running."
        echo "Start Docker daemon:"
        echo "  Colima: colima start"
        echo "  Docker Desktop: Open Docker Desktop app"
        exit 1
    fi

    print_success "Docker and Docker Compose are ready!"
}

# Setup environment file
setup_env() {
    if [ ! -f ".env" ]; then
        print_status "Setting up environment file..."
        if [ -f "docker/.env.docker" ]; then
            cp docker/.env.docker .env
            print_warning "Please edit .env file and add your GOOGLE_REFRESH_TOKEN"
            print_status "You can get this from your Replit secrets"
        else
            print_error "docker/.env.docker template not found"
            exit 1
        fi
    else
        print_success "Environment file already exists"
    fi
}

# Main command dispatcher
case "${1:-}" in
    "start" | "up")
        print_status "Starting Wedding E-Invitation Platform with Docker..."
        check_docker
        setup_env
        docker-compose -f $COMPOSE_FILE up
        ;;
    
    "start-bg" | "up-bg")
        print_status "Starting in background..."
        check_docker
        setup_env
        docker-compose -f $COMPOSE_FILE up -d
        print_success "Services started in background!"
        print_status "Visit: http://localhost:5000"
        ;;
    
    "start-admin")
        print_status "Starting with database admin..."
        check_docker
        setup_env
        docker-compose -f $COMPOSE_FILE --profile admin up
        ;;
    
    "stop" | "down")
        print_status "Stopping services..."
        docker-compose -f $COMPOSE_FILE down
        print_success "Services stopped"
        ;;
    
    "restart")
        print_status "Restarting services..."
        docker-compose -f $COMPOSE_FILE down
        docker-compose -f $COMPOSE_FILE up
        ;;
    
    "build")
        print_status "Rebuilding containers..."
        docker-compose -f $COMPOSE_FILE build --no-cache
        print_success "Rebuild complete"
        ;;
    
    "reset")
        print_warning "This will delete all data! Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_status "Resetting everything..."
            docker-compose -f $COMPOSE_FILE down -v
            docker-compose -f $COMPOSE_FILE build --no-cache
            print_success "Reset complete"
        else
            print_status "Reset cancelled"
        fi
        ;;
    
    "logs")
        shift
        docker-compose -f $COMPOSE_FILE logs -f "${@:-app}"
        ;;
    
    "shell")
        print_status "Opening shell in app container..."
        docker-compose -f $COMPOSE_FILE exec app sh
        ;;
    
    "db")
        print_status "Connecting to database..."
        docker-compose -f $COMPOSE_FILE exec postgres psql -U wedding_user -d wedding_invitation_db
        ;;
    
    "status")
        print_status "Service status:"
        docker-compose -f $COMPOSE_FILE ps
        ;;
    
    "setup")
        print_status "Setting up Docker environment..."
        check_docker
        setup_env
        print_success "Setup complete! Run './docker-run.sh start' to begin"
        ;;
    
    *)
        echo "🎉 Wedding E-Invitation Platform - Docker Helper"
        echo ""
        echo "Usage: ./docker-run.sh <command>"
        echo ""
        echo "Commands:"
        echo "  setup         - Initial setup (check Docker, create .env)"
        echo "  start         - Start all services (with logs)"
        echo "  start-bg      - Start services in background"
        echo "  start-admin   - Start with database admin UI"
        echo "  stop          - Stop all services"
        echo "  restart       - Restart all services"
        echo "  build         - Rebuild containers"
        echo "  reset         - Reset everything (deletes data!)"
        echo "  logs [service] - View logs (default: app)"
        echo "  shell         - Open shell in app container"
        echo "  db            - Connect to database"
        echo "  status        - Show service status"
        echo ""
        echo "Quick start:"
        echo "  1. ./docker-run.sh setup"
        echo "  2. Edit .env file with your GOOGLE_REFRESH_TOKEN"
        echo "  3. ./docker-run.sh start"
        echo ""
        echo "Your app will be available at: http://localhost:5000"
        ;;
esac