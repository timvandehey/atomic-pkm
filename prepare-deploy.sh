#!/bin/bash

# 1. Configuration
DEPLOY_FILE="atomic-pkm-deploy.tar.gz"

# 2. Preparation
echo "🚀 Building frontend assets..."
bun run build

# 3. Create Archive
# We include:
# - server.js (main entry)
# - lib/ (backend logic)
# - dist/ (compiled frontend)
# - package.json (to install dependencies on server)
# - README.md (for reference)
#
# We EXCLUDE:
# - node_modules/ (server should run 'bun install --production')
# - .git/ (source control history)
# - data/ (usually you want to manage this separately on the server)
# - .env (don't bundle secrets, handle them on the server)
# - public/ (source frontend files, not needed if we have dist)

tar -czf "$DEPLOY_FILE" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data' \
    --exclude='public' \
    --exclude='.DS_Store' \
    --exclude='*.log' \
    server.js \
    lib/ \
    dist/ \
    package.json \
    README.md

echo "✅ Ready! Transfer '$DEPLOY_FILE' to your server."
echo "💡 On the server, run:"
echo "   1. tar -xzf $DEPLOY_FILE"
echo "   2. bun install --production"
echo "   3. bun run server.js"
