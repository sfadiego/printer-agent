@echo off
echo Reiniciando cola de impresion...
net stop spooler
net start spooler
echo Cola de impresion reiniciada.
pause
