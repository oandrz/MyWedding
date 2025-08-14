#!/bin/bash

# Wedding E-Invitation Platform - Local Development Setup Script
# This script helps set up your local development environment

set -e

echo "🎉 Setting up Wedding E-Invitation Platform for local development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.x first."
    echo "Visit: https://nodejs.org/ or see LOCAL_DEVELOPMENT_SETUP.md"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js version $NODE_VERSION detected. Recommended: 20.x"
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10+ first."
    echo "See LOCAL_DEVELOPMENT_SETUP.md for instructions."
    exit 1
fi

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. You'll need to install and configure PostgreSQL."
    echo "See LOCAL_DEVELOPMENT_SETUP.md for database setup instructions."
fi

echo "✅ Prerequisites check complete!"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install flask flask-cors pydantic || {
    echo "⚠️  Failed to install Python dependencies globally. Trying with --user flag..."
    pip3 install --user flask flask-cors pydantic
}

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your actual values (DATABASE_URL, GOOGLE_REFRESH_TOKEN, etc.)"
else
    echo "ℹ️  .env file already exists. Skipping..."
fi

# Create uploads directory if it doesn't exist
echo "📁 Creating uploads directory..."
mkdir -p public/uploads

# Check if database is accessible
if command -v psql &> /dev/null; then
    echo "🗄️  Testing database connection..."
    if psql -lqt | cut -d \| -f 1 | grep -qw wedding_invitation_db; then
        echo "✅ Database 'wedding_invitation_db' found!"
    else
        echo "⚠️  Database 'wedding_invitation_db' not found."
        echo "Run: createdb wedding_invitation_db"
        echo "Or see LOCAL_DEVELOPMENT_SETUP.md for database setup."
    fi
fi

echo ""
echo "🎉 Local development setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your actual values"
echo "2. Set up your PostgreSQL database (see LOCAL_DEVELOPMENT_SETUP.md)"
echo "3. Run: npm run dev"
echo ""
echo "Your app will be available at:"
echo "  Frontend: http://localhost:5000"
echo "  Backend API: http://localhost:5001"
echo ""
echo "Need help? Check LOCAL_DEVELOPMENT_SETUP.md for detailed instructions."