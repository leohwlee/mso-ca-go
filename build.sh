#!/bin/sh
# Build the single self-contained HTML file into dist/
set -e
cd "$(dirname "$0")"
mkdir -p dist
go test ./...
go run . -export-html dist/mso-ca.html
ls -la dist/mso-ca.html
