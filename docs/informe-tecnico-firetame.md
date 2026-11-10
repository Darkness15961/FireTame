# Informe técnico de FireTame

Plataforma IoT de prevención de incendios forestales por telemetría ambiental temprana.

Este documento describe **cómo funciona el sistema entregado**: arquitectura, protocolos, nodos, red LoRaWAN, servidor, frontend, riesgo, bitácora y límites. No sustituye al código; lo interpreta para la investigación.

Las correcciones puntuales a frases del informe (LMIC, AU915, MQTT, ppm, etc.) están en [`correcciones-afirmaciones-tecnicas.md`](correcciones-afirmaciones-tecnicas.md).

---

## 1. Propósito y alcance

FireTame concentra lecturas de temperatura, humedad, un índice relativo de gas/humo, presión e inclinación, enviadas cada ~60 s por nodos LoRaWAN. El servidor evalúa umbrales configurables y genera alertas. El operador ve el estado en un dashboard web.

**Sí cubre**

- Tres nodos Heltec WiFi LoRa 32 V3 en The Things Network.
- Cadena radio → red → base de datos → interfaz.
- Riesgo ambiental a partir de sensores (no visión por cámara).
- Bitácora de pruebas de campo (distancia, obstáculos, PDR, RSSI, tiempos).

**No cubre**

- Análisis de CO₂ en ppm ni cámara / Raspberry Pi.
- MQTT desde el nodo o desde TTN hacia Supabase.
- Consumo energético medido en firmware (se deja para medición manual).
- Localización GNSS: las coordenadas las carga el operador, el nodo no las envía.

El Heltec **no habla con Supabase**. El navegador **no habla LoRaWAN**. Cada tramo usa su protocolo.

---

## 2. Arquitectura general

```text
┌─────────────┐  I2C / DHT / ADC   ┌──────────────────────┐
│ DHT22       │───────────────────▶│ Heltec WiFi          │
│ MQ135       │                    │ LoRa 32 V3           │
│ GY-91       │                    │ Firmware Arduino     │
│ BMP280+MPU  │                    │ LoRaWan_APP · OTAA   │
└─────────────┘                    └──────────┬───────────┘
                                              │ LoRaWAN Clase A
                                              │ 14 bytes · puerto 2 · ~60 s
                                              │ US915 FSB 2 (903,9–905,3 MHz)
                                              ▼
                                   ┌──────────────────────┐
                                   │ Gateway HT-M7603     │
                                   │ (documentado en repo)│
                                   └──────────┬───────────┘
                                              │ enlace concentrador → TTN
                                              ▼
                                   ┌──────────────────────┐
                                   │ The Things Network   │
                                   │ app heltec-v3-peru   │
                                   │ cluster nam1         │
                                   └──────────┬───────────┘
                                              │ HTTPS POST (webhook)
                                              │ JSON + x-ttn-secret
                                              ▼
                                   ┌──────────────────────┐
                                   │ Edge Function        │
                                   │ ttn-uplink (Deno)    │
                                   │ fallas · riesgo · BD │
                                   └──────────┬───────────┘
                                              │ HTTPS PostgREST
                                              ▼
                                   ┌──────────────────────┐
                                   │ Supabase PostgreSQL  │
                                   │ Realtime (WebSocket) │
                                   └──────────┬───────────┘
                                              │ HTTPS REST + WS
                                              ▼
                                   ┌──────────────────────┐
                                   │ Dashboard Vue 3      │
                                   │ Vite · Pinia · TW    │
                                   └──────────────────────┘
```

Tres planos:

| Plano | Dónde se construye | Qué resuelve |
|---|---|---|
| Dispositivo | Arduino IDE, `firmware/nodo-N` | Medir, filtrar 3 muestras, uplink LoRaWAN |
| Red | Gateway + consola TTN | Radio, identidad OTAA, webhook |
| Aplicación | Supabase + Vue | Persistencia, riesgo, visualización, bitácora |

---

## 3. Protocolos, tramo a tramo

**Pregunta de investigación:** ¿el nodo envía por HTTP a Supabase o por MQTT?

**Ninguno de los dos.** El protocolo de las tramas de sensor es **LoRaWAN**. HTTP aparece después, entre TTN y Supabase. MQTT existe como opción de TTN y **no se usa**.

