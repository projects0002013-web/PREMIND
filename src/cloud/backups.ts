import type { SupabaseClient } from "@supabase/supabase-js";
import { validate } from "../storage/db";
import type { Data } from "../types";
export interface CloudBackup {
  document: Data;
  revision: number;
  updated_at: string;
}
export class ConflictError extends Error {
  constructor() {
    super("cloud-conflict");
  }
}
async function userId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw Error("authentication-required");
  return data.user.id;
}
export async function readBackup(
  client: SupabaseClient,
): Promise<CloudBackup | null> {
  const id = await userId(client);
  const { data, error } = await client
    .from("research_backups")
    .select("document,revision,updated_at")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    document: validate(data.document),
    revision: data.revision,
    updated_at: data.updated_at,
  };
}
export async function writeBackup(
  client: SupabaseClient,
  document: Data,
  revision: number | null,
): Promise<CloudBackup> {
  const id = await userId(client);
  const safe = validate(structuredClone(document));
  if (new Blob([JSON.stringify(safe)]).size > 20 * 1024 * 1024)
    throw Error("backup-too-large");
  const query =
    revision === null
      ? client.from("research_backups").insert({ user_id: id, document: safe })
      : client
          .from("research_backups")
          .update({ document: safe })
          .eq("user_id", id)
          .eq("revision", revision);
  const { data, error } = await query
    .select("document,revision,updated_at")
    .maybeSingle();
  if (error?.code === "23505" || (!error && !data)) throw new ConflictError();
  if (error) throw error;
  return {
    document: validate(data!.document),
    revision: data!.revision,
    updated_at: data!.updated_at,
  };
}
export async function removeBackup(client: SupabaseClient, revision: number) {
  const id = await userId(client);
  const { data, error } = await client
    .from("research_backups")
    .delete()
    .eq("user_id", id)
    .eq("revision", revision)
    .select("revision");
  if (error) throw error;
  if (!data?.length) throw new ConflictError();
}
