// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "../LanguageContext";

function LangDisplay() {
  const { lang, t, dateLocale } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="t-open">{t("openInvitation")}</span>
      <span data-testid="date-locale">{dateLocale}</span>
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <button onClick={() => setLang(lang === "en" ? "id" : "en")}>toggle</button>
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("LanguageContext", () => {
  it("defaults to en when no ?lang param", () => {
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("t-open").textContent).toBe("Open Invitation");
    expect(screen.getByTestId("date-locale").textContent).toBe("en-US");
  });

  it("initialises to id when ?lang=id is in URL", () => {
    window.history.replaceState({}, "", "/?lang=id");
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>
    );
    expect(screen.getByTestId("lang").textContent).toBe("id");
    expect(screen.getByTestId("t-open").textContent).toBe("Buka Undangan");
    expect(screen.getByTestId("date-locale").textContent).toBe("id-ID");
  });

  it("setLang switches language and updates URL param", () => {
    render(
      <LanguageProvider>
        <LangDisplay />
        <LangToggle />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("lang").textContent).toBe("id");
    expect(window.location.search).toContain("lang=id");
  });

  it("setLang preserves existing URL params", () => {
    window.history.replaceState({}, "", "/?code=abc");
    render(
      <LanguageProvider>
        <LangToggle />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByText("toggle"));
    expect(window.location.search).toContain("code=abc");
    expect(window.location.search).toContain("lang=id");
  });
});
