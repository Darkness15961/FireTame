export interface DbNodo {
  id: string
  nombre: string
  ubicacion: string | null
  descripcion: string | null
  estado: number
  ultima_conexion: string
}

export interface DbLecturaSensor {
  id: number
  nodo_id: string
  tipo_sensor_id: number
  valor: number
  unidad: string | null
  created_at: string
}

export interface DbVisionAi {
  id: number
  nodo_id: string
  deteccion: string | null
  confianza: number | null
  frame_url: string | null
  estado: number | null
  created_at: string
}

export interface DbAlerta {
  id: number
  nodo_id: string
  nivel: string | null
  mensaje: string | null
  estado: number | null
  confianza: number | null
  created_at: string
}

export interface DbEvento {
  id: number
  nodo_id: string
  estado: number | null
  tipo: string | null
  mensaje: string | null
  created_at: string
}

export interface DbNodoDashboard {
  nodo_id: string
  nombre: string
  ubicacion: string | null
  estado: number
  ultima_conexion: string
  ultima_lectura_at?: string | null
  en_linea?: boolean | null
  temperatura: number | null
  humedad: number | null
  co2: number | null
  pm25: number | null
  acc_x: number | null
  acc_y?: number | null
  acc_z?: number | null
  gyro_x?: number | null
  gyro_y?: number | null
  gyro_z?: number | null
}

export interface DbResumenGlobal {
  total_nodos: number
  nodos_online: number
  nodos_offline: number
  alertas_activas: number
  temp_promedio: number | null
  ultima_lectura_at: string | null
}

export interface DbNodoDetalle {
  nodo_id: string
  nombre: string
  ubicacion: string | null
  estado: number
  ultima_conexion: string
  temperatura: number | null
  humedad: number | null
  co2: number | null
  pm25: number | null
  acc_x: number | null
  acc_y?: number | null
  acc_z?: number | null
  gyro_x?: number | null
  gyro_y?: number | null
  gyro_z?: number | null
  vision_deteccion: string | null
  vision_confianza: number | null
  vision_estado: number | null
  vision_created_at: string | null
}
