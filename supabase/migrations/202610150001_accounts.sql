-- Run once in the Supabase SQL editor, or use `supabase db push`.
-- Auth accounts are managed by Supabase Auth; passwords never enter this table.
begin;
create table public.research_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint backup_object check (jsonb_typeof(document) = 'object' and document @> '{"schemaVersion":1}'::jsonb),
 constraint backup_size check (octet_length(document::text) <= 20971520)
);
alter table public.research_backups enable row level security;
revoke all on table public.research_backups from anon;
grant select, insert, update, delete on table public.research_backups to authenticated;
create policy "Owner manages own backup" on public.research_backups
 for all to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create function public.stamp_research_backup() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.updated_at := now();
 if TG_OP = 'INSERT' then new.revision := 1;
 else new.revision := old.revision + 1; end if;
 return new;
end;
$$;
create trigger stamp_research_backup before insert or update on public.research_backups
 for each row execute function public.stamp_research_backup();
commit;
