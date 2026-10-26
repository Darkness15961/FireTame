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

export function hasTiltData(t: Pick<HeltecTelemetry, 'pitchDeg' | 'rollDeg'>): boolean {
  return t.pitchDeg != null || t.rollDeg != null
}
