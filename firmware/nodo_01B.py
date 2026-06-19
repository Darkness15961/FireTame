# FireTame - Firmware nodo_01B (Raspberry Pi)
# DHT22 + MPU6050 (6 ejes) + cámara + Supabase

import os
import cv2
import numpy as np
import time
import board
import adafruit_dht
from supabase import create_client

try:
    import smbus2 as smbus
except ImportError:
    import smbus

# =========================
# CONFIG SUPABASE
# =========================
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://efmznvykjxvsjzuuhhzr.supabase.co",
)
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "TU_ANON_KEY_AQUI")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# =========================
# CONFIG SISTEMA
# =========================
NODE_ID = "nodo_01B"
INTERVAL_SENSOR = 1   # lectura sensores (segundos)
INTERVAL_SEND = 10    # envío a BD (segundos)
BUFFER_SIZE = 10      # ~10 lecturas por ciclo de envío

# IDs tipos_sensores (ejecutar 003_mpu6050_axes.sql en Supabase)
SENSOR_TEMP = 1
SENSOR_HUM = 2
SENSOR_ACC_X = 8
SENSOR_ACC_Y = 9
SENSOR_ACC_Z = 10
SENSOR_GYRO_X = 11
SENSOR_GYRO_Y = 12
SENSOR_GYRO_Z = 13

# =========================
# SENSOR DHT22
# =========================
dhtDevice = adafruit_dht.DHT22(board.D4)
temp_buffer = []
hum_buffer = []

# =========================
# SENSOR MPU6050 (Acelerómetro / Giroscopio)
# =========================
acc_buffer = []
gyro_buffer = []

try:
    bus = smbus.SMBus(1)
    MPU6050_ADDR = 0x68
    bus.write_byte_data(MPU6050_ADDR, 0x6B, 0)  # Wake up
except Exception as e:
    print("Error init MPU6050:", e)
    bus = None


def read_mpu_word(reg):
    if bus is None:
        return 0
    try:
        h = bus.read_byte_data(MPU6050_ADDR, reg)
        l = bus.read_byte_data(MPU6050_ADDR, reg + 1)
        value = (h << 8) + l
        if value >= 0x8000:
            return -((65535 - value) + 1)
        return value
    except Exception:
        return 0


# =========================
# CÁMARA (libcamera pipeline)
# =========================
cap = cv2.VideoCapture(
    "libcamerasrc ! video/x-raw,width=640,height=480,framerate=30/1 ! appsink",
    cv2.CAP_GSTREAMER,
)


# =========================
# DETECCIÓN HUMO (HEURÍSTICA)
# =========================
def detect_smoke(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (15, 15), 0)
    diff = cv2.absdiff(gray, blur)
    score = np.mean(diff)
    if score < 8:
        return 2   # alto riesgo
    if score < 12:
        return 1   # posible humo
    return 0       # normal


# =========================
# LECTURA SENSORES
# =========================
def read_sensors():
    global temp_buffer, hum_buffer, acc_buffer, gyro_buffer

    try:
        temp = dhtDevice.temperature
        hum = dhtDevice.humidity
        if temp is not None and hum is not None:
            temp_buffer.append(temp)
            hum_buffer.append(hum)
    except Exception as e:
        print("Error sensor DHT:", e)

    try:
        acc_x = read_mpu_word(0x3B)
        acc_y = read_mpu_word(0x3D)
        acc_z = read_mpu_word(0x3F)
        gyro_x = read_mpu_word(0x43)
        gyro_y = read_mpu_word(0x45)
        gyro_z = read_mpu_word(0x47)
        acc_buffer.append((acc_x, acc_y, acc_z))
        gyro_buffer.append((gyro_x, gyro_y, gyro_z))
    except Exception as e:
        print("Error MPU6050:", e)


