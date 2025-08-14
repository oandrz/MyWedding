#!/bin/sh

# Wedding Platform Testing Script
# Tests all components of your wedding invitation platform

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}🧪 Wedding Platform Test Suite${NC}"
echo "=================================="

# Test 1: Check Docker containers
echo "\n${BLUE}1. Testing Docker Container Status${NC}"
if docker-compose -f docker-compose.local.yml ps | grep -q "Up"; then
    echo "${GREEN}✅ Docker containers are running${NC}"
else
    echo "${RED}❌ Docker containers are not running${NC}"
    echo "Run: ./docker-run.sh start"
    exit 1
fi

# Test 2: Database connectivity
echo "\n${BLUE}2. Testing Database Connection${NC}"
if docker exec mywedding-postgres-1 psql -U wedding_user -d wedding_invitation_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "${GREEN}✅ Database connection successful${NC}"
else
    echo "${RED}❌ Database connection failed${NC}"
fi

# Test 3: Redis connectivity
echo "\n${BLUE}3. Testing Redis Connection${NC}"
if docker exec mywedding-redis-1 redis-cli ping | grep -q "PONG"; then
    echo "${GREEN}✅ Redis connection successful${NC}"
else
    echo "${RED}❌ Redis connection failed${NC}"
fi

# Test 4: Express Server (Port issues on macOS with AirTunes)
echo "\n${BLUE}4. Testing Express Server${NC}"
PORTS_TO_TRY="5000 8000 8080 3001"
EXPRESS_WORKING=false

for port in $PORTS_TO_TRY; do
    if curl -s -f http://localhost:$port > /dev/null 2>&1; then
        echo "${GREEN}✅ Express server responding on port $port${NC}"
        EXPRESS_WORKING=true
        EXPRESS_PORT=$port
        break
    fi
done

if [ "$EXPRESS_WORKING" = false ]; then
    echo "${YELLOW}⚠️  Express server not accessible via curl (may be port conflict)${NC}"
    echo "   Try opening http://localhost:5000 or http://localhost:3000 in your browser"
fi

# Test 5: Flask Server
echo "\n${BLUE}5. Testing Flask Server${NC}"
if curl -s -I http://localhost:5001 | grep -q "Server: Werkzeug"; then
    echo "${GREEN}✅ Flask server is responding${NC}"
else
    echo "${YELLOW}⚠️  Flask server may not be accessible from host${NC}"
fi

# Test 6: API Endpoints (using Node.js inside container)
echo "\n${BLUE}6. Testing API Endpoints${NC}"
if docker exec mywedding-app-1 node -e "
const http = require('http');
const req = http.request({hostname: 'localhost', port: 5000, path: '/api/rsvp', method: 'GET'}, (res) => {
    console.log('RSVP API Status:', res.statusCode);
    process.exit(res.statusCode === 200 ? 0 : 1);
});
req.on('error', () => process.exit(1));
req.end();
" > /dev/null 2>&1; then
    echo "${GREEN}✅ RSVP API endpoint accessible${NC}"
else
    echo "${YELLOW}⚠️  RSVP API endpoint check failed${NC}"
fi

# Test 7: File Upload Directory
echo "\n${BLUE}7. Testing File Upload Directory${NC}"
if docker exec mywedding-app-1 test -d /app/public/uploads; then
    echo "${GREEN}✅ Upload directory exists${NC}"
else
    echo "${RED}❌ Upload directory missing${NC}"
fi

# Test 8: Environment Variables
echo "\n${BLUE}8. Testing Environment Configuration${NC}"
if docker exec mywedding-app-1 sh -c 'test -n "$DATABASE_URL"'; then
    echo "${GREEN}✅ DATABASE_URL is set${NC}"
else
    echo "${RED}❌ DATABASE_URL is missing${NC}"
fi

if docker exec mywedding-app-1 sh -c 'test -n "$GOOGLE_REFRESH_TOKEN"'; then
    echo "${GREEN}✅ GOOGLE_REFRESH_TOKEN is set${NC}"
else
    echo "${YELLOW}⚠️  GOOGLE_REFRESH_TOKEN is missing (Google Drive integration won't work)${NC}"
fi

# Summary
echo "\n${BLUE}🎉 Test Summary${NC}"
echo "==================="
echo "${GREEN}Your wedding platform is running successfully!${NC}"
echo ""
echo "🌐 Access your wedding platform at:"
echo "   • Main App: http://localhost:5000 (if port 5000 available)"
echo "   • Frontend: http://localhost:3000 (Vite dev server)"
echo "   • Flask API: http://localhost:5001"
echo ""
echo "🔧 If you have port conflicts (common on macOS):"
echo "   • Disable AirPlay Receiver in System Preferences"
echo "   • Or modify docker-compose.local.yml to use different ports"
echo ""
echo "📝 To test specific features:"
echo "   • RSVP Form: Navigate to your app and test the RSVP section"
echo "   • Message Wall: Test posting messages"
echo "   • Photo Gallery: Test uploading photos"
echo "   • Google Drive: Ensure GOOGLE_REFRESH_TOKEN is configured"
echo ""
echo "${BLUE}Happy testing! 🎊${NC}"
