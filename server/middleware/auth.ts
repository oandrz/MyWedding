import { Request, Response, NextFunction } from "express";

// Simple admin authentication middleware
// In a production environment, you would use a more secure approach
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check for admin credentials in headers (basic auth) or query params for testing
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'wedding-admin'; // Default password for testing
  
  if (authHeader) {
    // Basic auth header format: "Basic base64(username:password)"
    const base64Credentials = authHeader.split(' ')[1];
    
    if (base64Credentials) {
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      if (username === 'admin' && password === adminPassword) {
        return next();
      }
    }
  }
  
  // Check for adminKey in request body (for validation endpoint)
  if (req.body?.adminKey === adminPassword) {
    return next();
  }
  
  // Alternative: Allow using query parameter for development/testing
  if (req.query.adminKey === adminPassword) {
    return next();
  }
  
  // If no valid authentication is provided
  res.status(401).json({ message: 'Unauthorized access to admin area' });
}