@echo off
echo Limpiando trabajos atascados en la cola de impresion...
echo Requiere permisos de administrador.
echo.

net stop spooler

echo Eliminando trabajos pendientes...
del /Q /F /S "%SystemRoot%\System32\spool\PRINTERS\*.*" 2>nul

net start spooler

echo.
echo Cola limpiada y spooler reiniciado.
pause
