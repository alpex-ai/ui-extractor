#!/bin/bash
# analyze-motion.sh - Temporal motion analysis for screen recordings
# Computes frame-to-frame motion scores, detects scene changes, and identifies animation sequences
#
# Usage: ./analyze-motion.sh <input_video> [options]
# Options:
#   --output <file>           Output JSON file (default: stdout)
#   --scene-threshold <0-1>   Scene change threshold (default: 0.4)
#   --motion-threshold <0-1>  High motion threshold (default: 0.3)
#   --sample-rate <fps>       Analysis sample rate (default: 10 for efficiency)
#
# Output: JSON with per-frame motion data, animation sequences, and scene boundaries

set -e

# Default configuration
OUTPUT_FILE=""
SCENE_THRESHOLD=0.4
MOTION_THRESHOLD=0.3
SAMPLE_RATE=10
STATIC_THRESHOLD=0.05
LOW_MOTION_THRESHOLD=0.3

# Colors for stderr output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_debug() { echo -e "${CYAN}[DEBUG]${NC} $1" >&2; }

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
        echo '{"success": false, "error": "ffprobe not installed"}'
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed."
        log_error "Install with: brew install jq"
        echo '{"success": false, "error": "jq not installed"}'
        exit 1
    fi
}

# Get video metadata
get_video_info() {
    local input="$1"
    local duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null)
    local fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null | bc -l 2>/dev/null || echo "30")
    local width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null)
    local height=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "$input" 2>/dev/null)

    echo "$duration $fps $width $height"
}

# Parse arguments
parse_args() {
    INPUT=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --scene-threshold)
                SCENE_THRESHOLD="$2"
                shift 2
                ;;
            --motion-threshold)
                MOTION_THRESHOLD="$2"
                shift 2
                ;;
            --sample-rate)
                SAMPLE_RATE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "$INPUT" ]]; then
                    INPUT="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$INPUT" ]]; then
        log_error "Usage: $0 <input_video> [options]"
        echo '{"success": false, "error": "Missing input video"}'
        exit 1
    fi

    if [[ ! -f "$INPUT" ]]; then
        log_error "Input file not found: $INPUT"
        echo '{"success": false, "error": "Input file not found", "path": "'"$INPUT"'"}'
        exit 1
    fi
}

show_help() {
    cat >&2 << 'EOF'
analyze-motion.sh - Temporal motion analysis for screen recordings

USAGE:
    ./analyze-motion.sh <input_video> [options]

OPTIONS:
    --output <file>           Output JSON file (default: stdout)
    --scene-threshold <0-1>   Scene change threshold (default: 0.4)
    --motion-threshold <0-1>  High motion threshold (default: 0.3)
    --sample-rate <fps>       Analysis sample rate (default: 10)
    -h, --help                Show this help message

OUTPUT:
    JSON object with:
    - frames[]: Per-frame motion scores and classifications
    - animation_sequences[]: Detected animation/transition sequences
    - scene_boundaries[]: Frame numbers where major UI changes occur
    - summary: Statistics about motion distribution

CLASSIFICATION:
    - static:       motion_score < 0.05
    - low_motion:   motion_score 0.05 - 0.3
    - high_motion:  motion_score 0.3 - 0.7
    - scene_change: scene_score > threshold OR motion_score > 0.7

EXAMPLES:
    # Basic analysis
    ./analyze-motion.sh recording.mov

    # Save to file with custom thresholds
    ./analyze-motion.sh recording.mov --output motion.json --scene-threshold 0.3

    # Higher sample rate for detailed analysis
    ./analyze-motion.sh recording.mov --sample-rate 30
EOF
}

# Extract scene scores using FFmpeg's scene detection
extract_scene_scores() {
    local input="$1"
    local temp_file="$2"

    log_info "Extracting scene change scores..."

    # Use FFmpeg to extract scene scores at sample rate
    # The metadata filter outputs scene_score for each frame
    ffmpeg -i "$input" \
        -vf "fps=$SAMPLE_RATE,select='gte(scene,0)',metadata=print:file=$temp_file" \
        -f null - 2>/dev/null
}

# Extract motion magnitude using frame difference
extract_motion_scores() {
    local input="$1"
    local temp_file="$2"

    log_info "Computing frame-to-frame motion magnitude..."

    # Use tblend to compute frame differences, then blackframe to quantify
    # blackframe outputs percentage of near-black pixels (inverse of motion)
    ffmpeg -i "$input" \
        -vf "fps=$SAMPLE_RATE,tblend=all_mode=difference,blackframe=amount=0:threshold=32" \
        -f null - 2>&1 | grep -E "^\[Parsed_blackframe" > "$temp_file" || true
}

