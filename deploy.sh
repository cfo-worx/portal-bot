#!/bin/bash

# Deployment script for Digital Ocean Droplet
set -e  # Exit on any error

echo "Starting deployment.."

# Ensure we're in the right directory
cd /var/www/html || { echo "Project directory not found!"; exit 1; }

# Check if portal directory exists (assuming it's already cloned and configured)
if [ ! -d "portal" ]; then
    echo "Error: portal directory not found. Please ensure the repository is cloned to /var/www/html/portal"
    exit 1
fi

# Update the repository
echo "Updating repository..."
cd portal
git fetch origin
git reset --hard origin/main
cd ..

# Copy client and server directories from portal to /var/www/html
echo "Copying project directories..."

rm -rf client server

# Verify the source directories exist before copying
if [ ! -d "portal/client" ] || [ ! -d "portal/server" ]; then
    echo "Error: portal/client or portal/server directory not found in cloned repository"
    exit 1
fi

cp -r portal/client .
cp -r portal/server .


cp /var/www/html/client.env /var/www/html/client/.env
cp /var/www/html/server.env /var/www/html/server/.env

echo "✅ Project directories copied successfully"

# Update server dependencies
echo "Updating server dependencies..."
cd server
npm ci --production

# Build the client application
echo "Building client application..."
cd ../client
npm ci
npm run build

# Restart the server using PM2
echo "Restarting server with PM2..."
cd ../server

# Stop existing backend process if running
echo "Stopping existing backend process..."
pm2 stop backend || true
pm2 delete backend || true

# Start the server using PM2
echo "Starting backend server with PM2..."
pm2 start npm --name "backend" -- run start

# Wait a moment and check if server started successfully
sleep 3
if pm2 list | grep -q "backend.*online"; then
    echo "✅ Backend server started successfully with PM2!"
    echo "Deployment completed successfully!"
else
    echo "❌ Backend server failed to start. Check PM2 logs for details."
    pm2 logs backend --lines 20
    exit 1
fi
