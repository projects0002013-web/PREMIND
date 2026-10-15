import { describe, it, expect, vi } from "vitest";
import { parseCloudConfig } from "../cloud/client";
import {
  readBackup,
  writeBackup,
  removeBackup,
  ConflictError,
} from "../cloud/backups";
import { initial } from "../storage/db";
import type { SupabaseClient } from "@supabase/supabase-js";
function mockClient(response: unknown = { data: null, error: null }) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.insert.mockReturnValue(q);
  q.update.mockReturnValue(q);
  q.delete.mockReturnValue(q);
  const auth = {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null }),
  };
  const from = vi.fn().mockReturnValue(q);
  return { client: { auth, from } as unknown as SupabaseClient, q, auth, from };
}
describe("public cloud configuration", () => {
  it("keeps local mode available without configuration", () => {
    expect(parseCloudConfig()).toBeNull();
  });
  it("accepts only complete public configuration", () => {
    expect(
      parseCloudConfig("https://project.supabase.co", "sb_publishable_example")
        ?.url,
    ).toBe("https://project.supabase.co");
    expect(() => parseCloudConfig("https://project.supabase.co")).toThrow();
    expect(() =>
      parseCloudConfig("http://example.com", "sb_publishable_example"),
    ).toThrow();
  });
  it("rejects server keys, URL credentials and arbitrary JWT roles", () => {
    for (const key of [
      "sb_secret_example",
      "x." + btoa(JSON.stringify({ role: "service_role" })) + ".x",
      "not-a-key",
    ])
      expect(() =>
        parseCloudConfig("https://project.supabase.co", key),
      ).toThrow();
    expect(() =>
      parseCloudConfig(
        "https://user:pass@project.supabase.co",
        "sb_publishable_example",
      ),
    ).toThrow();
  });
  it("supports a legacy anon key without accepting elevated roles", () => {
    expect(
      parseCloudConfig(
        "https://project.supabase.co",
        "x." + btoa(JSON.stringify({ role: "anon" })) + ".x",
      ),
    ).not.toBeNull();
  });
});
describe("account-scoped cloud backups", () => {
  it("refuses unauthenticated access before any table request", async () => {
    const m = mockClient();
    m.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);
    await expect(readBackup(m.client)).rejects.toThrow(
      "authentication-required",
    );
    expect(m.from).not.toHaveBeenCalled();
  });
  it("filters reads to the verified account ID", async () => {
    const d = initial();
    const m = mockClient({
      data: { document: d, revision: 2, updated_at: new Date().toISOString() },
      error: null,
    });
    expect((await readBackup(m.client))?.document).toEqual(d);
    expect(m.q.eq).toHaveBeenCalledWith("user_id", "owner-a");
  });
  it("creates a backup with the verified owner and no arbitrary revision", async () => {
    const d = initial();
    const m = mockClient({
      data: { document: d, revision: 1, updated_at: new Date().toISOString() },
      error: null,
    });
    await writeBackup(m.client, d, null);
    expect(m.q.insert).toHaveBeenCalledWith({
      user_id: "owner-a",
      document: d,
    });
    expect(m.q.update).not.toHaveBeenCalled();
  });
  it("compares revisions on update and rejects lost-update races", async () => {
    const m = mockClient();
    await expect(writeBackup(m.client, initial(), 3)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(m.q.eq).toHaveBeenCalledWith("user_id", "owner-a");
    expect(m.q.eq).toHaveBeenCalledWith("revision", 3);
    expect(m.q.insert).not.toHaveBeenCalled();
  });
  it("does not turn an insert race into an overwrite", async () => {
    const m = mockClient({ data: null, error: { code: "23505" } });
    await expect(writeBackup(m.client, initial(), null)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(m.q.update).not.toHaveBeenCalled();
  });
  it("validates downloaded data before exposing it to the application", async () => {
    const m = mockClient({
      data: {
        document: { schemaVersion: 99 },
        revision: 1,
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    await expect(readBackup(m.client)).rejects.toThrow("Invalid backup");
  });
  it("requires an explicit revision and owner on deletion", async () => {
    const m = mockClient();
    m.q.select.mockResolvedValue({ data: [], error: null });
    await expect(removeBackup(m.client, 5)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(m.q.eq).toHaveBeenCalledWith("revision", 5);
    expect(m.q.eq).toHaveBeenCalledWith("user_id", "owner-a");
  });
});
