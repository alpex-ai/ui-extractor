# Frame Analysis Prompt

This document contains the structured prompt for analyzing extracted frames from screen recordings. The agent should use this prompt when processing frames through vision capabilities.

## Analysis Context

When analyzing frames, you are examining a screen recording of an application. The frames were extracted using scene detection, meaning each frame represents a distinct UI state or transition point. Your goal is to understand the application's:

1. Visual design system
2. Component architecture
3. User flows and interactions
4. Implementation patterns
5. Motion/animation system (when temporal data available)

## Temporal Context (When Available)

If `temporal-metadata.json` is provided alongside frames, incorporate motion analysis:

### Using Motion Metadata

The temporal metadata file contains:
- **Per-frame motion scores**: How much each frame differs from the previous (0-1 scale)
- **Frame classifications**: `static`, `low_motion`, `high_motion`, `scene_change`
- **Animation sequences**: Groups of consecutive high-motion frames with duration
- **Scene boundaries**: Frame numbers where major UI changes occur

### Motion-Enhanced Analysis

When temporal data is available:

1. **Screen Identification**: Use `scene_boundaries` to definitively separate screens
2. **Transition Detection**: `animation_sequences` indicate transitions - note their duration
3. **Dwell Time**: Calculate time user spent on each screen from timestamps
4. **Animation Extraction**: Map `duration_ms` values to motion design tokens

### Diff Frame Analysis

When diff frames (`diff_XXXX.jpg`) are provided:
- **Bright areas** = pixels that changed between frames
- **Dark areas** = pixels that stayed the same

Use diff frames to identify:
- **Animation type**: Fade (uniform), slide (edge-weighted), scale (center-weighted)
- **Partial updates**: Which UI element animated vs. full screen change
- **Transition direction**: For slides, which edge has brightness indicates direction

For detailed temporal analysis guidance, see `references/temporal-analysis-prompt.md`.

## Structured Analysis Sections

### 1. Screen Inventory

Identify each distinct screen or major UI state visible across the frames.

For each screen:
- **Name**: Descriptive name (e.g., "Login Screen", "Dashboard", "Settings Modal")
- **Frame references**: Which frame numbers show this screen
- **Purpose**: What the user accomplishes on this screen
- **Key elements**: Major components visible

Output format:
```json
{
  "screens": [
    {
      "name": "Login Screen",
      "frames": [1, 2],
      "purpose": "User authentication",
      "elements": ["email input", "password input", "login button", "forgot password link"],
      "confidence": "high"
    }
  ]
}
```

### 2. Component Detection

Identify reusable UI components across all frames.

Component categories to look for:
- **Navigation**: Header, sidebar, tabs, breadcrumbs, bottom nav
- **Inputs**: Text fields, selects, checkboxes, radio buttons, toggles, sliders
- **Buttons**: Primary, secondary, ghost, icon buttons, FABs
- **Cards**: Content cards, list items, grid items
- **Modals/Dialogs**: Overlays, sheets, drawers, toasts
- **Feedback**: Loading states, progress bars, skeleton screens, empty states
- **Data display**: Tables, lists, charts, badges, avatars

For each component:
- **Type**: Component category
- **Variants**: Different states or styles observed (e.g., "primary", "disabled")
- **Locations**: Which screens contain this component
- **Confidence**: high/medium/low based on visibility and consistency

Output format:
```json
{
  "components": [
    {
      "type": "button",
      "name": "Primary Button",
      "variants": ["default", "hover", "disabled"],
      "screens": ["Login Screen", "Dashboard"],
      "description": "Rounded corners, filled background, white text",
      "confidence": "high"
    }
  ]
}
```

### 3. Design System Extraction

Extract visual design tokens from the frames.

#### Colors
Identify and categorize colors:
- **Primary**: Main brand/action color
- **Secondary**: Supporting accent color
- **Background**: Page and card backgrounds
- **Surface**: Elevated surface colors
- **Text**: Primary, secondary, disabled text colors
- **Border**: Divider and border colors
- **Semantic**: Success (green), warning (yellow), error (red), info (blue)

For each color:
- Provide hex value (estimate if exact match not possible)
- Describe usage context
- Rate confidence (high if color appears consistently, low if estimated)

#### Typography
Identify text styles:
- **Headings**: H1, H2, H3 etc. - sizes, weights
- **Body**: Regular paragraph text
- **Caption**: Small supporting text
- **Button/Label**: Interactive element text

Note: Exact pixel values may be estimates. Focus on relative sizing and weight.

#### Spacing
Identify spacing patterns:
- **Component padding**: Internal spacing within components
- **Section gaps**: Space between major sections
- **Element gaps**: Space between related elements
- **Page margins**: Edge spacing

Look for consistent patterns (e.g., 8px grid, 4px increments).

#### Other tokens
- **Border radius**: Sharp (0), slight (4px), rounded (8px), pill (full)
- **Shadows**: Elevation levels observed

