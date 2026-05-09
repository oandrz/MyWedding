// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    h2: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <h2 {...rest}>{children}</h2>;
    },
    p: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <p {...rest}>{children}</p>;
    },
  },
}));

import DressCodeSection from "../DressCodeSection";

function renderWithColors(colors: { hex: string; label: string }[] | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (colors !== null) {
    qc.setQueryData(["/api/app-settings"], {
      settings: [{ settingKey: "dress_code_colors", settingValue: JSON.stringify(colors) }],
    });
  }
  return render(
    <QueryClientProvider client={qc}><DressCodeSection /></QueryClientProvider>
  );
}

describe("DressCodeSection", () => {
  it("renders nothing while data is loading (no query data seeded)", () => {
    const { container } = renderWithColors(null);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when colors array is empty", () => {
    const { container } = renderWithColors([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading and subtitle when colors are present", () => {
    renderWithColors([{ hex: "#FFFFFF", label: "White" }]);
    expect(screen.getByText("Dress Code")).toBeInTheDocument();
    expect(screen.getByText("Attire")).toBeInTheDocument();
    expect(screen.getByText(/avoid wearing the following colors/i)).toBeInTheDocument();
  });

  it("renders a swatch and label for each color", () => {
    renderWithColors([
      { hex: "#FFFFFF", label: "White" },
      { hex: "#FFD700", label: "Gold" },
    ]);
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    const swatch0 = screen.getByTestId("color-swatch-0");
    const swatch1 = screen.getByTestId("color-swatch-1");
    expect(swatch0).toHaveStyle({ backgroundColor: "#FFFFFF" });
    expect(swatch1).toHaveStyle({ backgroundColor: "#FFD700" });
  });

  it("renders nothing when dress_code_colors value is malformed JSON", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["/api/app-settings"], {
      settings: [{ settingKey: "dress_code_colors", settingValue: "{{invalid" }],
    });
    const { container } = render(
      <QueryClientProvider client={qc}><DressCodeSection /></QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
