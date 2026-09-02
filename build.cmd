@echo off
rem Cross-compile mso-ca for Windows and macOS into dist\
setlocal
cd /d "%~dp0"
if not exist dist mkdir dist

set CGO_ENABLED=0

set GOOS=windows
set GOARCH=amd64
go build -trimpath -ldflags "-s -w" -o dist\mso-ca-windows-amd64.exe . || exit /b 1

set GOOS=darwin
set GOARCH=arm64
go build -trimpath -ldflags "-s -w" -o dist\mso-ca-macos-arm64 . || exit /b 1

set GOOS=darwin
set GOARCH=amd64
go build -trimpath -ldflags "-s -w" -o dist\mso-ca-macos-amd64 . || exit /b 1

echo.
echo Built:
dir /b dist
endlocal
