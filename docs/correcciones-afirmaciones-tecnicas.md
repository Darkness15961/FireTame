# Correcciones a las afirmaciones técnicas

Contraste de lo escrito contra el código y la configuración actuales de FireTame. Cada bloque indica **dónde se aplica**, **si ya está en el repositorio** y qué conviene decir en el informe.

El informe completo (arquitectura, protocolos, riesgo, calibración) está en [`informe-tecnico-firetame.md`](informe-tecnico-firetame.md).

Fecha de este recuento: 6 de noviembre de 2026.

---

## Estado de lo aplicado (qué está hecho y dónde)

| Aplicación | Capa | ¿En el repo? | ¿En el hardware / nube? |
|---|---|---|---|
| Media móvil de **3 muestras** (no 5) en DHT22 y MQ135 | Nodo, Arduino IDE | **Sí.** `FILTER_SAMPLES = 3` en `nodo-1`, `nodo-2` y `nodo-3` | **Pendiente grabar** cada Heltec. Hasta entonces el nodo en campo sigue con 1 muestra |
| Pila LoRaWAN Heltec `LoRaWan_APP`, OTAA, US915 FSB 2 | Nodo | Sí | Sí, si el sketch grabado es este |
| Validación de sensores en falla (`fallas[]`) | Servidor `ttn-uplink` | Sí | **Sí.** Edge Function desplegada; columna `sensor_readings.fallas` en Supabase |
| Línea base MQ135 = media de 10 lecturas válidas | Servidor | Sí | Sí |
| Alerta: 2 sensores coinciden al instante; si es 1 sensor, 2 de 3 uplinks en 5 min | Servidor | Sí | Sí |
| Alertas se marcan atendidas (`atendida_at`) | Servidor + frontend | Sí | Sí |
| Umbrales configurables | Frontend Centro de Alertas + tabla `umbrales_alerta` | Sí | Sí |
| Bitácora de pruebas (columnas de campo, CSV) | Frontend `/bitacora` + vista SQL | Sí | Sí |
| Gráficas **separadas** (T, H, MQ, BMP, presión, inclinación) | Frontend | Sí | Sí (dashboard web) |
| Ayudas ⓘ en cada magnitud | Frontend | Sí | Sí |
| Quitar legado Raspberry (`nodo_01B`, `vision_ai`, etc.) | Repo + Supabase | Sí | Sí (tablas borradas) |
| Fórmula CO₂ ppm (124,75 / Ro 718,5) | — | **No.** No se usa | No aplicar |
| MQTT del nodo o de TTN hacia Supabase | — | **No** | No: el tramo a Supabase es HTTP POST |
| MCCI LMIC, OneWire, AU915, Dragino LPS8v2 | — | **No** en este repo | No citar como del sistema entregado |

---

## Resumen de las afirmaciones que enviaste

| Afirmación | ¿Coincide con lo que hay? | Dónde se aplica |
|---|---|---|
| Librería **MCCI LoRaWAN LMIC** | **No.** El firmware incluye `LoRaWan_APP.h` (Heltec / LoRaMAC-node). | Nodo, Arduino IDE |
| Canales **AU915** | **No.** `LORAWAN_REGION = REGION_US915` y TTN `nam1` / US915 FSB 2. | Nodo + TTN |
| Activación **OTAA o ABP** | **Parcial.** Solo OTAA (`overTheAirActivation = true`). ABP está en `secrets.h` como plantilla Heltec, no se usa. | Nodo |
| Librerías **I2C y OneWire** | **Parcial.** I2C sí (`Wire.h`). OneWire **no**. | Nodo |
| Gateway **Dragino LPS8v2**, AU915 **916,8–918,2 MHz** | **No consta.** El README documenta **Heltec HT-M7603** y **US915 FSB 2** (903,9–905,3 MHz). | Gateway (sin config en el repo) |
| Media móvil de **3 muestras** (MQ135 y DHT22) | **Sí, en el código.** No son 5. Hay que **flashear** los nodos. | Nodo. Distinto del promedio de 10 lecturas del MQ135 **en el servidor** (línea base). |

---

## 1. Nodo Heltec (Arduino IDE)

**Hardware:** Heltec WiFi LoRa 32 V3  
**Sensores:** DHT22 (GPIO4), MQ135 ADC (GPIO2), GY-91 BMP280 + MPU (I2C `Wire1`, SDA 47 / SCL 48)  
**Sketches:** `firmware/nodo-1`, `firmware/nodo-2`, `firmware/nodo-3`

### Librerías que sí se usan

