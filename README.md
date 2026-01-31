# Portal

A full-stack application with React frontend and Node.js backend.

## CI/CD Deployment

This repository is configured with GitHub Actions to automatically deploy to a Digital Ocean droplet when changes are pushed to the `main` branch.

### Setup Instructions

To set up CI/CD, you need to configure the following GitHub Secrets in your repository settings:

1. `DROPLET_IP` - The IP address of your Digital Ocean droplet
2. `DROPLET_PASSWORD` - The root password for your Digital Ocean droplet

### How It Works

1. **Trigger**: When code is pushed to the `main` branch, the workflow automatically triggers
2. **Testing**: The workflow first runs tests, linting, and builds to ensure code quality
3. **Deployment**: If tests pass, it SSHes into your Digital Ocean droplet and:
   - Updates the repository in `/var/www/html/portal` (assumes already cloned)
   - Copies `client` and `server` directories to `/var/www/html`
   - Updates server dependencies in `/var/www/html/server`
   - Builds the client application in `/var/www/html/client`
   - Restarts the server using PM2 from `/var/www/html/server`

### Manual Deployment

You can also trigger deployments manually by going to the Actions tab in GitHub and clicking "Run workflow" on the "Deploy to Digital Ocean Droplet" workflow.

### Server Requirements

Your Digital Ocean droplet should have:
- Node.js and npm installed
- PM2 process manager installed (`npm install -g pm2`)
- Git installed and configured for repository access
- The repository already cloned to `/var/www/html/portal`
- SSH access enabled for the root user with password authentication
- The `/var/www/html` directory available for deployments