-- FireTame MVP Heltec LoRaWAN (schema_version 1)
-- Conserva `nodos`. Añade lecturas anchas + eventos de riesgo.

alter table public.nodos
  add column if not exists ttn_device_id text,
  add column if not exists deveui text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists status text default 'active';

create unique index if not exists nodos_ttn_device_id_uidx
  on public.nodos (ttn_device_id)
  where ttn_device_id is not null;

create unique index if not exists nodos_deveui_uidx
  on public.nodos (deveui)
  where deveui is not null;

update public.nodos
set
  lat = nullif(split_part(ubicacion, ',', 1), '')::double precision,
  lng = nullif(split_part(ubicacion, ',', 2), '')::double precision
where ubicacion is not null
  and ubicacion like '%,%'
  and lat is null;

create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  node_id text not null references public.nodos (id) on delete cascade,
  received_at timestamptz not null default now(),
  temp_dht_c real,
  humidity_pct real,
  mq135_adc integer,
  temp_bmp_c real,
  pressure_hpa real,
  pitch_deg real,
  roll_deg real,
  rssi integer,
  snr real,
  gateway_id text,
  f_port smallint default 2,
  schema_version smallint default 1,
  raw_payload jsonb
);

create index if not exists sensor_readings_node_received_idx
  on public.sensor_readings (node_id, received_at desc);

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  node_id text not null references public.nodos (id) on delete cascade,
  level text not null check (level in ('low', 'medium', 'high', 'critical')),
  score smallint not null,
  reason jsonb,
  reading_id uuid references public.sensor_readings (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists risk_events_node_created_idx
  on public.risk_events (node_id, created_at desc);

alter table public.sensor_readings enable row level security;
alter table public.risk_events enable row level security;

drop policy if exists "anon_read_sensor_readings" on public.sensor_readings;
create policy "anon_read_sensor_readings"
  on public.sensor_readings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_read_risk_events" on public.risk_events;
create policy "anon_read_risk_events"
  on public.risk_events
  for select
  to anon, authenticated
  using (true);

grant select on public.sensor_readings to anon, authenticated;
grant select on public.risk_events to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.sensor_readings;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.risk_events;
exception
  when duplicate_object then null;
end $$;

create or replace view public.nodos_heltec_dashboard as
select
  n.id as nodo_id,
  n.nombre,
  n.ubicacion,
  n.descripcion,
  n.estado,
  n.status,
  n.ttn_device_id,
  n.deveui,
  coalesce(
    n.lat,
    case
      when split_part(n.ubicacion, ',', 1) ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then trim(split_part(n.ubicacion, ',', 1))::double precision
    end
  ) as lat,
  coalesce(
    n.lng,
    case
      when split_part(n.ubicacion, ',', 2) ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
      then trim(split_part(n.ubicacion, ',', 2))::double precision
    end
  ) as lng,
  n.ultima_conexion,
  r.received_at as ultima_lectura_at,
  r.temp_dht_c,
  r.humidity_pct,
  r.mq135_adc,
  r.temp_bmp_c,
  r.pressure_hpa,
  r.pitch_deg,
  r.roll_deg,
  r.rssi,
  r.snr,
  ev.level as risk_level,
  ev.score as risk_score
from public.nodos n
left join lateral (
  select *
  from public.sensor_readings sr
  where sr.node_id = n.id
  order by sr.received_at desc
  limit 1
) r on true
left join lateral (
  select *
  from public.risk_events re
  where re.node_id = n.id
  order by re.created_at desc
  limit 1
) ev on true;

grant select on public.nodos_heltec_dashboard to anon, authenticated;
