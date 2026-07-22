@echo off
echo ============================================
echo   DIAGNOSTICO DE IMPRESORA - SISTEMA POS
echo ============================================
echo.

echo [1] Impresoras instaladas:
wmic printer list brief
echo.

echo [2] Nombre y puerto de cada impresora:
wmic printer get Name,PortName,Status
echo.

echo [3] Estado de la cola de impresion (Spooler):
sc query spooler
echo.

echo [4] Trabajos pendientes en la cola:
wmic printjob list brief
echo.

echo [5] Puertos de impresora disponibles:
wmic printerport list brief
echo.

pause
