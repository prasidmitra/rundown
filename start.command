#!/bin/bash
# Double-click launcher for the tracker app.
cd "$(dirname "$0")"
open "http://127.0.0.1:8787" &
node server.js