| Tramo | Protocolo | Dirección | Contenido |
|---|---|---|---|
| Sensor → MCU | I2C (`Wire1` 100 kHz), 1-hilo DHT, ADC 12 bits | Nodo | T, H, ADC, P, pitch, roll |
| Nodo → gateway | LoRaWAN 1.0.x Clase A, PHY LoRa | Uplink no confirmado | 14 bytes binarios, `f_port = 2` |
| Gateway → TTN | Enlace del concentrador (en Heltec/Semtech suele ser packet forwarder UDP; no versionado en el repo) | Hacia `nam1` | El mismo paquete + RSSI/SNR |
| TTN → Edge Function | **HTTPS POST** (webhook de aplicación) | TTN → `…/functions/v1/ttn-uplink` | JSON (`decoded_payload`, `f_cnt`, `rx_metadata`, airtime) |
| Función → PostgreSQL | HTTPS (PostgREST), service role | Insert | `sensor_readings`, a veces `risk_events` |
| Vue → Supabase | HTTPS REST (anon) | Lectura / umbrales / atender alertas | JSON |
| Vue en vivo | WebSocket (Supabase Realtime, Phoenix) | Push de `INSERT` | No es MQTT |

Por qué webhook HTTP y no MQTT de TTN:

1. La Edge Function se invoca con `POST`; no hace falta un proceso 24/7 suscrito a `v3/heltec-v3-peru/devices/+/up`.
2. El secreto `x-ttn-secret` autentica el origen.
3. En el mismo request se validan fallas y se calcula el riesgo.

WiFi del Heltec **no** se usa para telemetría. La placa tiene WiFi; el firmware de este MVP no sube sensores por HTTP.

---

## 4. Capa de dispositivo

### 4.1 Hardware

| Elemento | Detalle |
|---|---|
| MCU / radio | Heltec WiFi LoRa 32 V3 (ESP32-S3 + SX1262) |
| DHT22 | GPIO 4 — temperatura y humedad |
| MQ135 | GPIO 2 — ADC 12 bits (0–4095), índice de gas/humo |
| GY-91 | SDA 47, SCL 48 (`Wire1`) — BMP280 (T, P) y MPU (pitch, roll) |
| OLED | SSD1306, librería Heltec |
| Periodo | `appTxDutyCycle = 60000` ms (+ jitter de Heltec) |

Tres dispositivos TTN:

| ID TTN | DevEUI |
|---|---|
| `heltec-wifi-lora-32-v3` | 70B3D57ED0079581 |
| `heltec-nodo-2` | 70B3D57ED0079582 |
| `heltec-nodo-3` | 70B3D57ED0079584 |

### 4.2 Software del nodo (Arduino IDE)

Librería LoRaWAN: **`LoRaWan_APP.h`** (Heltec / LoRaMAC-node de Semtech), **no** MCCI LMIC.

| Include | Uso |
|---|---|
| `LoRaWan_APP.h` | Join OTAA, ADR, Clase A, TX |
| `Wire.h` | I2C |
| `DHT.h` | DHT22 (no es OneWire Dallas) |
| `BMP280.h` | Presión y T del BMP280, oversampling y `FILTER_X16` |
| MPU | Registros I2C (`WHO_AM_I`, accel ±2 g) y `atan2` para ángulos |
| `HT_SSD1306Wire.h` | Estado en pantalla |

Activación: **solo OTAA** (`overTheAirActivation = true`). Claves en `secrets.h` (no versionado). ABP está declarado porque el ejemplo Heltec lo pide; no se usa.

Región: **`REGION_US915`**, máscara `{ 0xFF00, 0, 0, 0, 0, 0 }` = sub-banda 2, canales 8–15 (**903,9–905,3 MHz**). AU915 (916,8–918,2 MHz) **no** está en el firmware.

Uplink no confirmado, puerto 2, ADR activo, data rate inicial SF9 (`setDefaultDR(3)`), luego lo ajusta la red.

### 4.3 Media móvil de 3 muestras (aplicada en el .ino)

`FILTER_SAMPLES = 3` en los tres sketches.

| Sensor | Muestreo | Espera |
|---|---|---|
| MQ135 | 3 `analogRead` | 5 ms |
| DHT22 | 3 lecturas T y H; se descartan `NaN` | **2 s** (datasheet; Adafruit si se llama antes **repite** el valor) |

