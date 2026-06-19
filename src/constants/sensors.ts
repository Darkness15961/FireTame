/** IDs de tipos_sensores usados por el firmware y la BD */
export const SENSOR_TYPES = {
  TEMPERATURA: 1,
  HUMEDAD: 2,
  CO2: 3,
  PM25: 4,
  HUMO_AI: 7,
  ACELEROMETRO_X: 8,
  ACELEROMETRO_Y: 9,
  ACELEROMETRO_Z: 10,
  GIROSCOPIO_X: 11,
  GIROSCOPIO_Y: 12,
  GIROSCOPIO_Z: 13,
} as const

export type SensorTypeId = (typeof SENSOR_TYPES)[keyof typeof SENSOR_TYPES]

export interface Mpu6050Readings {
  accX: number | null
  accY: number | null
  accZ: number | null
  gyroX: number | null
  gyroY: number | null
  gyroZ: number | null
}

export const EMPTY_MPU: Mpu6050Readings = {
  accX: null,
  accY: null,
  accZ: null,
  gyroX: null,
  gyroY: null,
  gyroZ: null,
}

export function parseMpuFromRow(row: {
  acc_x?: number | null
  acc_y?: number | null
  acc_z?: number | null
  gyro_x?: number | null
  gyro_y?: number | null
  gyro_z?: number | null
}): Mpu6050Readings {
  return {
    accX: row.acc_x ?? null,
    accY: row.acc_y ?? null,
    accZ: row.acc_z ?? null,
    gyroX: row.gyro_x ?? null,
    gyroY: row.gyro_y ?? null,
    gyroZ: row.gyro_z ?? null,
  }
}

export function hasMpuData(mpu: Mpu6050Readings): boolean {
  return [mpu.accX, mpu.accY, mpu.accZ, mpu.gyroX, mpu.gyroY, mpu.gyroZ].some((v) => v != null)
}
