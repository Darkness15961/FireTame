# Correcciones de arquitectura, por ubicación en el Word

**Vigente para el texto.** El nodo transmite **cada 15 minutos**. En cada ciclo toma **cinco lecturas locales** del DHT22 y del MQ135 y descarta la que se aparta del resto, para que a la base de datos llegue el valor ya discriminado. No redactar un periodo de 60 s ni una media de tres muestras.

El resto de este archivo se escribió antes de esa decisión. Si un apartado de abajo dice 60 s o tres muestras, manda el párrafo anterior.

Documento de tesis: *Sistema Basado en Internet de las Cosas en la Gestión de Información de Incendios Forestales*.

Sensores de esta versión del texto: **solo DHT22 y MQ135**. No agregar otros transductores.

El esquema de tres capas se mantiene. En cada fila se indica el capítulo, el numeral y qué hay que cambiar ahí. Lo demás del apartado puede quedarse.

---

## Resumen y abstract

No describen la arquitectura. No hace falta reescribirlos por el diseño del sistema.

Sí hay que volver a tocarlos **después** de cerrar el capítulo IV, porque repiten cifras que hoy no coinciden con el resto del documento:

| Dónde | Frase actual | Dejar |
|---|---|---|
| Resumen, párrafo de hallazgos | Integridad 99,75 %; autonomía superior a 145 días; alerta en 4,97 s; verdaderos positivos 99,87 %; falsos positivos 3,16 % | Los mismos números que queden en 4.3, en el capítulo V y en las conclusiones. Hoy la discusión usa 99,79 % y el capítulo III usa 6,405 s y 3,75 % |
| Abstract | Las mismas cifras, más “rateo” en la frase de falsos positivos | Misma unificación. Corregir esa palabra |

---

## Introducción

| Dónde | Qué dice | Corrección |
|---|---|---|
| Párrafo que anuncia el capítulo IV | Atribuye la integridad de la telemetría al “cómputo en el borde” | El borde del nodo solo filtra (media de 3 muestras). La alerta la calcula el servidor. Ajustar esta frase cuando el capítulo IV ya esté corregido |

El resto de la introducción no describe protocolos ni hardware. No se toca.

---

## Capítulo I. Planteamiento del problema

### 1.5 Limitaciones de la investigación

Segundo párrafo, el del MQ-135.

| Qué dice | Corrección |
|---|---|
| El ciclo de reposo profundo interrumpe el régimen térmico del sensor y, antes de cada lectura, hace falta precalentamiento para estabilizar “la medición de partes por millón” | El MQ135 de este prototipo se registra como cuentas del ADC (0 a 4095), no como ppm. Si se mantiene la limitación de precalentamiento, redactarla sobre la estabilidad de esa lectura analógica, sin unidad ppm |

El párrafo del DHT22 y del presupuesto puede quedarse. El de la quema controlada en caja también.

### 1.6.2 Variables

No cambiar la definición de las tres capas. No aparece aquí el detalle de protocolos que hay que corregir.

---

## Capítulo II. Marco teórico

### 2.2.3 Arquitectura y fundamentos de IoT

**Apartado “Edge Computing”.**

| Qué dice | Corrección |
|---|---|
| El nodo identifica umbrales de riesgo y prioriza el envío de alertas | El nodo promedia tres muestras y arma la trama. No clasifica el incendio ni cambia el periodo de transmisión según el riesgo. Los umbrales se evalúan en el servidor, al recibir el uplink |

**Apartado “Estándares de interoperabilidad”.**

| Qué dice | Corrección |
|---|---|
| Cita LoRaWAN y MQTT como protocolos del prototipo | Dejar LoRaWAN. Quitar MQTT. En este sistema el nodo no publica en un broker. HTTP aparece después, entre The Things Network y Supabase, y entre el navegador y la base de datos |

### 2.2.4 Tecnología LPWAN y LoRaWAN

Esta sección está bien encaminada (CSS, estrella de estrellas, Clase A, RSSI, SNR, tiempo en el aire).

