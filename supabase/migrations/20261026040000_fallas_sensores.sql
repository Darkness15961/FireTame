-- Sensores en falla detectados por ttn-uplink en cada uplink: 'dht', 'humedad', 'mq135', 'bmp', 'mpu'.
-- NULL = lectura anterior a la validación (no evaluada). '{}' = todos los sensores respondieron.

alter table public.sensor_readings
  add column if not exists fallas text[];

comment on column public.sensor_readings.fallas is
  'Sensores en falla según ttn-uplink (dht, humedad, mq135, bmp, mpu). NULL = no evaluada.';
