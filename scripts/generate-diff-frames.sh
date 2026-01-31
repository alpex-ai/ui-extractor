#!/bin/bash
# generate-diff-frames.sh - Create visual difference frames between keyframes
# Shows what changed between frames to help identify transitions and animations
#
# Usage: ./generate-diff-frames.sh <input_video> <output_dir> [options]
# Options:
#   --keyframes <file>    JSON file with keyframe list (from extract-frames.sh)
#   --amplify             Increase contrast for better visibility
#   --threshold <0-255>   Minimum change threshold to show (default: 10)
#   --pairs-only          Only generate diffs for keyframe pairs, not all frames
#
# Output: diff_XXXX.jpg files and diff-manifest.json

set -e

# Default configuration
KEYFRAMES_FILE=""
AMPLIFY=false
THRESHOLD=10
PAIRS_ONLY=false
FPS=1

# Colors for stderr output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check dependencies
check_dependencies() {
    if ! command -v ffmpeg &> /dev/null; then
        log_error "ffmpeg is required but not installed."
        echo '{"success": false, "error": "ffmpeg not installed"}'
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed."
        echo '{"success": false, "error": "jq not installed"}'
        exit 1
    fi
}

# Parse arguments
parse_args() {
    INPUT=""
    OUTPUT_DIR=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --keyframes)
                KEYFRAMES_FILE="$2"
                shift 2
                ;;
            --amplify)
                AMPLIFY=true
                shift
                ;;
            --threshold)
                THRESHOLD="$2"
                shift 2
                ;;
            --pairs-only)
                PAIRS_ONLY=true
                shift
                ;;
            --fps)
                FPS="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "$INPUT" ]]; then
                    INPUT="$1"
                elif [[ -z "$OUTPUT_DIR" ]]; then
                    OUTPUT_DIR="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$INPUT" ]] || [[ -z "$OUTPUT_DIR" ]]; then
        log_error "Usage: $0 <input_video> <output_dir> [options]"
        echo '{"success": false, "error": "Missing required arguments"}'
        exit 1
    fi

    if [[ ! -f "$INPUT" ]]; then
        log_error "Input file not found: $INPUT"
        echo '{"success": false, "error": "Input file not found"}'
        exit 1
    fi
}

show_help() {
    cat >&2 << 'EOF'
generate-diff-frames.sh - Create visual difference frames

USAGE:
    ./generate-diff-frames.sh <input_video> <output_dir> [options]

OPTIONS:
    --keyframes <file>    JSON file listing keyframes to use
    --amplify             Increase contrast for better visibility
    --threshold <0-255>   Minimum pixel change to show (default: 10)
    --pairs-only          Only generate diffs between consecutive keyframes
    --fps <rate>          Sample rate for diff generation (default: 1)
    -h, --help            Show this help message

OUTPUT:
    - diff_XXXX.jpg files showing pixel differences
    - diff-manifest.json linking diffs to original frame pairs

    Diff frames show:
    - Bright pixels = areas that changed
    - Dark pixels = areas that stayed the same
    - Use to identify animation types (fade, slide, scale, etc.)

EXAMPLES:
    # Generate diffs at 1fps
    ./generate-diff-frames.sh recording.mov ./frames

    # Generate diffs only for extracted keyframes
    ./generate-diff-frames.sh recording.mov ./frames --keyframes ./frames/extraction.json --pairs-only

    # Amplified diffs for subtle changes
    ./generate-diff-frames.sh recording.mov ./frames --amplify --threshold 5
EOF
}

# Get video duration
get_duration() {
    local input="$1"
    ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null | cut -d. -f1
}

# Generate diff frames from video
generate_diffs_from_video() {
    local input="$1"
    local output_dir="$2"

    log_info "Generating difference frames at ${FPS}fps..."

    # Build filter chain
    local filter_chain=""

    if [[ "$AMPLIFY" == "true" ]]; then
        # Amplified diff: difference + contrast boost + threshold
        filter_chain="fps=$FPS,tblend=all_mode=difference,eq=brightness=0.1:contrast=4,colorlevels=rimin=$THRESHOLD/255"
    else
        # Standard diff: just frame difference
        filter_chain="fps=$FPS,tblend=all_mode=difference"
    fi

    # Scale to match extracted frames
    filter_chain="$filter_chain,scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"

    ffmpeg -i "$input" \
        -vf "$filter_chain" \
        -vsync vfr \
        -q:v 2 \
        "$output_dir/diff_%04d.jpg" \
        2>&1 | grep -E "^frame=" >&2 || true

    # Count generated diffs
    local diff_count=$(ls -1 "$output_dir"/diff_*.jpg 2>/dev/null | wc -l | tr -d ' ')
    log_info "Generated $diff_count difference frames"

    echo "$diff_count"
}

