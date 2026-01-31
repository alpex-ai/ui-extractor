# Temporal Analysis Prompt

This document extends `frame-analysis-prompt.md` with guidance for analyzing temporal context from motion metadata and diff frames. Use this when `temporal-metadata.json` is available alongside extracted frames.

## When to Use This Guide

Apply these analysis techniques when:
- `temporal-metadata.json` exists in the frames directory
- Diff frames (`diff_XXXX.jpg`) are provided
- The extraction used `--include-metadata` or `--adaptive` flags
- Motion system tokens are requested in the output

## Understanding Temporal Metadata

### Metadata Structure

```json
{
  "frames": [
    {
      "frame_number": 1,
      "timestamp_ms": 0,
      "scene_score": 0.02,
      "motion_score": 0.15,
      "classification": "static",
      "is_scene_boundary": false
    }
  ],
  "animation_sequences": [
    {
      "start_frame": 120,
      "end_frame": 150,
      "duration_ms": 1000,
      "type": "transition",
      "avg_motion_score": 0.65
    }
  ],
  "scene_boundaries": [1, 45, 180, 420],
  "summary": {
    "static_frames_pct": 68,
    "animation_count": 3
  }
}
```

### Classification Meanings

| Classification | Motion Score | Interpretation |
|---------------|--------------|----------------|
| `static` | < 0.05 | No visible change, stable UI state |
| `low_motion` | 0.05 - 0.3 | Minor changes (cursor, typing, small updates) |
| `high_motion` | 0.3 - 0.7 | Significant change (scrolling, animation in progress) |
| `scene_change` | > 0.7 or scene > 0.4 | Major UI change (navigation, modal open/close) |

## Motion-Aware Screen Detection

### Using Scene Boundaries

Scene boundaries from the metadata definitively separate screens. Use them to:

1. **Confirm screen transitions**: If `is_scene_boundary: true`, a new screen/state begins
2. **Group frames by screen**: Frames between boundaries belong to the same logical screen
3. **Identify navigation patterns**: Boundary timing reveals user navigation speed

Example analysis:
```
Scene boundaries: [1, 45, 180, 420]

Screen 1: Frames 1-44 (Login Screen)
  - Duration: ~44 seconds
  - Mostly static (user reading/thinking)

Screen 2: Frames 45-179 (Dashboard)
  - Duration: ~135 seconds
  - Some low_motion frames (scrolling, hovering)

Screen 3: Frames 180-419 (Settings Modal)
  - Duration: ~240 seconds
  - High motion at 180 (modal opening animation)
```

### Identifying Transitions vs Screens

Not all scene boundaries are navigation events. Distinguish:

**Navigation (true screen change):**
- High scene_score (> 0.6)
- Followed by sustained different content
- Often preceded by button click timing

**Modal/Overlay (same screen, new layer):**
- High scene_score but partial frame change
- Diff frames show localized change area
- Original screen visible behind (if transparent)

**Animation completion:**
- Moderate scene_score (0.3-0.5)
- Followed by static frames
- Part of a transition sequence

## Animation Sequence Analysis

### Interpreting Sequences

Each animation sequence represents continuous motion:

```json
{
  "start_frame": 120,
  "end_frame": 150,
  "start_time_ms": 4000,
  "end_time_ms": 5000,
  "duration_ms": 1000,
  "type": "transition",
  "avg_motion_score": 0.65
}
```

**What to extract:**
1. **Duration**: 1000ms → Map to "slow" duration token
2. **Context**: What changed between start_frame and end_frame?
3. **Pattern**: Did motion accelerate/decelerate? (easing hint)

### Animation Duration Clustering

Group detected durations into semantic tokens:

| Detected Range | Token | Typical Use |
|---------------|-------|-------------|
| 0-100ms | instant | No animation |
| 100-200ms | fast | Hover, micro-interactions |
| 200-350ms | normal | Standard transitions |
| 350-500ms | slow | Modal animations |
| 500ms+ | slower | Complex/emphasized |

### Sequence Types

**`transition`** (has scene_change frames):
- Screen navigation
- Modal open/close
- Major state change

**`animation`** (no scene_change, just high_motion):
- Loading spinner
- Progress indicator
- Scrolling animation
- Content loading

## Diff Frame Analysis

### Reading Diff Frames

Diff frames show pixel-level changes:
- **Bright pixels**: Changed between frames
- **Dark pixels**: Unchanged areas

### Identifying Animation Types

**Fade (opacity change):**
- Uniform brightness across element
- Element shape visible but diffuse
- Entire area changes equally

**Slide (position change):**
- Bright edge on movement direction
- Trailing dark area where element was
- Clear directional pattern

**Scale (size change):**
- Center-weighted brightness
- Concentric change pattern
- Edges more visible than center

**Scale-fade (combined):**
- Center brightness with gradient
- Shape visible but with opacity gradient

### Diff Frame to Transition Mapping

