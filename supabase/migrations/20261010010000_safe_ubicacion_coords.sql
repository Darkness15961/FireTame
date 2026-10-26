-- ubicacion a veces es texto ("Laboratorio / Cerro piloto"), no "lat,lng".
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
