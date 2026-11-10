import type { BitacoraRow } from '@/types/database'
import { parseUtcDate } from '@/utils/format'

export type ModoColumnas = 'campo' | 'completo' | 'sensores'

/** Vista inicial: la señal de la imagen, más temperatura y humedad. */
const COLUMNAS_CAMPO = ['n', 'rssi', 'snr', 'tempDht', 'humedad', 'mq135', 'gateway', 'bd'] as const

export interface FilaReporte {
  n: number
  distancia: number | ''
  obstaculos: string
  altura: number | ''
  clima: string
  rssi: number | ''
  snr: number | ''
  crc: number | ''
  tempDht: number | ''
  humedad: number | ''
  mq135: number | ''
  tempBmp: number | ''
  presion: number | ''
  pitch: number | ''
  roll: number | ''
  envioNodo: string
  recepcionGateway: string
  recepcionBd: string
  emisionAlerta: string
}

export interface ColumnaReporte {
  id: string
  titulo: string
  grupo: 'base' | 'sensores'
  ancho: number
  valor: (fila: FilaReporte) => string | number
}

export const COLUMNAS_REPORTE: ColumnaReporte[] = [
  { id: 'n', titulo: 'N', grupo: 'base', ancho: 8, valor: (fila) => fila.n },
  { id: 'distancia', titulo: 'Distancia (m)', grupo: 'base', ancho: 14, valor: (fila) => fila.distancia },
  { id: 'obstaculos', titulo: 'Obstáculos', grupo: 'base', ancho: 22, valor: (fila) => fila.obstaculos },
  { id: 'altura', titulo: 'Altura (m)', grupo: 'base', ancho: 12, valor: (fila) => fila.altura },
  { id: 'clima', titulo: 'Clima', grupo: 'base', ancho: 16, valor: (fila) => fila.clima },
  { id: 'rssi', titulo: 'RSSI (dBm)', grupo: 'base', ancho: 14, valor: (fila) => fila.rssi },
  { id: 'snr', titulo: 'SNR (dB)', grupo: 'base', ancho: 12, valor: (fila) => fila.snr },
  { id: 'tempDht', titulo: 'T (°C)', grupo: 'sensores', ancho: 12, valor: (fila) => fila.tempDht },
  { id: 'humedad', titulo: 'Humedad (%)', grupo: 'sensores', ancho: 14, valor: (fila) => fila.humedad },
  { id: 'mq135', titulo: 'MQ135 (ADC)', grupo: 'sensores', ancho: 14, valor: (fila) => fila.mq135 },
  { id: 'tempBmp', titulo: 'T BMP (°C)', grupo: 'sensores', ancho: 14, valor: (fila) => fila.tempBmp },
  { id: 'presion', titulo: 'Presión (hPa)', grupo: 'sensores', ancho: 14, valor: (fila) => fila.presion },
  { id: 'pitch', titulo: 'Pitch (°)', grupo: 'sensores', ancho: 12, valor: (fila) => fila.pitch },
  { id: 'roll', titulo: 'Roll (°)', grupo: 'sensores', ancho: 12, valor: (fila) => fila.roll },
  { id: 'crc', titulo: 'CRC', grupo: 'base', ancho: 8, valor: (fila) => fila.crc },
  { id: 'envio', titulo: 'Hora envío nodo', grupo: 'base', ancho: 26, valor: (fila) => fila.envioNodo },
  { id: 'gateway', titulo: 'Hora recepción - gateway', grupo: 'base', ancho: 28, valor: (fila) => fila.recepcionGateway },
  { id: 'bd', titulo: 'Hora recepción - BD', grupo: 'base', ancho: 26, valor: (fila) => fila.recepcionBd },
  { id: 'alerta', titulo: 'Hora emisión alerta', grupo: 'base', ancho: 24, valor: (fila) => fila.emisionAlerta },
]

/** Campo es la vista inicial. Completo lleva el enlace y los sensores. Sensores deja N y las lecturas. */
export function columnasReporte(modo: ModoColumnas): ColumnaReporte[] {
  if (modo === 'campo') {
    return COLUMNAS_CAMPO.flatMap((id) => {
      const columna = COLUMNAS_REPORTE.find((item) => item.id === id)
      return columna ? [columna] : []
    })
  }
  if (modo === 'sensores') {
    return COLUMNAS_REPORTE.filter((columna) => columna.id === 'n' || columna.grupo === 'sensores')
  }
  return COLUMNAS_REPORTE
}