# Generate diffs only for keyframe pairs
generate_diffs_for_keyframes() {
    local input="$1"
    local output_dir="$2"
    local keyframes_file="$3"

    log_info "Generating diffs for keyframe pairs..."

    # Read keyframe timestamps from the JSON file
    local frames=$(jq -r '.frames[]' "$keyframes_file" 2>/dev/null || jq -r '.[]' "$keyframes_file" 2>/dev/null)

    if [[ -z "$frames" ]]; then
        log_warn "Could not parse keyframes file, falling back to video-based generation"
        generate_diffs_from_video "$input" "$output_dir"
        return
    fi

    # Get frame count and generate diffs between consecutive pairs
    local frame_files=("$output_dir"/frame_*.jpg)
    local frame_count=${#frame_files[@]}

    if [[ $frame_count -lt 2 ]]; then
        log_warn "Need at least 2 frames for diff generation"
        echo "0"
        return
    fi

    local diff_count=0
    for ((i=0; i<frame_count-1; i++)); do
        local frame1="${frame_files[$i]}"
        local frame2="${frame_files[$i+1]}"
        local diff_file="$output_dir/diff_$(printf '%04d' $((i+1))).jpg"

        # Generate diff using ImageMagick if available, otherwise use ffmpeg
        if command -v compare &> /dev/null; then
            compare -metric AE -fuzz 5% "$frame1" "$frame2" "$diff_file" 2>/dev/null || true
        else
            # Use ffmpeg to create diff between two images
            ffmpeg -y -i "$frame1" -i "$frame2" \
                -filter_complex "[0:v][1:v]blend=all_mode=difference[diff];[diff]eq=brightness=0.1:contrast=3[out]" \
                -map "[out]" \
                -q:v 2 \
                "$diff_file" 2>/dev/null
        fi

        ((diff_count++))
    done

    log_info "Generated $diff_count keyframe difference frames"
    echo "$diff_count"
}

# Calculate change magnitude for a diff frame
calculate_change_magnitude() {
    local diff_file="$1"

    # Use ffprobe to get average brightness of diff frame
    # Higher brightness = more change
    local brightness=$(ffprobe -v error -select_streams v:0 \
        -show_entries frame=pkt_pts_time \
        -show_entries frame_tags=lavfi.signalstats.YAVG \
        -f lavfi "movie=$diff_file,signalstats" 2>/dev/null | grep YAVG | head -1 | cut -d= -f2 || echo "0")

    # Normalize to 0-1 range (YAVG is 0-255)
    if [[ -n "$brightness" ]] && [[ "$brightness" != "0" ]]; then
        echo "scale=4; $brightness / 255" | bc 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Generate manifest JSON
generate_manifest() {
    local output_dir="$1"
    local diff_count="$2"

    log_info "Generating diff manifest..."

    # Build manifest array
    local manifest_entries=""
    local frame_files=("$output_dir"/frame_*.jpg)

    for ((i=1; i<=diff_count; i++)); do
        local diff_file="diff_$(printf '%04d' $i).jpg"
        local from_frame="frame_$(printf '%04d' $i).jpg"
        local to_frame="frame_$(printf '%04d' $((i+1))).jpg"

        # Check if files exist
        if [[ ! -f "$output_dir/$diff_file" ]]; then
            continue
        fi

        # Calculate change magnitude
        local magnitude=$(calculate_change_magnitude "$output_dir/$diff_file")

        # Estimate timestamps (assuming 1fps extraction)
        local from_ts=$((i * 1000))
        local to_ts=$(((i + 1) * 1000))

        # Build entry
        local entry=$(jq -n \
            --arg diff "$diff_file" \
            --arg from "$from_frame" \
            --arg to "$to_frame" \
            --argjson from_num "$i" \
            --argjson to_num "$((i+1))" \
            --argjson from_ts "$from_ts" \
            --argjson to_ts "$to_ts" \
            --argjson magnitude "$magnitude" \
            '{
                diff_file: $diff,
                from_frame: $from,
                to_frame: $to,
                from_frame_number: $from_num,
                to_frame_number: $to_num,
                from_timestamp_ms: $from_ts,
                to_timestamp_ms: $to_ts,
                change_magnitude: $magnitude
            }')

        if [[ -z "$manifest_entries" ]]; then
            manifest_entries="$entry"
        else
            manifest_entries="$manifest_entries,$entry"
        fi
    done

    # Calculate summary stats
    local total_magnitude=$(echo "[$manifest_entries]" | jq '[.[].change_magnitude] | add // 0')
    local avg_magnitude=0
    if [[ $diff_count -gt 0 ]]; then
        avg_magnitude=$(echo "scale=4; $total_magnitude / $diff_count" | bc 2>/dev/null || echo "0")
    fi

    # Build final manifest
    local manifest=$(jq -n \
        --argjson entries "[$manifest_entries]" \
        --argjson total "$diff_count" \
        --argjson avg "$avg_magnitude" \
        --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --argjson amplified "$AMPLIFY" \
        --argjson threshold "$THRESHOLD" \
        '{
            version: "1.0",
            generation_date: $date,
            settings: {
                amplified: $amplified,
                threshold: $threshold
            },
            diff_frames: $entries,
            summary: {
                total_diff_frames: $total,
                avg_change_magnitude: $avg
            }
        }')

    echo "$manifest" > "$output_dir/diff-manifest.json"
    log_info "Manifest written to: $output_dir/diff-manifest.json"
}

# Main function
generate_diff_frames() {
    local input="$1"
    local output_dir="$2"

    # Create output directory if needed
    mkdir -p "$output_dir"

    local diff_count=0

    if [[ "$PAIRS_ONLY" == "true" ]] && [[ -n "$KEYFRAMES_FILE" ]]; then
        diff_count=$(generate_diffs_for_keyframes "$input" "$output_dir" "$KEYFRAMES_FILE")
    else
        diff_count=$(generate_diffs_from_video "$input" "$output_dir")
    fi

    # Generate manifest
    generate_manifest "$output_dir" "$diff_count"

    # Output summary JSON
    local output_json=$(jq -n \
        --argjson count "$diff_count" \
        --arg manifest "$output_dir/diff-manifest.json" \
        --arg output "$output_dir" \
        '{
            success: true,
            diff_count: $count,
            manifest: $manifest,
            output_dir: $output
        }')

    echo "$output_json"
}

# Main
check_dependencies
parse_args "$@"
generate_diff_frames "$INPUT" "$OUTPUT_DIR"
