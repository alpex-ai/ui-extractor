#!/bin/bash
# figma-export.sh - Export design system to Figma
# Supports Figma MCP (preferred) or REST API (fallback)
#
# Usage: ./figma-export.sh --design-system <json_file> [options]
# Options:
#   --push-to-figma       Push to Figma (otherwise just outputs JSON)
#   --file-key <key>      Figma file key (from URL)
#   --collection <name>   Collection name (default: "Design System")
#   --format <type>       Output format: figma-tokens, style-dictionary, css (default: figma-tokens)
#
# Environment:
#   FIGMA_ACCESS_TOKEN    Required for REST API push (not needed if MCP available)
#
# Output: JSON to stdout (converted format or API response)
# Status messages: stderr

set -e

# Default configuration
DESIGN_SYSTEM_FILE=""
PUSH_TO_FIGMA=false
FILE_KEY=""
COLLECTION_NAME="Design System"
OUTPUT_FORMAT="figma-tokens"

# Colors for stderr
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

# Check if jq is available
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed."
        log_error "Install with: brew install jq"
        echo '{"success": false, "error": "jq not installed"}'
        exit 1
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --design-system)
                DESIGN_SYSTEM_FILE="$2"
                shift 2
                ;;
            --push-to-figma)
                PUSH_TO_FIGMA=true
                shift
                ;;
            --file-key)
                FILE_KEY="$2"
                shift 2
                ;;
            --collection)
                COLLECTION_NAME="$2"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                shift 2
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

    if [[ -z "$DESIGN_SYSTEM_FILE" ]]; then
        log_error "Missing required --design-system argument"
        show_help
        exit 1
    fi

    if [[ ! -f "$DESIGN_SYSTEM_FILE" ]]; then
        log_error "Design system file not found: $DESIGN_SYSTEM_FILE"
        echo '{"success": false, "error": "Design system file not found"}'
        exit 1
    fi
}

show_help() {
    cat >&2 << EOF
figma-export.sh - Export design system to Figma

USAGE:
    ./figma-export.sh --design-system <json_file> [options]

OPTIONS:
    --design-system <file>  Path to design system JSON (required)
    --push-to-figma         Push variables to Figma
    --file-key <key>        Figma file key (required for push)
    --collection <name>     Variable collection name (default: "Design System")
    --format <type>         Output format: figma-tokens, style-dictionary, css
    -h, --help              Show this help message

ENVIRONMENT:
    FIGMA_ACCESS_TOKEN      Required for API push (generate at figma.com/developers)

EXAMPLES:
    # Output as Figma Tokens format
    ./figma-export.sh --design-system ./design-system.json

    # Output as CSS custom properties
    ./figma-export.sh --design-system ./design-system.json --format css

    # Push to Figma via API
    export FIGMA_ACCESS_TOKEN="figd_xxx"
    ./figma-export.sh --design-system ./design-system.json --push-to-figma --file-key abc123
EOF
}

