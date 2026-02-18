#!/bin/bash

# Milad Appointment Bot - Deployment Helper Script
# This script guides you through the deployment process

set -e  # Exit on error

echo "=================================="
echo "Milad Bot Deployment Helper"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js v18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version must be 18 or higher. Current: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    print_success "npm $(npm --version)"
    
    # Check Wrangler
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed."
        print_info "Installing Wrangler..."
        npm install -g wrangler
    fi
    print_success "Wrangler $(wrangler --version)"
    
    # Check if we're in the right directory
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml not found. Are you in the project directory?"
        exit 1
    fi
    
    print_success "All prerequisites met!"
    echo ""
}

# Step 1: Install dependencies
install_deps() {
    print_info "Step 1: Installing dependencies..."
    npm install
    print_success "Dependencies installed!"
    echo ""
}

# Step 2: Login to Cloudflare
cloudflare_login() {
    print_info "Step 2: Logging in to Cloudflare..."
    print_info "A browser window will open. Please log in to your Cloudflare account."
    wrangler login
    print_success "Logged in to Cloudflare!"
    echo ""
}

# Step 3: Create D1 Database
create_database() {
    print_info "Step 3: Creating D1 Database..."
    
    # Check if database already exists
    if wrangler d1 list | grep -q "milad-bot-db"; then
        print_info "Database 'milad-bot-db' already exists."
        DB_INFO=$(wrangler d1 list | grep "milad-bot-db")
        print_info "Database info: $DB_INFO"
    else
        print_info "Creating new database..."
        wrangler d1 create milad-bot-db
        print_success "Database created!"
        print_info "IMPORTANT: Copy the database ID from above and update wrangler.toml"
    fi
    
    echo ""
    read -p "Press Enter after you've updated wrangler.toml with the database ID..."
    echo ""
}

# Step 4: Run migrations
run_migrations() {
    print_info "Step 4: Running database migrations..."
    wrangler d1 migrations apply milad-bot-db
    print_success "Migrations applied!"
    echo ""
}

# Step 5: Set secrets
set_secrets() {
    print_info "Step 5: Setting secrets..."
    print_info "You'll need:"
    print_info "  - Telegram Bot Token (from @BotFather)"
    print_info "  - Your Telegram User ID (from @userinfobot)"
    print_info "  - A valid National Code (10 digits)"
    echo ""
    
    read -p "Press Enter to set BOT_TOKEN..."
    wrangler secret put BOT_TOKEN
    echo ""
    
    read -p "Press Enter to set ADMIN_IDS..."
    wrangler secret put ADMIN_IDS
    echo ""
    
    read -p "Press Enter to set SYSTEM_NATIONAL_CODE..."
    wrangler secret put SYSTEM_NATIONAL_CODE
    echo ""
    
    print_success "Secrets set!"
    echo ""
}

# Step 6: Deploy
deploy() {
    print_info "Step 6: Deploying to Cloudflare..."
    wrangler deploy
    print_success "Deployed!"
    echo ""
}

# Step 7: Set webhook
set_webhook() {
    print_info "Step 7: Setting Telegram webhook..."
    
    # Get worker URL from wrangler.toml
    WORKER_NAME=$(grep "^name = " wrangler.toml | cut -d'"' -f2)
    WORKER_URL="https://${WORKER_NAME}.workers.dev"
    
    print_info "Worker URL: $WORKER_URL"
    print_info "Please enter your BOT_TOKEN to set the webhook:"
    read -s BOT_TOKEN
    echo ""
    
    curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\": \"${WORKER_URL}/webhook\"}"
    
    echo ""
    print_success "Webhook set!"
    echo ""
}

# Step 8: Verify
verify_deployment() {
    print_info "Step 8: Verifying deployment..."
    
    # Get worker URL
    WORKER_NAME=$(grep "^name = " wrangler.toml | cut -d'"' -f2)
    WORKER_URL="https://${WORKER_NAME}.workers.dev"
    
    print_info "Testing health endpoint..."
    if curl -s "${WORKER_URL}/health" | grep -q "OK"; then
        print_success "Health check passed!"
    else
        print_error "Health check failed. Please check the logs."
    fi
    
    echo ""
    print_info "Checking webhook status..."
    read -sp "Enter BOT_TOKEN to verify: " BOT_TOKEN
    echo ""
    curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
    echo ""
    
    print_success "Deployment verification complete!"
    echo ""
}

# Main menu
main_menu() {
    echo "What would you like to do?"
    echo ""
    echo "1) Full deployment (all steps)"
    echo "2) Install dependencies only"
    echo "3) Login to Cloudflare only"
    echo "4) Create database only"
    echo "5) Run migrations only"
    echo "6) Set secrets only"
    echo "7) Deploy only"
    echo "8) Set webhook only"
    echo "9) Verify deployment"
    echo "10) View logs"
    echo "11) Database console"
    echo "0) Exit"
    echo ""
    read -p "Enter your choice (0-11): " choice
    
    case $choice in
        1)
            check_prerequisites
            install_deps
            cloudflare_login
            create_database
            run_migrations
            set_secrets
            deploy
            set_webhook
            verify_deployment
            ;;
        2) install_deps ;;
        3) cloudflare_login ;;
        4) create_database ;;
        5) run_migrations ;;
        6) set_secrets ;;
        7) deploy ;;
        8) set_webhook ;;
        9) verify_deployment ;;
        10) wrangler tail ;;
        11) 
            print_info "Opening database console..."
            wrangler d1 execute milad-bot-db --command="SELECT name FROM sqlite_master WHERE type='table';"
            ;;
        0) exit 0 ;;
        *) 
            print_error "Invalid choice"
            main_menu
            ;;
    esac
}

# Run main menu
main_menu

print_success "All done! Your bot should be running."
print_info "Test it by sending /start to your bot on Telegram."
