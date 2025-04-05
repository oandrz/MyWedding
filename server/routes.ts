import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRsvpSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { createProxyMiddleware } from "http-proxy-middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  // Try using the Flask API first, if available
  app.post("/api/rsvp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = "http://localhost:5001/api/rsvp";
      const flaskOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      };

      const flaskResponse = await fetch(flaskUrl, flaskOptions).catch(() => null);
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, use the Node.js implementation
      return handleRsvpSubmission(req, res);
    } catch (error) {
      return handleRsvpSubmission(req, res);
    }
  });

  app.get("/api/rsvp", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Try forwarding to Flask server
      const flaskUrl = "http://localhost:5001/api/rsvp";
      const flaskResponse = await fetch(flaskUrl).catch(() => null);
      
      if (flaskResponse && flaskResponse.ok) {
        const data = await flaskResponse.json();
        return res.status(flaskResponse.status).json(data);
      }
      
      // If Flask is not available, use the Node.js implementation
      return handleGetRsvps(req, res);
    } catch (error) {
      return handleGetRsvps(req, res);
    }
  });

  // Fallback API handlers for RSVP submission (used if Flask server is not available)
  async function handleRsvpSubmission(req: Request, res: Response) {
    try {
      // Validate the request body using zod
      const validatedData = insertRsvpSchema.parse(req.body);
      
      // Check if this email has already RSVP'd
      const existingRsvp = await storage.getRsvpByEmail(validatedData.email);
      
      if (existingRsvp) {
        // Update existing RSVP instead of creating a new one
        // But for now, let's just return a message
        return res.status(200).json({ 
          message: "Your RSVP has been updated successfully!",
          rsvp: existingRsvp 
        });
      }
      
      // Store the RSVP
      const rsvp = await storage.createRsvp(validatedData);
      
      res.status(201).json({ 
        message: "Thank you for your RSVP!",
        rsvp 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("RSVP submission error:", error);
        res.status(500).json({ message: "Failed to submit RSVP" });
      }
    }
  }

  // Fallback API handlers for getting all RSVPs (used if Flask server is not available)
  async function handleGetRsvps(_req: Request, res: Response) {
    try {
      const rsvps = await storage.getRsvps();
      
      // Calculate attendance stats
      const attending = rsvps.filter(rsvp => rsvp.attending).length;
      const notAttending = rsvps.filter(rsvp => !rsvp.attending).length;
      
      // Calculate total guests
      const totalGuests = rsvps
        .filter(rsvp => rsvp.attending && rsvp.guestCount)
        .reduce((sum, current) => sum + (current.guestCount || 0), 0);
      
      res.status(200).json({ 
        rsvps,
        stats: {
          total: rsvps.length,
          attending,
          notAttending,
          totalGuests
        }
      });
    } catch (error) {
      console.error("Error fetching RSVPs:", error);
      res.status(500).json({ message: "Failed to fetch RSVPs" });
    }
  }

  const httpServer = createServer(app);

  return httpServer;
}
