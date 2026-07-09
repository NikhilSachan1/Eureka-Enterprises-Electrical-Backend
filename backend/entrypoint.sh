#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/.bin/typeorm migration:run -d dist/typeorm-datasource.config.js

echo "Starting server..."
exec node dist/src/main.js
