@echo off
rem Build the single self-contained HTML file into dist\
setlocal
cd /d "%~dp0"
if not exist dist mkdir dist
go test ./... || exit /b 1
go run . -export-html dist\mso-ca.html || exit /b 1
dir dist\mso-ca.html
endlocal
