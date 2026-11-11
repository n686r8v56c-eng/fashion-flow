-- Run once in the Supabase project used by Fashion Flow.
create table if not exists public.fashion_color_palettes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 category text not null,
 colors jsonb not null check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) between 2 and 6),
 updated_at timestamptz not null default now()
);
create index if not exists fashion_color_palettes_owner_updated_idx on public.fashion_color_palettes(user_id, updated_at desc);
alter table public.fashion_color_palettes enable row level security;
grant select, insert, update, delete on public.fashion_color_palettes to authenticated;
create policy "fashion_color_palettes_select" on public.fashion_color_palettes for select to authenticated using ((select auth.uid()) = user_id);
create policy "fashion_color_palettes_insert" on public.fashion_color_palettes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fashion_color_palettes_update" on public.fashion_color_palettes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fashion_color_palettes_delete" on public.fashion_color_palettes for delete to authenticated using ((select auth.uid()) = user_id);
