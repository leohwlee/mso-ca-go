#!/bin/sh
# Cross-compile mso-ca for Windows and macOS into dist/
set -e
cd "$(dirname "$0")"
mkdir -p dist

export CGO_ENABLED=0

GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/mso-ca-windows-amd64.exe .
GOOS=darwin  GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o dist/mso-ca-macos-arm64 .
GOOS=darwin  GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o dist/mso-ca-macos-amd64 .

echo
echo "Built:"
ls -la dist