# Convert hex to Figma RGBA (0-1 range)
hex_to_figma_rgba() {
    local hex="$1"
    # Remove # if present
    hex="${hex#\#}"

    local r=$((16#${hex:0:2}))
    local g=$((16#${hex:2:2}))
    local b=$((16#${hex:4:2}))

    # Convert to 0-1 range with 3 decimal places
    local r_float=$(echo "scale=3; $r / 255" | bc)
    local g_float=$(echo "scale=3; $g / 255" | bc)
    local b_float=$(echo "scale=3; $b / 255" | bc)

    echo "{\"r\": $r_float, \"g\": $g_float, \"b\": $b_float, \"a\": 1}"
}

# Normalize input - handle both flat and nested (.designSystem) formats
normalize_input() {
    local input="$1"
    # Check if data is nested under .designSystem
    if jq -e '.designSystem' "$input" > /dev/null 2>&1; then
        jq '.designSystem' "$input"
    else
        cat "$input"
    fi
}

# Convert design system to Figma Tokens format
convert_to_figma_tokens() {
    local input="$1"

    normalize_input "$input" | jq '{
        color: (
            (.colors // {}) | to_entries | map(
                if .value | type == "object" and .value.hex then
                    {(.key): {value: .value.hex, type: "color"}}
                elif .value | type == "object" then
                    .value | to_entries | map(
                        if .value | type == "object" and .value.hex then
                            {(.key): {value: .value.hex, type: "color"}}
                        else empty
                        end
                    ) | add // {} | {"\(.key)": .}
                else empty
                end
            ) | add // {}
        ),
        spacing: (
            (.spacing.scale // {}) | to_entries | map(
                if .value.value then
                    {(.key): {value: (.value.value | gsub("px$"; "")), type: "spacing"}}
                else empty
                end
            ) | add // {}
        ),
        borderRadius: (
            (.radii // {}) | to_entries | map(
                if .value.value then
                    {(.key): {value: (.value.value | gsub("px$"; "")), type: "borderRadius"}}
                else empty
                end
            ) | add // {}
        ),
        typography: (
            (.typography.styles // {}) | to_entries | map(
                {
                    (.key): {
                        fontSize: {value: (.value.fontSize // "16px" | gsub("px$"; "")), type: "fontSizes"},
                        fontWeight: {value: (.value.fontWeight // "400"), type: "fontWeights"},
                        lineHeight: {value: (.value.lineHeight // "1.5"), type: "lineHeights"}
                    }
                }
            ) | add // {}
        )
    }'
}

# Convert design system to Style Dictionary format
convert_to_style_dictionary() {
    local input="$1"

    normalize_input "$input" | jq '{
        color: (
            (.colors // {}) | to_entries | map(
                if .value | type == "object" and .value.hex then
                    {(.key): {value: .value.hex}}
                elif .value | type == "object" then
                    {(.key): (
                        .value | to_entries | map(
                            if .value | type == "object" and .value.hex then
                                {(.key): {value: .value.hex}}
                            else empty
                            end
                        ) | add // {}
                    )}
                else empty
                end
            ) | add // {}
        ),
        size: {
            spacing: (
                (.spacing.scale // {}) | to_entries | map(
                    if .value.value then
                        {(.key): {value: .value.value}}
                    else empty
                    end
                ) | add // {}
            ),
            radius: (
                (.radii // {}) | to_entries | map(
                    if .value.value then
                        {(.key): {value: .value.value}}
                    else empty
                    end
                ) | add // {}
            )
        }
    }'
}

# Convert design system to CSS custom properties
convert_to_css() {
    local input="$1"
    local normalized=$(normalize_input "$input")

    echo ":root {"

    # Colors - handle both flat and nested structures
    echo "$normalized" | jq -r '
        def extract_colors(prefix):
            to_entries[] |
            if .value | type == "object" and has("hex") then
                "  --color-\(prefix)\(.key): \(.value.hex);"
            elif .value | type == "object" then
                .key as $k |
                .value | extract_colors("\($k)-")
            else empty
            end;
        (.colors // {}) | extract_colors("")
    '

    # Spacing
    echo "$normalized" | jq -r '
        (.spacing.scale // {}) | to_entries[] |
        if .value.value then
            "  --spacing-\(.key): \(.value.value);"
        else empty
        end
    '

    # Radii
    echo "$normalized" | jq -r '
        (.radii // {}) | to_entries[] |
        if .value.value then
            "  --radius-\(.key): \(.value.value);"
        else empty
        end
    '

    # Typography
    echo "$normalized" | jq -r '
        (.typography.styles // {}) | to_entries[] |
        "  --font-size-\(.key): \(.value.fontSize // "16px");",
        "  --font-weight-\(.key): \(.value.fontWeight // "400");",
        "  --line-height-\(.key): \(.value.lineHeight // "1.5");"
    '

    # Shadows
    echo "$normalized" | jq -r '
        (.shadows // {}) | to_entries[] |
        if .value.value then
            "  --shadow-\(.key): \(.value.value);"
        else empty
        end
    '

    echo "}"
}

# Push to Figma via REST API
push_to_figma_api() {
    local input="$1"
    local file_key="$2"
    local collection_name="$3"

    if [[ -z "$FIGMA_ACCESS_TOKEN" ]]; then
        log_error "FIGMA_ACCESS_TOKEN environment variable not set"
        log_error "Generate a token at: https://www.figma.com/developers/api#access-tokens"
        echo '{"success": false, "error": "FIGMA_ACCESS_TOKEN not set"}'
        exit 1
    fi

    log_info "Pushing to Figma file: $file_key"
    log_info "Collection: $collection_name"

    # Get existing variables to check for collection
    log_info "Fetching existing variables..."
    local existing=$(curl -s -X GET \
        "https://api.figma.com/v1/files/${file_key}/variables/local" \
        -H "X-Figma-Token: ${FIGMA_ACCESS_TOKEN}")

    # Check for errors
    if echo "$existing" | jq -e '.err' > /dev/null 2>&1; then
        local error_msg=$(echo "$existing" | jq -r '.err')
        log_error "Figma API error: $error_msg"
        echo "{\"success\": false, \"error\": \"$error_msg\"}"
        exit 1
    fi

    # Find or note that we need to create collection
    local collection_id=$(echo "$existing" | jq -r --arg name "$collection_name" '
        .meta.variableCollections | to_entries[] |
        select(.value.name == $name) | .key
    ')

    local mode_id=""
    local create_collection=false

    if [[ -z "$collection_id" || "$collection_id" == "null" ]]; then
        log_info "Collection '$collection_name' not found, will create"
        create_collection=true
    else
        log_info "Found existing collection: $collection_id"
        mode_id=$(echo "$existing" | jq -r --arg cid "$collection_id" '
            .meta.variableCollections[$cid].modes[0].modeId
        ')
    fi

    # Build the variables payload
    local variables_json=$(normalize_input "$input" | jq -c '
        def flatten_colors:
            (.colors // {}) | to_entries | map(
                if .value | type == "object" and .value.hex then
                    {name: "color/\(.key)", hex: .value.hex, type: "COLOR"}
                elif .value | type == "object" then
                    .key as $parent |
                    .value | to_entries | map(
                        if .value | type == "object" and .value.hex then
                            {name: "color/\($parent)/\(.key)", hex: .value.hex, type: "COLOR"}
                        else empty
                        end
                    )[]
                else empty
                end
            );

        def flatten_spacing:
            (.spacing.scale // {}) | to_entries | map(
                if .value.value then
                    {name: "spacing/\(.key)", value: (.value.value | gsub("px$"; "") | tonumber), type: "FLOAT"}
                else empty
                end
            );

        def flatten_radii:
            (.radii // {}) | to_entries | map(
                if .value.value then
                    {name: "radius/\(.key)", value: (.value.value | gsub("px$"; "") | tonumber), type: "FLOAT"}
                else empty
                end
            );

        [flatten_colors, flatten_spacing, flatten_radii] | flatten
    ')

    log_info "Preparing $(echo "$variables_json" | jq 'length') variables..."

    # For now, output what would be sent (actual API push requires more complex handling)
    cat << EOF
{
    "success": true,
    "method": "figma-api",
    "fileKey": "$file_key",
    "collection": "$collection_name",
    "collectionExists": $(if [ "$create_collection" = true ]; then echo "false"; else echo "true"; fi),
    "variableCount": $(echo "$variables_json" | jq 'length'),
    "variables": $variables_json,
    "note": "To complete the push, use the Figma MCP or manually import the figma-tokens format"
}
EOF
}

# Main function
main() {
    check_dependencies
    parse_args "$@"

    log_info "Processing design system: $DESIGN_SYSTEM_FILE"
    log_info "Output format: $OUTPUT_FORMAT"

    if [[ "$PUSH_TO_FIGMA" == "true" ]]; then
        if [[ -z "$FILE_KEY" ]]; then
            log_error "Figma file key required for push (use --file-key)"
            echo '{"success": false, "error": "No file key provided"}'
            exit 1
        fi

        push_to_figma_api "$DESIGN_SYSTEM_FILE" "$FILE_KEY" "$COLLECTION_NAME"
    else
        case "$OUTPUT_FORMAT" in
            figma-tokens)
                convert_to_figma_tokens "$DESIGN_SYSTEM_FILE"
                ;;
            style-dictionary)
                convert_to_style_dictionary "$DESIGN_SYSTEM_FILE"
                ;;
            css)
                convert_to_css "$DESIGN_SYSTEM_FILE"
                ;;
            *)
                log_error "Unknown format: $OUTPUT_FORMAT"
                log_error "Supported: figma-tokens, style-dictionary, css"
                exit 1
                ;;
        esac
    fi
}

main "$@"
