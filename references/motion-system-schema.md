# Motion System Schema

This document defines the JSON schema for motion/animation design tokens extracted from screen recordings. The motion system complements the static design system with temporal properties.

## Overview

The motion system captures:
- **Animation durations**: Standard timing values used across the UI
- **Easing curves**: Acceleration patterns for animations
- **Transition patterns**: How screens and elements animate between states
- **Micro-interactions**: Small feedback animations

## Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Motion System Schema",
  "type": "object",
  "properties": {
    "durations": {
      "type": "object",
      "description": "Standard animation duration tokens",
      "additionalProperties": {
        "$ref": "#/$defs/durationToken"
      }
    },
    "easings": {
      "type": "object",
      "description": "Easing curve definitions",
      "additionalProperties": {
        "$ref": "#/$defs/easingToken"
      }
    },
    "transitions": {
      "type": "object",
      "description": "Named transition patterns",
      "additionalProperties": {
        "$ref": "#/$defs/transitionToken"
      }
    },
    "microInteractions": {
      "type": "array",
      "description": "Small feedback animations",
      "items": {
        "$ref": "#/$defs/microInteractionToken"
      }
    }
  },
  "$defs": {
    "confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"],
      "description": "Confidence level based on visibility and consistency"
    },
    "durationToken": {
      "type": "object",
      "properties": {
        "value": {
          "type": "string",
          "pattern": "^[0-9]+ms$",
          "description": "Duration in milliseconds"
        },
        "usage": {
          "type": "string",
          "description": "Where this duration is typically used"
        },
        "confidence": {
          "$ref": "#/$defs/confidence"
        }
      },
      "required": ["value", "confidence"]
    },
    "easingToken": {
      "type": "object",
      "properties": {
        "value": {
          "type": "string",
          "description": "Easing name (ease-in, ease-out, ease-in-out, linear)"
        },
        "cssValue": {
          "type": "string",
          "description": "CSS cubic-bezier or keyword"
        },
        "usage": {
          "type": "string",
          "description": "When this easing is used"
        },
        "confidence": {
          "$ref": "#/$defs/confidence"
        }
      },
      "required": ["value", "confidence"]
    },
    "transitionToken": {
      "type": "object",
      "properties": {
        "duration": {
          "type": "string",
          "description": "Transition duration"
        },
        "easing": {
          "type": "string",
          "description": "Easing curve to use"
        },
        "type": {
          "type": "string",
          "enum": ["fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale", "scale-fade", "none", "custom"],
          "description": "Animation type"
        },
        "properties": {
          "type": "array",
          "items": { "type": "string" },
          "description": "CSS properties being animated"
        },
        "detectedIn": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Where this transition was observed"
        },
        "confidence": {
          "$ref": "#/$defs/confidence"
        }
      },
      "required": ["duration", "type", "confidence"]
    },
    "microInteractionToken": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Interaction name"
        },
        "trigger": {
          "type": "string",
          "description": "What triggers this interaction"
        },
        "duration": {
          "type": "string",
          "description": "Animation duration"
        },
        "description": {
          "type": "string",
          "description": "What happens visually"
        },
        "confidence": {
          "$ref": "#/$defs/confidence"
        }
      },
      "required": ["name", "trigger", "confidence"]
    }
  }
}
```

## Example Output

```json
{
  "motion": {
    "durations": {
      "instant": {
        "value": "0ms",
        "usage": "Immediate state changes, no animation",
        "confidence": "high"
      },
      "fast": {
        "value": "150ms",
        "usage": "Micro-interactions, hover effects, button feedback",
        "confidence": "medium"
      },
      "normal": {
        "value": "250ms",
        "usage": "Standard UI transitions, dropdown opening",
        "confidence": "high"
      },
      "slow": {
        "value": "400ms",
        "usage": "Modal enter/exit, page transitions",
        "confidence": "high"
      },
      "slower": {
        "value": "600ms",
        "usage": "Complex multi-step animations",
        "confidence": "low"
      }
    },
    "easings": {
      "default": {
        "value": "ease-out",
        "cssValue": "cubic-bezier(0, 0, 0.2, 1)",
        "usage": "Most UI animations",
        "confidence": "medium"
      },
      "enter": {
        "value": "ease-out",
        "cssValue": "cubic-bezier(0, 0, 0.2, 1)",
        "usage": "Elements entering the screen",
        "confidence": "medium"
      },
      "exit": {
        "value": "ease-in",
        "cssValue": "cubic-bezier(0.4, 0, 1, 1)",
        "usage": "Elements leaving the screen",
        "confidence": "medium"
      },
      "emphasized": {
        "value": "ease-in-out",
        "cssValue": "cubic-bezier(0.4, 0, 0.2, 1)",
        "usage": "Important state changes, attention-grabbing",
        "confidence": "low"
      }
    },
    "transitions": {
      "modal-enter": {
        "duration": "250ms",
        "easing": "ease-out",
        "type": "scale-fade",
        "properties": ["transform", "opacity"],
        "detectedIn": ["Settings Modal", "Confirmation Dialog"],
        "confidence": "high"
      },
      "modal-exit": {
        "duration": "200ms",
        "easing": "ease-in",
        "type": "fade",
        "properties": ["opacity"],
        "detectedIn": ["Settings Modal", "Confirmation Dialog"],
        "confidence": "high"
      },
      "slide-panel": {
        "duration": "300ms",
        "easing": "ease-out",
        "type": "slide-right",
        "properties": ["transform"],
        "detectedIn": ["Side Panel", "Navigation Drawer"],
        "confidence": "medium"
      },
      "page-transition": {
        "duration": "200ms",
        "easing": "ease-in-out",
        "type": "fade",
        "properties": ["opacity"],
        "detectedIn": ["Dashboard → Settings", "Login → Dashboard"],
        "confidence": "high"
      },
      "dropdown-open": {
        "duration": "150ms",
        "easing": "ease-out",
        "type": "scale-fade",
        "properties": ["transform", "opacity"],
        "detectedIn": ["User Menu", "Filter Dropdown"],
        "confidence": "medium"
      }
    },
    "microInteractions": [
      {
        "name": "button-press",
        "trigger": "click/tap",
        "duration": "100ms",
        "description": "Slight scale down on press, return on release",
        "confidence": "medium"
      },
      {
        "name": "hover-highlight",
        "trigger": "hover",
        "duration": "150ms",
        "description": "Background color lightens on hover",
        "confidence": "low"
      },
      {
        "name": "loading-spinner",
        "trigger": "async operation",
        "duration": "1000ms",
        "description": "Continuous rotation animation",
        "confidence": "high"
      },
      {
        "name": "success-checkmark",
        "trigger": "operation complete",
        "duration": "300ms",
        "description": "Checkmark draws in with scale bounce",
        "confidence": "medium"
      }
    ]
  }
}
```

## Extraction Guidelines

### Detecting Durations

From temporal metadata:
1. Look at `animation_sequences[].duration_ms` values
2. Cluster similar durations into semantic tokens
3. Map to standard duration scale (fast, normal, slow)

Common duration patterns:
- **100-150ms**: Micro-interactions, instant feedback
- **200-300ms**: Standard transitions
- **400-600ms**: Emphasized or complex animations

### Detecting Transition Types

From diff frames:
1. **Fade**: Uniform brightness change across the whole element
2. **Slide**: Edge-weighted change (pixels change from one side)
3. **Scale**: Center-weighted change (grows/shrinks from center)
4. **Scale-fade**: Combination of scale and opacity change

### Confidence Levels

- **High**: Animation observed in multiple places, consistent timing
- **Medium**: Animation observed 1-2 times, timing approximate
- **Low**: Inferred from partial evidence, significant estimation

## Integration with Design System

The motion system should be output as part of the design system JSON:

```json
{
  "metadata": { ... },
  "colors": { ... },
  "typography": { ... },
  "spacing": { ... },
  "radii": { ... },
  "shadows": { ... },
  "motion": {
    "durations": { ... },
    "easings": { ... },
    "transitions": { ... },
    "microInteractions": [ ... ]
  }
}
```

## CSS Export

When exporting to CSS custom properties:

```css
:root {
  /* Durations */
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  /* Easings */
  --ease-default: cubic-bezier(0, 0, 0.2, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-emphasized: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Transition utilities */
.transition-modal-enter {
  transition: transform var(--duration-normal) var(--ease-enter),
              opacity var(--duration-normal) var(--ease-enter);
}
```
