# FireTame

Plataforma IoT de **prevención de incendios** por telemetría ambiental temprana.

**MVP actual:** nodos **Heltec WiFi LoRa 32 V3** → gateway HT-M7603 → **The Things Network (US915 / FSB 2 / nam1)** → webhook → **Supabase** → dashboard Vue en tiempo real.

---

## Cadena de datos

```text
Sensores (DHT22, MQ135, GY-91: BMP280 + MPU)
  → firmware SensorNode_LoRaWan.ino
  → uplink LoRaWAN 14 bytes, puerto 2, ~60 s
  → Gateway Heltec HT-M7603
  → TTN (decoder JS)
  → Webhook → Edge Function ttn-uplink
  → sensor_readings + risk_events (Realtime)
  → Vue
```

El frontend **no** habla con el Heltec. El Heltec **no** habla con Supabase.

---

## Contrato de telemetría (`schema_version: 1`)

| Campo | Sensor | Nota |
|--------|--------|------|
| `temp_dht_c` | DHT22 | °C |
| `humidity_pct` | DHT22 | % |
| `mq135_adc` | MQ135 | ADC crudo 0–4095. **No es ppm ni CO₂ calibrado.** En UI: “índice gas/humo (ADC)” |
| `temp_bmp_c` | BMP280 (GY-91) | °C secundaria (`bmp` se mantiene por schema v1) |
| `pressure_hpa` | BMP280 (GY-91) | hPa |
| `pitch_deg` | MPU (GY-91) | inclinación |
| `roll_deg` | MPU (GY-91) | inclinación |

No se usan CO₂ calibrado, PM2.5 ni ejes crudos del MPU.

---

## Riesgo ambiental

Score 0–100 a partir de umbrales de temperatura DHT, humedad, MQ135 vs baseline y tilt > 45°.

| Score | Nivel |
|-------|--------|
| 0–24 | low |
| 25–49 | medium |
| 50–74 | high |
| 75–100 | critical |

Baseline MQ135: media de las primeras 10 lecturas del nodo, o **1500** si aún no hay muestras (`delta1` +400, `delta2` +900). Ajustar en campo.

Nodo **en línea** si hay uplink en los últimos **3 minutos**.

---

## Frontend

### Requisitos

- Node `^20.19` o `>=22.12`
- Bun ≥ 1.3

### Variables

Copiar [`.env.example`](.env.example) a `.env`:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_ACCESS_TOKEN=          # CLI, NUNCA con prefijo VITE_
TTN_WEBHOOK_SECRET=             # header x-ttn-secret del webhook
```

`VITE_*` llega al navegador. El token CLI y el secreto TTN **no** deben usar prefijo `VITE_`.

```bash
bun install
bun run dev          # http://localhost:5173
bun run type-check
```

---

## Backend Supabase

Migración: [`supabase/migrations/20261004000000_heltec_lorawan_mvp.sql`](supabase/migrations/20261004000000_heltec_lorawan_mvp.sql)

- Conserva `nodos` y añade `ttn_device_id`, `deveui`, `lat`, `lng`
- Crea `sensor_readings`, `risk_events`, vista `nodos_heltec_dashboard`
- Realtime en INSERT de lecturas y riesgos
- RLS: lectura anon; escritura solo service role (Edge Function)

Aplicar en **SQL Editor** o:

```bash
npx supabase link --project-ref efmznvykjxvsjzuuhhzr
npx supabase db push
```

### Edge Function `ttn-uplink`

[`supabase/functions/ttn-uplink/index.ts`](supabase/functions/ttn-uplink/index.ts)

Desplegada en:

`https://efmznvykjxvsjzuuhhzr.supabase.co/functions/v1/ttn-uplink`

En TTN (app `heltec-v3-peru`) → Integrations → Webhooks → **Uplink message**, URL de arriba.  
Los beacons `mode: beacon` se ignoran (HTTP 200, sin insertar).

Nodos sembrados:

| UI | `ttn_device_id` | DevEUI |
|----|-----------------|--------|
| Nodo 1 | `heltec-wifi-lora-32-v3` | `70B3D57ED0079581` |
| Nodo 2 | `heltec-nodo-2` | `70B3D57ED0079582` |
| Nodo 3 | `heltec-nodo-3` | `70B3D57ED0079584` |

---

## Decoder TTN (referencia)

Usar el decoder del handoff (14 bytes big-endian, `/10` en temps/humedad/presión/ángulos). Puerto de aplicación **2**.

---

## Estructura

```text
src/
  stores/fireStore.ts       # estado + Realtime Heltec
  services/                 # nodos, lecturas, risk_events
  constants/risk.ts         # umbrales ambientales
  views/                    # Dashboard, Devices, Alerts, Management
supabase/
  migrations/               # schema MVP
  functions/ttn-uplink/     # webhook TTN
firmware/
  nodo-1 … nodo-3/          # sketches Heltec (secrets.h no se versiona)
```

---

## Licencia / notas

Proyecto académico. No commitear `.env` ni AppKey/AppEUI del dispositivo.