Agregar, al cierre de “Clases de dispositivos”, una frase que amarre el prototipo:

> El nodo opera en Clase A: transmite y solo después abre ventanas cortas de recepción.

No hace falta reescribir Chirp Spread Spectrum ni los parámetros RSSI y SNR.

### 2.2.5 Sistemas de monitoreo y detección

**Apartado “Sensores de gases y partículas (MQ-135)”.**

| Qué dice | Corrección |
|---|---|
| Trata la salida como concentración de monóxido o de CO₂, sujeta a calibración en ppm | El apartado teórico puede explicar que el MQ135 responde a varios gases. En la frase que baja al prototipo, la magnitud usada es el ADC de 12 bits, comparado con una línea base del mismo nodo. No afirmar que el sistema entrega ppm |

El triángulo del fuego y el párrafo de redes WSN pueden quedarse. No incorporar sensores que esta versión del documento no usa.

### 2.2.6 Gestión de información y toma de decisiones

**Apartado “Flujos de datos en tiempo real con HTTP”.** Este párrafo ya dice que no se usa un broker MQTT. Conservarlo. Precisar el recorrido:

> El nodo envía LoRaWAN. The Things Network reenvía el uplink con un webhook HTTP hacia Supabase. El tablero consulta por HTTPS y recibe inserciones por WebSocket. El nodo no hace peticiones REST.

**Apartado “Visualización de datos y tableros de control”.**

| Qué dice | Corrección |
|---|---|
| El tablero superpone alertas sobre mapas de vulnerabilidad y muestra rutas de evacuación | El tablero muestra la posición cargada de cada nodo, las series de temperatura, humedad y gas, y la lista de alertas. No calcula rutas de evacuación ni un modelo de propagación |

El párrafo del SINAGERD puede quedarse.

### 2.3 Marco conceptual

No hay corrección de arquitectura. Las definiciones de nodo, gateway y LoRaWAN sirven.

---

## Capítulo III. Metodología

### 3.2.1 Población — criterios de inclusión

Segundo criterio.

| Qué dice | Corrección |
|---|---|
| “Payload completo codificado (temperatura, humedad, CO₂ y coordenadas GPS)” | “Payload con temperatura y humedad del DHT22 y la lectura analógica del MQ135” |

Tercer criterio.

| Qué dice | Corrección |
|---|---|
| “Logs del servidor de red LoRaWAN / Broker MQTT” | “Registros del uplink en The Things Network y filas almacenadas en Supabase” |

El intervalo “una trama cada 15 minutos” y el total de 4320 tramas están en el párrafo anterior a los criterios. Eso se corrige junto con la tabla 2 y con el firmware del capítulo IV: el sketch transmite cerca de cada **60 s**, no cada 15 minutos. Si los 4320 salieron de un ensayo distinto, hay que decirlo en este párrafo y no mezclarlo con el firmware de 60 s. Si el ensayo usó este firmware, hay que recalcular la población.

### 3.3.2 Instrumentos — Ficha de registro de datos

La ficha está en el anexo (columna **CO2**). El cuerpo la cita en 3.3.2.

| Qué dice | Corrección |
|---|---|
| Columna CO2 | Encabezado “MQ135 (ADC)”. Misma corrección en el anexo de la ficha |

### 3.3 Confiabilidad — energía, latencias y falsos positivos

**Tabla 2** (consumo, columnas de tiempo dormido 597 s y tiempo activo ~3 s) y el párrafo que proyecta más de 145 días.

| Qué dice | Corrección |
|---|---|
| Presenta el ciclo de 597 s dormido y ~3 s activo como el régimen del nodo desplegado, con 0,5 % activo y autonomía superior a 145 días | Dejar la tabla como medición de banco. Añadir que el firmware que transmite no entra en reposo profundo ni usa un periodo de 597 s: el periodo de envío es de cerca de 60 s. No usar esa proyección como autonomía del prototipo en campo |

