-- Semilla de los 3 nodos TTN (app heltec-v3-peru).
-- Se conserva la tabla existente `nodos` (id text).

update public.nodos
set deveui = upper(replace(deveui, '-', ''))
where deveui is not null;

insert into public.nodos (id, nombre, ttn_device_id, deveui, estado, status)
values
  ('heltec-wifi-lora-32-v3', 'Nodo 3', 'heltec-wifi-lora-32-v3', '70B3D57ED0079581', 1, 'active'),
  ('heltec-nodo-2',          'Nodo 2', 'heltec-nodo-2',          '70B3D57ED0079582', 1, 'active'),
  ('heltec-nodo-3',          'heltec-nodo-3', 'heltec-nodo-3',    '70B3D57ED0079584', 1, 'active')
on conflict (id) do update
set
  nombre = excluded.nombre,
  ttn_device_id = excluded.ttn_device_id,
  deveui = excluded.deveui,
  estado = excluded.estado,
  status = excluded.status;
