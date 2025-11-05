-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'premium')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text check (subscription_status in ('active', 'canceled', 'past_due', 'trialing', 'unpaid')),
  subscription_period_end timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Resumes table
create table public.resumes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  content text not null,
  sections jsonb default '{}'::jsonb,
  file_url text, -- S3/Storage URL for original file
  is_active boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Applications table
create table public.applications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  resume_id uuid references public.resumes(id) on delete cascade not null,
  job_title text not null,
  company text,
  job_url text not null,
  job_description text,
  job_source text check (job_source in ('indeed', 'linkedin', 'glassdoor', 'other')),
  ats_score integer check (ats_score >= 0 and ats_score <= 100),
  status text not null default 'applied' check (status in ('applied', 'interviewing', 'rejected', 'offer')),
  notes text,
  callback_received boolean default false,
  callback_at timestamptz,
  applied_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- AI Usage tracking table
create table public.ai_usage (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('match', 'ai_suggestion', 'ai_call')),
  month date not null, -- first day of month
  count integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, type, month)
);

-- Indexes for performance
create index resumes_user_id_idx on public.resumes(user_id);
create index resumes_is_active_idx on public.resumes(is_active);
create index applications_user_id_idx on public.applications(user_id);
create index applications_status_idx on public.applications(status);
create index applications_applied_at_idx on public.applications(applied_at desc);
create index ai_usage_user_month_idx on public.ai_usage(user_id, month);

-- Updated_at triggers
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger resumes_updated_at before update on public.resumes
  for each row execute function public.handle_updated_at();

create trigger applications_updated_at before update on public.applications
  for each row execute function public.handle_updated_at();

create trigger ai_usage_updated_at before update on public.ai_usage
  for each row execute function public.handle_updated_at();

-- Function to get or create usage record
create or replace function public.get_or_create_usage(
  p_user_id uuid,
  p_type text
)
returns public.ai_usage
language plpgsql
security definer
as $$
declare
  v_month date;
  v_usage public.ai_usage;
begin
  v_month := date_trunc('month', now())::date;

  insert into public.ai_usage (user_id, type, month, count)
  values (p_user_id, p_type, v_month, 0)
  on conflict (user_id, type, month)
  do nothing;

  select * into v_usage
  from public.ai_usage
  where user_id = p_user_id
    and type = p_type
    and month = v_month;

  return v_usage;
end;
$$;

-- Function to increment usage
create or replace function public.increment_usage(
  p_user_id uuid,
  p_type text,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_month date;
begin
  v_month := date_trunc('month', now())::date;

  insert into public.ai_usage (user_id, type, month, count)
  values (p_user_id, p_type, v_month, p_amount)
  on conflict (user_id, type, month)
  do update set
    count = public.ai_usage.count + p_amount,
    updated_at = now();

  return true;
end;
$$;

-- Function to check quota
create or replace function public.check_quota(
  p_user_id uuid,
  p_type text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_month date;
  v_usage public.ai_usage;
  v_profile public.profiles;
  v_limit integer;
  v_count integer;
begin
  v_month := date_trunc('month', now())::date;

  -- Get user profile
  select * into v_profile
  from public.profiles
  where id = p_user_id;

  -- Get current usage
  select * into v_usage
  from public.ai_usage
  where user_id = p_user_id
    and type = p_type
    and month = v_month;

  v_count := coalesce(v_usage.count, 0);

  -- Determine limit based on plan and type
  case v_profile.plan
    when 'free' then
      case p_type
        when 'match' then v_limit := 20;
        when 'ai_suggestion' then v_limit := 5;
        when 'ai_call' then v_limit := 0;
        else v_limit := 0;
      end case;
    when 'pro' then
      case p_type
        when 'match' then v_limit := 100;
        when 'ai_suggestion' then v_limit := 50;
        when 'ai_call' then v_limit := 50;
        else v_limit := 0;
      end case;
    when 'premium' then
      case p_type
        when 'match' then v_limit := 300;
        when 'ai_suggestion' then v_limit := 200;
        when 'ai_call' then v_limit := 200;
        else v_limit := 0;
      end case;
    else
      v_limit := 0;
  end case;

  return jsonb_build_object(
    'allowed', v_count < v_limit,
    'current', v_count,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_count, 0)
  );
end;
$$;