No son 5: cinco lecturas DHT añadirían ~8 s al ciclo de 60 s sin mejorar 0,1 °C / 0,1 %. BMP y MPU no se promedian así.

**Hay que grabar** cada placa. Hasta entonces el nodo en campo sigue con una muestra.

Si el DHT22 falla las tres veces, el payload lleva T = 0 y H = 0. El servidor lo trata como falla, no como aire a 0 °C / 0 %.

### 4.4 Payload (schema_version 1)

14 bytes big-endian. No hay JSON en el aire.

| Offset | Tipo | Campo | Escala |
|---|---|---|---|
| 0 | int16 | `temp_dht_c` | ×10 |
| 2 | uint16 | `humidity_pct` | ×10 |
| 4 | uint16 | `mq135_adc` | 0–4095 |
| 6 | int16 | `temp_bmp_c` | ×10 |
| 8 | uint16 | `pressure_hpa` | ×10 |
| 10 | int16 | `pitch_deg` | ×10 |
| 12 | int16 | `roll_deg` | ×10 |

TTN (o la Edge Function si falta el decoder) divide entre 10 los campos escalados.

---

## 5. Gateway y TTN

El repositorio documenta el **Heltec HT-M7603**, cluster **nam1**, plan **US915 FSB 2**. No hay fichero de configuración del gateway. Un Dragino LPS8v2 no aparece en el código; si se usó en laboratorio, es un dato de campo aparte.

Nodo y gateway deben compartir los **ocho canales** de la sub-banda 2. Así el join no barre los 64 canales US915.

En TTN:

- Aplicación `heltec-v3-peru`.
- Integración **Webhooks → Uplink message** → URL de `ttn-uplink`.
- Cabecera `x-ttn-secret` si está configurada.
- Los beacons (`mode: beacon`) se ignoran (HTTP 200, sin insert).

Metadatos que TTN añade y la función guarda: RSSI y SNR del gateway, CRC, `f_cnt`, `consumed_airtime`, data rate (p. ej. SF7BW125), hora de recepción.

PDR en bitácora: tramas distintas / (`f_cnt` máx − `f_cnt` mín + 1), en la prueba abierta o en 24 h.

Fair use de TTN: ~67 ms de aire por uplink × 1440/día ≈ 96 s/día, por encima de 30 s/día. Para producción convendría espaciar (p. ej. 3–4 min) y subir a 60 s solo ante anomalía. El prototipo académico queda en 60 s.

---

## 6. Backend

### 6.1 Edge Function `ttn-uplink`

1. Verifica método POST y secreto.
2. Identifica el nodo por `device_id` o DevEUI.
3. Decodifica el payload si hace falta.
4. Inserta `sensor_readings` (sensores + RSSI/SNR + `f_cnt` + airtime + `fallas`).
5. Calcula línea base MQ135 (10 primeras ADC válidas; si no hay, 1500).
6. Evalúa riesgo **sin** valores en falla.
7. Inserta `risk_events` solo si hay **corroboración**.

### 6.2 Modelo de datos (aplicado)

| Tabla / vista | Rol |
|---|---|
| `nodos` | Identidad TTN, DevEUI, estado, lat/lng opcionales |
| `sensor_readings` | Un uplink = una fila |
| `risk_events` | Alertas; `atendida_at` cuando se acusan |
| `umbrales_alerta` | Fila única `id = 1` |
| `condiciones_prueba` | N, distancia, obstáculos, altura, clima, situación |
| `health_checks` | Pings HTTP a Supabase (disponibilidad del servidor) |
| `nodos_heltec_dashboard` | Vista para el NOC |
| `bitacora_pruebas` | Vista: uplink + prueba + PDR + alertas + latencias |

Se eliminó el legado Raspberry (`lecturas_sensores`, `vision_ai`, `sensores`, `eventos`, `alertas`).

Escritura de lecturas: **service role** (la función). El navegador lee con la anon key (RLS). Atender alertas: el anon solo puede actualizar `atendida_at`.

### 6.3 Fallas de sensor (servidor)