Más abajo, “Determinación de latencias” y “Evaluación del algoritmo de alerta”.

| Qué dice | Dónde se contradice | Corrección |
|---|---|---|
| Red 287 ms, almacenamiento 1,205 s, regla 4,913 s, total **6,405 s** | Capítulo IV y resumen usan **4,97 s** | Una sola definición: desde qué marca de tiempo hasta cuál. Un solo número en III, IV, V, resumen y conclusiones |
| Falsos positivos **3,75 %** | Tabla 13 del capítulo IV: **3,16 %** | Publicar solo el porcentaje de la matriz que se deje como definitiva |
| PDR de **100** a 500 m | El capítulo IV no repite ese 100 % con la misma muestra de 4320 | Si se conserva, indicar que es el tramo de 500 m del ensayo de confiabilidad, no el PDR de los 15 días |

### 3.5.1 Materiales

**Tabla 3, fila del MQ-135.**

| Qué dice | Corrección |
|---|---|
| Función “presencia de gases nocivos” y precisión “10–1000 ppm” | Función: índice de gas y humo. Precisión o rango: ADC de 12 bits, 0 a 4095. No ppm |

La fila del DHT22 puede quedarse.

**Párrafo “Concentrador LoRaWAN (Dragino LPS8v2)”.**

| Qué dice | Corrección |
|---|---|
| Gateway Dragino LPS8v2 | Gateway **Heltec HT-M7603**, plan US915. Este párrafo choca con el 3.5.2, donde el gateway ya está bien nombrado |

**Recursos de software.**

| Qué dice | Corrección |
|---|---|
| IDE principal: Visual Studio Code con PlatformIO | El firmware está en sketches de Arduino (C++). Dejar un solo IDE: el que se usó para grabar las placas. En 4.2.3 el documento dice Arduino IDE; las dos secciones tienen que coincidir |
| “The Things Industries” como servidor de red | The Things Network (The Things Stack), clúster nam1 |
| “Motor de reglas en la nube que dispara notificaciones al personal de emergencias” | La regla corre en la función que recibe el webhook. El resultado se ve en el tablero. No hay envío a un canal externo de brigadas |

La frase de `LoRaWan_APP.h`, `Wire.h`, `HT_SSD1306Wire.h` y `DHT.h` está bien. Conservarla.

**Mástil**, en “Infraestructura geográfica”.

| Qué dice | Corrección |
|---|---|
| Mástil de **4 m** | Unificar con 4.1.3 y con el capítulo V, que dicen **6 m**. Dejar la altura medida en campo |

### 3.5.2 Métodos

**Requisitos funcionales**, primer párrafo de “Análisis y diseño”.

| Qué dice | Corrección |
|---|---|
| “Captura periódica y por eventos” y “procesamiento local de umbrales” | Captura periódica de temperatura, humedad y ADC de gas. El filtrado local es la media de 3 muestras. El umbral de alerta no se decide en el nodo |

**Requisitos no funcionales.**

| Qué dice | Corrección |
|---|---|
| Autonomía mínima de 6 meses | Quitar los 6 meses, o pasarlos a recomendación. No salen del firmware de 60 s |
| Latencia menor a 5 s y alcance mayor a 2 km | Solo si 4.3 los mide con la misma definición. Si no, no dejarlos como requisito cumplido |

**“Capa de percepción”** (adquisición, deep sleep e interrupción).

| Qué dice | Corrección |
|---|---|
| Deep sleep del microcontrolador y despertar por interrupción cuando el gas o la temperatura cruzan el umbral | Borrar el sueño profundo y la interrupción por umbral. Dejar la media de 3 muestras y el payload de 14 bytes |

**“Capa de comunicación”.** El gateway Heltec HT-M7603, US915, sub-banda 2, canales 8 a 15 y **903,9 a 905,3 MHz** están bien. No cambiar ese párrafo. Es el texto que debe ganar sobre la tabla 4.

**“Desarrollo de la interfaz”.**

