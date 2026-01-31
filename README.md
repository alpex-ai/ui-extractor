# ui-extractor

A Claude Code skill that analyzes screen recordings and websites to extract implementation specs, design systems, and UI patterns.

[![Skills Library](https://img.shields.io/badge/skills.sh-ui--extractor-blue)](https://skills.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

Install via the [Skills Library](https://skills.sh):

```bash
npx skills add alpex-ai/ui-extractor
```

Or add directly to Claude Code:

```bash
claude skills add https://github.com/alpex-ai/ui-extractor
```

## Requirements

- **ffmpeg** - Required for video processing
  ```bash
  brew install ffmpeg
  ```

- **jq** - Required for JSON processing (Figma export)
  ```bash
  brew install jq
  ```

## Usage

Once installed, you can use natural language to analyze recordings:

### Basic Analysis

```
Analyze the recording at ./my-app-demo.mov
```

### Design System Extraction

```
Extract the design system from ./competitor.mp4 and export to Figma
```

### App Comparison

```
Compare my app at ./my-app.mov with the reference at ./target.mov
```

### Temporal/Motion Analysis

```
Analyze ./animation-demo.mov with motion detection enabled
```

### URL Recording (Automatic)

Simply provide a URL and the skill will automatically record the website:

```
Analyze stripe.com

Record linear.app and extract the design system

Analyze competitor.com in mobile dark mode
```

The recording captures:
- Page load and SPA hydration
- Hover states on interactive elements
- Scroll through entire page content
- Scroll-triggered animations

### Browser Tab Extraction (Authenticated Sites)

For sites requiring login, have the page open in your browser and ask the agent to analyze it:

```
Analyze my open browser tab

Extract the design system from the tab I have open

Look at this authenticated dashboard in my browser
```

This extracts:
- Screenshots of the current view
- CSS computed styles and design tokens
- Page structure and components
- Works with any authenticated session

### Static CSS Extraction

For design system extraction without video:

```
Extract the design system from https://example.com
```

### Importing Local Recordings

Screen recordings are saved to `~/Desktop`, which agents can't access due to macOS security. Copy recordings into your project:

```bash
cp ~/Desktop/Screen\ Recording*.mov ./recording.mov
```

Then: `Analyze ./recording.mov`

### Trigger Phrases

The skill activates when you mention:

| Intent | Example Phrases |
|--------|-----------------|
| URL Recording | "Analyze stripe.com", "Record linear.app", "What does example.com look like?" |
| Browser Tab | "Analyze my open tab", "Extract from my browser", "Look at this authenticated page" |
| Full Analysis | "Analyze the recording...", "Extract specs from...", "What components does this app use?" |
| Design System | "Extract the design system from...", "Get the colors/typography from...", "Export to Figma..." |
| Comparison | "Compare ... with ...", "How does my app differ from...", "What's missing compared to..." |
| Temporal | "Analyze animations in...", "Extract motion timings from...", "Detect transitions in..." |

## Capabilities

- **URL Recording**: Automatically record any website with simulated interactions
- **Browser Tab Extraction**: Extract from authenticated sites open in your browser
- **Full Analysis**: Extract complete implementation spec from a recording
- **Design System Only**: Extract colors, typography, spacing for Figma export
- **Comparison Mode**: Compare your app against a reference recording
- **Temporal Analysis**: Motion detection, animation extraction, and transition timing

## Quality Levels

Control extraction density with quality presets:

| Quality | FPS | Use Case |
|---------|-----|----------|
| low | 0.5 | Long recordings (>60s), simple UIs |
| default | 1 | Most recordings (15-60s) |
| high | 2 | Short recordings (<15s), complex UIs |

Custom FPS from 0.1-10 is also supported.

## Output

The skill generates:

### Implementation Spec (Markdown)
- Screen inventory with frame references
- Component catalog with variants and usage
- Design system tokens (colors, typography, spacing)
- User flows with triggers and transitions
- Implementation recommendations

### Design System (JSON)
```json
{
  "colors": { "primary": { "value": "#007AFF", "usage": "Primary actions" } },
  "typography": { "heading": { "size": "24px", "weight": "600" } },
  "spacing": { "sm": "8px", "md": "16px", "lg": "24px" },
  "motion": { "fast": "150ms", "normal": "250ms" }
}
```

### Export Formats
- CSS custom properties
- Tailwind config
- Figma Variables (JSON)
- W3C Design Tokens (DTCG)

## Figma Integration

Export design systems directly to Figma:

```
Export the design system to Figma

Push these tokens to my Figma file ABC123
```

Supports:
- Figma Variables API integration
- MCP tools for direct component creation
- Color, typography, and spacing tokens

## Advanced Features

### Motion Analysis
Enable `--include-metadata` for temporal analysis:
- Per-frame motion scores
- Animation duration detection
- Scene boundary identification
- Transition type classification

### Diff Frame Generation
Visualize changes between frames:
- Highlights pixel differences
- Identifies animation patterns (fade, slide, scale)
- Useful for transition analysis

### Adaptive Sampling
Motion-weighted frame extraction:
- More frames during high-motion segments
- Efficient context usage
- Better animation capture

## Supported Agents

This skill follows the [Agent Skills](https://agentskills.io) format and works with:

- [Claude Code](https://claude.ai/code)
- [Cursor](https://cursor.com)
- [GitHub Copilot](https://github.com/features/copilot)
- [Gemini CLI](https://geminicli.com)
- And other skills-compatible agents

## File Structure

```
ui-extractor/
├── SKILL.md              # Skill instructions (required)
├── README.md             # This file
├── LICENSE               # MIT License
├── scripts/              # Executable scripts
│   ├── record-website.sh     # Record websites with Playwright
│   ├── extract-frames.sh
│   ├── detect-recording.sh
│   ├── analyze-motion.sh
│   ├── generate-diff-frames.sh
│   ├── figma-export.sh
│   └── extract-website.sh
├── references/           # Reference documentation
│   ├── frame-analysis-prompt.md
│   ├── temporal-analysis-prompt.md
│   ├── design-system-schema.md
│   ├── motion-system-schema.md
│   ├── comparison-guide.md
│   ├── figma-integration.md
│   ├── figma-component-creation.md
│   └── website-extraction.md
├── assets/               # Example outputs
│   └── example-output.json
└── lib/                  # Node.js libraries
    └── website-extractor/
        ├── browser.js        # Browser automation with recording
        ├── recorder.js       # Video recording CLI
        └── extractors/       # CSS extraction modules
```

## License

MIT
