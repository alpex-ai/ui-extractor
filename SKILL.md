---
name: ui-extractor
description: Analyze screen recordings and screenshots to extract implementation specs, design systems, and UI patterns. Use when asked to analyze a video/recording of an app, extract a design system from a demo, compare an app to a reference, or generate specs from visual input.
license: MIT
compatibility: Requires ffmpeg and ffprobe for video processing. Install with "brew install ffmpeg" on macOS.
allowed-tools: Bash(ffmpeg:*) Bash(ffprobe:*) Bash(jq:*) Bash(node:*) Bash(npm:*) Bash(./scripts/*) Read Write
metadata:
  author: alpex-ai
  version: "1.0.0"
  repository: https://github.com/alpex-ai/ui-extractor
---

# UI Extractor

Analyze screen recordings to extract implementation specs, design systems, components, and user flows.

## Capabilities

- **Full Analysis**: Extract complete implementation spec from a recording
- **Design System Only**: Extract just colors, typography, spacing for Figma export
- **Comparison Mode**: Compare your app against a reference recording
- **URL Recording**: Automatically record a website with simulated interactions
- **Multiple Inputs**: Video files, screenshots, clipboard images, URLs, auto-detect recent recordings
- **Temporal Analysis**: Motion detection, animation extraction, and transition timing (optional)

## Quick Start

```
# Record and analyze a website (automatic recording from URL)
Analyze https://stripe.com

# Extract design system from a URL
Extract the design system from https://linear.app and export to Figma

# Analyze a local recording (drag file into chat to get the path)
Analyze the recording at /Users/me/Desktop/Screen Recording 2024-01-15.mov

# Compare to reference
Compare my app at ./my-app.mov with the reference at ./competitor.mov

# Record in mobile mode
Analyze https://mobile-app.com in mobile view
```

## Importing Recordings

Screen recordings are saved to `~/Desktop`, which agents can't access due to macOS security (Full Disk Access restriction). You need to copy recordings into your project.

### Quick Import (Recommended)

Run this in your terminal to copy your latest recording:
```bash
cp ~/Desktop/Screen\ Recording*.mov ./recording.mov
```

Then tell the agent: **"Analyze ./recording.mov"**

### If the Filename Has Special Characters

macOS screen recordings often have special Unicode characters in filenames. Use Tab completion or quotes:
```bash
# Tab completion (type partial name, press Tab)
cp ~/Desktop/Screen<TAB>

# Or use quotes and wildcards
cp ~/Desktop/"Screen Recording"*.mov ./recording.mov
```

### Why This Limitation?

macOS restricts terminal access to Desktop/Documents/Downloads unless the app has "Full Disk Access" permission. The agent's shell runs without this permission for security. Copying the file into your project bypasses this restriction.

## Workflow

### Step 1: Resolve Input

Determine the input source:

1. **URL provided** (starts with `http://` or `https://`): Record the website automatically
2. **Explicit path provided**: Validate the file exists
3. **No path provided**: Run `./scripts/detect-recording.sh` to find recent recordings
4. **Screenshot/image**: Proceed directly to analysis (skip frame extraction)
5. **Clipboard**: Save clipboard image to temp file, proceed to analysis

For URLs: Record the website and proceed to frame extraction
For video files, check the extension: `.mov`, `.mp4`, `.webm`, `.mkv`
For images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

### Step 1a: Record Website (URL Input)

When the user provides a URL, automatically record the website:

```bash
# Basic recording
./scripts/record-website.sh "https://example.com" --output ./recording.webm

# Mobile recording
./scripts/record-website.sh "https://example.com" --output ./recording.webm --mobile

# Dark mode recording
./scripts/record-website.sh "https://example.com" --output ./recording.webm --dark-mode

# Record and auto-extract frames
./scripts/record-website.sh "https://example.com" --analyze --quality default
```

**Recording options:**
- `--mobile`: Use mobile viewport (390x844)
- `--dark-mode`: Enable dark mode for the recording
- `--duration <secs>`: Max recording duration (default: 30)
- `--scroll-steps <n>`: Number of scroll steps (default: 5)
- `--browser <type>`: chromium (default) or firefox
- `--analyze`: Auto-extract frames after recording
- `--quality <level>`: Frame extraction quality when using --analyze

**What the recording captures:**
1. Initial page load and SPA hydration
2. Hover interactions on buttons and links (triggers hover states)
3. Smooth scroll through entire page content
4. Return scroll to top (captures scroll-triggered animations)

**Output:**
```json
{
  "success": true,
  "videoPath": "./recordings/example-com-20240115-143022.webm",
  "framesDir": "./frames",
  "frameCount": 28,
  "ready": true
}
```

After recording completes, proceed to Step 2 (Validate Video Duration) with the recorded video.

#### Handling Access Errors

If the file doesn't exist or you get "Operation not permitted":

**Tell the user to copy the recording:**
```
I can't access your Desktop directly due to macOS security restrictions.

Please run this in your terminal to import the recording:

cp ~/Desktop/Screen\ Recording*.mov ./recording.mov

Then say "Analyze ./recording.mov"

(If you have multiple recordings, use Tab completion to pick the right one)
```

**If user provides a specific filename that fails**, give them the exact copy command:
```
cp ~/Desktop/"[exact filename they mentioned]" ./recording.mov
```

**Note on special characters**: macOS filenames often contain narrow no-break spaces (Unicode). Wildcards (`*`) handle this better than exact filenames.

### Step 2: Validate Video Duration

For video files, check duration before proceeding:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH"
```

**Constraints:**
- **> 5 minutes**: ERROR - Ask user to trim the video
  - "This video is X minutes long. The maximum supported length is 5 minutes. Please trim to the relevant section."
- **> 1 minute**: WARN - Inform user about token cost
  - "This video is X seconds long. Analysis will use approximately Y frames (~Z tokens). Proceed?"
- **≤ 1 minute**: Proceed without warning

### Step 3: Extract Frames

Run frame extraction for videos. Choose the quality level based on video duration and complexity:

#### Quality Selection Guidelines

| Duration | Recommended | Frames | Use Case |
|----------|-------------|--------|----------|
| ≤15s | `high` (2fps) | ~30 | Short demos, complex UIs, detailed extraction |
| 15-60s | `default` (1fps) | ~15-60 | Typical recordings, balanced detail |
| >60s | `low` (0.5fps) | ~30-150 | Long recordings, simple UIs, overviews |

**Decision process:**
1. Check video duration
2. Consider UI complexity (many transitions = higher quality)
3. Suggest quality to user OR proceed with recommended level
4. User can override with explicit quality preference

```bash
# Default quality (1fps) - good for most recordings
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames"

# High quality for short/complex videos
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames" --quality high

# Low quality for long recordings
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames" --quality low

# Add scene-boost to capture transitions between regular frames
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames" --quality default --scene-boost

# Enable temporal analysis for motion detection
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames" --include-metadata

# Full temporal analysis with adaptive sampling and diff frames
./scripts/extract-frames.sh "$VIDEO_PATH" "./frames" --adaptive --include-metadata --include-diffs
```

#### Quality Levels

- **low** (0.5 fps): 1 frame every 2 seconds. Use for videos over 60s or simple UIs.
- **default** (1 fps): 1 frame per second. Balanced for typical UI demos.
- **high** (2 fps): 2 frames per second. Maximum detail for short or complex recordings.
- **--scene-boost**: Adds extra frames at significant UI transitions on top of FPS sampling.

#### Temporal Analysis Options (New)

- **--adaptive**: Motion-weighted adaptive sampling. Captures more frames during high-motion segments.
- **--include-metadata**: Runs motion analysis and outputs `temporal-metadata.json` with per-frame motion scores.
- **--include-diffs**: Generates diff frames (`diff_XXXX.jpg`) showing what changed between keyframes.

The script outputs JSON with extraction results:
```json
{
  "success": true,
  "frames": ["frame_0001.jpg", ...],
  "count": 25,
  "duration": 45,
  "fps_used": 1,
  "quality": "default",
  "adaptive_sampling": false,
  "token_estimate": 12500,
  "output_dir": "./frames",
  "temporal_metadata": "./frames/temporal-metadata.json",
  "diff_manifest": "./frames/diff-manifest.json"
}
```

Report to user: "Extracted X frames from Y second video at Z fps (~W tokens)"

### Step 3.5: Motion Analysis (Optional)

For enhanced temporal understanding, run motion analysis separately or via `--include-metadata`:

```bash
./scripts/analyze-motion.sh "$VIDEO_PATH" --output "./frames/temporal-metadata.json"
```

**When to use motion analysis:**
- Videos with significant animations/transitions
- When extracting motion design tokens (durations, easings)
- For accurate user flow timing information
- In comparison mode (matching animation timing)

**Output includes:**
- Per-frame motion and scene change scores
- Detected animation sequences with durations
- Scene boundary frame numbers
- Motion classification (static, low_motion, high_motion, scene_change)

### Step 3.6: Generate Diff Frames (Optional)

For transition analysis, generate visual diff frames:

```bash
./scripts/generate-diff-frames.sh "$VIDEO_PATH" "./frames"
```

This creates:
- `diff_XXXX.jpg` files showing pixel differences between consecutive frames
- `diff-manifest.json` linking diffs to original frame pairs

**Diff frame interpretation:**
- **Bright areas** = pixels that changed
- **Dark areas** = pixels that stayed the same
- Useful for identifying animation types (fade, slide, scale)

### Step 4: Analyze Frames

Load all extracted frames and analyze using the structured prompt in `references/frame-analysis-prompt.md`.

**With temporal context** (if `temporal-metadata.json` exists):
- Reference motion scores for frame classification
- Use animation sequences to identify transitions
- Extract motion design tokens from detected patterns
- Include diff frames for transition type identification
- See `references/temporal-analysis-prompt.md` for detailed guidance

**Analysis sections:**
1. **Screen Inventory**: Identify distinct screens/states
2. **Component Detection**: Catalog reusable UI components
3. **Design System Extraction**: Colors, typography, spacing, shadows
4. **Motion System Extraction**: Animation durations, easings, transitions (when temporal data available)
5. **User Flow Mapping**: Screen transitions and triggers (with timing if available)
6. **Interaction Patterns**: Loading, error, hover states
7. **Implementation Guidance**: Component hierarchy, state hints

**Confidence scoring:**
- **High**: Element appears in multiple frames, clearly visible
- **Medium**: 1-2 frames, some estimation required
- **Low**: Partially visible, significant estimation

### Step 5: Generate Output

#### Full Analysis Mode (default)

Output a structured implementation spec in markdown:

```markdown
# Implementation Spec: [App Name]

## Summary
- Screens: X distinct screens identified
- Components: Y reusable components
- Design tokens: Z color/typography/spacing values
- Confidence: Overall [high/medium/low]

## Screens
[For each screen: name, purpose, key components, frame references]

## Component Inventory
[For each component: type, variants, usage locations, implementation notes]

## Design System
### Colors
[Color tokens with hex values, usage, confidence]

### Typography
[Text styles with sizes, weights, line heights]

### Spacing
[Spacing scale and component-specific values]

### Other Tokens
[Radii, shadows, transitions]

## User Flows
[Flow diagrams with steps and triggers]

## Implementation Recommendations
[Component hierarchy, state management, accessibility notes]
```

#### Design System Only Mode

When user requests design system extraction only:

1. Focus analysis on design tokens
2. Output JSON following `references/design-system-schema.md`
3. **With `--include-metadata`**: Also extract motion tokens (durations, easings, transitions)
4. Offer export options:
   - "Export as CSS custom properties"
   - "Export as Tailwind config"
   - "Export to Figma" (if MCP or token available)

**With Motion Tokens** (when temporal data available):

The design system output will include a `motion` section:
```json
{
  "motion": {
    "durations": {
      "fast": { "value": "150ms", "usage": "Hover effects", "confidence": "medium" },
      "normal": { "value": "250ms", "usage": "Standard transitions", "confidence": "high" }
    },
    "transitions": {
      "modal-enter": { "duration": "250ms", "type": "scale-fade", "confidence": "high" }
    }
  }
}
```

For Figma export:
```bash
./scripts/figma-export.sh --design-system ./output/design-system.json --format figma-tokens
# Or with push:
./scripts/figma-export.sh --design-system ./output/design-system.json --push-to-figma --file-key ABC123
```

#### Figma Component Recreation (MCP)

When user requests full Figma recreation, use Figma MCP tools directly to build components in Figma. See `references/figma-component-creation.md` for detailed workflow.

**Workflow overview:**
1. Extract design system (colors, typography, spacing) from recording
2. Create Figma variables for design tokens using MCP
3. For each identified component, create a Figma component frame
4. Build component structure using auto-layout and design tokens
5. Create variants for different states (hover, active, disabled)

**Required MCP tools:**
- `create_frame` - Create component frames
- `create_text` - Add text layers with typography tokens
- `create_rectangle` - Build shapes with color tokens
- `set_auto_layout` - Configure component layout
- `create_component` - Convert frame to reusable component
- `create_component_set` - Group variants together

**Trigger phrases:**
- "Recreate this UI in Figma"
- "Build these components in my Figma file"
- "Export everything to Figma including components"

### Step 6: Comparison Mode

When comparing two recordings, follow `references/comparison-guide.md`:

1. Analyze reference recording first (establish target)
2. Analyze user's app recording
3. Generate gap analysis:
   - Design system differences (colors, typography, spacing)
   - Missing components
   - Flow differences
   - Prioritized recommendations

Output format:
```markdown
# Gap Analysis: [Your App] vs [Reference]

## Match Summary
- Overall: X%
- Design System: Y%
- Components: Z%

## High Priority Changes
1. [Specific actionable change]
2. [Another change]

## Detailed Differences
[By category: colors, components, flows]
```

## Modes

### Trigger Phrases

**URL Recording (automatic):**
- "Analyze https://..."
- "Record https://... and extract the design system"
- "Extract specs from https://..."
- "What does https://... look like?"

**Full Analysis:**
- "Analyze the recording at..."
- "Extract specs from..."
- "What components does this app use?"
- "Create an implementation spec for..."

**Design System Only:**
- "Extract the design system from..."
- "Get the colors/typography from..."
- "Export to Figma from..."

**Comparison:**
- "Compare ... with ..."
- "How does my app differ from..."
- "What's missing compared to..."

### Input Detection

**URL input** (starts with `http://` or `https://`):
- Automatically run `./scripts/record-website.sh` to record the website
- Proceed to frame extraction and analysis

**Local file input**:
- Validate file exists and proceed to analysis

**No path provided**:
- "Analyze my latest recording" → Run detect-recording.sh
- "Use the screen recording I just made" → Run detect-recording.sh
- "Check the demo video" → Ask for path or run detect-recording.sh

## Error Handling

### FFmpeg Not Installed
```
FFmpeg is required for video processing but wasn't found.
Install with: brew install ffmpeg
```

### No Recordings Found
```
No recent recordings found in ~/Desktop or ~/Movies.
Please provide a path to the video file, or create a new screen recording.
```

### Video Too Long
```
This video is [X] minutes long, which exceeds the 5-minute limit.
Long videos use excessive tokens and may not provide better results.
Please trim to the most relevant 1-5 minute section using QuickTime or similar.
```

### Low Quality Input
If frames are blurry or low resolution, note in output:
```
Note: Some extracted values have low confidence due to video quality.
Consider re-recording at higher resolution for more accurate extraction.
```

## Dependencies

**Required:**
- `ffmpeg` - Video processing and frame extraction
- `ffprobe` - Video metadata extraction

**Optional:**
- `jq` - JSON processing for Figma export
- Figma MCP or `FIGMA_ACCESS_TOKEN` - For direct Figma push

Check dependencies:
```bash
command -v ffmpeg && echo "ffmpeg: OK" || echo "ffmpeg: MISSING"
command -v ffprobe && echo "ffprobe: OK" || echo "ffprobe: MISSING"
```

## Examples

### URL Recording and Analysis
```
User: Analyze https://linear.app

Agent:
1. Detects URL input
2. Records website: ./scripts/record-website.sh "https://linear.app" --analyze
3. Captures page load, hover states, scroll interactions
4. Auto-extracts frames from recording
5. Analyzes frames for components, design system, flows
6. Outputs implementation spec
```

### URL with Mobile/Dark Mode
```
User: Analyze https://stripe.com in mobile dark mode

Agent:
1. Records with mobile and dark mode flags
2. ./scripts/record-website.sh "https://stripe.com" --mobile --dark-mode --analyze
3. Extracts mobile-specific design tokens
4. Outputs mobile implementation spec
```

### Basic Analysis (Local File)
```
User: Analyze the recording at ~/Desktop/competitor-app.mov

Agent:
1. Validates file exists
2. Checks duration (45 seconds - OK)
3. Extracts frames: "Extracted 28 frames"
4. Analyzes frames
5. Outputs implementation spec
```

### Design System to Figma
```
User: Extract the design system from ./demo.mp4 and push to my Figma file

Agent:
1. Extracts frames
2. Analyzes for design tokens only
3. Generates design-system.json
4. Checks for Figma MCP or token
5. Pushes to Figma or outputs JSON for manual import
```

### Comparison
```
User: Compare my app recording at ./my-app.mov with the reference at ./target-design.mov

Agent:
1. Analyzes reference first
2. Analyzes user's app
3. Generates gap analysis with prioritized changes
```

### URL Comparison
```
User: Compare my app at ./my-app.mov with https://competitor.com

Agent:
1. Records competitor website
2. Analyzes competitor recording (establishes target)
3. Analyzes user's app recording
4. Generates gap analysis with prioritized changes
```

## Output Files

The skill may create these temporary files:
- `./recordings/` - Website recordings (gitignored)
- `./frames/` - Extracted video frames (gitignored)
- `./frames/temporal-metadata.json` - Motion analysis data (when `--include-metadata`)
- `./frames/diff_XXXX.jpg` - Diff frames (when `--include-diffs`)
- `./frames/diff-manifest.json` - Diff frame manifest (when `--include-diffs`)
- `./output/design-system.json` - Extracted design system
- `./output/implementation-spec.md` - Full implementation spec

Clean up frames and recordings after analysis unless user requests to keep them.

## Reference Documents

- `references/frame-analysis-prompt.md` - Main analysis prompt structure
- `references/temporal-analysis-prompt.md` - Temporal/motion analysis guidance
- `references/design-system-schema.md` - Design system JSON schema (includes motion)
- `references/motion-system-schema.md` - Motion token schema details
- `references/comparison-guide.md` - Comparison mode workflow
- `references/figma-integration.md` - Figma export details
- `references/figma-component-creation.md` - Figma MCP component creation
