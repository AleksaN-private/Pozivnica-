@echo off
title Pauk proxy
if exist "%~dp0kljuc.txt" set /p ANTHROPIC_API_KEY=<"%~dp0kljuc.txt"
node "%~dp0proxy.js"
pause
