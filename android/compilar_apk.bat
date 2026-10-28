@echo off
rem Compila la APK firmada de Skala Equipo -> android\salida\SkalaEquipo-AAAAMMDD-HHMM.apk
setlocal
cd /d "%~dp0"
call comun.bat || goto :error
rem El SDK se pasa por ANDROID_HOME (sin local.properties: asi no hay problema con la "O" de Oscar)
if not exist keystore\keystore.properties call crear_llave.bat || goto :error
echo Compilando... ^(la primera vez descarga Gradle y tarda unos minutos^)
call gradlew.bat :app:assembleRelease --no-daemon > compilar.log 2>&1
if errorlevel 1 (
  echo Fallo la compilacion. Mira android\compilar.log
  goto :error
)
if not exist salida mkdir salida
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set "FECHA=%%i"
copy /y app\build\outputs\apk\release\app-release.apk "salida\SkalaEquipo-%FECHA%.apk" > nul
echo.
echo LISTO: android\salida\SkalaEquipo-%FECHA%.apk
exit /b 0
:error
echo.
pause
exit /b 1
