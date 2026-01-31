#!/bin/bash
# record-website.sh - Record a website with simulated user interactions
# Uses Playwright to navigate, scroll, hover, and capture video
#
# Usage: ./record-website.sh <url> [options]
# Options:
#   --output <file>      Output video path (default: ./recording.webm)
#   --mobile             Use mobile viewport (390x844)
#   --dark-mode          Enable dark mode
#   --duration <secs>    Max recording duration (default: 30)
#   --scroll-steps <n>   Number of scroll steps (default: 5)
#   --click-buttons      Click interactive elements (careful!)
#   --browser <type>     chromium (default) or firefox
#   --analyze            Auto-run frame extraction after recording
#   --quality <level>    Frame extraction quality (low/default/high)
#   --json-only          Output JSON only (no status messages)
#
# Output: Video file (webm format) with website recording
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

# Defaults
OUTPUT=""
MOBILE=false
DARK_MODE=false
DURATION=30
SCROLL_STEPS=5
SCROLL_DELAY=800
CLICK_BUTTONS=false
BROWSER="chromium"
ANALYZE=false
QUALITY="default"
JSON_ONLY=false
URL=""

# Log to stderr
log_info() {
    if [ "$JSON_ONLY" = false ]; then
        echo -e "${GREEN}[INFO]${NC} $1" >&2
    fi
}

log_warn() {
    if [ "$JSON_ONLY" = false ]; then
        echo -e "${YELLOW}[WARN]${NC} $1" >&2
    fi
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_hint() {
    if [ "$JSON_ONLY" = false ]; then
        echo -e "${CYAN}[HINT]${NC} $1" >&2
    fi
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
record-website.sh - Record a website with simulated user interactions

USAGE:
    ./record-website.sh <url> [options]

ARGUMENTS:
    <url>               URL of the website to record

OPTIONS:
    --output <file>     Output video path (default: ./recording.webm)
    --mobile            Use mobile viewport (390x844)
    --dark-mode         Enable dark mode
    --duration <secs>   Max recording duration in seconds (default: 30)
    --scroll-steps <n>  Number of scroll steps (default: 5)
    --scroll-delay <ms> Delay between scrolls in ms (default: 800)
    --click-buttons     Click interactive elements (use with caution)
    --browser <type>    Browser engine: chromium (default) or firefox
    --analyze           Auto-run frame extraction after recording
    --quality <level>   Frame extraction quality: low, default, or high
    --json-only         Output raw JSON only (suppress status messages)
    -h, --help          Show this help message

EXAMPLES:
    # Basic recording
    ./record-website.sh https://stripe.com

    # Record to specific file
    ./record-website.sh https://example.com --output ./my-recording.webm

    # Mobile dark mode recording
    ./record-website.sh https://myapp.com --mobile --dark-mode

    # Record and auto-analyze
    ./record-website.sh https://competitor.com --analyze --quality high

    # Full workflow: record, extract frames, ready for analysis
    ./record-website.sh https://target-app.com --output ./target.webm --analyze

OUTPUT:
    Outputs a WebM video file of the website with simulated interactions:
    - Page load and hydration
    - Hover over interactive elements (buttons, links)
    - Smooth scroll through page content
    - Scroll back to top

    With --analyze, also extracts frames for Claude analysis.

WORKFLOW:
    1. Records website interactions to video
    2. (Optional) Extracts frames from video
    3. Use frames with Claude for design system extraction

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --output)
                OUTPUT="$2"
                shift 2
                ;;
            --mobile)
                MOBILE=true
                shift
                ;;
            --dark-mode)
                DARK_MODE=true
                shift
                ;;
            --duration)
                DURATION="$2"
                shift 2
                ;;
            --scroll-steps)
                SCROLL_STEPS="$2"
                shift 2
                ;;
            --scroll-delay)
                SCROLL_DELAY="$2"
                shift 2
                ;;
            --click-buttons)
                CLICK_BUTTONS=true
                shift
                ;;
            --browser)
                BROWSER="$2"
                shift 2
                ;;
            --analyze)
                ANALYZE=true
                shift
                ;;
            --quality)
                QUALITY="$2"
                shift 2
                ;;
            --json-only)
                JSON_ONLY=true
                shift
                ;;
            -*)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                if [ -z "$URL" ]; then
                    URL="$1"
                else
                    log_error "Unexpected argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

