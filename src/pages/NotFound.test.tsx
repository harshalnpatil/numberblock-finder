import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "./NotFound";

describe("NotFound", () => {
  it("renders 404 messaging and home link", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter
        initialEntries={["/does-not-exist"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to home/i })).toHaveAttribute("href", "/");

    err.mockRestore();
  });
});
