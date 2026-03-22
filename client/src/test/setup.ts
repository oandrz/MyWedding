import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

// Only activate MSW in node environment; jsdom tests that use global.fetch mocks
// directly would have their mocks overridden by server.listen(), so we skip setup
// in browser-like (jsdom) environments.
if (typeof window === "undefined") {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
