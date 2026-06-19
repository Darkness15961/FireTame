import { supabase } from '@/supabase'
import type { Mpu6050Readings } from '@/constants/sensors'

export interface NodeLatestReadings {
  temperatura: number | null
  humedad: number | null
  co2: number | null
  pm25: number | null
  mpu: Mpu6050Readings
}

export async function fetchLatestReadings(nodoId: string): Promise<NodeLatestReadings> {
  const { data, error } = await supabase.rpc('get_ultimas_lecturas_nodo', {
    p_nodo_id: nodoId,
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return {
      temperatura: null,
      humedad: null,
      co2: null,
      pm25: null,
      mpu: { accX: null, accY: null, accZ: null, gyroX: null, gyroY: null, gyroZ: null },
    }
  }

  return {
    temperatura: row.temperatura ?? null,
    humedad: row.humedad ?? null,
    co2: row.co2 ?? null,
    pm25: row.pm25 ?? null,
    mpu: {
      accX: row.acc_x ?? null,
      accY: row.acc_y ?? null,
      accZ: row.acc_z ?? null,
      gyroX: row.gyro_x ?? null,
      gyroY: row.gyro_y ?? null,
      gyroZ: row.gyro_z ?? null,
    },
  }
}

export async function fetchNodeHistory(nodoId: string, limit = 20) {
  const { data, error } = await supabase.rpc('get_historial_nodo', {
    p_nodo_id: nodoId,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as Array<{
    created_at: string
    temperatura: number | null
    humedad: number | null
    co2: number | null
    pm25: number | null
  }>
}
