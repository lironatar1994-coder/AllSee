@echo off
cd /d "%~dp0"
if not exist .datadmin.env node tools\set-password.mjs
start "" http://localhost:4310/allsee/
node --env-file=.datadmin.env server.mjs
