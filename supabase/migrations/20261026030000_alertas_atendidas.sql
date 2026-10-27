-- Guarda cuándo se atendió cada alerta. Sin esto "Atender" solo vivía en memoria
-- y al recargar todas las alertas históricas volvían a contar como activas.

begin;

alter table public.risk_events
  add column if not exists atendida_at timestamptz;

create index if not exists risk_events_pendientes_idx
  on public.risk_events (created_at desc)
  where atendida_at is null;

-- El dashboard (anon) solo puede marcar o desmarcar la alerta, no tocar su contenido.
revoke update on public.risk_events from anon, authenticated;
grant update (atendida_at) on public.risk_events to anon, authenticated;

drop policy if exists anon_atender_risk_events on public.risk_events;
create policy anon_atender_risk_events on public.risk_events
  for update to anon, authenticated
  using (true)
  with check (true);

commit;
