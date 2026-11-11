-- Run once in the Fashion Flow project's SQL Editor. Additive; no legacy data is changed.
begin;
create table if not exists public.fashion_sync_events (
 seq bigint generated always as identity primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 collection text not null check (collection in ('candidates','collection','products')),
 item_id text not null check (length(item_id) between 1 and 100),
 payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) < 500000),
 deleted boolean not null default false,
 mutation_id uuid not null,
 created_at timestamptz not null default now(),
 unique(user_id,mutation_id)
);
create index if not exists fashion_sync_owner_cursor on public.fashion_sync_events(user_id,seq);
create index if not exists fashion_sync_item_latest on public.fashion_sync_events(user_id,collection,item_id,seq desc);
alter table public.fashion_sync_events enable row level security;
revoke all on public.fashion_sync_events from anon,authenticated;
grant select,insert on public.fashion_sync_events to authenticated;
grant usage on sequence public.fashion_sync_events_seq_seq to authenticated;
drop policy if exists fashion_sync_read_own on public.fashion_sync_events;
create policy fashion_sync_read_own on public.fashion_sync_events for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists fashion_sync_insert_own on public.fashion_sync_events;
create policy fashion_sync_insert_own on public.fashion_sync_events for insert to authenticated with check ((select auth.uid())=user_id);
create or replace function public.fashion_sync_push(changes jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); change jsonb; latest public.fashion_sync_events; saved public.fashion_sync_events; results jsonb:='[]'::jsonb;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)>20 then raise exception 'Invalid batch'; end if;
 -- Serialize all writes for this owner, including sequence allocation, so a pull cursor
 -- cannot skip an event committed after a higher sequence from the same owner.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text,0));
 for change in select value from jsonb_array_elements(changes) loop
  select * into saved from public.fashion_sync_events where user_id=owner and mutation_id=(change->>'mutation_id')::uuid;
  if found then results:=results||jsonb_build_array(jsonb_build_object('status','ok','mutation_id',saved.mutation_id,'seq',saved.seq));continue;end if;
  select * into latest from public.fashion_sync_events where user_id=owner and collection=change->>'collection' and item_id=change->>'item_id' order by seq desc limit 1;
  if coalesce(latest.seq,0)<>coalesce((change->>'base_seq')::bigint,0) then
   results:=results||jsonb_build_array(jsonb_build_object('status','conflict','mutation_id',change->>'mutation_id','event',to_jsonb(latest)));continue;
  end if;
  insert into public.fashion_sync_events(user_id,collection,item_id,payload,deleted,mutation_id)
   values(owner,change->>'collection',change->>'item_id',coalesce(change->'payload','{}'::jsonb),coalesce((change->>'deleted')::boolean,false),(change->>'mutation_id')::uuid) returning * into saved;
  results:=results||jsonb_build_array(jsonb_build_object('status','ok','mutation_id',saved.mutation_id,'seq',saved.seq));
 end loop;
 return results;
end $$;
revoke all on function public.fashion_sync_push(jsonb) from public,anon;
grant execute on function public.fashion_sync_push(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
