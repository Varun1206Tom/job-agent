@echo off
cd /d D:\React\Practice\AI_AGENT\job-agent
echo ===== %date% %time% ===== >> agent-log.txt
call npm run auto >> agent-log.txt 2>&1