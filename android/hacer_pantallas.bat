@echo off
rem Arma el paquete de PANTALLAS (sin reinstalar la app) -> android\salida\pantallas-VERSION.zip
rem Despues: subilo a GitHub Releases y pone version y enlace en la hoja Config
rem (version_pantallas y url_pantallas). Los telefonos lo usan la proxima vez que abren la app.
setlocal
cd /d "%~dp0"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy.MM.dd.HHmm"') do set "VER=%%i"
set "TMPD=%TEMP%\skala-pantallas-%VER%"
if exist "%TMPD%" rmdir /s /q "%TMPD%"
mkdir "%TMPD%"
set "SRC=..\catalogo-skala"
copy /y "%SRC%\panel.html" "%TMPD%\" > nul
copy /y "%SRC%\manifest.webmanifest" "%TMPD%\" > nul
robocopy "%SRC%\css" "%TMPD%\css" /e > nul
robocopy "%SRC%\js" "%TMPD%\js" /e > nul
robocopy "%SRC%\assets\img\web" "%TMPD%\assets\img\web" /e > nul
if not exist salida mkdir salida
set "ZIP=%CD%\salida\pantallas-%VER%.zip"
if exist "%ZIP%" del "%ZIP%"
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('%TMPD%', '%ZIP%')"
rmdir /s /q "%TMPD%"
echo.
echo LISTO: android\salida\pantallas-%VER%.zip
echo En la hoja Config: version_pantallas = %VER%  ^|  url_pantallas = enlace del .zip
pause
