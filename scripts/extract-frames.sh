#!/bin/bash
# extract-frames.sh - FPS-based frame extraction from screen recordings
# Extracts frames at configurable rates for UI analysis
#
# Usage: ./extract-frames.sh <input_video> <output_dir> [options]
# Options:
#   --quality <low|default|high>  Extraction quality (default: default)
#                                  low=0.5fps, default=1fps, high=2fps
#   --fps <rate>                   Custom FPS override (0.1-10, e.g., 0.5, 1, 2, 4, 10)
#   --scene-boost                  Also capture scene changes (adds frames)
#   --max-frames <n>               Maximum frames to extract (default: 120)
#   --adaptive                     Motion-weighted adaptive sampling
#   --include-metadata             Run motion analysis and output temporal-metadata.json
#   --include-diffs                Generate diff frames for transitions
#
# Output: JSON to stdout with extraction results
# Status messages: stderr

set -e

# Quality presets (FPS values)
FPS_LOW=0.5      # 1 frame every 2 seconds
FPS_DEFAULT=1    # 1 frame per second
FPS_HIGH=2       # 2 frames per second

# Default configuration
QUALITY="default"
CUSTOM_FPS=""
SCENE_BOOST=false
MAX_FRAMES=120
MAX_FPS=10
MIN_FPS=0.1
MAX_DURATION=300  # 5 minutes in seconds
WARN_DURATION=60  # 1 minute warning threshold

# New temporal analysis options
ADAPTIVE=false
INCLUDE_METADATA=false
INCLUDE_DIFFS=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Check dependencies
check_dependencies() {
    if ! command -v ffmpeg &> /dev/null; then
        log_error "ffmpeg is required but not installed."
        log_error "Install with: brew install ffmpeg"
        echo '{"success": false, "error": "ffmpeg not installed"}'
        exit 1
    fi

    if ! command -v ffprobe &> /dev/null; then
        log_error "ffprobe is required but not installed."
        log_error "Install with: brew install ffmpeg"
        echo '{"success": false, "error": "ffprobe not installed"}'
        exit 1
    fi
}

# Get video duration in seconds
get_duration() {
    local input="$1"
    ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null | cut -d. -f1
}

# Get video dimensions
get_dimensions() {
    local input="$1"
    ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$input" 2>/dev/null
}

# Get frame rate
get_framerate() {
    local input="$1"
    ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null | bc -l 2>/dev/null || echo "30"
}

# Suggest quality level based on duration
suggest_quality() {
    local duration="$1"

    if [[ $duration -le 15 ]]; then
        echo "high"
        log_hint "Short video (${duration}s) - suggesting 'high' quality (2fps, ~$((duration * 2)) frames)"
    elif [[ $duration -le 60 ]]; then
        echo "default"
        log_hint "Medium video (${duration}s) - using 'default' quality (1fps, ~$duration frames)"
    else
        echo "low"
        log_hint "Long video (${duration}s) - suggesting 'low' quality (0.5fps, ~$((duration / 2)) frames)"
    fi
}

# Get FPS from quality or custom setting
get_extraction_fps() {
    if [[ -n "$CUSTOM_FPS" ]]; then
        echo "$CUSTOM_FPS"
        return
    fi

    case $QUALITY in
        low)
            echo "$FPS_LOW"
            ;;
        high)
            echo "$FPS_HIGH"
            ;;
        default|*)
            echo "$FPS_DEFAULT"
            ;;
    esac
}