| Qué dice | Corrección |
|---|---|
| “Coordenadas GPS estáticas” | Coordenadas cargadas por el operador. El nodo no envía GPS |
| Webhook HTTP desde The Things Stack | Correcto. Conservarlo |

### 3.5.3 Tabla 4

La frase que abre la sección vuelve a nombrar el **Dragino LPS8v2**. Cambiarla al HT-M7603, igual que en 3.5.2.

| Fila | Valor escrito | Valor que debe quedar |
|---|---|---|
| Banda de frecuencia | US915 (sub-banda 2: **916,8–918,2 MHz**) | US915, sub-banda 2, **903,9–905,3 MHz**, canales 8 a 15. El rango 916,8–918,2 MHz es AU915 |
| Factor de dispersión | SF7 | SF inicial del sketch; con ADR la red puede cambiarlo. No presentar SF7 como valor fijo de todos los ensayos si los metadatos muestran otro data rate |
| Ancho de banda | 125 kHz | Puede quedarse |
| Potencia +20 dBm | Afirmada como máxima del SX1262 | Dejarla solo si ese valor está en el sketch grabado |
| Activación OTAA | Correcta | Agregar en la misma fila o en una fila nueva: Clase A, uplink no confirmado, puerto de aplicación 2 |
| Payload 14 bytes | “Tiempo en el aire menor a 60 ms” | 14 bytes se mantienen. El tiempo en el aire en SF7BW125 es del orden de 67 ms. No es la latencia hasta el tablero |

Falta una fila de periodo: **cerca de 60 s**.

---

## Capítulo IV. Presentación de resultados

### 4.1.1 Arquitectura (Figura 1)

Tres capas: se mantienen. Cambiar el texto de dos de ellas.

| Capa en el Word | Qué dice | Corrección |
|---|---|---|
| Comunicación y backend | “Protocolos de red como MQTT y HTTP Webhooks” | Quitar MQTT. Recorrido: LoRaWAN hasta el gateway HT-M7603, The Things Network, webhook HTTPS, función que recibe el POST, PostgreSQL en Supabase |
| Aplicación | “Simulaciones de propagación” y motor de alerta en la interfaz | Tablero Vue 3, mapa, gráficas de temperatura, humedad y gas, y lista de alertas. El puntaje lo calcula la función del webhook, no el navegador. No hay simulación de propagación |

Figura 1. Redibujar con esta cadena y sin MQTT:

```text
DHT22 + MQ135
    → Heltec WiFi LoRa 32 V3
      media de 3 muestras, 14 bytes, Clase A, OTAA, ~60 s
      US915 sub-banda 2 (903,9–905,3 MHz)
    → Gateway Heltec HT-M7603
    → The Things Network (nam1)
    → HTTPS POST (webhook)
    → Función que persiste la lectura y calcula el riesgo
    → PostgreSQL (Supabase)
    → Tablero Vue 3 (REST + WebSocket)
```

### 4.1.2 Hardware (Figura 2)

Sensores del texto: DHT22 y MQ135. No agregar otro.

| Qué dice | Corrección |
|---|---|
| El MQ135 “evalúa la presencia de dióxido de carbono (CO₂)” | El MQ135 entrega una lectura analógica del ADC. En el documento se usa como índice de gas y humo, no como concentración de CO₂ |

El DHT22 por un hilo puede quedarse. La Figura 2 solo debe mostrar las conexiones de esos dos sensores con el Heltec.

### 4.1.3 Topología (Figura 3)

| Qué dice | Corrección |
|---|---|
| Mástil de **6 m** y cobertura de más de 2 km | Unificar la altura con 3.5.1. El “más de 2 km” solo se deja si el capítulo 4.3 midió ese alcance. La topología en estrella de estrellas y el envío directo al gateway están bien |
| The Things Network recibe y deriva por HTTP | Correcto. Conservarlo |

### 4.1.4 Cómputo en el borde (Figura 4)

Este apartado hay que sustituirlo. No sirve con un retoque de una frase.