# Parse scene metadata file
parse_scene_data() {
    local scene_file="$1"

    # Parse the metadata output format:
    # frame:N    pts:T    pts_time:T.TTT
    # lavfi.scene_score=0.XXXXX

    awk '
    /^frame:/ {
        split($1, a, ":")
        frame = a[2]
        split($3, b, ":")
        pts_time = b[2]
    }
    /lavfi.scene_score/ {
        split($0, a, "=")
        score = a[2]
        print frame "," pts_time "," score
    }
    ' "$scene_file"
}

# Parse blackframe output for motion scores
parse_motion_data() {
    local motion_file="$1"

    # Parse blackframe output format:
    # [Parsed_blackframe_1 @ 0x...] frame:N pblack:P pts:T t:T.TTT...
    # pblack is percentage of black pixels (0-100)
    # We invert: motion_score = 1 - (pblack/100)

    awk -F'[ :]' '
    /pblack/ {
        for(i=1; i<=NF; i++) {
            if($i == "frame") frame = $(i+1)
            if($i == "pblack") pblack = $(i+1)
            if($i == "t") pts_time = $(i+1)
        }
        # Invert: high pblack = low motion, low pblack = high motion
        motion = 1 - (pblack / 100)
        print frame "," pts_time "," motion
    }
    ' "$motion_file"
}

# Classify frame based on scores
classify_frame() {
    local scene_score="$1"
    local motion_score="$2"

    # Scene change takes priority
    if (( $(echo "$scene_score > $SCENE_THRESHOLD" | bc -l) )); then
        echo "scene_change"
    elif (( $(echo "$motion_score > 0.7" | bc -l) )); then
        echo "scene_change"
    elif (( $(echo "$motion_score > $LOW_MOTION_THRESHOLD" | bc -l) )); then
        echo "high_motion"
    elif (( $(echo "$motion_score > $STATIC_THRESHOLD" | bc -l) )); then
        echo "low_motion"
    else
        echo "static"
    fi
}

# Detect animation sequences (consecutive high-motion frames)
detect_animation_sequences() {
    local frames_json="$1"

    # Use jq to find consecutive high_motion or scene_change frames
    echo "$frames_json" | jq -c '
        # Group consecutive frames by motion status
        reduce .[] as $frame (
            {sequences: [], current: null, prev_high: false};

            if ($frame.classification == "high_motion" or $frame.classification == "scene_change") then
                if .prev_high then
                    # Continue current sequence
                    .current.end_frame = $frame.frame_number |
                    .current.end_time_ms = $frame.timestamp_ms |
                    .current.frames += [$frame] |
                    .prev_high = true
                else
                    # Start new sequence
                    if .current != null then .sequences += [.current] else . end |
                    .current = {
                        start_frame: $frame.frame_number,
                        end_frame: $frame.frame_number,
                        start_time_ms: $frame.timestamp_ms,
                        end_time_ms: $frame.timestamp_ms,
                        frames: [$frame]
                    } |
                    .prev_high = true
                end
            else
                # End current sequence if exists
                if .current != null and (.current.frames | length) >= 2 then
                    .sequences += [.current]
                else . end |
                .current = null |
                .prev_high = false
            end
        ) |
        # Finalize last sequence
        if .current != null and (.current.frames | length) >= 2 then
            .sequences += [.current]
        else . end |
        .sequences |
        # Calculate duration and stats for each sequence
        map({
            start_frame: .start_frame,
            end_frame: .end_frame,
            start_time_ms: (.start_time_ms | floor),
            end_time_ms: (.end_time_ms | floor),
            duration_ms: ((.end_time_ms - .start_time_ms) | floor),
            type: (if any(.frames[]; .classification == "scene_change") then "transition" else "animation" end),
            avg_motion_score: (([.frames[].motion_score] | add) / ([.frames[].motion_score] | length) | . * 100 | floor / 100),
            peak_motion_score: ([.frames[].motion_score] | max | . * 100 | floor / 100),
            frame_count: (.frames | length)
        }) |
        # Filter out very short sequences (< 2 frames)
        map(select(.frame_count >= 2))
    '
}

