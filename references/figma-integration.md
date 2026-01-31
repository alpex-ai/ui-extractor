# Figma Integration Guide

This document describes how to export extracted design systems to Figma, either via the Figma MCP or directly through the REST API.

## Overview

The skill supports two methods for pushing design tokens to Figma:

1. **Figma MCP (Preferred)**: If the Figma MCP server is configured, use its tools directly
2. **Figma REST API (Fallback)**: Use the Variables API with an access token

## Method 1: Figma MCP Integration

### Prerequisites

The user must have the Figma MCP server configured in their Claude Code settings.

### Detection

Check if Figma MCP is available by looking for these tools:
- `figma_get_file`
- `figma_create_variable`
- `figma_get_variables`

### Usage

When MCP is available, use the tools directly:

```
// Get existing variables from a file
figma_get_variables(fileKey: "abc123")

// Create a color variable
figma_create_variable(
  fileKey: "abc123",
  collectionName: "Design System",
  variableName: "color/primary",
  variableType: "COLOR",
  value: { r: 0.23, g: 0.51, b: 0.96 }
)
```

### Variable Naming Convention

Use slash-separated paths for organization:
- `color/primary`
- `color/background/default`
- `color/text/primary`
- `spacing/sm`
- `spacing/md`
- `radius/sm`
- `radius/lg`

## Method 2: Figma REST API

### Prerequisites

1. **Figma Access Token**: Generate at https://www.figma.com/developers/api#access-tokens
2. **File Key**: From the Figma file URL: `figma.com/design/{FILE_KEY}/...`

### Environment Setup

Set the access token as an environment variable:

```bash
export FIGMA_ACCESS_TOKEN="figd_xxxxxxxxxxxxx"
```

### API Endpoints

#### Get Existing Variables

```bash
curl -X GET "https://api.figma.com/v1/files/{file_key}/variables/local" \
  -H "X-Figma-Token: ${FIGMA_ACCESS_TOKEN}"
```

#### Create Variable Collection

```bash
curl -X POST "https://api.figma.com/v1/files/{file_key}/variables" \
  -H "X-Figma-Token: ${FIGMA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "variableCollections": [
      {
        "action": "CREATE",
        "name": "Design System",
        "initialModeId": "default"
      }
    ]
  }'
```

#### Create Variables

```bash
curl -X POST "https://api.figma.com/v1/files/{file_key}/variables" \
  -H "X-Figma-Token: ${FIGMA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": [
      {
        "action": "CREATE",
        "name": "color/primary",
        "resolvedType": "COLOR",
        "variableCollectionId": "{collection_id}",
        "modeValues": {
          "{mode_id}": {
            "r": 0.231,
            "g": 0.51,
            "b": 0.965,
            "a": 1
          }
        }
      }
    ]
  }'
```

### Color Conversion

Figma uses RGBA values from 0-1, not hex. Convert hex to Figma format:

```javascript
function hexToFigma(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b, a: 1 };
}

// Example: #3B82F6 → { r: 0.231, g: 0.510, b: 0.965, a: 1 }
```

### Full Export Workflow

1. **Get or create collection**
   ```
   GET /files/{file_key}/variables/local
   → Check if "Design System" collection exists
   → If not, POST to create it
   ```

2. **Map tokens to variables**
   ```javascript
   const variables = [
     { name: "color/primary", type: "COLOR", value: hexToFigma(designSystem.colors.primary.hex) },
     { name: "color/secondary", type: "COLOR", value: hexToFigma(designSystem.colors.secondary.hex) },
     { name: "spacing/sm", type: "FLOAT", value: parseFloat(designSystem.spacing.scale.sm.value) },
     // ...
   ];
   ```

3. **Create/update variables**
   ```
   POST /files/{file_key}/variables
   → Batch create all variables
   ```

## JSON Export Format (Manual Import)

If neither MCP nor API is available, output JSON for manual import:

### For Figma Tokens Plugin

```json
{
  "color": {
    "primary": {
      "value": "#3B82F6",
      "type": "color"
    },
    "secondary": {
      "value": "#8B5CF6",
      "type": "color"
    },
    "background": {
      "default": {
        "value": "#FFFFFF",
        "type": "color"
      }
    }
  },
  "spacing": {
    "sm": {
      "value": "8",
      "type": "spacing"
    },
    "md": {
      "value": "16",
      "type": "spacing"
    }
  },
  "borderRadius": {
    "sm": {
      "value": "4",
      "type": "borderRadius"
    }
  }
}
```

### For Style Dictionary

```json
{
  "color": {
    "primary": { "value": "#3B82F6" },
    "secondary": { "value": "#8B5CF6" }
  },
  "size": {
    "spacing": {
      "sm": { "value": "8px" },
      "md": { "value": "16px" }
    }
  }
}
```

## Script Usage

### With Figma MCP

```bash
# Automatic detection - uses MCP if available
./scripts/figma-export.sh --design-system ./output/design-system.json --push-to-figma

# Specify file key
./scripts/figma-export.sh --design-system ./output/design-system.json --push-to-figma --file-key abc123def
```

### With REST API

```bash
# Requires FIGMA_ACCESS_TOKEN env var
export FIGMA_ACCESS_TOKEN="figd_xxx"
./scripts/figma-export.sh --design-system ./output/design-system.json --push-to-figma --file-key abc123def
```

### JSON Only

```bash
# Just output Figma-compatible JSON
./scripts/figma-export.sh --design-system ./output/design-system.json --format figma-tokens
./scripts/figma-export.sh --design-system ./output/design-system.json --format style-dictionary
```

## Troubleshooting

### "No Figma file key provided"
- Extract from URL: `figma.com/design/[THIS_PART]/...`
- Or provide via `--file-key` flag

### "Access token invalid"
- Regenerate at https://www.figma.com/developers/api#access-tokens
- Ensure token has write access

### "Collection not found"
- The script will create one named "Design System"
- Or specify existing collection with `--collection`

### "Rate limited"
- Figma API has rate limits
- Script includes automatic retry with backoff

## Supported Variable Types

| Design Token | Figma Type | Notes |
|--------------|------------|-------|
| Colors | COLOR | RGBA 0-1 format |
| Spacing | FLOAT | Unitless number |
| Border Radius | FLOAT | Unitless number |
| Font Size | FLOAT | Unitless number |
| Font Weight | FLOAT | 400, 500, 600, etc. |
| Line Height | FLOAT | Multiplier (1.5) or pixels |
| Shadows | STRING | Full CSS shadow value |
| Font Family | STRING | Font name string |

## Best Practices

1. **Use collections**: Group related variables (Colors, Spacing, Typography)
2. **Consistent naming**: Use `category/subcategory/name` format
3. **Include modes**: Support light/dark themes if detected
4. **Preserve confidence**: Add description with confidence level
5. **Document sources**: Note which frames tokens were extracted from
