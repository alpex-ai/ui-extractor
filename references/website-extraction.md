# Website Design System Extraction

Extract design systems directly from live websites using CSS/HTML analysis. This complements the video-based extraction by providing exact CSS values and implementation details.

## Quick Start

```bash
# Basic extraction
./scripts/extract-website.sh "https://example.com"

# Save to file
./scripts/extract-website.sh "https://stripe.com" --output ./stripe-design-system.json

# For JS-heavy SPAs
./scripts/extract-website.sh "https://spa-app.com" --slow

# For Cloudflare-protected sites
./scripts/extract-website.sh "https://protected-site.com" --browser firefox

# Export to Figma
./scripts/extract-website.sh "https://example.com" --output ./design-system.json
./scripts/figma-export.sh ./design-system.json --format figma-tokens
```

## CLI Options

| Flag | Description |
|------|-------------|
| `--output <file>` | Save to file (default: stdout) |
| `--dark-mode` | Extract dark mode variant |
| `--mobile` | Use mobile viewport (390x844) |
| `--slow` | 3x timeouts for JS-heavy SPAs |
| `--browser <type>` | chromium (default) or firefox |
| `--dtcg` | Output W3C Design Tokens format |
| `--json-only` | Output JSON only (no status messages) |

## What Gets Extracted

### Design System Tokens

| Category | Details |
|----------|---------|
| **Colors** | Primary, secondary, accent, background, text, border, semantic (success/warning/error/info) |
| **Typography** | Font families, size scale (h1-h4, body, caption, button, label), weights, line heights |
| **Spacing** | Unit detection, scale (xs-3xl), component padding, page margins |
| **Border Radii** | Scale (none, sm, md, lg, xl, full) with element type context |
| **Shadows** | Scale (sm, md, lg, xl) with usage context |
| **Breakpoints** | Responsive breakpoints from media queries |

### CSS-Specific Data (Always Included)

| Data | Description |
|------|-------------|
| **CSS Variables** | All `--*` custom properties from `:root` |
| **Framework Detection** | Tailwind, Bootstrap, MUI, Chakra, Ant Design, Radix, shadcn/ui, etc. |
| **Component Styles** | Button, input, link, badge styles with hover/focus states |
| **Icon Systems** | Font Awesome, Material Icons, Heroicons, Lucide, etc. |
| **Border Combinations** | Actual width/style/color combinations used |

## Output Format

The output matches the existing `design-system-schema.md` format with an additional `cssExtraction` section:

```json
{
  "metadata": {
    "name": "Design System from example.com",
    "source": "https://example.com",
    "extractedAt": "2024-01-15T10:30:00Z",
    "extractionType": "website",
    "overallConfidence": "high"
  },
  "colors": {
    "primary": { "hex": "#3B82F6", "rgb": "rgb(59, 130, 246)", "confidence": "high" },
    "background": { "default": { "hex": "#FFFFFF", "confidence": "high" } },
    "text": { "primary": { "hex": "#111827", "confidence": "high" } }
  },
  "typography": {
    "fontFamilies": { "heading": "Inter", "body": "Inter" },
    "styles": {
      "h1": { "fontSize": "36px", "fontWeight": "700", "confidence": "medium" },
      "body": { "fontSize": "16px", "fontWeight": "400", "confidence": "high" }
    }
  },
  "spacing": { "unit": "4px", "scale": { "md": { "value": "16px", "confidence": "high" } } },
  "radii": { "md": { "value": "8px", "confidence": "high" } },
  "shadows": { "md": { "value": "0 4px 6px rgba(0,0,0,0.1)", "confidence": "medium" } },
  "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px" },

  "cssExtraction": {
    "cssVariables": {
      "--color-primary": "#3B82F6",
      "--spacing-md": "16px"
    },
    "detectedFramework": {
      "name": "Tailwind CSS",
      "confidence": "high",
      "evidence": ["Classes: bg-blue-500, text-white, p-4..."]
    },
    "iconSystems": [{ "name": "Heroicons", "count": 15 }],
    "componentStyles": {
      "buttons": [{ "defaultState": {...}, "hoverState": {...} }],
      "inputs": [{ "type": "text", "defaultState": {...}, "focusState": {...} }]
    }
  }
}
```

