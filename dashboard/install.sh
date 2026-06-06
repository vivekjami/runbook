#!/bin/bash
set -e
export CI=true
npm install --no-audit --no-fund --loglevel=error 2>&1
echo "===DONE==="
