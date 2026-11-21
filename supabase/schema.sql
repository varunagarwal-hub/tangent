-- Tangent schema. Run once in the Supabase SQL editor.
-- Server uses the service-role key only (no auth); RLS is enabled with no policies,
-- so the anon key can read nothing and the service role bypasses RLS.
-- Safe to re-run: drops and recreates everything.

create extension if not exists "pgcrypto";

drop table if exists agent_runs, assignments, fewshot_examples, feedback, review_cards,
  misconception_events, mastery, attempts, classes, students, questions, misconceptions, concepts cascade;

create table concepts (
  id text primary key,
  name text not null,
  area text not null,
  prerequisites text[] not null default '{}',
  target_time_sec int not null default 120,
  weight int not null default 2
);

create table misconceptions (
  id text primary key,
  concept_id text not null references concepts(id),
  name text not null,
  description text not null,
  wrong_reasoning_example text,
  telltale_signs text[] not null default '{}',
  contrast_question_idea text
);
create index on misconceptions (concept_id);

create table questions (
  id uuid primary key default gen_random_uuid(),
  concept_id text not null references concepts(id),
  type text not null check (type in ('MCQ', 'TITA')),
  stem text not null,
  options jsonb,
  answer text not null,
  solution text not null,
  difficulty_elo float not null default 1200,
  attempts_count int not null default 0,
  source text not null default 'bank' check (source in ('bank', 'generated')),
  verified boolean not null default false,
  targets_misconception_id text references misconceptions(id),
  distractor_misconceptions jsonb,
  flag_count int not null default 0,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);
create index on questions (concept_id, status, difficulty_elo);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid
);

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'student' check (role in ('student', 'teacher')),
  class_id uuid references classes(id),
  target_percentile int,
  exam_date date,
  daily_minutes int default 60,
  persona jsonb,
  is_synthetic boolean not null default false,
  streak_days int not null default 0,
  created_at timestamptz not null default now()
);
create index on students (class_id);

alter table classes add constraint classes_teacher_fk foreign key (teacher_id) references students(id) on delete set null;

create table attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  concept_id text not null references concepts(id),
  answer text,
  is_correct boolean not null,
  time_sec int,
  confidence int check (confidence between 1 and 3),
  work_text text,
  work_image_url text,
  transcription text,
  reasoning_verdict text not null default 'unknown' check (reasoning_verdict in ('sound', 'flawed', 'unknown')),
  misconception_id text,
  error_line text,
  diagnosis jsonb,
  agent_trace jsonb,
  mode text not null default 'practice' check (mode in ('diagnostic', 'practice', 'review', 'contrast')),
  created_at timestamptz not null default now()
);
create index on attempts (student_id, created_at desc);
create index on attempts (concept_id);
create index on attempts (misconception_id);

create table mastery (
  student_id uuid not null references students(id) on delete cascade,
  concept_id text not null references concepts(id),
  p_mastery float not null default 0.3,
  elo float not null default 1200,
  avg_time_ratio float not null default 1,
  calibration float not null default 0,
  attempts int not null default 0,
  last_seen timestamptz,
  history jsonb not null default '[]', -- [{t, p}] for mastery-over-time charts
  primary key (student_id, concept_id)
);

create table misconception_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  misconception_id text not null references misconceptions(id),
  status text not null default 'detected' check (status in ('detected', 'fixing', 'resolved')),
  evidence_count int not null default 1,
  clean_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, misconception_id)
);

create table review_cards (
  student_id uuid not null references students(id) on delete cascade,
  item_type text not null check (item_type in ('concept', 'misconception')),
  item_id text not null,
  fsrs_state jsonb not null,
  due_at timestamptz not null,
  primary key (student_id, item_type, item_id)
);
create index on review_cards (student_id, due_at);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references attempts(id) on delete cascade,
  by_role text not null check (by_role in ('student', 'teacher')),
  kind text not null check (kind in ('disagree_diagnosis', 'bad_question', 'teacher_relabel')),
  note text,
  corrected_misconception_id text,
  created_at timestamptz not null default now()
);

create table fewshot_examples (
  id uuid primary key default gen_random_uuid(),
  misconception_id text not null references misconceptions(id),
  work_text text not null,
  source text not null default 'seed' check (source in ('teacher', 'seed')),
  created_at timestamptz not null default now()
);
create index on fewshot_examples (misconception_id, source);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  concept_id text not null references concepts(id),
  question_ids uuid[] not null default '{}',
  baseline_mastery float,
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  student_id uuid,
  input_summary text,
  output jsonb,
  latency_ms int,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);
create index on agent_runs (created_at desc);
create index on agent_runs (agent);

-- Lock everything down: service role bypasses RLS; anon/auth get nothing.
do $$
declare t text;
begin
  foreach t in array array['concepts','misconceptions','questions','classes','students','attempts','mastery',
    'misconception_events','review_cards','feedback','fewshot_examples','assignments','agent_runs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Storage bucket for rough-work photos (public read, 4MB max).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rough-work', 'rough-work', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 4194304;
