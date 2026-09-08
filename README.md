# FireTame

Plataforma IoT para monitoreo y detección temprana de incendios forestales.

Conecta nodos físicos (Raspberry Pi + sensores + cámara) con un dashboard en tiempo real vía **Supabase**.

---

## Descripción

**FireTame** integra:

- **Nodos IoT reales** (Raspberry Pi) con sensores DHT22, MPU6050 y cámara
- **Backend en Supabase** (PostgreSQL + Realtime + RPC)
- **Frontend Vue 3** con dashboards, mapa, alertas y detalle por nodo
- **Panel de simulación** opcional para demos (sin tocar la BD de producción)

Monitorea:

| Sensor | Datos |
|--------|--------|
| DHT22 | Temperatura (°C), humedad (%) |
| MPU6050 | Acelerómetro X/Y/Z + giroscopio X/Y/Z |
| Cámara | Detección heurística de humo (visión) |

---

## Arquitectura

```
┌─────────────────────┐     HTTPS / Realtime      ┌──────────────────┐
│  Raspberry Pi       │ ─────────────────────────► │    Supabase      │
│  (firmware Python)  │   lecturas_sensores        │  PostgreSQL      │
│  DHT22 + MPU6050    │   vision_ai                │  RPC + Realtime  │
│  + cámara CSI       │                            └────────┬─────────┘
└─────────────────────┘                                     │
                                                            │
                                                   ┌────────▼─────────┐
                                                   │  Frontend Vue 3  │
                                                   │  Dashboard IoT   │
                                                   └──────────────────┘
```

---

## Tecnologías

### Frontend

- Vue 3 + Vite 8 + TypeScript
- Pinia, Vue Router, TailwindCSS
- Leaflet (mapa), ApexCharts (gráficos)
- Lucide Icons
- Cliente: **Bun** (no usar npm en este proyecto)

### Backend / datos

- Supabase (PostgreSQL, Realtime, funciones RPC)

### Nodo físico

- Raspberry Pi + Python 3
- DHT22, MPU6050 (I2C), cámara CSI (libcamera / OpenCV)

---

## Diagrama de conexiones (Raspberry Pi ↔ sensores)

Firmware de referencia: `firmware/nodo_01B.py`

### Esquema general

```
Raspberry Pi
├── 3.3V  ──┬── DHT22 VCC
│           └── MPU6050 VCC
├── GND   ──┬── DHT22 GND
│           └── MPU6050 GND
├── GPIO4 ──── DHT22 DATA          (board.D4)
├── GPIO2 ──── MPU6050 SDA         (I2C1)
├── GPIO3 ──── MPU6050 SCL         (I2C1)
└── CSI ────── Cámara (cinta flat)
```

### DHT22 (temperatura / humedad)

| DHT22 | Raspberry Pi | Pin físico | Nota |
|-------|--------------|------------|------|
| VCC | 3.3V | 1 | Preferible 3.3V |
| DATA | **GPIO 4** | **7** | `adafruit_dht.DHT22(board.D4)` |
| GND | GND | 6 o 9 | Tierra común |

Entre DATA y 3.3V: pull-up **4.7kΩ–10kΩ** (muchos módulos ya la incluyen).

### MPU6050 (acelerómetro / giroscopio — I2C)

| MPU6050 | Raspberry Pi | Pin físico | Nota |
|---------|--------------|------------|------|
| VCC | 3.3V | 1 | Preferible 3.3V |
| GND | GND | 6 o 9 | Tierra común |
| SDA | **GPIO 2 / SDA** | **3** | `SMBus(1)` |
| SCL | **GPIO 3 / SCL** | **5** | I2C bus 1 |
| AD0 | GND o libre | — | Dirección I2C **0x68** |

### Header 40 pines (referencia)

```
         3.3V  (1)  (2)  5V
   SDA → GPIO2 (3)  (4)  5V          ← MPU6050 SDA
   SCL → GPIO3 (5)  (6)  GND         ← MPU6050 SCL + GND
  DATA → GPIO4 (7)  (8)  GPIO14      ← DHT22 DATA
         GND   (9) (10)  GPIO15
         ...
```

### Cámara

Conector **CSI** (no GPIO). Pipeline en firmware:

```text
libcamerasrc ! video/x-raw,width=640,height=480,framerate=30/1 ! appsink
```

### Verificar I2C (MPU6050)

```bash
sudo raspi-config   # Interface Options → I2C → Enable
sudo i2cdetect -y 1
```

Debe aparecer `68` en la tabla.

---

## Mapeo de sensores en la BD

| `tipo_sensor_id` | Sensor | Unidad |
|------------------|--------|--------|
| 1 | Temperatura (DHT22) | C |
| 2 | Humedad (DHT22) | % |
| 3 | CO₂ | ppm |
| 4 | PM2.5 | µg/m³ |
| 7 | Humo (visión AI) | — |
| 8 | Acelerómetro X | acc_x |
| 9 | Acelerómetro Y | acc_y |
| 10 | Acelerómetro Z | acc_z |
| 11 | Giroscopio X | gyro_x |
| 12 | Giroscopio Y | gyro_y |
| 13 | Giroscopio Z | gyro_z |

Cada ciclo de envío (~10 s) inserta: temp, hum + **6 ejes MPU** + fila en `vision_ai`.

