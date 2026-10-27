export interface HeltecTelemetry {
  tempDht: number | null
  humidity: number | null
  mq135Adc: number | null
  tempBmp: number | null
  pressureHpa: number | null
  pitchDeg: number | null
  rollDeg: number | null
  rssi: number | null
  snr: number | null
}

export const EMPTY_TELEMETRY: HeltecTelemetry = {
  tempDht: null,
  humidity: null,
  mq135Adc: null,
  tempBmp: null,
  pressureHpa: null,
  pitchDeg: null,
  rollDeg: null,
  rssi: null,
  snr: null,
}

export const SENSOR_INFO = {
  tempDht:
    'Temperatura del aire medida por el DHT22 del nodo, en °C.\nEs la temperatura que usa el cálculo de riesgo. Llega en cada uplink, más o menos cada 60 s.',
  humidity:
    'Humedad relativa del aire medida por el DHT22, en %.\nUna humedad baja aumenta el riesgo de incendio. Si el DHT22 falla manda 0 %, y esa lectura no cuenta para el riesgo.',
  mq135:
    'Lectura cruda del conversor analógico (0 a 4095) del sensor de gases MQ135. Sube con humo y otros gases.\nNo está calibrado: no es ppm ni CO₂. El riesgo compara este valor con la línea base del nodo (promedio de sus primeras 10 lecturas).',
  tempBmp:
    'Temperatura medida por el BMP280 del módulo GY-91, en °C.\nEs una segunda referencia y puede diferir de la del DHT22 porque está en otro punto del nodo. No entra en el cálculo de riesgo.',
  pressure:
    'Presión atmosférica medida por el BMP280, en hPa. Baja con la altitud del lugar.\nNo entra en el cálculo de riesgo.',
  radio:
    'Señal con la que el gateway recibió el último paquete; la reporta TTN.\nRSSI en dBm: siempre negativo; más cerca de 0 es más fuerte.\nSNR en dB: cuánto supera la señal al ruido; positivo es una señal limpia.',
  connection:
    'En línea: llegó un uplink en los últimos 5 minutos.\nSin señal: el nodo está habilitado pero no envía hace más de 5 minutos.\nSin uplinks: nunca llegó un paquete de este nodo.\nDeshabilitado: se apagó a mano en Registro de Nodos.',
} as const

type LecturaSensores = Omit<HeltecTelemetry, 'rssi' | 'snr'>

/**
 * Quita los valores de sensores en falla (mismas reglas que detectarFallas() en ttn-uplink):
 * el firmware manda 0 cuando un sensor no responde y el MQ135 marca 0 o 4095 con el pin suelto.
 */
export function sinValoresEnFalla<T extends LecturaSensores>(r: T): T {
  const t = r.tempDht
  const h = r.humidity
  const dhtFalla = t == null || h == null || (t === 0 && h === 0) || t < -40 || t > 80
  const mq = r.mq135Adc
  const tb = r.tempBmp
  const p = r.pressureHpa
  const bmpFalla = tb == null || p == null || (tb === 0 && p === 0) || p < 300 || p > 1100 || tb < -40 || tb > 85
  const mpuFalla = r.pitchDeg == null || r.rollDeg == null || (r.pitchDeg === 0 && r.rollDeg === 0)
  return {
    ...r,
    tempDht: dhtFalla ? null : t,
    humidity: dhtFalla || h == null || h <= 0 || h > 100 ? null : h,
    mq135Adc: mq == null || mq <= 0 || mq >= 4095 ? null : mq,
    tempBmp: bmpFalla ? null : tb,
    pressureHpa: bmpFalla ? null : p,
    pitchDeg: mpuFalla ? null : r.pitchDeg,
    rollDeg: mpuFalla ? null : r.rollDeg,
  }
}

export function hasTiltData(t: Pick<HeltecTelemetry, 'pitchDeg' | 'rollDeg'>): boolean {
  return t.pitchDeg != null || t.rollDeg != null
}
