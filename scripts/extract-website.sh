#!/bin/bash
# extract-website.sh - Extract design systems from live websites
# Uses Playwright to render pages and extract CSS/HTML design tokens
#
# Usage: ./extract-website.sh <url> [options]
# Options:
#   --output <file>      Save to file (default: stdout)
#   --dark-mode          Extract dark mode variant
#   --mobile             Use mobile viewport (390x844)
#   --slow               3x timeouts for JS-heavy SPAs
#   --browser <type>     chromium (default) or firefox
#   --dtcg               Output W3C Design Tokens format
#   --json-only          Output JSON only (no status messages)
#
# Output: JSON to stdout with design system
# Status messages: stderr

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTRACTOR_DIR="$SCRIPT_DIR/../lib/website-extractor"

# Colors for stderr output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Log to stderr
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_hint() {
    echo -e "${CYAN}[HINT]${NC} $1" >&2
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed."
        log_hint "Install with: brew install node"
        echo '{"success": false, "error": "Node.js not installed"}'
        exit 1
    fi

    # Check version (need 18+)
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ is required. Current version: $(node -v)"
        log_hint "Update with: brew upgrade node"
        echo '{"success": false, "error": "Node.js 18+ required"}'
        exit 1
    fi
}

# Check npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed."
        echo '{"success": false, "error": "npm not installed"}'
        exit 1
    fi
}

# Install dependencies if needed
install_deps() {
    if [ ! -d "$EXTRACTOR_DIR/node_modules" ]; then
        log_info "Installing dependencies (first run)..."
        cd "$EXTRACTOR_DIR"
        npm install --silent 2>&1 | while read line; do
            log_info "$line"
        done
        cd - > /dev/null
        log_info "Dependencies installed."
    fi
}

# Show help
show_help() {
    cat << 'EOF'
extract-website.sh - Extract design systems from live websites

USAGE:
    ./extract-website.sh <url> [options]

ARGUMENTS:
    <url>           URL of the website to extract from

OPTIONS:
    --output <file>     Save output to file (default: stdout)
    --dark-mode         Extract dark mode variant
    --mobile            Use mobile viewport (390x844)
    --slow              Extended timeouts for JS-heavy SPAs (3x)
    --browser <type>    Browser engine: chromium (default) or firefox
    --dtcg              Output in W3C Design Tokens Community Group format
    --json-only         Output raw JSON only (suppress status messages)
    -h, --help          Show this help message

EXAMPLES:
    # Basic extraction
    ./extract-website.sh https://stripe.com

    # Save to file
    ./extract-website.sh https://example.com --output ./design-system.json

    # Extract dark mode from a slow SPA
    ./extract-website.sh https://myapp.com --dark-mode --slow

    # Use Firefox for Cloudflare-protected sites
    ./extract-website.sh https://protected-site.com --browser firefox

OUTPUT:
    Outputs a JSON design system compatible with figma-export.sh
    including colors, typography, spacing, radii, shadows, and breakpoints.

    The cssExtraction section includes:
    - CSS custom properties (variables)
    - Detected CSS framework (Tailwind, Bootstrap, etc.)
    - Component styles (buttons, inputs, links)
    - Icon system detection

EOF
}

# Main
main() {
    # Check for help flag
    for arg in "$@"; do
        if [ "$arg" = "-h" ] || [ "$arg" = "--help" ]; then
            show_help
            exit 0
        fi
    done

    # Check for URL argument
    if [ $# -lt 1 ]; then
        log_error "Missing URL argument"
        log_hint "Usage: ./extract-website.sh <url> [options]"
        echo '{"success": false, "error": "Missing URL argument"}'
        exit 1
    fi

    # Run checks
    check_node
    check_npm
    install_deps

    # Run the Node.js extractor with all arguments
    node "$EXTRACTOR_DIR/index.js" "$@"
}

main "$@"