#### Motion Tokens (when temporal data available)

Extract animation-related design tokens from temporal metadata:

- **Durations**: Cluster detected `animation_sequences[].duration_ms` into semantic tokens
  - `fast` (100-200ms): Micro-interactions, hovers
  - `normal` (200-350ms): Standard transitions
  - `slow` (350-500ms): Modal animations

- **Transition types**: From diff frame analysis
  - `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`, `scale-fade`

- **Easing hints**: From motion_score progression
  - Decreasing scores = ease-out (quick start, slow end)
  - Increasing scores = ease-in (slow start, quick end)

Output format: See `design-system-schema.md` and `motion-system-schema.md` for full schemas.

### 4. User Flow Mapping

Analyze the sequence of frames to understand user journeys.

For each flow:
- **Name**: Descriptive name (e.g., "Login Flow", "Add to Cart")
- **Steps**: Ordered sequence of screens/states
- **Triggers**: What causes transitions (button click, gesture, etc.)
- **Branches**: Alternative paths if visible
- **Timing** (when temporal data available): Dwell time and transition durations

Output format:
```json
{
  "flows": [
    {
      "name": "Login Flow",
      "steps": [
        {"screen": "Login Screen", "action": "Enter credentials"},
        {"screen": "Loading State", "action": "Submit form"},
        {"screen": "Dashboard", "action": "Success redirect"}
      ],
      "triggers": ["button click", "form submit"],
      "confidence": "high"
    }
  ]
}
```

With temporal data, enhanced format:
```json
{
  "flows": [
    {
      "name": "Login Flow",
      "steps": [
        {
          "screen": "Login Screen",
          "action": "Enter credentials",
          "start_time_ms": 0,
          "dwell_time_ms": 5000
        },
        {
          "screen": "Loading State",
          "action": "Submit form",
          "start_time_ms": 5000,
          "dwell_time_ms": 1200,
          "transition_duration_ms": 200
        },
        {
          "screen": "Dashboard",
          "action": "Success redirect",
          "start_time_ms": 6200,
          "transition_duration_ms": 300
        }
      ],
      "triggers": ["button click", "form submit"],
      "confidence": "high"
    }
  ]
}
```

### 5. Interaction Patterns

Identify interaction and feedback patterns:
- **Loading states**: Spinners, skeletons, progress indicators
- **Empty states**: What shows when no data
- **Error states**: How errors are displayed
- **Hover/Focus states**: Visual feedback on interaction
- **Animations**: Transitions, micro-interactions
- **Gestures**: Swipe, pull-to-refresh, etc. (if visible)

### 6. Implementation Guidance

Based on the analysis, provide recommendations for implementation:

- **Component hierarchy**: Suggested parent-child relationships
- **State management hints**: What state needs to be tracked
- **Responsive considerations**: Any breakpoint hints visible
- **Accessibility notes**: Contrast issues, missing labels, etc.
- **Framework suggestions**: Patterns that map well to specific frameworks

## Confidence Scoring Guidelines

Rate each extracted element:

- **High confidence**:
  - Element appears in multiple frames
  - Clear, high-quality visibility
  - Consistent across appearances
  - Exact values can be determined

- **Medium confidence**:
  - Element appears in 1-2 frames
  - Partially visible or slightly blurry
  - Some estimation required
  - Values are approximate

- **Low confidence**:
  - Element barely visible or cut off
  - Significant estimation required
  - Inconsistent across frames
  - May be misidentified

## Output Structure

The final analysis should be structured as:

```json
{
  "metadata": {
    "frameCount": 25,
    "duration": "45s",
    "analysisDate": "2024-01-15",
    "hasTemporalData": true
  },
  "screens": [...],
  "components": [...],
  "designSystem": {
    "colors": {...},
    "typography": {...},
    "spacing": {...},
    "radii": {...},
    "shadows": {...},
    "motion": {
      "durations": {...},
      "easings": {...},
      "transitions": {...}
    }
  },
  "flows": [...],
  "interactions": [...],
  "implementation": {
    "hierarchy": [...],
    "stateHints": [...],
    "accessibility": [...],
    "recommendations": [...]
  }
}
```

Note: The `motion` section in `designSystem` should be included when temporal metadata is available. See `motion-system-schema.md` for the full motion token structure.

## Analysis Tips

1. **Start with screens**: Get the big picture before diving into details
2. **Look for patterns**: Consistent elements = higher confidence
3. **Note uncertainties**: Better to flag low confidence than guess wrong
4. **Consider context**: A button's color meaning depends on where it appears
5. **Think implementation**: What would a developer need to know?
6. **Be specific**: "Blue button" is less useful than "Rounded button with #3B82F6 fill"
7. **Use temporal data**: When available, reference motion scores to identify animations
8. **Check diff frames**: For transitions, diff frames reveal animation type and direction
