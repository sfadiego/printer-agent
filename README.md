# Print Agent

Agente local de impresión para impresoras térmicas USB. Actúa como puente entre una aplicación web y una impresora USB conectada al equipo, usando WebSocket en `localhost` para recibir los bytes ESC/POS generados por el backend y enviarlos directamente a la impresora.

## ¿Cómo funciona?

```
[App Web (cloud)]
      │
      │  GET /api/order/:id/print/bytes
      ▼
[Backend Laravel]  ──→  genera bytes ESC/POS
      │
      ▼
[Navegador (React)]  ──→  ws://localhost:8765  ──→  [Print Agent]  ──→  [Impresora USB]
```

1. El backend genera el ticket en formato ESC/POS y lo retorna como bytes crudos.
2. El navegador recibe los bytes y los envía al agente local por WebSocket.
3. El agente los envía a la impresora usando CUPS (macOS/Linux) o copia directa (Windows).

---

## Requisitos

- **macOS / Linux:** CUPS instalado (viene por defecto en macOS).
- **Windows:** Impresora compartida en red local (ver instrucciones abajo).
- **Node.js 18+** (solo si corres desde el código fuente).

---

## Opción A — Ejecutable (recomendada para clientes)

No requiere instalar Node.js.

### 1. Construir los ejecutables

```bash
npm install
npm run build
```

Se generan en la carpeta `dist/`:
```
dist/
├── print-agent-macos    ← macOS
├── print-agent-win.exe  ← Windows
└── config.json          ← configuración (se copia automáticamente)
```

### 2. Configurar

Editar `config.json` junto al ejecutable:

```json
{
  "printer": "NOMBRE_DE_TU_IMPRESORA",
  "port": 8765
}
```

Para conocer el nombre exacto de la impresora:

- **macOS / Linux:**
  ```bash
  lpstat -p
  ```
- **Windows:** ver sección "Configuración en Windows" más abajo.

### 3. Ejecutar

- **macOS:** doble clic en `print-agent-macos` o desde Terminal:
  ```bash
  ./print-agent-macos
  ```
- **Windows:** doble clic en `print-agent-win.exe`.

Dejar la ventana abierta mientras se usa el sistema.

#### Nota macOS — alerta de seguridad

La primera vez que se ejecuta, macOS muestra:
> *"No se puede verificar el desarrollador"*

Ir a **Preferencias del Sistema → Privacidad y Seguridad → Abrir de todas formas**.

#### Nota Windows — SmartScreen

Windows puede mostrar una advertencia. Clic en **"Más información" → "Ejecutar de todas formas"**.

---

## Opción B — Desde el código fuente

```bash
npm install
npm start
```

### Variables de entorno (alternativa a config.json)

```bash
PRINTER_NAME=EPSON_TM_T20 AGENT_PORT=8765 npm start
```

---

## Inicio automático con el sistema

### macOS — launchd

Crear `~/Library/LaunchAgents/com.pos.printagent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pos.printagent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/ruta/a/print-agent-macos</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/print-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/print-agent-error.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.pos.printagent.plist
```

### Windows — Tarea programada

1. Abrir **Administrador de tareas** → Crear tarea básica.
2. Disparador: **Al iniciar sesión**.
3. Acción: iniciar `print-agent-win.exe`.

---

## Mensajes en consola

| Mensaje | Significado |
|---|---|
| `Listo — esperando conexiones` | Agente corriendo correctamente |
| `Navegador conectado` | El sistema web se conectó |
| `Recibidos X bytes — imprimiendo...` | Trabajo de impresión recibido |
| `Impresión OK` | Ticket enviado a la impresora |
| `Error: lp: ...` | Problema con CUPS o nombre de impresora incorrecto |
| `Puerto 8765 en uso` | Ya hay una instancia del agente corriendo |

---

## Configuración en Windows

El agente imprime enviando bytes ESC/POS a una impresora compartida en red local. Se requiere:

### 1. Compartir la impresora

1. Ir a **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**.
2. Clic en la impresora térmica → **Propiedades de la impresora**.
3. Pestaña **Compartir** → marcar **Compartir esta impresora**.
4. Anotar el **Nombre del recurso compartido** (puede ser diferente al nombre de la impresora).

> ⚠️ El campo `printer` en `config.json` debe ser el **nombre del recurso compartido**, no el nombre de pantalla de la impresora.

### 2. Habilitar el compartir archivos e impresoras

En el **Firewall de Windows** asegurarse de que esté habilitada la regla  
**"Compartir archivos e impresoras"** para redes privadas.

### 3. Verificar la conexión

Desde un símbolo del sistema (`cmd`) ejecutar:
```cmd
net view \\localhost
```
Debe aparecer la impresora en la lista de recursos compartidos.

---

## Solución de problemas

**El navegador no se conecta al agente**
- Verificar que el agente esté corriendo y que la consola muestre `Listo`.
- Verificar que el puerto 8765 no esté bloqueado por un firewall local.
- **Windows:** Si el agente está corriendo pero el navegador dice "no conectado", es un problema de resolución de `localhost`. En Windows 10/11, `localhost` puede resolverse a IPv6 (`::1`) mientras versiones anteriores usaban IPv4 (`127.0.0.1`). Esto se resuelve usando la versión del agente >= 1.1.0 (que ya escucha en ambas).

**Error al imprimir en macOS/Linux**
- Verificar el nombre de la impresora con `lpstat -p`.
- El agente normaliza automáticamente guiones (`-`) a guiones bajos (`_`) en macOS, ya que CUPS registra los nombres así. Por ejemplo, `OFICHIDO-POS-58` en `config.json` se envía como `OFICHIDO_POS_58` a CUPS.

**La impresora imprime en blanco (Windows)**
- El spooler de Windows convierte los bytes ESC/POS a formato GDI antes de enviarlos, lo que produce papel en blanco. El agente detecta automáticamente el puerto físico de la impresora (USB001, COM1, etc.) y escribe directamente al dispositivo para evitarlo.
- Si sigue imprimiendo en blanco, verificar en la consola del agente qué puerto detectó. Si dice "fallback a impresora compartida", el nombre en `config.json` no coincide exactamente con el nombre de la impresora en Windows. Ejecutar `wmic printer list brief` para ver los nombres exactos.

**La impresora imprime caracteres extraños**
- La impresora no es compatible con ESC/POS o el driver está procesando los bytes. Verificar que la cola CUPS use el driver correcto para impresoras térmicas.

**La app es HTTPS y el agente no conecta en Firefox/Safari**
- Chrome permite conexiones `ws://localhost` desde páginas HTTPS. Firefox y Safari pueden bloquearlo. Usar Chrome como navegador principal para el POS.

---

## Stack

- **Runtime:** Node.js 18
- **WebSocket:** [ws](https://github.com/websockets/ws)
- **Empaquetado:** [pkg](https://github.com/vercel/pkg)
- **Protocolo de impresión:** ESC/POS via CUPS (`lp -o raw`) en macOS/Linux, copia directa en Windows
