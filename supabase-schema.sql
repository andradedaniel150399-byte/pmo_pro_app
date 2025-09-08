-- SQL para criar tabelas e views utilizadas pela aplicação PMO Pro

-- Tabela de projetos sincronizados do Pipefy
create table if not exists projects (
  id bigserial primary key,
  external_id text unique not null,
  name text not null,
  status text,
  owner_email text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de profissionais
create table if not exists professionals (
  id bigserial primary key,
  name text not null,
  email text unique,
  role text,
  created_at timestamptz default now()
);

-- Tabela de alocações de profissionais em projetos
create table if not exists allocations (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  professional_id bigint not null references professionals(id) on delete cascade,
  hours numeric,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- View de alocações com nomes de projeto e profissional
create or replace view allocations_view as
select
  a.id,
  a.project_id,
  p.name as project_name,
  a.professional_id,
  pr.name as professional_name,
  a.hours,
  a.start_date,
  a.end_date,
  a.created_at
from allocations a
  left join projects p on p.id = a.project_id
  left join professionals pr on pr.id = a.professional_id;
