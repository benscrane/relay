#!/bin/bash
set -e

echo "Setting up Relay development environment..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed. Run: npm install -g pnpm"; exit 1; }

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Copy environment variables template
if [ ! -f .dev.vars ]; then
  cp .dev.vars.example .dev.vars
  echo "Created .dev.vars from template. Please update with your values."
fi

# Create local D1 database
echo "Creating local D1 database..."
pnpm wrangler d1 create relay-db --local 2>/dev/null || true

# Run migrations
echo "Running database migrations..."
pnpm db:migrate

echo ""
echo "Setup complete! Run 'pnpm dev' to start development."
