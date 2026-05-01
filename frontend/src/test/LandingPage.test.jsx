import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandingPage from "../pages/LandingPage";

describe("LandingPage", () => {
  it("renders the marketing content", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Budapest Smart Parking Management System"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/AI-powered license plate detection/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Platform Features")).toBeInTheDocument();
  });

  it("navigates to the login page", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<div>Login Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Login Route")).toBeInTheDocument();
  });

  it("navigates to the register page", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<div>Register Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("Register Route")).toBeInTheDocument();
  });
});
