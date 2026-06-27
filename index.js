const { WebSocketServer } = require("ws");
const { exec }            = require("child_process");
const fs                  = require("fs");
const os                  = require("os");
const path                = require("path");

// ─── Configuración ────────────────────────────────────────────────────────────

// Al empaquetar con pkg, el ejecutable vive en un directorio temporal interno.
// process.execPath apunta al binario real, así buscamos config.json junto a él.
const execDir    = path.dirname(process.execPath);
const configPath = path.join(execDir, "config.json");

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {
    console.error(`\n[print-agent] ERROR: No se encontró config.json en:\n  ${configPath}\n`);
    console.error("Crea el archivo config.json junto al ejecutable con este contenido:");
    console.error('  { "printer": "NOMBRE_DE_TU_IMPRESORA", "port": 8765 }\n');
    process.exit(1);
}

const PRINTER = config.printer;
const PORT    = config.port || 8765;

if (!PRINTER) {
    console.error('[print-agent] ERROR: El campo "printer" está vacío en config.json.');
    process.exit(1);
}

// ─── Impresión ────────────────────────────────────────────────────────────────

function printBytes(data, callback) {
    const tmpFile = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, data);

    const platform = process.platform;

    if (platform === "darwin" || platform === "linux") {
        const cmd = `lp -d "${PRINTER}" -o raw "${tmpFile}"`;
        exec(cmd, (err, _stdout, stderr) => {
            fs.unlinkSync(tmpFile);
            if (err) return callback(new Error(stderr || err.message));
            callback(null);
        });
    } else if (platform === "win32") {
        const cmd = `copy /b "${tmpFile}" "\\\\localhost\\${PRINTER}"`;
        exec(cmd, (err, _stdout, stderr) => {
            fs.unlinkSync(tmpFile);
            if (err) return callback(new Error(stderr || err.message));
            callback(null);
        });
    } else {
        fs.unlinkSync(tmpFile);
        callback(new Error(`Plataforma no soportada: ${platform}`));
    }
}

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT, host: "127.0.0.1" });

console.log(`[print-agent] Impresora : ${PRINTER}`);
console.log(`[print-agent] Puerto    : ${PORT}`);
console.log(`[print-agent] Listo — esperando conexiones en ws://localhost:${PORT}\n`);

wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[print-agent] Navegador conectado (${ip})`);

    ws.on("message", (data) => {
        console.log(`[print-agent] Recibidos ${data.length} bytes — imprimiendo...`);

        printBytes(data, (err) => {
            if (err) {
                console.error("[print-agent] Error:", err.message);
                ws.send(JSON.stringify({ ok: false, error: err.message }));
            } else {
                console.log("[print-agent] Impresión OK");
                ws.send(JSON.stringify({ ok: true }));
            }
        });
    });

    ws.on("close", () => console.log("[print-agent] Navegador desconectado"));
    ws.on("error", (err) => console.error("[print-agent] Error WS:", err.message));
});

wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`[print-agent] ERROR: El puerto ${PORT} ya está en uso.`);
        console.error("¿Ya está corriendo el agente? Ciérralo antes de abrir uno nuevo.");
    } else {
        console.error("[print-agent] Error del servidor:", err.message);
    }
    process.exit(1);
});
