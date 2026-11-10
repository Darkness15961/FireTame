-- La bitácora pide los uplinks más recientes con order by received_at.
-- El índice por nodo no cubre ese orden cuando se listan todos los nodos.

create index if not exists sensor_readings_received_idx
  on public.sensor_readings (received_at desc);

create index if not exists risk_events_reading_idx
  on public.risk_events (reading_id);