| Librería / include | Función real |
|---|---|
| `LoRaWan_APP.h` (paquete Heltec ESP32) | Pila LoRaWAN Clase A: join, duty cycle, ADR, payload. **No es MCCI LMIC.** |
| `Wire.h` | I2C (`Wire1` a 100 kHz) para BMP280, MPU y OLED. |
| `DHT.h` (Adafruit DHT) | DHT22 por su protocolo de un hilo. **No es OneWire (Dallas/Maxim).** |
| `BMP280.h` | Temperatura y presión del BMP280. |
| `HT_SSD1306Wire.h` | Pantalla OLED. |
| MPU | **Sin librería de IMU.** Registros I2C a mano (`0x68` / `0x69`); se calculan pitch y roll. |

### LoRaWAN en el nodo

- Región: **US915** (`Tools → LORAWAN_REGION = REGION_US915`).
- Máscara: `userChannelsMask = { 0xFF00, 0, 0, 0, 0, 0 }` → sub-banda 2, canales 8–15.
- Frecuencias US915 FSB 2: **903,9 a 905,3 MHz**.
- Las **916,8 a 918,2 MHz** son AU915 FSB 2; **no** aplican a este firmware.
- Activación: **solo OTAA**. `devEui`, `appEui`, `appKey` en `secrets.h`.
- Clase A, ADR, uplinks **no confirmados**, puerto **2**, periodo **60 s**.

### Media móvil: son 3 muestras, no 5 — aplicado en el .ino

Constante en los tres nodos:

```cpp
static const uint8_t FILTER_SAMPLES = 3;
static const uint16_t DHT_SAMPLE_GAP_MS = 2000;
static const uint16_t MQ_SAMPLE_GAP_MS = 5;
```

Funciones: `readMq135Average()` y `readDhtAverage()`, llamadas desde `readSensors()` **antes** de armar los 14 bytes.

| Sensor | Qué hace el código | Por qué 3 y no 5 |
|---|---|---|
| **MQ135** | 3 `analogRead`, 5 ms entre ellos; se envía el entero más cercano a la media. | El ruido del ADC es rápido; 5 muestras casi no cambian el resultado. |
| **DHT22** | 3 lecturas de T y H, **2 s** entre ellas. Se descartan `NaN`. Si las 3 fallan → T = 0, H = 0. | Datasheet ≥ 2 s. Adafruit, si se llama antes, **repite el valor anterior**: 3 lecturas rápidas no filtran nada. |

Tiempo extra por uplink (cabe en 60 s):

- 3 muestras DHT: **~4 s**
- 5 muestras DHT: **~8 s**, misma resolución 0,1 °C / 0,1 %

BMP280 y MPU **no** entran en este filtro.

**Pendiente de campo:** grabar `nodo-1.ino`, `nodo-2.ino` y `nodo-3.ino` en cada placa. El dashboard no hace esta media.

**Frase para el informe**

> En Arduino IDE, sobre Heltec WiFi LoRa 32 V3, la pila LoRaWAN es Heltec `LoRaWan_APP` (LoRaMAC-node), US915 sub-banda 2 y OTAA. Los sensores se leen con `DHT.h`, `Wire.h`, `BMP280.h` y registros I2C del MPU. No se usa MCCI LMIC ni OneWire. Cada uplink aplica una media móvil de tres muestras consecutivas al MQ135 (ADC, 5 ms) y al DHT22 (2 s entre lecturas). No se usaron cinco muestras porque el DHT22 duplicaría la espera sin mejorar su resolución.

---

## 2. Gateway

**Documentado:** Heltec **HT-M7603** → TTN `nam1`, **US915 / FSB 2**.  
**No está en el repo:** configuración del gateway ni Dragino LPS8v2.

Los 8 canales de la sub-banda 2 sí aplican, en **US915**, tanto en el nodo (`userChannelsMask`) como en el gateway.

Si en laboratorio se usó un Dragino, hay que decirlo como cambio de hardware y no citar 916,8–918,2 MHz mientras el sketch siga en `REGION_US915`.

**Frase**

> El gateway Heltec HT-M7603 se alineó con TTN US915 sub-banda 2 (ocho canales de 125 kHz entre 903,9 y 905,3 MHz), la misma máscara del nodo, para no barrer los 64 canales del plan.

---

## 3. The Things Network

| Dato | Valor |
|---|---|
| Aplicación | `heltec-v3-peru` |
| Cluster | `nam1` |
| Plan | US915 FSB 2 |
| Nodos | `heltec-wifi-lora-32-v3` (70B3D57ED0079581), `heltec-nodo-2` (70B3D57ED0079582), `heltec-nodo-3` (70B3D57ED0079584) |
| Decoder | 14 bytes, puerto 2 |
| Integración | webhook **HTTP POST** → Edge Function `ttn-uplink` (no MQTT) |

---

## 4. Backend (Supabase)

