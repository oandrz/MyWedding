// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NavBar from "@/components/NavBar";

vi.mock("wouter", () => ({
  Link: ({ href, children, className, onClick }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => <a href={href} className={className} onClick={onClick}>{children}</a>,
  useLocation: () => ["/gallery", vi.fn()],
}));

vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ isFeatureEnabled: () => false }),
}));

vi.mock("@/lib/constants", () => ({
  BRIDE_NAME: "Test Bride",
  GROOM_NAME: "Test Groom",
}));

const NAV_LABELS: Record<string, string> = {
  navHome: "Home",
  navOurStory: "Our Story",
  navWeddingDetails: "Wedding Details",
  navWishes: "Wishes",
  navMonogram: "A&C",
};

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "en",
    setLang: vi.fn(),
    t: (key: string) => NAV_LABELS[key] ?? key,
    dateLocale: "en-US",
  }),
}));

describe("NavBar minimal prop", () => {
  it("shows logo when minimal=true", () => {
    render(<NavBar minimal />);
    expect(screen.getByText("A&C")).toBeInTheDocument();
  });

  it("hides the mobile hamburger button when minimal=true", () => {
    render(<NavBar minimal />);
    expect(screen.queryByLabelText("Toggle menu")).toBeNull();
  });

  it("hides nav links when minimal=true", () => {
    render(<NavBar minimal />);
    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.queryByText("Wishes")).toBeNull();
    expect(screen.queryByText("Memories")).toBeNull();
  });
});

describe("NavBar home link", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("home link goes to / when no code in sessionStorage", () => {
    render(<NavBar />);
    const link = screen.getByText("Home").closest("a")!;
    expect(link).toHaveAttribute("href", "/");
  });

  it("home link includes ?code= when code is in sessionStorage", () => {
    sessionStorage.setItem("inviteCode", "klycp");
    render(<NavBar />);
    const link = screen.getByText("Home").closest("a")!;
    expect(link).toHaveAttribute("href", "/?code=klycp");
  });

  it("logo link includes ?code= when code is in sessionStorage", () => {
    sessionStorage.setItem("inviteCode", "klycp");
    render(<NavBar />);
    const logo = screen.getByText("A&C").closest("a")!;
    expect(logo).toHaveAttribute("href", "/?code=klycp");
  });

  it("logo link goes to / when no code in sessionStorage", () => {
    render(<NavBar />);
    const logo = screen.getByText("A&C").closest("a")!;
    expect(logo).toHaveAttribute("href", "/");
  });

  it("logo link includes ?code= when minimal=true and code in sessionStorage", () => {
    sessionStorage.setItem("inviteCode", "klycp");
    render(<NavBar minimal />);
    const logo = screen.getByText("A&C").closest("a")!;
    expect(logo).toHaveAttribute("href", "/?code=klycp");
  });
});

describe("NavBar language toggle", () => {
  it("shows EN and ID toggle buttons", () => {
    render(<NavBar />);
    expect(screen.getByTestId("lang-toggle-en")).toBeInTheDocument();
    expect(screen.getByTestId("lang-toggle-id")).toBeInTheDocument();
  });

  it("shows toggle in minimal mode", () => {
    render(<NavBar minimal />);
    expect(screen.getByTestId("lang-toggle-en")).toBeInTheDocument();
    expect(screen.getByTestId("lang-toggle-id")).toBeInTheDocument();
  });
});