| Etiqueta | Criterio |
|---|---|
| `dht` | T y H nulos, o ambos 0, o T fuera de −40…80 °C |
| `humedad` | H ≤ 0 o > 100 si el DHT no está ya en falla |
| `mq135` | ADC nulo, ≤ 0 o ≥ 4095 |
| `bmp` | T y P en 0, P fuera 300…1100 hPa, T fuera −40…85 °C |
| `mpu` | pitch y roll exactamente 0 o nulos |

Esas magnitudes **no suman** al puntaje de incendio. Siguen guardadas en crudo.

### 6.4 Puntaje de riesgo (0–100)

Umbrales por defecto (editables en Centro de Alertas):

| Condición | Puntos |
|---|---|
| T DHT ≥ 35 °C | +20 |
| T DHT ≥ 40 °C | +15 más |
| H ≤ 30 % | +20 |
| H ≤ 20 % | +15 más |
| MQ135 ≥ base + 400 | +20 |
| MQ135 ≥ base + 900 | +25 más |
| \|pitch\| o \|roll\| > 45° (si está activa) | +10 |

| Score | Nivel |
|---|---|
| 0–24 | low / Normal |
| 25–49 | medium / Observación |
| 50–74 | high / Riesgo alto |
| 75–100 | critical / Crítico |

**Corroboración (aplicada):**

- Dos grupos distintos (temperatura, humedad, gas) sobre umbral → alerta **inmediata**.
- Un solo grupo → hace falta que **otro de los 2 uplinks previos** (ventana 5 min) también superara el mínimo (`score_minimo_alerta`, por defecto 25).

Así un pin suelto o un ADC saturado no enciende incendio. Un nodo que deja de transmitir **no borra** alertas ya guardadas: se acusan a mano (`atendida_at`). “En línea” = último uplink en **5 minutos** y nodo no deshabilitado.

---

## 7. Frontend

Stack: Vue 3.5, Vite 8, Pinia 3, Vue Router 5, Tailwind 3, Lucide, ApexCharts 5, Leaflet 1.9, `@supabase/supabase-js`.

| Ruta | Función |
|---|---|
| `/` | NOC: KPIs, mapa, gráficas del nodo, eventos |
| `/devices` | Lista Heltec |
| `/devices/:id` | Detalle, tarjetas con ⓘ, 6 gráficas, inclinación, eventos |
| `/alerts` | Cola de alertas + umbrales |
| `/management` | Alta, coordenadas, habilitar/deshabilitar |
| `/bitacora` | Pruebas de campo y tabla de uplinks |

Horas en **America/Lima**. Hoy: solo hora; otro día: fecha + hora. “Último uplink” incluye “hace N días” para no confundirlo con la hora actual.

Gráficas: una por magnitud (T DHT, H, MQ135, T BMP, presión, inclinación). Huecos = falla, no ceros. Líneas de umbral cuando caen en la escala. Eje `HH:mm`; tooltip con fecha completa.

Bitácora (orden de columnas): nodo y MAC (DevEUI); N, distancia, obstáculos, altura, clima; RSSI/SNR gateway y nodo, CRC, PDR, frame counter, disponibilidad; horas (envío nodo, gateway, BD, alerta); latencias; T, H, MQ135; situación real; ¿alerta?

RSSI/SNR del **nodo** y hora de envío del MCU quedan vacíos hasta que el firmware los meta en el payload. Disponibilidad 24 h mide **pings a Supabase**, no al Heltec.

---

## 8. Calibración de sensores

Objetivo: **alerta relativa de incendio**, no un laboratorio de gases.

| Magnitud | Qué es válido | Qué no afirmar |
|---|---|---|
| T y H DHT22 | Calibración de fábrica (`DHT.h`) + media de 3 | Offset que no está en el código |
| Presión | BMP280 compensado, **hPa** | BMP085/180 ni unidad Pa |
| Gas/humo | ADC 12 bits vs línea base **del mismo nodo** | “CO₂ ppm” con 124,75 y Ro = 718,5 |
| Inclinación | MPU, umbral 45° configurable | — |

La fórmula antigua `CO₂ = 124.75 × (Rs/Ro)^(−2.805)` **no se usa**: el ADC del Heltec es de **3,3 V** (no 5 V), `RL`/`Ro` cambiaban entre sketches, `Ro` no se mide en aire limpio, y el MQ-135 es multigás. Etiquetar el ADC como ppm es un error de unidad.

