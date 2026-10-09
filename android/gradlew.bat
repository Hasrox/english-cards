@ECHO OFF
SETLOCAL
SET DIRNAME=%~dp0
IF "%DIRNAME%"=="" SET DIRNAME=.
SET APP_HOME=%DIRNAME%
FOR %%i IN ("%APP_HOME%") DO SET APP_HOME=%%~fi
SET CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar
IF NOT EXIST "%CLASSPATH%" (
  ECHO Missing gradle-wrapper.jar
  EXIT /B 1
)
SET JAVA_EXE=java.exe
IF DEFINED JAVA_HOME SET JAVA_EXE=%JAVA_HOME%\bin\java.exe
"%JAVA_EXE%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
EXIT /B %ERRORLEVEL%
