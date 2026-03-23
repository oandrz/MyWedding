import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/feature-flags", () => {
    return HttpResponse.json({
      featureFlags: [
        { id: 1, featureKey: "rsvp_enabled", featureName: "RSVP", enabled: true },
        { id: 2, featureKey: "gallery_enabled", featureName: "Gallery", enabled: true },
        { id: 3, featureKey: "messages_enabled", featureName: "Messages", enabled: true },
      ],
    });
  }),

  http.get("/api/app-settings", () => {
    return HttpResponse.json({
      settings: [],
    });
  }),

  http.get("/api/messages", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "20");
    const offset = Number(url.searchParams.get("offset") || "0");
    return HttpResponse.json({
      messages: [],
      total: 0,
      limit,
      offset,
    });
  }),

  http.get("/api/media", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "20");
    const offset = Number(url.searchParams.get("offset") || "0");
    return HttpResponse.json({
      media: [],
      total: 0,
      limit,
      offset,
    });
  }),

  http.post("/api/rsvp", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Thank you for your RSVP!",
      rsvp: { id: 1, ...body },
    }, { status: 201 });
  }),

  http.post("/api/messages", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Message submitted successfully!",
      data: { id: 1, ...body, createdAt: new Date().toISOString() },
    }, { status: 201 });
  }),
];
