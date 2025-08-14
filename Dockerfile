# Multi-stage build for Wedding E-Invitation Platform
FROM node:20-alpine AS base

# Install Python and system dependencies
RUN apk add --no-cache python3 py3-pip python3-dev build-base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pyproject.toml poetry.lock* ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install Python dependencies
RUN pip3 install flask flask-cors pydantic

# Development stage
FROM base AS development

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p public/uploads

# Expose ports
EXPOSE 5000 5001 3000

# Default command for development
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Copy built application
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5000

# Production command
CMD ["npm", "start"]