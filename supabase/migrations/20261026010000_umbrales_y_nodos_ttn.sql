-- Umbrales de alerta configurables desde el dashboard.
-- Quita los nodos de demostración y deja en el dashboard solo los nodos registrados en TTN.

create table if not exists public.umbrales_alerta (
  id smallint primary key default 1 check (id = 1),
  temp_observacion_c real not null default 35,
  temp_critica_c real not null default 40,
  humedad_observacion_pct real not null default 30,
  humedad_critica_pct real not null default 20,
  mq135_baseline_defecto integer not null default 1500,
  mq135_delta_observacion integer not null default 400,
  mq135_delta_critico integer not null default 900,
  inclinacion_activa boolean not null default true,
  inclinacion_deg real not null default 45,
  score_minimo_alerta smallint not null default 25 check (score_minimo_alerta between 1 and 100),
  updated_at timestamptz not null default now()
);

insert into public.umbrales_alerta (id) values (1) on conflict (id) do nothing;

alter table public.umbrales_alerta enable row level security;

drop policy if exists "anon_read_umbrales_alerta" on public.umbrales_alerta;
create policy "anon_read_umbrales_alerta"
  on public.umbrales_alerta
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_update_umbrales_alerta" on public.umbrales_alerta;
create policy "anon_update_umbrales_alerta"
  on public.umbrales_alerta
  for update
  to anon, authenticated
  using (id = 1)
  with check (id = 1);

grant select, update on public.umbrales_alerta to anon, authenticated;

-- Nodos de demostración sin lecturas ni eventos.
delete from public.nodos n
where n.id in ('CH-08', 'CL-07', 'CQ-05', 'MP-01', 'OT-03', 'PS-04', 'SH-02')
  and not exists (select 1 from public.sensor_readings s where s.node_id = n.id)
  and not exists (select 1 from public.risk_events r where r.node_id = n.id);

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
) ev on true
where n.ttn_device_id is not null;

grant select on public.nodos_heltec_dashboard to anon, authenticated;