# Parse arguments
parse_args() {
    INPUT=""
    OUTPUT_DIR=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --quality)
                QUALITY="$2"
                if [[ ! "$QUALITY" =~ ^(low|default|high)$ ]]; then
                    log_error "Invalid quality: $QUALITY (use: low, default, high)"
                    exit 1
                fi
                shift 2
                ;;
            --fps)
                CUSTOM_FPS="$2"
                # Validate FPS is a number between MIN_FPS and MAX_FPS
                if ! echo "$CUSTOM_FPS" | grep -qE '^[0-9]*\.?[0-9]+$'; then
                    log_error "Invalid FPS value: $CUSTOM_FPS (must be a number)"
                    exit 1
                fi
                if (( $(echo "$CUSTOM_FPS > $MAX_FPS" | bc -l) )); then
                    log_error "FPS too high: $CUSTOM_FPS (max: $MAX_FPS)"
                    exit 1
                fi
                if (( $(echo "$CUSTOM_FPS < $MIN_FPS" | bc -l) )); then
                    log_error "FPS too low: $CUSTOM_FPS (min: $MIN_FPS)"
                    exit 1
                fi
                shift 2
                ;;
            --scene-boost)
                SCENE_BOOST=true
                shift
                ;;
            --max-frames)
                MAX_FRAMES="$2"
                shift 2
                ;;
            --adaptive)
                ADAPTIVE=true
                shift
                ;;
            --include-metadata)
                INCLUDE_METADATA=true
                shift
                ;;
            --include-diffs)
                INCLUDE_DIFFS=true
                shift
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

    # Validate required arguments
    if [[ -z "$INPUT" ]] || [[ -z "$OUTPUT_DIR" ]]; then
        log_error "Usage: $0 <input_video> <output_dir> [options]"
        echo '{"success": false, "error": "Missing required arguments"}'
        exit 1
    fi

    # Validate input file exists
    if [[ ! -f "$INPUT" ]]; then
        log_error "Input file not found: $INPUT"
        echo '{"success": false, "error": "Input file not found", "path": "'"$INPUT"'"}'
        exit 1
    fi
}

show_help() {
    cat >&2 << EOF
extract-frames.sh - FPS-based frame extraction from screen recordings

USAGE:
    ./extract-frames.sh <input_video> <output_dir> [options]

OPTIONS:
    --quality <level>      Extraction quality preset (default: default)
                            low    = 0.5 fps (1 frame every 2 seconds)
                            default = 1 fps (1 frame per second)
                            high   = 2 fps (2 frames per second)

    --fps <rate>           Custom FPS override, 0.1-10 (e.g., 0.5, 1, 2, 4, 10)
                           Overrides --quality if specified

    --scene-boost          Also capture scene changes between FPS frames
                           Adds extra frames at significant UI transitions

    --max-frames <n>       Maximum frames to extract (default: 120)

    --adaptive             Motion-weighted adaptive sampling
                           Samples more densely during high-motion segments
                           Requires analyze-motion.sh in same directory

    --include-metadata     Run motion analysis and output temporal-metadata.json
                           Provides per-frame motion scores and animation detection

    --include-diffs        Generate diff frames showing what changed
                           Creates diff_XXXX.jpg files and diff-manifest.json

    -h, --help             Show this help message

QUALITY GUIDELINES:
    Use 'low' for:
        - Videos over 60 seconds
        - Simple UIs with few state changes
        - Quick overview extraction

    Use 'default' for:
        - Most screen recordings (15-60 seconds)
        - Typical UI demos
        - Balanced detail and token usage

    Use 'high' for:
        - Short videos under 15 seconds
        - Complex UIs with many transitions
        - When you need maximum detail

TEMPORAL ANALYSIS:
    For enhanced motion understanding, use:

    --include-metadata     Adds temporal-metadata.json with:
                           - Per-frame motion scores
                           - Animation sequence detection
                           - Scene boundary identification

    --include-diffs        Adds visual diff frames showing:
                           - What pixels changed between frames
                           - Useful for identifying animation types

    --adaptive             Combines scene-boost with motion analysis
                           for optimal keyframe selection

EXAMPLES:
    # Default extraction (1 fps)
    ./extract-frames.sh recording.mov ./frames

    # High quality for short detailed video
    ./extract-frames.sh recording.mov ./frames --quality high

    # Low quality for long overview
    ./extract-frames.sh recording.mov ./frames --quality low

    # Custom FPS with scene detection boost
    ./extract-frames.sh recording.mov ./frames --fps 1.5 --scene-boost

    # Full temporal analysis
    ./extract-frames.sh recording.mov ./frames --adaptive --include-metadata

    # Include diff frames for transition analysis
    ./extract-frames.sh recording.mov ./frames --include-metadata --include-diffs

OUTPUT:
    JSON object to stdout with extraction results:
    {
        "success": true,
        "frames": ["frame_0001.jpg", ...],
        "count": 25,
        "duration": 45,
        "fps_used": 1,
        "quality": "default",
        "adaptive_sampling": false,
        "temporal_metadata": "./frames/temporal-metadata.json",
        "output_dir": "./frames"
    }
EOF
}

