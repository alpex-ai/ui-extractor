# video-to-code

A Claude Code skill that analyzes screen recordings to extract implementation specs, design systems, and UI patterns.

## Installation

Add this skill to Claude Code:

```bash
claude skills add https://github.com/alpex-ai/video-to-code
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

```
Analyze the recording at ./my-app-demo.mov

Extract the design system from ./competitor.mp4 and export to Figma

Compare my app at ./my-app.mov with the reference at ./target.mov
```

### Importing Recordings

Screen recordings are saved to `~/Desktop`, which agents can't access due to macOS security. Copy recordings into your project:

```bash
cp ~/Desktop/Screen\ Recording*.mov ./recording.mov
```

Then: `Analyze ./recording.mov`

## Capabilities

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
- Implementation specs (markdown)
- Design system tokens (JSON)
- Component inventories
- User flow documentation
- Gap analysis (comparison mode)

## Figma Integration

Export design systems directly to Figma using MCP tools or the Figma Variables API.

## License

MIT
