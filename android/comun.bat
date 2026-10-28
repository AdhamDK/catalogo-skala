@echo off
rem Busca Java 17 y el SDK de Android (Android Studio) para compilar.
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if not defined JAVA_HOME if exist "%USERPROFILE%\jdk-17\bin\java.exe" set "JAVA_HOME=%USERPROFILE%\jdk-17"
if not defined JAVA_HOME (
  echo No encontre Java 17. Instala Android Studio ^(trae Java^) o defini JAVA_HOME.
  exit /b 2
)
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not exist "%ANDROID_HOME%\platforms" (
  echo No encontre el SDK de Android en %ANDROID_HOME%.
  echo Abri Android Studio una vez ^(More Actions ^> SDK Manager^) para instalarlo, o defini ANDROID_HOME.
  exit /b 3
)
set "PATH=%JAVA_HOME%\bin;%PATH%"
exit /b 0