**Runtime:** Deno, `supabase/functions/ttn-uplink/index.ts` (desplegada).  
**Tablas:** `nodos`, `sensor_readings`, `risk_events`, `umbrales_alerta`, `condiciones_prueba`, `health_checks`.  
**Quitado:** Raspberry (`lecturas_sensores`, `vision_ai`, `sensores`, `tipos_sensores`, `eventos`, `alertas` y RPCs viejos).

Hay **dos promedios distintos**:

1. **En el nodo:** 3 muestras por uplink (anti-ruido). Requiere firmware grabado.
2. **En el servidor:** media de las **primeras 10 lecturas válidas** del MQ135 = línea base de riesgo. Ya activo.

Otras reglas ya en la nube:

- Columna `fallas` (`dht`, `humedad`, `mq135`, `bmp`, `mpu`). T/H = 0, ADC 0 o 4095, BMP o MPU en cero no suman riesgo de incendio.
- Alerta inmediata si **dos sensores** coinciden; un solo sensor exige **persistencia** (otro uplink sobre umbral en 5 min).
- `risk_events.atendida_at`: “Acusar alerta” se guarda; no vuelve al recargar.
- Umbrales editables (T, H, deltas MQ135, inclinación, puntaje mínimo).

**Frase**

> El nodo reduce ruido del ADC y del DHT22 con tres muestras. El servidor descarta lecturas imposibles (pin suelto, saturación) y arma la línea base del MQ135 con las primeras diez muestras válidas de cada nodo. Un pin en falso no enciende alerta de incendio.

---

## 5. Frontend (Vue, Vite)

No es Arduino. No implementa LoRaWAN ni el filtro de 3 muestras.

| Pieza | Librería | Uso |
|---|---|---|
| UI | Vue 3.5 | Componentes |
| Build | Vite 8 | Dev y build |
| Estado | Pinia 3 | Nodos, umbrales, alertas |
| Rutas | Vue Router 5 | Dashboard, dispositivos, alertas, bitácora, registro |
| Estilos | Tailwind CSS 3 | Diseño |
| Iconos | lucide-vue-next | Iconografía |
| Gráficas | ApexCharts 5 + vue3-apexcharts | **Una gráfica por magnitud** |
| Mapa | Leaflet 1.9 | Ubicación |
| Datos | `@supabase/supabase-js` | REST + Realtime (WebSocket) |

Aplicado en la interfaz:

- Detalle del nodo: 6 gráficas (T DHT, H, MQ135, T BMP, presión, pitch/roll), cada una con su escala; huecos = sensor en falla, no ceros.
- Dashboard: 4 gráficas del nodo seleccionado.
- ⓘ en cada magnitud.
- Bitácora: registros en el orden de campo (nodo, prueba, enlace, tiempos, sensores, resultado).
- Centro de Alertas: umbrales + acusar (persiste en BD).
- Sin botón de Vue DevTools (se quitó el plugin).

---

## 6. Protocolos: no es HTTP ni MQTT desde el nodo

El Heltec **no habla con Supabase**. Tampoco abre MQTT. La trama va por **LoRaWAN**; el **HTTP** empieza en TTN → Edge Function.

```text
Nodo Heltec
    │  LoRaWAN Clase A  (14 bytes, puerto 2, ~60 s)
    │  OTAA · US915 FSB 2
    ▼
Gateway HT-M7603
    │  reenvío a TTN (packet forwarder; no versionado aquí)
    ▼
The Things Network (nam1)
    │  Webhook HTTP POST + x-ttn-secret
    ▼
Edge Function ttn-uplink
    │  HTTPS PostgREST (service role)
    ▼
PostgreSQL
    ├─ Vue → HTTPS REST
    └─ Vue en vivo → WebSocket Realtime  (no MQTT)
```

| Tramo | Protocolo | Qué viaja |
|---|---|---|
| Sensores → ESP32 | I2C / DHT / ADC | Valores en RAM |
| Nodo → gateway | **LoRaWAN** | 14 bytes binarios, no JSON |
| Gateway → TTN | Enlace del concentrador (suele ser UDP Semtech) | El paquete + RSSI/SNR |
| TTN → Supabase | **HTTPS POST** | JSON del uplink |
| Función → tablas | HTTPS PostgREST | INSERT lectura / alerta |
| Dashboard | HTTPS REST + **WebSocket** | JSON / eventos INSERT |

TTN tiene broker MQTT (`mqtts://nam1.cloud.thethings.network`). **Este prototipo no se suscribe.**

Payload en el aire (big-endian):

| Bytes | Campo |
|---|---|
| 0–1 | T DHT ×10 |
| 2–3 | H ×10 |
| 4–5 | MQ135 ADC |
| 6–7 | T BMP ×10 |
| 8–9 | Presión ×10 (hPa) |
| 10–11 | Pitch ×10 |
| 12–13 | Roll ×10 |

**Frase**

