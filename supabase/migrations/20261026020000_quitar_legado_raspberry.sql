-- Quita el esquema del nodo Raspberry Pi (nodo_01B): lecturas por sensor, visión por cámara,
-- eventos/alertas antiguos y las funciones RPC que los leían. El MVP usa solo
-- sensor_readings, risk_events y nodos_heltec_dashboard.

begin;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_historial_nodo',
        'get_alertas_activas',
        'get_eventos_recientes',
        'nodo_en_linea',
        'get_resumen_global',
        'get_ultimas_lecturas_nodo',
        'get_nodos_dashboard',
        'get_nodo_detalle'
      )
  loop
    execute format('drop function %s', f.firma);
  end loop;
end $$;

drop table if exists public.vision_ai;
drop table if exists public.lecturas_sensores;
drop table if exists public.sensores;
drop table if exists public.tipos_sensores;
drop table if exists public.eventos;
drop table if exists public.alertas;

commit;