# =========================
# PROMEDIO
# =========================
def get_avg():
    avg_temp = sum(temp_buffer) / len(temp_buffer) if temp_buffer else None
    avg_hum = sum(hum_buffer) / len(hum_buffer) if hum_buffer else None

    avg_acc = (0.0, 0.0, 0.0)
    avg_gyro = (0.0, 0.0, 0.0)

    if acc_buffer:
        avg_acc = (
            sum(a[0] for a in acc_buffer) / len(acc_buffer),
            sum(a[1] for a in acc_buffer) / len(acc_buffer),
            sum(a[2] for a in acc_buffer) / len(acc_buffer),
        )

    if gyro_buffer:
        avg_gyro = (
            sum(g[0] for g in gyro_buffer) / len(gyro_buffer),
            sum(g[1] for g in gyro_buffer) / len(gyro_buffer),
            sum(g[2] for g in gyro_buffer) / len(gyro_buffer),
        )

    return avg_temp, avg_hum, avg_acc, avg_gyro


# =========================
# ENVÍO SUPABASE
# =========================
def insert_lectura(tipo_sensor_id, valor, unidad):
    supabase.table("lecturas_sensores").insert({
        "nodo_id": NODE_ID,
        "tipo_sensor_id": tipo_sensor_id,
        "valor": valor,
        "unidad": unidad,
    }).execute()


def send_to_supabase(temp, hum, acc, gyro, smoke_state):
    try:
        estado = 0
        if smoke_state == 1:
            estado = 1
        elif smoke_state == 2:
            estado = 2

        if temp is not None and hum is not None:
            insert_lectura(SENSOR_TEMP, round(temp, 2), "C")
            insert_lectura(SENSOR_HUM, round(hum, 2), "%")

        # 6 ejes MPU6050 → tipos_sensores 8-13
        mpu_readings = [
            (SENSOR_ACC_X, round(acc[0], 2), "acc_x"),
            (SENSOR_ACC_Y, round(acc[1], 2), "acc_y"),
            (SENSOR_ACC_Z, round(acc[2], 2), "acc_z"),
            (SENSOR_GYRO_X, round(gyro[0], 2), "gyro_x"),
            (SENSOR_GYRO_Y, round(gyro[1], 2), "gyro_y"),
            (SENSOR_GYRO_Z, round(gyro[2], 2), "gyro_z"),
        ]
        for tipo_id, valor, unidad in mpu_readings:
            insert_lectura(tipo_id, valor, unidad)

        supabase.table("vision_ai").insert({
            "nodo_id": NODE_ID,
            "deteccion": "smoke" if smoke_state > 0 else "normal",
            "confianza": float(smoke_state),
            "estado": estado,
        }).execute()

        print("Enviado a Supabase")
    except Exception as e:
        print("Error Supabase:", e)


# =========================
# LOOP PRINCIPAL
# =========================
def main():
    global temp_buffer, hum_buffer, acc_buffer, gyro_buffer

    print("SISTEMA IOT INICIADO")
    last_send = time.time()

    while True:
        # 1. sensores cada 1s
        read_sensors()

        # 2. cámara cada ciclo
        ret, frame = cap.read()
        smoke_state = detect_smoke(frame) if ret else 0

        # 3. envío cada 10s
        if time.time() - last_send >= INTERVAL_SEND:
            avg_temp, avg_hum, avg_acc, avg_gyro = get_avg()

            print("\nDATA PROMEDIO")
            if avg_temp is not None:
                print("Temp:", round(avg_temp, 2))
                print("Hum:", round(avg_hum, 2))
            print("ACC:", [round(x, 2) for x in avg_acc])
            print("GYRO:", [round(x, 2) for x in avg_gyro])
            print("Smoke:", smoke_state)
            print("Estado:", smoke_state)

            send_to_supabase(avg_temp, avg_hum, avg_acc, avg_gyro, smoke_state)

            temp_buffer = []
            hum_buffer = []
            acc_buffer = []
            gyro_buffer = []
            last_send = time.time()

        time.sleep(INTERVAL_SENSOR)


# =========================
# RUN
# =========================
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Sistema detenido")
    finally:
        cap.release()
        try:
            dhtDevice.exit()
        except Exception:
            pass
