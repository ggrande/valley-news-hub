// Base schema we apply to a freshly provisioned tenant Supabase project.
// Kept minimal on purpose: enough to verify the SQL pipeline end-to-end
// without coupling tenant schema to wkna49.com's full master schema.
// Extend as the affiliate template's data needs evolve.

export const BASE_TENANT_BOOTSTRAP_SQL = `
-- Lovable-managed tenant bootstrap (idempotent).
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users read own profile') then
    create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Users update own profile') then
    create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- App roles
do $$ begin
  if not exists (select 1 from pg_type where typname='app_role') then
    create type public.app_role as enum ('admin','editor','user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Posts (lightweight starter schema for the affiliate news site)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  slug text unique not null,
  title text not null,
  body text,
  cover_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posts' and policyname='Public read published posts') then
    create policy "Public read published posts" on public.posts for select to anon using (published = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posts' and policyname='Authors manage their posts') then
    create policy "Authors manage their posts" on public.posts for all to authenticated
      using (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
      with check (author_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
  end if;
end $$;

-- Comments (lightweight starter schema)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  author_name text,
  author_email text,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.comments to anon;
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='Public read approved comments') then
    create policy "Public read approved comments" on public.comments for select to anon using (status = 'approved');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='Anyone can submit comments') then
    create policy "Anyone can submit comments" on public.comments for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='Admins manage comments') then
    create policy "Admins manage comments" on public.comments for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
  end if;
end $$;

-- Site settings (key/value for branding & toggles)
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='Public read settings') then
    create policy "Public read settings" on public.site_settings for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_settings' and policyname='Admins write settings') then
    create policy "Admins write settings" on public.site_settings for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
  end if;
end $$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_posts_updated_at') then
    create trigger trg_posts_updated_at before update on public.posts for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_updated_at') then
    create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_comments_updated_at') then
    create trigger trg_comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_site_settings_updated_at') then
    create trigger trg_site_settings_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
  end if;
end $$;


-- First user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare existing_admins int;
begin
  insert into public.profiles (id, email, display_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
    on conflict (id) do nothing;
  select count(*) into existing_admins from public.user_roles where role='admin';
  if existing_admins = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_tenant') then
    create trigger on_auth_user_created_tenant
      after insert on auth.users for each row execute function public.handle_new_user();
  end if;
end $$;
`;
