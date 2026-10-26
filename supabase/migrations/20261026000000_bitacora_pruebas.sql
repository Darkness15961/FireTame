-- Bitácora de pruebas de campo.
-- El consumo eléctrico (voltaje, corrientes, energía) queda fuera de esta migración.

alter table public.sensor_readings
  add column if not exists crc_status text,
  add column if not exists f_cnt integer,
  add column if not exists node_rssi real,
  add column if not exists node_snr real,
  add column if not exists node_sent_at timestamptz,
  add column if not exists gateway_received_at timestamptz,
  add column if not exists db_received_at timestamptz,
  add column if not exists airtime_s double precision,
  add column if not exists datarate text;

alter table public.sensor_readings
  alter column db_received_at set default now();

create index if not exists sensor_readings_node_fcnt_idx
  on public.sensor_readings (node_id, f_cnt);

create table if not exists public.condiciones_prueba (
  id uuid primary key default gen_random_uuid(),
  n integer not null,
  node_id text not null references public.nodos (id) on delete cascade,
  distancia_m real,
  obstaculos text,
  altura_m real,
  clima text,
  situacion_real text,
  activa boolean not null default true,
  iniciada_at timestamptz not null default now(),
  cerrada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists condiciones_prueba_nodo_inicio_idx
  on public.condiciones_prueba (node_id, iniciada_at desc);

create unique index if not exists condiciones_prueba_una_activa_por_nodo
  on public.condiciones_prueba (node_id)
  where activa;

create table if not exists public.health_checks (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  ok boolean not null,
  latency_ms integer,
  origen text not null default 'dashboard'
);

create index if not exists health_checks_checked_idx
  on public.health_checks (checked_at desc);

create or replace view public.bitacora_pruebas as
select
  sr.id as reading_id,
  sr.node_id,
  n.nombre as nodo_nombre,
  n.deveui as nodo_mac,
  cp.n,
  cp.distancia_m,
  cp.obstaculos,
  cp.altura_m,
  cp.clima,
  sr.rssi,
  sr.snr,
  sr.node_rssi,
  sr.node_snr,
  sr.crc_status,
  sr.f_cnt,
  pdr.pdr_recibidos,
  pdr.pdr_esperados,
  pdr.pdr_pct,
  (
    select round(
      100.0 * (count(*) filter (where h.ok))::numeric / nullif(count(*), 0),
      1
    )
    from public.health_checks h
    where h.checked_at > now() - interval '24 hours'
  ) as disponibilidad_pct,
  sr.node_sent_at,
  sr.gateway_received_at,
  sr.received_at,
  sr.db_received_at,
  sr.airtime_s,
  case
    when sr.node_sent_at is not null and sr.gateway_received_at is not null
      then extract(epoch from (sr.gateway_received_at - sr.node_sent_at))
    else sr.airtime_s
  end as tiempo_subida_s,
  case
    when sr.gateway_received_at is not null
      then extract(epoch from (sr.received_at - sr.gateway_received_at))
  end as retraso_gateway_red_s,
  case
    when sr.db_received_at is not null
      then extract(epoch from (sr.db_received_at - sr.received_at))
  end as retraso_red_bd_s,
  re.created_at as hora_emision_alerta,
  sr.temp_dht_c,
  sr.humidity_pct,
  sr.mq135_adc,
  cp.situacion_real,
  (re.id is not null) as alerta_emitida,
  cp.id as condicion_id,
  sr.datarate
from public.sensor_readings sr
join public.nodos n on n.id = sr.node_id
left join lateral (
  select *
  from public.condiciones_prueba c
  where c.node_id = sr.node_id
    and sr.received_at >= c.iniciada_at
    and (c.cerrada_at is null or sr.received_at < c.cerrada_at)
  order by c.iniciada_at desc
  limit 1
) cp on true
left join lateral (
  select id, created_at
  from public.risk_events
  where reading_id = sr.id
  order by created_at asc
  limit 1
) re on true
left join lateral (
  select
    count(distinct sr2.f_cnt)::integer as pdr_recibidos,
    (max(sr2.f_cnt) - min(sr2.f_cnt) + 1)::integer as pdr_esperados,
    round(
      100.0 * count(distinct sr2.f_cnt)::numeric
      / nullif(max(sr2.f_cnt) - min(sr2.f_cnt) + 1, 0),
      1
    ) as pdr_pct
  from public.sensor_readings sr2
  where sr2.node_id = sr.node_id
    and sr2.f_cnt is not null
    and sr2.received_at >= coalesce(cp.iniciada_at, now() - interval '24 hours')
    and (cp.cerrada_at is null or sr2.received_at < cp.cerrada_at)
) pdr on true;

alter table public.condiciones_prueba enable row level security;
alter table public.health_checks enable row level security;

drop policy if exists "anon_rw_condiciones_prueba" on public.condiciones_prueba;
create policy "anon_rw_condiciones_prueba"
  on public.condiciones_prueba
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_read_health_checks" on public.health_checks;
create policy "anon_read_health_checks"
  on public.health_checks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_insert_health_checks" on public.health_checks;
create policy "anon_insert_health_checks"
  on public.health_checks
  for insert
  to anon, authenticated
  with check (true);

grant select, insert, update, delete on public.condiciones_prueba to anon, authenticated;
grant select, insert on public.health_checks to anon, authenticated;
grant select on public.bitacora_pruebas to anon, authenticated;