# Main extraction function
extract_frames() {
    local input="$1"
    local output_dir="$2"

    # Create output directory
    mkdir -p "$output_dir"

    # Get video info
    local duration=$(get_duration "$input")
    local dimensions=$(get_dimensions "$input")
    local source_fps=$(get_framerate "$input")

    log_info "Video: $input"
    log_info "Duration: ${duration}s | Dimensions: $dimensions | Source FPS: ~${source_fps}"

    # Check duration limits
    if [[ $duration -gt $MAX_DURATION ]]; then
        log_error "Video exceeds maximum duration of ${MAX_DURATION}s (5 minutes)"
        log_error "Please trim the video to the relevant section"
        echo '{"success": false, "error": "Video too long", "duration": '"$duration"', "max_duration": '"$MAX_DURATION"'}'
        exit 1
    fi

    if [[ $duration -gt $WARN_DURATION ]]; then
        log_warn "Video is ${duration}s long. Consider using --quality low for better efficiency."
    fi

    # Auto-suggest quality if using default and no custom FPS
    if [[ "$QUALITY" == "default" ]] && [[ -z "$CUSTOM_FPS" ]]; then
        local suggested=$(suggest_quality "$duration")
        # Only log suggestion, don't auto-change (agent should decide)
    fi

    # Get extraction FPS
    local extraction_fps=$(get_extraction_fps)
    local expected_frames=$(echo "$duration * $extraction_fps" | bc | cut -d. -f1)

    log_info "Extracting at ${extraction_fps} fps (quality: $QUALITY)"
    log_info "Expected frames: ~$expected_frames"

    # Build FFmpeg filter
    local vf_filter=""

    if [[ "$ADAPTIVE" == "true" ]]; then
        # Adaptive mode: combines FPS sampling with scene detection and motion awareness
        # Uses a lower scene threshold (0.3) to catch more transitions
        # Also ensures frames during high-motion sequences are captured
        local interval=$(echo "scale=4; 1 / $extraction_fps" | bc)
        vf_filter="select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,$interval)+gt(scene\\,0.3)',scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"
        log_info "Adaptive sampling enabled - optimized for motion and transitions"
    elif [[ "$SCENE_BOOST" == "true" ]]; then
        # Scene boost: first do FPS-based extraction, then also grab scene changes
        # We use select filter with combined condition
        # isnan(prev_selected_t) handles first frame, then either FPS interval OR scene change
        local interval=$(echo "scale=4; 1 / $extraction_fps" | bc)
        vf_filter="select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,$interval)+gt(scene\\,0.4)',scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"
        log_info "Scene boost enabled - will capture additional transition frames"
    else
        # Pure FPS-based extraction
        vf_filter="fps=$extraction_fps,scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"
    fi

    # FFmpeg extraction
    ffmpeg -i "$input" \
        -vf "$vf_filter" \
        -vsync vfr \
        -q:v 2 \
        "$output_dir/frame_%04d.jpg" \
        2>&1 | grep -E "^frame=" >&2 || true

    # Count extracted frames
    local frame_count=$(ls -1 "$output_dir"/frame_*.jpg 2>/dev/null | wc -l | tr -d ' ')

    if [[ $frame_count -eq 0 ]]; then
        log_error "No frames extracted. The video may be corrupted or too short."
        echo '{"success": false, "error": "No frames extracted"}'
        exit 1
    fi

    # If too many frames, keep only evenly distributed ones
    if [[ $frame_count -gt $MAX_FRAMES ]]; then
        log_warn "Extracted $frame_count frames, limiting to $MAX_FRAMES"

        # Keep every Nth frame to reduce to MAX_FRAMES
        local keep_every=$((frame_count / MAX_FRAMES + 1))
        local counter=0
        local kept=0
        for f in "$output_dir"/frame_*.jpg; do
            if [[ $((counter % keep_every)) -eq 0 ]] && [[ $kept -lt $MAX_FRAMES ]]; then
                ((kept++))
            else
                rm "$f"
            fi
            ((counter++))
        done

        # Renumber remaining frames
        counter=1
        for f in "$output_dir"/frame_*.jpg; do
            mv "$f" "$output_dir/frame_$(printf '%04d' $counter).jpg"
            ((counter++))
        done

        frame_count=$((counter - 1))
    fi

    log_info "Extracted $frame_count frames to $output_dir"

    # Token estimate (~500 tokens per frame)
    local token_estimate=$((frame_count * 500))
    log_info "Estimated tokens for analysis: ~$token_estimate"

    # Run motion analysis if requested
    local temporal_metadata_file=""
    if [[ "$INCLUDE_METADATA" == "true" ]] || [[ "$ADAPTIVE" == "true" ]]; then
        temporal_metadata_file="$output_dir/temporal-metadata.json"
        if [[ -x "$SCRIPT_DIR/analyze-motion.sh" ]]; then
            log_info "Running motion analysis..."
            "$SCRIPT_DIR/analyze-motion.sh" "$input" --output "$temporal_metadata_file" >/dev/null 2>&1 || {
                log_warn "Motion analysis failed, continuing without temporal metadata"
                temporal_metadata_file=""
            }
            if [[ -f "$temporal_metadata_file" ]]; then
                log_info "Temporal metadata written to: $temporal_metadata_file"
                # Add token overhead for metadata
                token_estimate=$((token_estimate + 500))
            fi
        else
            log_warn "analyze-motion.sh not found, skipping motion analysis"
        fi
    fi

    # Generate diff frames if requested
    local diff_manifest_file=""
    if [[ "$INCLUDE_DIFFS" == "true" ]]; then
        if [[ -x "$SCRIPT_DIR/generate-diff-frames.sh" ]]; then
            log_info "Generating diff frames..."
            "$SCRIPT_DIR/generate-diff-frames.sh" "$input" "$output_dir" --fps "$extraction_fps" >/dev/null 2>&1 || {
                log_warn "Diff frame generation failed, continuing without diffs"
            }
            if [[ -f "$output_dir/diff-manifest.json" ]]; then
                diff_manifest_file="$output_dir/diff-manifest.json"
                local diff_count=$(ls -1 "$output_dir"/diff_*.jpg 2>/dev/null | wc -l | tr -d ' ')
                log_info "Generated $diff_count diff frames"
                # Add token overhead for diff frames (~300 tokens each, less detail than full frames)
                token_estimate=$((token_estimate + diff_count * 300))
            fi
        else
            log_warn "generate-diff-frames.sh not found, skipping diff generation"
        fi
    fi

    log_info "Estimated tokens for analysis: ~$token_estimate"

    # Build frame list
    local frames_json="["
    local first=true
    for f in "$output_dir"/frame_*.jpg; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            frames_json+=","
        fi
        frames_json+="\"$(basename "$f")\""
    done
    frames_json+="]"

    # Build frame details with timestamps and motion scores if available
    local frame_details_json="[]"
    if [[ -n "$temporal_metadata_file" ]] && [[ -f "$temporal_metadata_file" ]]; then
        # Extract frame details from temporal metadata, matching to extracted frames
        frame_details_json=$(jq -c '
            .frames as $motion_frames |
            [range(1; (.frames | length) + 1)] |
            map(. as $i |
                ($motion_frames | map(select(.frame_number == $i)) | first) // {} |
                {
                    filename: ("frame_" + ($i | tostring | if length < 4 then "0" * (4 - length) + . else . end) + ".jpg"),
                    frame_number: $i,
                    timestamp_ms: .timestamp_ms,
                    motion_score: .motion_score,
                    classification: .classification,
                    source: (if .is_scene_boundary then "scene_change" else "regular" end)
                }
            )
        ' "$temporal_metadata_file" 2>/dev/null || echo "[]")
    fi

    # Build output JSON
    local temporal_metadata_value="null"
    local diff_manifest_value="null"
    if [[ -n "$temporal_metadata_file" ]]; then
        temporal_metadata_value="\"$temporal_metadata_file\""
    fi
    if [[ -n "$diff_manifest_file" ]]; then
        diff_manifest_value="\"$diff_manifest_file\""
    fi

    # Output JSON result
    cat << EOF
{
    "success": true,
    "frames": $frames_json,
    "count": $frame_count,
    "duration": $duration,
    "dimensions": "$dimensions",
    "fps_used": $extraction_fps,
    "quality": "$QUALITY",
    "scene_boost": $SCENE_BOOST,
    "adaptive_sampling": $ADAPTIVE,
    "token_estimate": $token_estimate,
    "output_dir": "$output_dir",
    "temporal_metadata": $temporal_metadata_value,
    "diff_manifest": $diff_manifest_value,
    "frame_details": $frame_details_json,
    "settings": {
        "quality": "$QUALITY",
        "fps": $extraction_fps,
        "max_frames": $MAX_FRAMES,
        "scene_boost": $SCENE_BOOST,
        "adaptive": $ADAPTIVE,
        "include_metadata": $INCLUDE_METADATA,
        "include_diffs": $INCLUDE_DIFFS
    }
}
EOF
}

# Main
check_dependencies
parse_args "$@"
extract_frames "$INPUT" "$OUTPUT_DIR"