```
Diff Frame Pattern          →  Transition Type
─────────────────────────────────────────────
Uniform brightness          →  fade
Left edge bright            →  slide-right
Right edge bright           →  slide-left
Top edge bright             →  slide-down
Bottom edge bright          →  slide-up
Center bright               →  scale (grow)
Edge ring bright            →  scale (shrink)
Center + uniform            →  scale-fade
```

## Motion Token Extraction

### From Animation Sequences

1. **Collect all `duration_ms` values**
2. **Cluster into groups** (within 50ms of each other)
3. **Assign semantic names** based on usage context:
   - Fast durations during hover states → "fast" for micro-interactions
   - Medium durations for navigation → "normal" for transitions
   - Longer durations for modals → "slow" for emphasis

### From Diff Frame Patterns

1. **Identify transition type** from diff appearance
2. **Note which screens use which types**
3. **Group consistent patterns** into named transitions:
   ```json
   {
     "modal-enter": {
       "type": "scale-fade",
       "duration": "250ms",
       "detectedIn": ["Settings Modal", "Confirmation Dialog"]
     }
   }
   ```

### Easing Estimation

Exact easing curves can't be determined from frames, but hints include:

- **Quick start, slow end** (motion_score decreases): ease-out
- **Slow start, quick end** (motion_score increases): ease-in
- **Symmetric pattern**: ease-in-out
- **Constant motion_score**: linear

Default to `ease-out` for enter animations and `ease-in` for exit if unsure.

## Enhanced User Flow Mapping

### Using Timestamps

With temporal metadata, flows include timing:

```json
{
  "name": "Login Flow",
  "steps": [
    {
      "screen": "Login Screen",
      "action": "Enter credentials",
      "start_time_ms": 0,
      "end_time_ms": 5000,
      "dwell_time_ms": 5000
    },
    {
      "screen": "Loading State",
      "action": "Submit form",
      "start_time_ms": 5000,
      "end_time_ms": 6200,
      "dwell_time_ms": 1200,
      "transition_duration_ms": 200
    },
    {
      "screen": "Dashboard",
      "action": "Success redirect",
      "start_time_ms": 6200,
      "transition_duration_ms": 300
    }
  ]
}
```

### Dwell Time Analysis

Dwell time (time on screen before action) reveals:
- **Very short (< 1s)**: Automatic transition or quick navigation
- **Short (1-5s)**: User knows where to go, minimal reading
- **Medium (5-15s)**: User reading/comprehending content
- **Long (15s+)**: User completing task (form, editing)

### Identifying User Behavior

From motion patterns:
- **Rapid scene changes**: Power user, knows the app
- **Long static periods + brief actions**: First-time user, learning
- **Repeated back-and-forth**: User confused or comparing

## Confidence Scoring with Temporal Data

Temporal data improves confidence:

| Evidence | Confidence Boost |
|----------|-----------------|
| Multiple animation sequences of same duration | +1 level |
| Consistent transition type across screens | +1 level |
| Clear scene boundaries matching screen changes | +1 level |
| Diff frames clearly show animation type | +1 level |

| Evidence | Confidence Reduction |
|----------|---------------------|
| Single animation sequence | -1 level |
| Ambiguous diff pattern | -1 level |
| Motion during static content (artifacts) | Review needed |

## Output Integration

### Adding Motion to Implementation Spec

When outputting the implementation spec, include:

```markdown
## Motion System

### Animation Durations
| Token | Value | Usage | Confidence |
|-------|-------|-------|------------|
| fast | 150ms | Hover effects, button feedback | medium |
| normal | 250ms | Dropdown, tooltip | high |
| slow | 400ms | Modal enter/exit | high |

### Transitions Observed
- **Modal Enter**: scale-fade, 250ms ease-out (frames 45-52)
- **Page Navigation**: fade, 200ms ease-in-out (frames 180-185)
- **Dropdown Open**: slide-down + fade, 150ms ease-out (frames 300-304)

### Micro-interactions
- Button hover: background lighten, ~150ms (low confidence)
- Loading spinner: continuous rotation (high confidence)
```

### Adding Motion to Design System JSON

```json
{
  "designSystem": {
    "colors": { ... },
    "typography": { ... },
    "motion": {
      "durations": {
        "fast": { "value": "150ms", "confidence": "medium" },
        "normal": { "value": "250ms", "confidence": "high" },
        "slow": { "value": "400ms", "confidence": "high" }
      },
      "transitions": {
        "modal-enter": {
          "duration": "250ms",
          "type": "scale-fade",
          "easing": "ease-out",
          "confidence": "high"
        }
      }
    }
  }
}
```

## Analysis Checklist

When temporal metadata is available:

- [ ] Review scene_boundaries to confirm screen identification
- [ ] Map animation_sequences to UI transitions
- [ ] Cluster durations into semantic tokens
- [ ] Analyze diff frames for transition types
- [ ] Calculate dwell times for user flow
- [ ] Add motion section to design system output
- [ ] Note confidence levels based on evidence