| Qué dice ahora | Qué debe decir |
|---|---|
| Máquina de estados en el nodo: verde cada 15 minutos en sueño profundo, amarillo con más muestreo, naranja con comprobación cruzada, rojo por superación instantánea | El nodo no clasifica el incendio. En cada ciclo lee DHT22 y MQ135, promedia 3 muestras y transmite cerca de cada 60 s. Los colores salen de un puntaje de 0 a 100 calculado en el servidor |

Puntaje para escribir en este apartado (umbrales editables en el tablero):

| Condición | Puntos |
|---|---|
| Temperatura DHT ≥ 35 °C | +20 |
| Temperatura DHT ≥ 40 °C | +15 más |
| Humedad ≤ 30 % | +20 |
| Humedad ≤ 20 % | +15 más |
| MQ135 ≥ línea base + 400 | +20 |
| MQ135 ≥ línea base + 900 | +25 más |

| Puntaje | Color |
|---|---|
| 0–24 | Verde |
| 25–49 | Amarillo |
| 50–74 | Naranja |
| 75–100 | Rojo |

Línea base del MQ135: media de las 10 primeras lecturas válidas de ese nodo. Si todavía no hay, se usa 1500.

Corroboración, también en el servidor:

- Dos grupos distintos (temperatura, humedad o gas) sobre umbral: la alerta se guarda en ese uplink.
- Un solo grupo: hace falta que otro de los dos uplinks anteriores, dentro de 5 minutos, también supere el mínimo.

Si se conserva la Figura 4, dibujarla como estados del **servidor**, no del microcontrolador.

### 4.1.5 Flujo de datos (Figura 5)

| Paso escrito | Corrección |
|---|---|
| Transmisión hacia el gateway **Dragino LPS8v2** | Gateway **Heltec HT-M7603** |
| “La API de Supabase valida el token del dispositivo” | The Things Network hace el POST. La función reconoce el nodo por su identificador o por el DevEUI. Si está configurada, la cabecera `x-ttn-secret` autentica el origen del webhook |

Secuencia que debe quedar en la figura y en la lista:

1. Lectura de temperatura, humedad y ADC de gas.
2. Trama de 14 bytes y uplink LoRaWAN.
3. El gateway reenvía a The Things Network (RSSI, SNR, CRC, hora).
4. Webhook HTTPS con el JSON.
5. La función guarda la lectura, marca si el sensor falló y, si hay corroboración, guarda la alerta.
6. El tablero se entera por el canal en vivo de Supabase.

### 4.1.6 Diseño de la base de datos

Sustituir las entidades de este apartado y el MER del anexo.

| Entidad escrita | Qué hacer |
|---|---|
| `Tipos_Sensores` | Quitarla. No está en el esquema usado |
| `Lecturas_Sensores` | Sustituir por `sensor_readings`: una fila por uplink |
| `Alertas` | Sustituir por `risk_events`. La fila se crea al corroborar, no en cada lectura. El cierre de la alerta queda en `atendida_at` |
| `Nodos` con “coordenadas GPS fijas” y “estado de batería” | `nodos`: identificador en The Things Network, DevEUI, habilitado, latitud y longitud opcionales cargadas a mano. Sin batería enviada por radio y sin GPS del nodo |

Tablas que faltan y hay que nombrar:

| Tabla | Para qué |
|---|---|
| `umbrales_alerta` | Umbrales que el operador edita. Una sola fila |
| `condiciones_prueba` | Distancia, obstáculos, altura, clima y situación de la prueba |
| `health_checks` | Disponibilidad de Supabase, no del nodo |

### 4.1.7 Interfaz (el cuerpo la llama Figura 7; el índice, Figura 6)

Primero, unificar el número de figura con el índice.