## Downstream Compatibility

The output is fully compatible with existing tools:

```bash
# Export to CSS custom properties
./scripts/figma-export.sh ./design-system.json --format css

# Export to Figma Tokens plugin format
./scripts/figma-export.sh ./design-system.json --format figma-tokens

# Export to Style Dictionary
./scripts/figma-export.sh ./design-system.json --format style-dictionary
```

## Video vs Website Extraction

| Aspect | Video Extraction | Website Extraction |
|--------|-----------------|-------------------|
| **Colors** | Approximated from pixels | Exact CSS values |
| **Typography** | Estimated from visuals | Exact font-* properties |
| **Spacing** | Measured from frames | Exact margin/padding |
| **Animation** | Duration/easing from timing | CSS transition-* values |
| **Components** | Visual detection | DOM selectors & class names |
| **States** | Captured in video | CSS :hover/:focus rules |

### Hybrid Analysis

For maximum accuracy, combine both approaches:

```bash
# Extract from video (captures actual rendering)
./scripts/extract-frames.sh recording.mov ./frames
# Analyze frames with Claude...

# Extract from live URL (exact CSS values)
./scripts/extract-website.sh "http://localhost:3000" --output ./website-tokens.json

# Compare outputs
diff <(jq -S '.colors' ./video-analysis.json) <(jq -S '.colors' ./website-tokens.json)
```

## Confidence Scoring

Tokens are assigned confidence levels based on:

| Confidence | Criteria |
|------------|----------|
| **High** | Used frequently (10+ times), or in brand contexts (logo, CTA, primary buttons) |
| **Medium** | Used moderately (3-10 times), or in interactive contexts |
| **Low** | Used rarely (<3 times), filtered from output |

## Framework Detection

The extractor identifies these CSS frameworks:

- **Tailwind CSS** - Arbitrary values, responsive modifiers, `dark:`
- **Bootstrap** - Grid system, button variants, form controls
- **Material UI (MUI)** - `Mui*` class patterns
- **Chakra UI** - `chakra-*` classes
- **Ant Design** - `ant-*` classes
- **Radix UI** - `data-radix-*`, `data-state` attributes
- **shadcn/ui** - Tailwind + Radix combination
- **Vuetify** - `v-*` classes
- **Foundation** - Grid system, button modifiers
- **Bulma** - Columns system, `is-*` modifiers
- **Semantic UI** - `.ui.*` patterns

## Anti-Detection & SPA Support

The extractor uses:

- **Stealth mode** - Spoofs `navigator.webdriver`, hardware properties
- **SPA hydration wait** - 8s initial + 4s stabilization
- **Network idle detection** - Waits for async content
- **Human simulation** - Mouse movements, scroll behavior

For problematic sites:

```bash
# JS-heavy SPAs
./scripts/extract-website.sh "https://spa.com" --slow

# Cloudflare-protected
./scripts/extract-website.sh "https://protected.com" --browser firefox
```

## Limitations

- **Public pages only** - No authentication support
- **Canvas/WebGL sites** - Limited extraction (Tesla, Apple Vision Pro demos)
- **Dynamic content** - May miss lazy-loaded elements
- **CORS stylesheets** - External CSS may not be fully accessible

## Technical Details

### Dependencies

- Node.js 18+
- Playwright (browser automation)
- chroma-js (color conversion)
- commander (CLI)

### Color Processing

- Delta-E (CIE2000) deduplication with threshold 15
- LAB/LCH/OKLCH color space conversion
- CSS variable extraction from `:root`

### Architecture

```
scripts/extract-website.sh
    └── lib/website-extractor/
        ├── index.js           # CLI entry point
        ├── browser.js         # Playwright with stealth mode
        ├── extractors/        # Color, typography, spacing, etc.
        ├── utils/             # Color conversion, delta-E, confidence
        └── output/            # Schema mapping, DTCG format
```

## Trigger Phrases

Use these phrases to invoke website extraction:

- "Extract the design system from https://..."
- "Analyze the CSS of this website"
- "Get the color palette from this URL"
- "What design tokens does this site use?"
- "Extract typography from https://..."
