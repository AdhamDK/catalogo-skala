@echo off
rem Crea la llave de firma de la app (UNA sola vez). Guarda una copia de la carpeta keystore:
rem sin esta llave no se pueden instalar actualizaciones encima de la app.
setlocal
cd /d "%~dp0"
call comun.bat || exit /b %errorlevel%
if exist keystore\keystore.properties (
  echo Ya existe la llave en keystore\. No se crea otra.
  exit /b 0
)
if not exist keystore mkdir keystore
set "CLAVE=Sk%RANDOM%%RANDOM%%RANDOM%a"
"%JAVA_HOME%\bin\keytool.exe" -genkeypair -keystore keystore\skala-equipo.jks -alias skala -keyalg RSA -keysize 2048 -validity 10000 -storepass %CLAVE% -keypass %CLAVE% -dname "CN=Skala Equipo, O=Skala Venezuela, C=VE"
if errorlevel 1 (
  echo No se pudo crear la llave.
  exit /b 4
)
(
  echo storeFile=skala-equipo.jks
  echo storePassword=%CLAVE%
  echo keyAlias=skala
  echo keyPassword=%CLAVE%
) > keystore\keystore.properties
echo.
echo Llave creada en android\keystore\. GUARDA UNA COPIA de esa carpeta ^(Drive, pendrive^).
exit /b 0
