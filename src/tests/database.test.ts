import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { initial } from "../storage/db";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values ('${a}'),('${b}'),('${c}');`,
  );
  await db.exec(
    await readFile("supabase/migrations/202610150001_accounts.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL RLS and revision trigger (real engine, simulated Auth identity)", () => {
  it("rejects anonymous reads", async () => {
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.research_backups"),
    ).rejects.toThrow(/permission denied/);
  });
  it("assigns the first revision server-side and permits the owner to read", async () => {
    await asUser(a);
    const saved = await db.query<{ revision: number }>(
      "insert into public.research_backups(user_id,document,revision) values ($1,$2,99) returning revision",
      [a, JSON.stringify(initial())],
    );
    expect(saved.rows[0].revision).toBe(1);
    expect(
      (await db.query("select * from public.research_backups")).rows,
    ).toHaveLength(1);
  });
  it("hides another account’s data and prevents writes/deletes on its row", async () => {
    await asUser(b);
    expect(
      (await db.query("select * from public.research_backups")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.research_backups set document=$1 where user_id=$2 returning user_id",
          [JSON.stringify(initial()), a],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.research_backups where user_id=$1 returning user_id",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.research_backups(user_id,document) values ($1,$2)",
        [c, JSON.stringify(initial())],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects missing and unsupported schema versions", async () => {
    await asUser(b);
    for (const document of [{}, { schemaVersion: 2 }])
      await expect(
        db.query(
          "insert into public.research_backups(user_id,document) values ($1,$2)",
          [b, JSON.stringify(document)],
        ),
      ).rejects.toThrow(/backup_object/);
  });
  it("increments revisions and rejects a stale compare-and-swap update", async () => {
    await asUser(a);
    const changed = await db.query<{ revision: number }>(
      "update public.research_backups set document=$1 where user_id=$2 and revision=1 returning revision",
      [JSON.stringify(initial()), a],
    );
    expect(changed.rows[0].revision).toBe(2);
    const stale = await db.query(
      "update public.research_backups set document=$1 where user_id=$2 and revision=1 returning revision",
      [JSON.stringify(initial()), a],
    );
    expect(stale.rows).toHaveLength(0);
  });
  it("deletes the backup when the Auth account is deleted", async () => {
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [a]);
    await asUser(a);
    expect(
      (await db.query("select * from public.research_backups")).rows,
    ).toHaveLength(0);
  });
});