# Main
main() {
    parse_args "$@"

    # Check for URL argument
    if [ -z "$URL" ]; then
        log_error "Missing URL argument"
        log_hint "Usage: ./record-website.sh <url> [options]"
        echo '{"success": false, "error": "Missing URL argument"}'
        exit 1
    fi

    # Set default output if not specified
    if [ -z "$OUTPUT" ]; then
        # Create a filename from the URL
        DOMAIN=$(echo "$URL" | sed -E 's|https?://||' | sed 's|/.*||' | sed 's/[^a-zA-Z0-9]/-/g')
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        OUTPUT="./recordings/${DOMAIN}-${TIMESTAMP}.webm"
    fi

    # Ensure output directory exists
    OUTPUT_DIR=$(dirname "$OUTPUT")
    mkdir -p "$OUTPUT_DIR"

    # Run checks
    check_node
    check_npm
    install_deps

    log_info "Recording: $URL"
    log_info "Output: $OUTPUT"
    log_info "Mobile: $MOBILE"
    log_info "Dark mode: $DARK_MODE"
    log_info "Browser: $BROWSER"

    # Build recorder arguments
    RECORDER_ARGS=("$URL" "--output" "$OUTPUT")

    if [ "$MOBILE" = true ]; then
        RECORDER_ARGS+=("--mobile")
    fi

    if [ "$DARK_MODE" = true ]; then
        RECORDER_ARGS+=("--dark-mode")
    fi

    RECORDER_ARGS+=("--duration" "$DURATION")
    RECORDER_ARGS+=("--scroll-steps" "$SCROLL_STEPS")
    RECORDER_ARGS+=("--scroll-delay" "$SCROLL_DELAY")
    RECORDER_ARGS+=("--browser" "$BROWSER")

    if [ "$CLICK_BUTTONS" = true ]; then
        RECORDER_ARGS+=("--click-buttons")
    fi

    if [ "$JSON_ONLY" = true ]; then
        RECORDER_ARGS+=("--json")
    fi

    # Run the recorder
    RESULT=$(node "$EXTRACTOR_DIR/recorder.js" "${RECORDER_ARGS[@]}" 2>&1)
    RECORD_EXIT=$?

    if [ $RECORD_EXIT -ne 0 ]; then
        log_error "Recording failed"
        if [ "$JSON_ONLY" = true ]; then
            echo '{"success": false, "error": "Recording failed", "details": "'"$RESULT"'"}'
        fi
        exit 1
    fi

    # Parse video path from result
    if [ "$JSON_ONLY" = true ]; then
        VIDEO_PATH=$(echo "$RESULT" | grep -o '"videoPath"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//;s/"$//' || echo "$OUTPUT")
    else
        VIDEO_PATH="$RESULT"
    fi

    log_info "Recording complete: $VIDEO_PATH"

    # Auto-analyze if requested
    if [ "$ANALYZE" = true ]; then
        log_info "Extracting frames for analysis..."

        FRAMES_DIR="./frames"
        mkdir -p "$FRAMES_DIR"

        EXTRACT_RESULT=$("$SCRIPT_DIR/extract-frames.sh" "$VIDEO_PATH" "$FRAMES_DIR" --quality "$QUALITY" --include-metadata)

        if [ $? -eq 0 ]; then
            log_info "Frames extracted successfully"

            if [ "$JSON_ONLY" = true ]; then
                # Combine recording and extraction results
                FRAME_COUNT=$(echo "$EXTRACT_RESULT" | grep -o '"count"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*' || echo "0")
                echo "{\"success\": true, \"videoPath\": \"$VIDEO_PATH\", \"framesDir\": \"$FRAMES_DIR\", \"frameCount\": $FRAME_COUNT, \"ready\": true}"
            else
                echo "$VIDEO_PATH"
                echo "Frames: $FRAMES_DIR"
            fi
        else
            log_warn "Frame extraction failed, but recording succeeded"
            if [ "$JSON_ONLY" = true ]; then
                echo "{\"success\": true, \"videoPath\": \"$VIDEO_PATH\", \"analysisReady\": false}"
            else
                echo "$VIDEO_PATH"
            fi
        fi
    else
        if [ "$JSON_ONLY" = true ]; then
            echo "{\"success\": true, \"videoPath\": \"$VIDEO_PATH\"}"
        else
            echo "$VIDEO_PATH"
        fi
    fi
}

main "$@"
