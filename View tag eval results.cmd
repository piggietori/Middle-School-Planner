@echo off
rem Double-click to open the latest tag eval results page. Free: it reads saved results only. See docs/testing.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-tag-eval.ps1" -ViewOnly
if errorlevel 1 pause
