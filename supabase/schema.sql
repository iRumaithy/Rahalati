-- RAHALATI v3.0.0 — database schema
-- Re-runnable setup for the current Supabase project.

create table if not exists public.rahalati_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('owner','user')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rahalati_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  country text not null default '',
  city text not null default '',
  start_date date,
  end_date date,
  travelers integer not null default 1 check (travelers > 0),
  budget numeric(14,2) not null default 0 check (budget >= 0),
  currency text not null default 'AED',
  cover_url text,
  status text not null default 'planned' check (status in ('idea','planned','active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);

create table if not exists public.rahalati_trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('activity','place','booking','expense','packing','document','note')),
  title text not null,
  item_date date,
  item_time time,
  amount numeric(14,2),
  currency text,
  completed boolean not null default false,
  sort_order integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rahalati_trip_items_trip_owner_fk foreign key (trip_id,user_id)
    references public.rahalati_trips(id,user_id) on delete cascade
);

create table if not exists public.rahalati_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  channel text not null check (channel in ('candidate','stable')),
  status text not null check (status in ('testing','approved','published','rejected')),
  notes text not null default '',
  build_path text not null default '',
  tested_at timestamptz,
  tested_by uuid references auth.users(id),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rahalati_user_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  installed_version text not null default '0.0.0',
  deferred_version text,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rahalati_profiles enable row level security;
alter table public.rahalati_trips enable row level security;
alter table public.rahalati_trip_items enable row level security;
alter table public.rahalati_releases enable row level security;
alter table public.rahalati_user_versions enable row level security;

revoke all on public.rahalati_profiles,public.rahalati_trips,public.rahalati_trip_items,public.rahalati_releases,public.rahalati_user_versions from anon;
revoke all on public.rahalati_profiles,public.rahalati_trips,public.rahalati_trip_items,public.rahalati_releases,public.rahalati_user_versions from authenticated;
grant select on public.rahalati_profiles to authenticated;
grant select,insert,update,delete on public.rahalati_trips to authenticated;
grant select,insert,update,delete on public.rahalati_trip_items to authenticated;
grant select on public.rahalati_releases to authenticated;
grant select,insert,update on public.rahalati_user_versions to authenticated;

drop policy if exists rahalati_profiles_self_select on public.rahalati_profiles;
create policy rahalati_profiles_self_select on public.rahalati_profiles for select to authenticated
using ((select auth.uid())=id);

-- Trip and item access requires both ownership and an active Rahalati profile.
drop policy if exists rahalati_trips_select_own on public.rahalati_trips;
create policy rahalati_trips_select_own on public.rahalati_trips for select to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_trips_insert_own on public.rahalati_trips;
create policy rahalati_trips_insert_own on public.rahalati_trips for insert to authenticated
with check ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_trips_update_own on public.rahalati_trips;
create policy rahalati_trips_update_own on public.rahalati_trips for update to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'))
with check ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_trips_delete_own on public.rahalati_trips;
create policy rahalati_trips_delete_own on public.rahalati_trips for delete to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));

drop policy if exists rahalati_items_select_own on public.rahalati_trip_items;
create policy rahalati_items_select_own on public.rahalati_trip_items for select to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_items_insert_own on public.rahalati_trip_items;
create policy rahalati_items_insert_own on public.rahalati_trip_items for insert to authenticated
with check ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_items_update_own on public.rahalati_trip_items;
create policy rahalati_items_update_own on public.rahalati_trip_items for update to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'))
with check ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));
drop policy if exists rahalati_items_delete_own on public.rahalati_trip_items;
create policy rahalati_items_delete_own on public.rahalati_trip_items for delete to authenticated
using ((select auth.uid())=user_id and exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.status='active'));

-- Users see only published stable versions. Owner additionally sees candidate versions.
drop policy if exists rahalati_releases_visible on public.rahalati_releases;
create policy rahalati_releases_visible on public.rahalati_releases for select to authenticated
using ((channel='stable' and status='published') or exists(select 1 from public.rahalati_profiles p where p.id=(select auth.uid()) and p.role='owner' and p.status='active'));

drop policy if exists rahalati_versions_select_own on public.rahalati_user_versions;
create policy rahalati_versions_select_own on public.rahalati_user_versions for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists rahalati_versions_insert_own on public.rahalati_user_versions;
create policy rahalati_versions_insert_own on public.rahalati_user_versions for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists rahalati_versions_update_own on public.rahalati_user_versions;
create policy rahalati_versions_update_own on public.rahalati_user_versions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Reuse the existing owner identity from Ejazati when both apps share this project.
insert into public.rahalati_profiles(id,username,email,display_name,role,status)
select id,username,email,coalesce(display_name,username,'Owner'),'owner','active'
from public.ejazati_profiles where role='owner'
on conflict(id) do update set username=excluded.username,email=excluded.email,display_name=excluded.display_name,role='owner',status='active',updated_at=now();

insert into public.rahalati_releases(version,channel,status,notes,build_path,published_at)
values('3.0.0','stable','published','الإصدار الأساسي المرتبط بنظام الحسابات والرحلات.','/',now())
on conflict(version) do nothing;