| Componente escrito | Corrección |
|---|---|
| Mapa con geolocalización “exacta” y marcador según la máquina de estados del nodo | Mapa con la coordenada cargada en el registro del nodo. El color sale del puntaje del servidor |
| Gráficas solo de temperatura y humedad | Agregar la serie del MQ135 en ADC. Una gráfica por magnitud |
| Consola con aviso auditivo, coordenadas del foco y despacho de brigadas | Lista de alertas en pantalla. No hay alarma sonora ni botones de despacho de brigadas |

### 4.2.1 Product Backlog (Tabla 5)

| Historia | Dónde está | Corrección |
|---|---|---|
| HU-02 | Sprint 1 | Puede quedarse: media de 3 muestras |
| HU-07 | Sprint 3 | No es “la base de datos” la que dispara la alerta con un trigger. La función del webhook escribe `risk_events` |
| HU-10 | Sprint 4 | Quitar “notificación auditiva” si la interfaz no reproduce sonido |
| HU-11 | Sprint 5 | Deep sleep no está en el sketch. Pasar la historia a trabajo futuro, o marcarla como ensayo de banco y no como incremento entregado |

HU-01, HU-03, HU-04, HU-05, HU-06, HU-08, HU-09 y HU-12 pueden quedarse si el entregable se describe como T, H y ADC, no como CO₂.

### 4.2.2 Sprints

| Sprint | Frase a cambiar |
|---|---|
| Sprint 1, entregable | “Concentraciones analógicas de gas CO₂” → lectura ADC del MQ135 |
| Sprint 2, objetivo y entregable | “Dragino LPS8v2” → HT-M7603. “Canal bidireccional punto a punto” → uplink LoRaWAN de Clase A hacia The Things Network. La clase A no es un enlace de aplicación abierto en los dos sentidos |
| Sprint 3 | El motor de reglas no son triggers de PostgreSQL. Es la función que recibe el webhook |
| Sprint 4 | Quitar “alertas auditivas”. El canal en vivo es de lectura: el navegador no ordena al nodo |

### 4.2.3 Firmware

Primera frase del apartado.

| Qué dice | Corrección |
|---|---|
| “Desarrollado en lenguaje Python sobre el entorno Arduino IDE” | Desarrollado en **C++** en Arduino IDE, sketches del nodo 1, 2 y 3. Librería `LoRaWan_APP.h` |

El párrafo de la máquina de estados y el apartado **“Manejo de interrupciones y reposo profundo”** se eliminan. No hay despertar por temporizador de 15 minutos ni por comparador analógico.

Se conservan, con este alcance:

- Media de 3 muestras en el MQ135 y en el DHT22.
- Payload de 14 bytes.
- Figuras 7, 8 y 9 si el código de la captura corresponde a esa lectura, a ese filtro y al decoder. Volver a numerarlas para que no choquen con el wireframe.

### 4.2.4 Nube y backend

Sustituir el mecanismo.

| Qué dice | Corrección |
|---|---|
| Un trigger en pgSQL sobre `Lecturas_Sensores` inserta en `Alertas` y empuja el WebSocket | The Things Network aplica el Payload Formatter y hace el POST. La función del webhook inserta `sensor_readings`, descarta lecturas imposibles (DHT en 0 °C y 0 %, ADC en 0 o en 4095) y solo entonces calcula el puntaje. `risk_events` se llena si hay corroboración. El tablero escucha las inserciones |

El párrafo del Payload Formatter en JavaScript, dentro de la consola de The Things Network, puede quedarse.

### 4.2.5 Frontend Vue 3

Estos archivos no existen. Hay que cambiar los nombres en este apartado.

| Nombre escrito | Qué poner |
|---|---|
| `NocDashboard.vue` | `Dashboard.vue`, ruta `/` |
| `MapModule.vue` con Leaflet/Mapbox | Mapa con Leaflet, dentro del tablero. Sin Mapbox |
| `AlertConsole.vue` con modal sonoro y botones de brigadas | `Alerts.vue`, ruta `/alerts`: cola de alertas y umbrales |
| `MetricsChart.vue` con Chart.js o ECharts, y “CO₂” | Gráficas con ApexCharts, una por magnitud: temperatura, humedad y ADC del MQ135 |