export interface HojaNodo {
  nodeId: string
  nombre: string
  filas: FilaReporte[]
}

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000

function dosDigitos(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Marca de tiempo en hora de Lima, con milisegundos: 2026-10-01 10:30:45.088. Perú no usa horario de verano. */
export function marcaTiempo(iso: string | null | undefined): string {
  const date = parseUtcDate(iso)
  if (!date || Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() + LIMA_OFFSET_MS)
  const ms = shifted.getUTCMilliseconds()
  const frac = ms < 10 ? `00${ms}` : ms < 100 ? `0${ms}` : String(ms)
  return `${shifted.getUTCFullYear()}-${dosDigitos(shifted.getUTCMonth() + 1)}-${dosDigitos(shifted.getUTCDate())} ${dosDigitos(shifted.getUTCHours())}:${dosDigitos(shifted.getUTCMinutes())}:${dosDigitos(shifted.getUTCSeconds())}.${frac}`
}

function medida(value: number | null, digits: number): number | '' {
  if (value == null || Number.isNaN(value)) return ''
  return Number(value.toFixed(digits))
}

/** 1 si el gateway validó el CRC, 0 si falló. Vacío si no hay dato. */
function crcBit(status: string | null): number | '' {
  if (status === 'CRC_OK') return 1
  if (status === 'CRC_ERROR') return 0
  return ''
}

function instante(row: BitacoraRow): number {
  return parseUtcDate(row.gateway_received_at ?? row.received_at)?.getTime() ?? 0
}

export function celdasReporte(
  fila: FilaReporte,
  columnas: ColumnaReporte[] = COLUMNAS_REPORTE,
): (string | number)[] {
  return columnas.map((columna) => columna.valor(fila))
}

/** 0 en CRC es un error real. En el resto, 0 o vacío cuenta como columna sin dato. */
function celdaTieneDato(id: string, valor: string | number): boolean {
  if (typeof valor === 'number') return id === 'crc' || valor !== 0
  return valor.trim() !== ''
}

function columnaTieneDatos(hoja: HojaNodo, columna: ColumnaReporte): boolean {
  if (columna.id === 'n') return hoja.filas.length > 0
  return hoja.filas.some((fila) => celdaTieneDato(columna.id, columna.valor(fila)))
}

export interface TablaReporte {
  hoja: HojaNodo
  columnas: ColumnaReporte[]
}

/** Con datos: cada nodo pierde las columnas vacías. Si no le queda ninguna lectura, la tabla no sale. */
export function tablasReporte(
  hojas: HojaNodo[],
  columnas: ColumnaReporte[],
  soloConDatos: boolean,
): TablaReporte[] {
  if (!soloConDatos) return hojas.map((hoja) => ({ hoja, columnas }))
  return hojas.flatMap((hoja) => {
    const activas = columnas.filter((columna) => columnaTieneDatos(hoja, columna))
    if (!activas.some((columna) => columna.id !== 'n')) return []
    return [{ hoja, columnas: activas }]
  })
}

/** Una hoja por nodo. Arriba el uplink más reciente. N = 1 sigue siendo el más antiguo de ese nodo. */
export function armarHojas(
  rows: BitacoraRow[],
  etiqueta: (nodeId: string, nombre: string | null) => string,
): HojaNodo[] {
  const grupos = new Map<string, BitacoraRow[]>()
  for (const row of rows) {
    const lista = grupos.get(row.node_id)
    if (lista) lista.push(row)
    else grupos.set(row.node_id, [row])
  }

  const hojas: HojaNodo[] = []
  for (const [nodeId, lista] of grupos) {
    const cronologico = [...lista].sort((a, b) => instante(a) - instante(b))
    const filas = cronologico.map((row, index) => ({
      n: index + 1,
      distancia: medida(row.distancia_m, 1),
      obstaculos: row.obstaculos ?? '',
      altura: medida(row.altura_m, 1),
      clima: row.clima ?? '',
      rssi: medida(row.rssi, 1),
      snr: medida(row.snr, 1),
      crc: crcBit(row.crc_status),
      tempDht: medida(row.temp_dht_c, 1),
      humedad: medida(row.humidity_pct, 1),
      mq135: medida(row.mq135_adc, 0),
      tempBmp: medida(row.temp_bmp_c, 1),
      presion: medida(row.pressure_hpa, 1),
      pitch: medida(row.pitch_deg, 1),
      roll: medida(row.roll_deg, 1),
      envioNodo: marcaTiempo(row.node_sent_at),
      recepcionGateway: marcaTiempo(row.gateway_received_at),
      recepcionBd: marcaTiempo(row.db_received_at),
      emisionAlerta: marcaTiempo(row.hora_emision_alerta),
    }))
    filas.reverse()
    hojas.push({
      nodeId,
      nombre: etiqueta(nodeId, cronologico[0]?.nodo_nombre ?? null),
      filas,
    })
  }

  hojas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return hojas
}

function nombreHoja(raw: string, usados: Set<string>): string {
  const limpio = raw.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim() || 'Nodo'
  const base = limpio.slice(0, 31)
  let nombre = base
  let n = 2
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` ${n}`
    nombre = `${base.slice(0, 31 - sufijo.length)}${sufijo}`
    n += 1
  }
  usados.add(nombre.toLowerCase())
  return nombre
}

