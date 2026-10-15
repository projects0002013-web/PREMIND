// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppContext } from "../components/Context";
import { initial } from "../storage/db";
const mock = vi.hoisted(() => ({
  state: {
    configured: true,
    invalidConfig: false,
    loading: false,
    authError: false,
    recovering: false,
    finishRecovery: vi.fn(),
    session: null as { user: { id: string; email: string } } | null,
  },
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
  },
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../cloud/CloudContext", () => ({ useCloud: () => mock.state }));
vi.mock("../cloud/client", () => ({
  client: { auth: mock.auth },
  authRedirect: () => "http://localhost/PREMIND/",
}));
vi.mock("../cloud/backups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../cloud/backups")>()),
  readBackup: mock.read,
  writeBackup: mock.write,
  removeBackup: mock.remove,
}));
import Account from "../pages/Account";
function mount() {
  return render(
    <AppContext.Provider
      value={{
        data: initial(),
        update: vi.fn().mockResolvedValue(undefined),
        lang: "en",
        t: (_, en) => en,
      }}
    >
      <Account />
    </AppContext.Provider>,
  );
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mock.state.configured = true;
  mock.state.session = null;
  mock.state.recovering = false;
  mock.auth.getUser.mockResolvedValue({
    data: { user: { id: "owner-a" } },
    error: null,
  });
  mock.read.mockResolvedValue(null);
  for (const fn of [
    mock.auth.signInWithPassword,
    mock.auth.signUp,
    mock.auth.signInWithOAuth,
    mock.auth.resetPasswordForEmail,
    mock.auth.updateUser,
    mock.auth.signOut,
  ])
    fn.mockResolvedValue({ data: { session: null }, error: null });
});
describe("account workflows", () => {
  it("explains missing setup and makes no cloud requests in local mode", () => {
    mock.state.configured = false;
    mount();
    expect(screen.getByText(/Cloud is not connected yet/)).toBeInTheDocument();
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
    expect(mock.read).not.toHaveBeenCalled();
  });
  it("starts only Google authentication when requested, without uploading results", async () => {
    mount();
    fireEvent.click(screen.getByText("Continue with Google"));
    await waitFor(() =>
      expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost/PREMIND/" },
      }),
    );
    expect(mock.write).not.toHaveBeenCalled();
  });
  it("registers by email and explains verification", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "participant@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password-only" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account authentication" }),
    );
    await screen.findByText(
      "Check your email and confirm your address, then sign in.",
    );
    expect(mock.auth.signUp).toHaveBeenCalledWith({
      email: "participant@example.test",
      password: "test-password-only",
      options: { emailRedirectTo: "http://localhost/PREMIND/" },
    });
  });
  it("never uploads on sign-in and requires consent plus confirmation", async () => {
    mock.state.session = {
      user: { id: "owner-a", email: "person@example.test" },
    };
    mock.write.mockResolvedValue({
      document: initial(),
      revision: 1,
      updated_at: new Date().toISOString(),
    });
    mount();
    expect(mock.write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Check cloud backup"));
    await screen.findByText("This account has no cloud backup yet.");
    const upload = screen.getByText("Save to cloud");
    expect(upload).toBeDisabled();
    fireEvent.click(screen.getByText(/I consent to uploading/));
    fireEvent.click(upload);
    expect(mock.write).not.toHaveBeenCalled();
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "Confirm cloud action" }),
      ).getByText("Confirm"),
    );
    await screen.findByText("Cloud backup saved.");
    expect(mock.write).toHaveBeenCalledTimes(1);
  });
  it("does not delete a cloud backup without confirmation", async () => {
    mock.state.session = {
      user: { id: "owner-a", email: "person@example.test" },
    };
    mock.read.mockResolvedValue({
      document: initial(),
      revision: 1,
      updated_at: new Date().toISOString(),
    });
    mock.remove.mockResolvedValue(undefined);
    mount();
    fireEvent.click(screen.getByText("Check cloud backup"));
    await screen.findByText("Delete cloud backup");
    fireEvent.click(screen.getByText("Delete cloud backup"));
    expect(mock.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(mock.remove).not.toHaveBeenCalled();
  });
  it("offers a new-password form after an email recovery callback", async () => {
    mock.state.session = {
      user: { id: "owner-a", email: "person@example.test" },
    };
    mock.state.recovering = true;
    mount();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "new-test-password" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account authentication" }),
    );
    await waitFor(() =>
      expect(mock.auth.updateUser).toHaveBeenCalledWith({
        password: "new-test-password",
      }),
    );
    expect(mock.state.finishRecovery).toHaveBeenCalled();
  });
  it("shows a recoverable message for failed login", async () => {
    mock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: Error("bad credentials"),
    });
    mount();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Account authentication" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Action failed");
    expect(mock.write).not.toHaveBeenCalled();
  });
});