Rutas que el apartado no menciona y conviene citar en el mismo párrafo: `/devices`, `/devices/:id`, `/management` y `/bitacora`.

| Qué dice del WebSocket | Corrección |
|---|---|
| Canal bidireccional; el trigger avisa en menos de 100 ms | Suscripción de lectura de Supabase Realtime. No es un canal para enviar órdenes al nodo. No afirmar “menos de 100 ms” si esa cifra no está medida aparte del tiempo total de alerta |

### 4.3.1 Capa de percepción

| Dónde | Corrección |
|---|---|
| Tabla 6, columna “Autonomía proyectada” y el párrafo de 145 días | Misma nota que en la tabla 2: proyección de banco, no autonomía del firmware que transmite cada 60 s |
| Tabla 10, encabezado “CO₂ Prom. (ppm)” y “CO₂ CV” | “MQ135 (ADC)”. Los promedios de reposo cercanos a 540 y los de evento cercanos a 1860–1996 se leen como cuentas del conversor |
| Párrafos “Comportamiento del MQ-135” | Quitar “ppm”, “concentración de CO₂” y “aumento superior al 260 %” en partes por millón. El salto se describe en cuentas de ADC frente a la línea base |
| Párrafo que atribuye la alerta a “la máquina de estados del firmware” | La separación entre reposo y evento la hace el puntaje del servidor |

La prueba Z, Bonferroni y Fisher no cambian de método. Solo la cifra global debe decir **99,75 %** (4309/4320) en este apartado, en el resumen y en el capítulo V.

### 4.3.2 Capa de comunicación

| Dónde | Corrección |
|---|---|
| Título y párrafo de “Latencia de envío” (Tabla 12, medianas 1,37 s, 1,42 s y 1,42 s) | Esas medianas no son el tiempo en el aire. El tiempo en el aire de una trama corta en SF7 es de decenas de milisegundos. Nombrar la etapa real: nodo a gateway, gateway a The Things Network, o red a base de datos, según las marcas de tiempo que se hayan restado |
| ANOVA de RSSI y SNR | Puede quedarse. No mezcla protocolos |

### 4.3.3 Capa de aplicación

La matriz (Tabla 13) y el tiempo de 4,97 s (Tabla 14) pueden quedarse si son el resultado definitivo.

| Qué ajustar en el texto, no en la cuenta | Corrección |
|---|---|
| “Motor de reglas” sin decir dónde corre | Escribir que la clasificación ocurre en la función del webhook, con los umbrales de 4.1.4 |
| 883 eventos de alerta frente a 772 eventos críticos de la matriz | Explicar en una frase por qué las dos muestras no son iguales, o usar una sola cohorte |

---

## Capítulo V. Discusión

### 5.1 Capa de percepción

| Qué dice | Corrección |
|---|---|
| Integridad **99,79 %** | **99,75 %**, igual que la tabla del capítulo IV |
| El resultado se explica por cómputo en el borde que distingue el ruido de fondo de “la liberación de CO₂” | El filtro de 3 muestras está en el nodo. La decisión de alerta y la lectura de gas en ADC están en el servidor. Quitar CO₂ en ppm |
| Autonomía de 145 días y reposo profundo como régimen del despliegue | Igual que en 1.5, 3.3 y 4.3.1: medición de banco, no ciclo del firmware |

### 5.2 Capa de comunicación

| Qué dice | Corrección |
|---|---|
| Mástil de **6 m** | La misma altura que en 3.5.1 y 4.1.3 |
| “Latencia de radio de aproximadamente 1,4 s” y, en la misma frase, tiempo en el aire inferior a 60 ms | Separar las dos magnitudes. 1,4 s es la latencia de la etapa medida en la tabla 12. El tiempo en el aire es otra cifra, del orden de 67 ms en SF7BW125, no “inferior a 60 ms” |

El ANOVA, el CSS y la banda US915 pueden quedarse.