function esReporteSensores(columnas: ColumnaReporte[]): boolean {
  return columnas.every((columna) => columna.id === 'n' || columna.grupo === 'sensores')
}

function nombreArchivo(columnas: ColumnaReporte[], extension: 'xlsx' | 'csv'): string {
  const base = esReporteSensores(columnas) ? 'reporte-sensores-firetame' : 'reporte-nodos-firetame'
  return `${base}-completa.${extension}`
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function columna(index: number): string {
  let n = index + 1
  let nombre = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    nombre = String.fromCharCode(65 + resto) + nombre
    n = Math.floor((n - 1) / 26)
  }
  return nombre
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function hojaXml(filas: (string | number)[][], nombre: string, anchos: number[]): string {
  const ultima = columna(Math.max(anchos.length, 1) - 1)
  const ref = `A1:${ultima}${Math.max(filas.length, 1)}`
  const cols = anchos.map(
    (ancho, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${ancho}" customWidth="1"/>`,
  ).join('')
  const rows = filas
    .map((fila, rowIndex) => {
      const celdas = fila
        .map((valor, colIndex) => {
          if (valor === '') return ''
          const refCelda = `${columna(colIndex)}${rowIndex + 1}`
          if (typeof valor === 'number') return `<c r="${refCelda}"><v>${valor}</v></c>`
          return `<c r="${refCelda}" t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${celdas}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${ref}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="${ref}"/>
  <headerFooter><oddHeader>&amp;L${xml(nombre)}</oddHeader></headerFooter>
</worksheet>`
}

function libroXml(nombres: string[]): string {
  const sheets = nombres
    .map((nombre, index) => `<sheet name="${xml(nombre)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`
}

function relacionesLibro(total: number): string {
  const items = Array.from({ length: total }, (_, index) => {
    const id = index + 1
    return `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`
}

function tipos(total: number): string {
  const hojas = Array.from({ length: total }, (_, index) => {
    const id = index + 1
    return `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${hojas}
</Types>`
}

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

/** ZIP sin compresión. Excel abre el xlsx igual. */
function zipStore(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let offset = 0

  for (const archivo of archivos) {
    const nombre = new TextEncoder().encode(archivo.nombre)
    const crc = crc32(archivo.datos)
    const local = new Uint8Array(30 + nombre.length)
    const vistaLocal = new DataView(local.buffer)
    vistaLocal.setUint32(0, 0x04034b50, true)
    vistaLocal.setUint16(4, 20, true)
    vistaLocal.setUint16(8, 0, true)
    vistaLocal.setUint32(14, crc, true)
    vistaLocal.setUint32(18, archivo.datos.length, true)
    vistaLocal.setUint32(22, archivo.datos.length, true)
    vistaLocal.setUint16(26, nombre.length, true)
    local.set(nombre, 30)

    const central = new Uint8Array(46 + nombre.length)
    const vistaCentral = new DataView(central.buffer)
    vistaCentral.setUint32(0, 0x02014b50, true)
    vistaCentral.setUint16(4, 20, true)
    vistaCentral.setUint16(6, 20, true)
    vistaCentral.setUint32(16, crc, true)
    vistaCentral.setUint32(20, archivo.datos.length, true)
    vistaCentral.setUint32(24, archivo.datos.length, true)
    vistaCentral.setUint16(28, nombre.length, true)
    vistaCentral.setUint32(42, offset, true)
    central.set(nombre, 46)

    locales.push(local, archivo.datos)
    centrales.push(central)
    offset += local.length + archivo.datos.length
  }

  const tamanoCentral = centrales.reduce((suma, parte) => suma + parte.length, 0)
  const fin = new Uint8Array(22)
  const vistaFin = new DataView(fin.buffer)
  vistaFin.setUint32(0, 0x06054b50, true)
  vistaFin.setUint16(8, archivos.length, true)
  vistaFin.setUint16(10, archivos.length, true)
  vistaFin.setUint32(12, tamanoCentral, true)
  vistaFin.setUint32(16, offset, true)

  const total = offset + tamanoCentral + fin.length
  const salida = new Uint8Array(total)
  let cursor = 0
  for (const parte of [...locales, ...centrales, fin]) {
    salida.set(parte, cursor)
    cursor += parte.length
  }
  return salida
}

export function bytesReporteExcel(tablas: TablaReporte[]): Uint8Array {
  const usados = new Set<string>()
  const nombres = tablas.map((tabla) => nombreHoja(tabla.hoja.nombre, usados))
  const encoder = new TextEncoder()
  const archivos = [
    { nombre: '[Content_Types].xml', datos: encoder.encode(tipos(tablas.length)) },
    { nombre: '_rels/.rels', datos: encoder.encode(RELS) },
    { nombre: 'xl/workbook.xml', datos: encoder.encode(libroXml(nombres)) },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: encoder.encode(relacionesLibro(tablas.length)) },
    ...tablas.map((tabla, index) => ({
      nombre: `xl/worksheets/sheet${index + 1}.xml`,
      datos: encoder.encode(
        hojaXml(
          [
            tabla.columnas.map((columna) => columna.titulo),
            ...tabla.hoja.filas.map((fila) => celdasReporte(fila, tabla.columnas)),
          ],
          nombres[index]!,
          tabla.columnas.map((columna) => columna.ancho),
        ),
      ),
    })),
  ]
  return zipStore(archivos)
}

function csvCelda(valor: string | number): string {
  const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor
  if (/[;"\n]/.test(texto)) return `"${texto.replaceAll('"', '""')}"`
  return texto
}

function descargarBlob(blob: Blob, archivo: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = archivo
  link.click()
  URL.revokeObjectURL(url)
}

function columnasDelArchivo(tablas: TablaReporte[]): ColumnaReporte[] {
  const ids = new Set(tablas.flatMap((tabla) => tabla.columnas.map((columna) => columna.id)))
  return COLUMNAS_REPORTE.filter((columna) => ids.has(columna.id))
}

export function descargarReporteExcel(tablas: TablaReporte[], archivo?: string): void {
  if (!tablas.length) return
  const bytes = bytesReporteExcel(tablas)
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  descargarBlob(
    new Blob([copia], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    archivo ?? nombreArchivo(columnasDelArchivo(tablas), 'xlsx'),
  )
}

/** Un CSV con las mismas columnas que se ven. Cada fila indica el nodo. */
export function descargarReporteCsv(tablas: TablaReporte[], archivo?: string): void {
  if (!tablas.length) return
  const columnas = columnasDelArchivo(tablas)
  const encabezado = ['Nodo', ...columnas.map((columna) => columna.titulo)]
  const lineas = tablas.flatMap((tabla) =>
    tabla.hoja.filas.map((fila) =>
      [tabla.hoja.nombre, ...celdasReporte(fila, columnas)].map(csvCelda).join(';'),
    ),
  )
  descargarBlob(
    new Blob([`\uFEFF${encabezado.map(csvCelda).join(';')}\n${lineas.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    }),
    archivo ?? nombreArchivo(columnas, 'csv'),
  )
}