Línea base FireTame = media de las 10 primeras ADC válidas (1…4094). Umbrales +400 / +900. 0 y 4095 = cable, no gas.

---

## 9. Cadena temporal de un uplink

1. Media de 3 lecturas DHT (~4 s) y 3 ADC (~10 ms).
2. Se arma el frame de 14 bytes y se transmite LoRaWAN (~67 ms de aire en SF7BW125; más si SF sube).
3. El gateway anota RSSI/SNR/hora y reenvía a TTN.
4. TTN decodifica y hace POST al webhook.
5. `ttn-uplink` inserta la fila, rellena `fallas`, evalúa riesgo, acaso inserta alerta.
6. Realtime avisa al dashboard; la bitácora une la fila a la prueba abierta.

Latencias en bitácora: subida nodo→gateway (airtime si no hay reloj en el nodo); gateway→red TTN; red→BD.

---

## 10. Seguridad (alcance del prototipo)

- Claves OTAA solo en `secrets.h` / `.env`, no en git.
- Webhook con secreto opcional.
- Anon: lectura; no reescribe scores de alerta; sí `atendida_at`.
- Token de management (`VITE_SUPABASE_TOKEN_CLIENT`) no debe usarse en el navegador.
- Sin autenticación de operador en el dashboard (MVP académico).

---

## 11. Limitaciones y trabajo futuro

| Limitación | Implicación |
|---|---|
| Firmware de 3 muestras no grabado | El nodo físico aún puede ir a 1 muestra |
| MQ135 sin ppm | Índice relativo; no concentración |
| Pin flotante del MQ entre 1 y 4094 | El servidor no lo distingue de gas; haría falta un bit de estado en el payload |
| Fair use TTN a 60 s | Excede 30 s/día de aire |
| Sin RSSI/hora del nodo en el payload | Columnas vacías en bitácora |
| Energía | Multímetro / bitácora manual, no en el aire |
| Coordenadas | Carga manual |
| Alertas históricas | Siguen pendientes hasta acusarlas |

Futuro razonable: bit de falla en el payload; Ro o NDIR si se exige ppm; ADR y periodo adaptativo; login de operadores.

---

## 12. Frases para el capítulo de arquitectura

**Arquitectura**

> FireTame separa tres planos. El nodo Heltec mide y transmite LoRaWAN Clase A (OTAA, US915 sub-banda 2, 14 bytes, ~60 s). El gateway entrega el uplink a The Things Network. TTN lo reenvía por webhook HTTPS a una Edge Function que persiste en PostgreSQL y calcula el riesgo. El dashboard Vue consulta esas tablas por REST y Realtime. El microcontrolador no abre HTTP ni MQTT hacia la nube.

**Protocolos**

> LoRaWAN cubre el tramo inalámbrico de bajo consumo. HTTP cubre la integración de aplicación (TTN → Supabase y el frontend). La actualización en vivo usa WebSocket, no MQTT. Confundir estos protocolos implicaría atribuir al sensor un cliente de Internet que el firmware no implementa.

**Filtrado y calibración**

> En el nodo, MQ135 y DHT22 se promedian en tres muestras consecutivas (2 s entre lecturas del DHT22). En el servidor, la línea base del gas es la media de las diez primeras ADC válidas de cada nodo. Temperatura, humedad y presión usan la compensación de fábrica. El MQ-135 no se reporta en ppm.

**Alertas**

> El puntaje (0–100) usa solo magnitudes no marcadas en falla. La alerta se guarda si dos sensores coinciden o si un único sensor persiste en 2 de 3 uplinks. Un nodo sin señal no borra incidentes ya registrados; el operador los acusa en Centro de Alertas.

---

## 13. Referencias internas del repositorio

| Recurso | Ruta |
|---|---|
| Firmware | `firmware/nodo-1`, `nodo-2`, `nodo-3` |
| Webhook | `supabase/functions/ttn-uplink/index.ts` |
| Riesgo (UI) | `src/constants/risk.ts` |
| Fallas (UI) | `src/constants/sensors.ts` |
| Store | `src/stores/fireStore.ts` |
| Migraciones | `supabase/migrations/` |
| Correcciones de redacción | `docs/correcciones-afirmaciones-tecnicas.md` |