### 5.3 Capa de aplicación

| Qué dice | Corrección |
|---|---|
| “Triggers y funciones almacenadas en pgSQL” que evalúan el umbral al insertar y avisan “en menos de 100 ms” | Función del webhook. El tablero se actualiza por WebSocket de Supabase. Sin la cota de 100 ms si no está medida |
| La alerta crítica exige la regla de la máquina de estados del firmware, cruzando DHT22 y MQ135 | Esa comprobación cruzada es la corroboración del servidor descrita en 4.1.4 |

### 5.4 Implicancias

| Apartado | Corrección |
|---|---|
| 5.4.1 | El payload de 14 bytes y LoRaWAN pueden quedarse. No atribuir al nodo la clasificación del riesgo |
| 5.4.2 | Sin cambio de arquitectura |
| 5.4.3 | El tiempo de 4,97 s se mantiene solo si es el número único elegido en 3.3 y 4.3.3 |

---

## Conclusiones

| Conclusión | Corrección |
|---|---|
| Primera | 99,75 %, no 99,79 %. La media de 3 muestras se conserva. El reposo profundo y los 0,47 mA solo como ensayo de banco |
| Segunda | Puede quedarse en LoRaWAN, US915 y estrella de estrellas. Si se cita un PDR, poner el porcentaje y la muestra. No llamarlo solo “óptimo” |
| Tercera | El motor está en la función del webhook y el tablero en Vue 3. TPR 99,87 % y FPR 3,16 % solo si la tabla 13 es la que se publica. Quitar la contradicción con el 3,75 % del capítulo III |
| Cuarta, la general | Puede quedarse. No agrega un protocolo distinto |

---

## Recomendaciones

Pueden quedarse como trabajo futuro: mejor calibración del MQ135, más gateways, mensajería externa y modelos de propagación.

| Qué dice | Corrección |
|---|---|
| Primera recomendación: reemplazar paneles ya instalados por MPPT e IP68 | Redactarla como incorporación futura. En materiales el panel se describe como parte del nodo; en el firmware no hay gestión de esa carga. No dar por instalado un MPPT |
| Tercera: inteligencia artificial, viento, satélite, Telegram, WhatsApp y SMS | Correcto como extensión. No implicar que el tablero ya alerta por esos canales |
| Cuarta: malla entre nodos | Correcto como estudio futuro. La topología entregada es estrella de estrellas, no malla |

---

## Referencias

| Entrada | Corrección |
|---|---|
| [26] Manual del Dragino LPS8 | Quitarla si el gateway del documento queda en el HT-M7603. Sustituir por la ficha de ese equipo |
| [27] Especificación MQTT | Quitarla si MQTT ya no se presenta como protocolo del sistema |

El resto de la bibliografía no depende de esta corrección de arquitectura.

---

## Anexos

| Anexo | Corrección |
|---|---|
| Ficha de registro de datos, columna CO2 | “MQ135 (ADC)”, la misma que en 3.3.2 |
| Modelo entidad-relación | El índice lo numera como Anexo 8 y el capítulo IV lo cita como Anexo 11. Unificar el número. Sustituir entidades por las de 4.1.6 |
| Matriz de consistencia (Anexo 1) y operacionalización (Anexo 2) | No cambian de estructura. La fuente de datos de la capa de aplicación debe decir Supabase / tablero, no “broker” |

---

## Orden para aplicarlas

1. Capítulo IV: 4.1.1, 4.1.4, 4.1.5, 4.1.6, 4.2.3, 4.2.4 y 4.2.5.
2. Capítulo III: 3.5.1, 3.5.2, tabla 4 del 3.5.3, criterios de 3.2.1 y tabla 2.
3. Capítulo II: 2.2.3, 2.2.5 y 2.2.6.
4. Capítulo I, solo el párrafo de ppm en 1.5.
5. Capítulo V, conclusiones y los números del resumen.
6. Anexos del MER y de la ficha, y referencias [26] y [27].