---

## Estados de riesgo

| Estado | Color | Descripción |
|--------|-------|-------------|
| Normal | Verde | Sin anomalías |
| Observación | Amarillo | Desviaciones leves |
| Riesgo | Naranja | Posible humo / protocolo preventivo |
| Alerta crítica | Rojo | Incendio / humo confirmado |

**Conectividad del nodo:** en línea si hay lecturas en los últimos **3 minutos** (no depende solo de `nodos.estado`).

---

## Frontend — instalación y uso

> Este proyecto usa **Bun**. No mezclar con `npm install`.

### Requisitos

- Node `^20.19` o `>=22.12`
- Bun ≥ 1.3

### Variables de entorno

Crear `.env` en la raíz:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### Comandos

```bash
bun install
bun run dev          # http://localhost:5173
bun run build
bun run type-check
```

Si falla el binding nativo de Vite/Rolldown en Linux:

```bash
rm -rf node_modules
bun install
bun add -d @rolldown/binding-linux-x64-gnu
bun run dev
```

### Estructura relevante (frontend)

```text
src/
  stores/fireStore.ts      # estado global + Realtime
  services/                # capa tipo controladores (nodos, lecturas, alertas…)
  constants/sensors.ts     # IDs de sensores + MPU6050
  constants/connection.ts  # umbral online / labels
  utils/format.ts          # hora America/Lima
  components/              # SensorCard, Mpu6050Panel, NodeReportTable…
  views/                   # Dashboard, Devices, DeviceDetail, Simulation…
```

### Zona horaria (Perú)

El frontend formatea fechas con `America/Lima` (`src/utils/format.ts`).  
Las fechas de Supabase sin sufijo `Z` se interpretan como UTC y se muestran en hora peruana.

---

## Firmware (Raspberry Pi)

Archivo de referencia: [`firmware/nodo_01B.py`](firmware/nodo_01B.py)

### Comportamiento

1. Lee sensores cada **1 s** (buffer)
2. Promedia cada **10 s**
3. Envía a Supabase: temp, hum, 6 ejes MPU, visión
4. Reinicia buffers

### Dependencias tipicas

```bash
# Sistema
sudo apt update
sudo apt install -y python3-opencv python3-smbus i2c-tools

# Entorno virtual (recomendado con paquetes del sistema para OpenCV)
cd ~/Desktop/sensores
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install adafruit-circuitpython-dht supabase smbus2 numpy
```

Si `ModuleNotFoundError: cv2`:

```bash
sudo apt install -y python3-opencv
# o recrear venv con --system-site-packages
```

### Ejecutar

```bash
export SUPABASE_URL="https://TU_PROYECTO.supabase.co"
export SUPABASE_KEY="tu_anon_key"
source venv/bin/activate
python iot_system.py   # o copiar firmware/nodo_01B.py
```

El bloque final debe ser exactamente:

```python
if __name__ == "__main__":
```

(doble guion bajo en `__name__` y `"__main__"`).

### Zona horaria en la Pi

```bash
sudo timedatectl set-timezone America/Lima
timedatectl
```

---

## Supabase — migraciones SQL

Ejecutar en **Supabase → SQL Editor**, en orden:

| Archivo | Contenido |
|---------|-----------|
| `001_rpc_functions.sql` | RPC dashboard, lecturas, historial, resumen, alertas, eventos |
| `002_online_status.sql` | Estado en línea por lecturas recientes (3 min) |
| `003_mpu6050_axes.sql` | Tipos sensor 9–13 + RPC con 6 ejes MPU |
| `004_timezone_lima.sql` | Timezone `America/Lima` en roles/BD |
| `005_timestamptz_lima.sql` | Convertir `timestamp` → `timestamptz` + defaults |

Si la carpeta `supabase/migrations/` no está en el clone, recupérala del historial del repo o vuelve a generarlas desde el equipo de desarrollo.

### Verificar hora en SQL

```sql
SELECT current_setting('TIMEZONE') AS zona, now() AS hora_peru;
SELECT created_at FROM lecturas_sensores ORDER BY created_at DESC LIMIT 3;
```

---

## SSH a la Raspberry Pi

En la Pi:

```bash
sudo systemctl enable --now ssh
hostname -I          # IP (guion + I mayúscula)
```

Desde tu PC (misma red WiFi/LAN):

```bash
ssh edu@IP_DE_LA_RASPBERRY
# ejemplo: ssh edu@192.168.1.45
```

Opcional sin contraseña:

```bash
ssh-keygen -t ed25519
ssh-copy-id edu@IP_DE_LA_RASPBERRY
```

Alias en `~/.ssh/config`:

```text
Host raspberry
    HostName 192.168.1.45
    User edu
```

Luego: `ssh raspberry`

---

## Panel de simulación

Ruta `/simulation`: inyecta escenarios de demo en el store (incendio, humo, offline, etc.).  
No reemplaza los datos reales del nodo físico; sirve para presentaciones.

---

## Objetivo del proyecto

Centro de monitoreo IoT para prevención de incendios forestales: telemetría real, alertas progresivas, visión por cámara y visualización operativa en dashboard.

---

## Licencia / notas

Proyecto académico / desarrollo IoT. No commitear claves reales en el repositorio; usar `.env` y variables de entorno en la Raspberry.
