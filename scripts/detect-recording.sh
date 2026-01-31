#!/bin/bash
# detect-recording.sh - Find recent screen recordings on macOS
# Searches common locations for video files created in the last 24 hours
#
# Usage: ./detect-recording.sh [options]
# Options:
#   --hours <n>     Look for recordings from the last N hours (default: 24)
#   --type <type>   Filter by type: video, image, or all (default: video)
#   --list          List all found recordings, not just the most recent
#
# Output: JSON to stdout
# Status messages: stderr

set -e

# Default configuration
HOURS=24
TYPE="video"
LIST_ALL=false

# Colors for stderr output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check dependencies
check_dependencies() {
    if ! command -v ffprobe &> /dev/null; then
        log_warn "ffprobe not found. Duration info will be unavailable."
        log_warn "Install with: brew install ffmpeg"
    fi
}

# Get video duration in seconds
get_duration() {
    local file="$1"
    if command -v ffprobe &> /dev/null; then
        ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null | cut -d. -f1 || echo "unknown"
    else
        echo "unknown"
    fi
}

# Get file size in human readable format
get_size() {
    local file="$1"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f%z "$file" 2>/dev/null | awk '{
            if ($1 >= 1073741824) printf "%.1fGB", $1/1073741824
            else if ($1 >= 1048576) printf "%.1fMB", $1/1048576
            else if ($1 >= 1024) printf "%.1fKB", $1/1024
            else printf "%dB", $1
        }'
    else
        stat --printf="%s" "$file" 2>/dev/null | awk '{
            if ($1 >= 1073741824) printf "%.1fGB", $1/1073741824
            else if ($1 >= 1048576) printf "%.1fMB", $1/1048576
            else if ($1 >= 1024) printf "%.1fKB", $1/1024
            else printf "%dB", $1
        }'
    fi
}

# Get modification time as ISO string
get_modified() {
    local file="$1"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%S" "$file" 2>/dev/null
    else
        stat -c "%y" "$file" 2>/dev/null | cut -d. -f1
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --hours)
                HOURS="$2"
                shift 2
                ;;
            --type)
                TYPE="$2"
                shift 2
                ;;
            --list)
                LIST_ALL=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat >&2 << EOF
detect-recording.sh - Find recent screen recordings on macOS

USAGE:
    ./detect-recording.sh [options]

OPTIONS:
    --hours <n>     Look for recordings from the last N hours (default: 24)
    --type <type>   Filter by type: video, image, or all (default: video)
    --list          List all found recordings, not just the most recent
    -h, --help      Show this help message

SEARCHED LOCATIONS:
    ~/Desktop
    ~/Movies
    ~/Downloads
    ~/Documents/Screen Recordings (if exists)

SUPPORTED FORMATS:
    Video: .mov, .mp4, .webm, .mkv
    Image: .png, .jpg, .jpeg, .webp, .gif

OUTPUT:
    JSON object with the most recent recording (or array with --list):
    {
        "path": "/Users/.../recording.mov",
        "filename": "recording.mov",
        "duration": 45,
        "size": "12.5MB",
        "modified": "2024-01-15T10:30:00",
        "type": "video"
    }
EOF
}

# Find recordings in a directory
find_recordings() {
    local dir="$1"
    local type="$2"
    local hours="$3"

    if [[ ! -d "$dir" ]]; then
        return
    fi

    local patterns=()
    case $type in
        video)
            patterns=("*.mov" "*.mp4" "*.webm" "*.mkv")
            ;;
        image)
            patterns=("*.png" "*.jpg" "*.jpeg" "*.webp" "*.gif")
            ;;
        all)
            patterns=("*.mov" "*.mp4" "*.webm" "*.mkv" "*.png" "*.jpg" "*.jpeg" "*.webp" "*.gif")
            ;;
    esac

    # Find files modified within the time window
    local mmin=$((hours * 60))

    for pattern in "${patterns[@]}"; do
        find "$dir" -maxdepth 1 -name "$pattern" -mmin -"$mmin" -type f 2>/dev/null
    done
}

# Main function
main() {
    check_dependencies
    parse_args "$@"

    log_info "Searching for ${TYPE} files from the last ${HOURS} hours..."

    # Directories to search
    # First check for symlinks in current directory (project-local access)
    # Then fall back to home directories (may fail due to permissions)
    local search_dirs=()

    # Project-local symlinks (preferred - avoids permission issues)
    if [[ -L "./.recordings-desktop" ]]; then
        search_dirs+=("./.recordings-desktop")
    fi
    if [[ -L "./.recordings-movies" ]]; then
        search_dirs+=("./.recordings-movies")
    fi
    if [[ -L "./.recordings" ]]; then
        search_dirs+=("./.recordings")
    fi

    # Fall back to home directories if no symlinks found
    if [[ ${#search_dirs[@]} -eq 0 ]]; then
        search_dirs=(
            "$HOME/Desktop"
            "$HOME/Movies"
            "$HOME/Downloads"
            "$HOME/Documents/Screen Recordings"
        )
        log_warn "No .recordings symlink found. Trying home directories (may fail due to permissions)."
        log_warn "For reliable auto-detect, run: ln -s ~/Desktop ./.recordings"
    fi

    # Collect all found files
    local all_files=()
    for dir in "${search_dirs[@]}"; do
        while IFS= read -r file; do
            if [[ -n "$file" ]]; then
                all_files+=("$file")
            fi
        done < <(find_recordings "$dir" "$TYPE" "$HOURS")
    done

    if [[ ${#all_files[@]} -eq 0 ]]; then
        log_warn "No ${TYPE} files found in the last ${HOURS} hours"
        echo '{"found": false, "message": "No recordings found"}'
        exit 0
    fi

    # Sort by modification time (most recent first)
    IFS=$'\n' sorted_files=($(ls -t "${all_files[@]}" 2>/dev/null))
    unset IFS

    log_info "Found ${#sorted_files[@]} ${TYPE} file(s)"

    if [[ "$LIST_ALL" == "true" ]]; then
        # Output all files as JSON array
        echo "["
        local first=true
        for file in "${sorted_files[@]}"; do
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo ","
            fi

            local filename=$(basename "$file")
            local duration=$(get_duration "$file")
            local size=$(get_size "$file")
            local modified=$(get_modified "$file")
            local ftype="video"
            if [[ "$filename" =~ \.(png|jpg|jpeg|webp|gif)$ ]]; then
                ftype="image"
            fi

            cat << EOF
    {
        "path": "$file",
        "filename": "$filename",
        "duration": "$duration",
        "size": "$size",
        "modified": "$modified",
        "type": "$ftype"
    }
EOF
        done
        echo "]"
    else
        # Output only the most recent file
        local file="${sorted_files[0]}"
        local filename=$(basename "$file")
        local duration=$(get_duration "$file")
        local size=$(get_size "$file")
        local modified=$(get_modified "$file")
        local ftype="video"
        if [[ "$filename" =~ \.(png|jpg|jpeg|webp|gif)$ ]]; then
            ftype="image"
        fi

        log_info "Most recent: $filename ($size, ${duration}s)"

        cat << EOF
{
    "found": true,
    "path": "$file",
    "filename": "$filename",
    "duration": "$duration",
    "size": "$size",
    "modified": "$modified",
    "type": "$ftype"
}
EOF
    fi
}

main "$@"
