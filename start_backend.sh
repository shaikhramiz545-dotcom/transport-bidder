#!/bin/bash
# Start Backend
echo "Starting TBidder API on http://localhost:4000 ..."
echo "Keep this window open."
echo ""
cd "$(dirname "$0")/backend" || exit
node src/server.js
