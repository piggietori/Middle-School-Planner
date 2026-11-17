@echo off
rem Double-click to open the page comparing the models' tag eval results. Free: it reads saved results only. See docs/testing.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-tag-eval.ps1" -Compare
if errorlevel 1 pause
