@echo off
rem Double-click to run the tag classifier eval and open its results page. See docs/testing.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-tag-eval.ps1"
echo.
pause