# Main analysis function
analyze_motion() {
    local input="$1"

    # Get video info
    read -r duration fps width height <<< $(get_video_info "$input")
    local duration_ms=$(echo "$duration * 1000" | bc | cut -d. -f1)
    local total_frames=$(echo "$duration * $fps" | bc | cut -d. -f1)

    log_info "Video: ${duration}s, ${fps}fps, ${width}x${height}"
    log_info "Analyzing at ${SAMPLE_RATE}fps sample rate..."

    # Create temp files
    local scene_temp=$(mktemp)
    local motion_temp=$(mktemp)
    local scene_parsed=$(mktemp)
    local motion_parsed=$(mktemp)

    # Extract scores
    extract_scene_scores "$input" "$scene_temp"
    extract_motion_scores "$input" "$motion_temp"

    # Parse extracted data
    parse_scene_data "$scene_temp" > "$scene_parsed"
    parse_motion_data "$motion_temp" > "$motion_parsed"

    log_info "Processing frame data..."

    # Combine scene and motion data into frames array
    # Join on frame number, handling missing data
    local frames_json=$(awk -F',' '
        BEGIN { OFS="," }
        NR==FNR {
            scene_score[$1] = $3
            pts_time[$1] = $2
            next
        }
        {
            frame = $1
            motion = $3
            time_ms = $2 * 1000
            scene = (frame in scene_score) ? scene_score[frame] : 0

            # Classification logic
            if (scene > '"$SCENE_THRESHOLD"' || motion > 0.7) {
                class = "scene_change"
            } else if (motion > '"$LOW_MOTION_THRESHOLD"') {
                class = "high_motion"
            } else if (motion > '"$STATIC_THRESHOLD"') {
                class = "low_motion"
            } else {
                class = "static"
            }

            is_boundary = (scene > '"$SCENE_THRESHOLD"') ? "true" : "false"

            printf "{\"frame_number\":%d,\"timestamp_ms\":%.0f,\"scene_score\":%.4f,\"motion_score\":%.4f,\"classification\":\"%s\",\"is_scene_boundary\":%s}\n", \
                frame, time_ms, scene, motion, class, is_boundary
        }
    ' "$scene_parsed" "$motion_parsed" | jq -s '.')

    # Handle empty frames case
    if [[ -z "$frames_json" ]] || [[ "$frames_json" == "[]" ]]; then
        log_warn "No frame data extracted, using fallback analysis..."
        frames_json="[]"
    fi

    # Detect animation sequences
    local sequences_json=$(detect_animation_sequences "$frames_json")

    # Extract scene boundaries
    local boundaries_json=$(echo "$frames_json" | jq '[.[] | select(.is_scene_boundary == true) | .frame_number]')

    # Calculate summary statistics
    local summary_json=$(echo "$frames_json" | jq '
        if length == 0 then
            {
                static_frames_pct: 0,
                low_motion_pct: 0,
                high_motion_pct: 0,
                scene_change_pct: 0,
                total_analyzed_frames: 0
            }
        else
            {
                static_frames_pct: (([.[] | select(.classification == "static")] | length) * 100 / length | floor),
                low_motion_pct: (([.[] | select(.classification == "low_motion")] | length) * 100 / length | floor),
                high_motion_pct: (([.[] | select(.classification == "high_motion")] | length) * 100 / length | floor),
                scene_change_pct: (([.[] | select(.classification == "scene_change")] | length) * 100 / length | floor),
                total_analyzed_frames: length
            }
        end
    ')

    # Add animation stats to summary
    local anim_count=$(echo "$sequences_json" | jq 'length')
    local total_anim_duration=$(echo "$sequences_json" | jq '[.[].duration_ms] | add // 0')
    summary_json=$(echo "$summary_json" | jq ". + {animation_count: $anim_count, total_animation_duration_ms: $total_anim_duration}")

    # Clean up temp files
    rm -f "$scene_temp" "$motion_temp" "$scene_parsed" "$motion_parsed"

    # Build final JSON output
    local output_json=$(jq -n \
        --argjson frames "$frames_json" \
        --argjson sequences "$sequences_json" \
        --argjson boundaries "$boundaries_json" \
        --argjson summary "$summary_json" \
        --arg source "$input" \
        --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --argjson duration_ms "$duration_ms" \
        --argjson fps "$fps" \
        --argjson total_frames "$total_frames" \
        --arg dimensions "${width}x${height}" \
        --argjson sample_rate "$SAMPLE_RATE" \
        --argjson scene_threshold "$SCENE_THRESHOLD" \
        --argjson motion_threshold "$MOTION_THRESHOLD" \
        '{
            success: true,
            version: "1.0",
            source_video: $source,
            analysis_date: $date,
            video_info: {
                duration_ms: $duration_ms,
                fps: $fps,
                total_frames: $total_frames,
                dimensions: $dimensions
            },
            analysis_settings: {
                sample_rate: $sample_rate,
                scene_threshold: $scene_threshold,
                motion_threshold: $motion_threshold
            },
            frames: $frames,
            animation_sequences: $sequences,
            scene_boundaries: $boundaries,
            summary: $summary
        }')

    log_info "Analysis complete: $anim_count animation sequences, $(echo "$boundaries_json" | jq 'length') scene boundaries"

    # Output results
    if [[ -n "$OUTPUT_FILE" ]]; then
        echo "$output_json" > "$OUTPUT_FILE"
        log_info "Results written to: $OUTPUT_FILE"
    else
        echo "$output_json"
    fi
}

# Main
check_dependencies
parse_args "$@"
analyze_motion "$INPUT"