> El envío no es HTTP ni MQTT desde el nodo. El Heltec transmite un uplink LoRaWAN de 14 bytes; TTN lo reenvía por webhook HTTP POST a `ttn-uplink`. El dashboard lee por HTTPS y se actualiza por WebSocket. No se usa el cliente MQTT de TTN.

---

## 7. Calibración: sketches anteriores vs FireTame

Lo válido para **este** prototipo es FireTame. La fórmula de “CO₂ en ppm” de `ver1` / `sketch_jun26a` / `ecoXplorer` **no se aplica**.

### MQ-135 — no usar 124,75 ni Ro = 718,5

```text
V  = ADC × 5 / 4095          ← el Heltec mide a 3,3 V, no 5 V
Rs = RL × (5 − V) / V        ← RL 1000 vs 10 según el sketch viejo
CO₂ = 124.75 × (Rs / Ro)^(−2.805)
```

Eso no es calibración de estas placas: Vref incorrecta, RL/Ro inconsistentes, Ro no medido en aire limpio, y el MQ-135 es **multigás**, no un analizador de CO₂. Etiquetar el ADC como ppm (ecoXplorer) es un error de unidad.

**FireTame (aplicado):**

1. Media de 3 ADC en el nodo.
2. Se envía el crudo 0–4095, **índice de gas/humo, no ppm**.
3. Línea base por nodo: 10 primeras lecturas válidas (ni 0 ni 4095).
4. Alerta si sube **+400** / **+900** ADC respecto a esa base.
5. 0 y 4095 = falla de cable.

### DHT22 — válido en ambos; ahora con 3 muestras

Calibración de fábrica vía `DHT.h`. No hay offset. El heat index no se envía. El riesgo usa T y H.

### Presión — otro chip

Antes BMP085/180 en **Pa**. Ahora **BMP280** del GY-91 en **hPa**, con `FILTER_X16`. No entra en el puntaje de incendio. La T del BMP es referencia; el riesgo usa la del DHT22.

| Magnitud | Base defendible | No afirmar |
|---|---|---|
| T / H | Fábrica DHT22 + media de 3 | Un offset que no está en el código |
| Presión | BMP280 compensado, hPa | BMP085 o unidad Pa |
| Gas / humo | ADC vs línea base del **mismo nodo** | “CO₂ ppm” con 124,75 y Ro 718,5 |
| Inclinación | MPU vs 45° configurables | — |

**Frase**

> Temperatura y humedad salen de la calibración de fábrica del DHT22, promediadas en tres muestras. La presión la compensa el BMP280 (hPa). El MQ-135 no se convierte a ppm: no hay Ro medido ni Vref de 5 V, y el sensor es multigás. Se usa el ADC de 12 bits respecto a la línea base del nodo. Es un índice relativo de alerta temprana, no un analizador de CO₂.

---

## 8. Párrafos listos para pegar

### Dispositivo

Se implementó el firmware en Arduino IDE sobre Heltec WiFi LoRa 32 V3. La pila LoRaWAN es Heltec `LoRaWan_APP` (LoRaMAC-node), no MCCI LMIC. Región US915, sub-banda 2, OTAA. I2C (`Wire.h`) para el GY-91; DHT22 con `DHT.h` (no OneWire). En cada uplink, MQ135 y DHT22 pasan por una media móvil de tres muestras consecutivas (ADC cada 5 ms; DHT cada 2 s). No se usaron cinco muestras porque el DHT22 duplicaría la espera sin mejorar 0,1 °C / 0,1 %.

### Gateway y red

El gateway documentado es Heltec HT-M7603 en TTN nam1, US915 FSB 2 (903,9–905,3 MHz). Las frecuencias 916,8–918,2 MHz son AU915 y no aplican.

### Comunicaciones

El nodo no envía HTTP ni MQTT a la nube. LoRaWAN cubre el aire; HTTP cubre TTN → Supabase; el dashboard usa HTTPS y WebSocket. MQTT de TTN no se implementa.

### Servidor y frontend

La Edge Function `ttn-uplink` persiste la lectura, marca fallas de sensor, calcula riesgo con umbrales configurables y una línea base de diez ADC válidos. Vue 3 + Vite + Pinia + Tailwind muestran una gráfica por magnitud y la bitácora de campo.

---

## 9. Pendiente para ratificar en campo

1. **Grabar** los tres `.ino` actualizados (si no, la media de 3 no corre en el nodo).
2. Abrir una prueba en Bitácora y anotar “firmware con FILTER_SAMPLES = 3”.
3. Comprobar que el MQ135 salta menos entre uplinks y que un DHT desconectado sigue yendo a T = 0, H = 0 (falla, no promedio falso).
4. No citar Dragino / AU915 / ppm / MQTT / MCCI LMIC / OneWire salvo que se documente un ensayo aparte.
