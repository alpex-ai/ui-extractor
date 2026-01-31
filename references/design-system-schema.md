# Design System Schema

This document defines the JSON schema for extracted design systems. This format is designed to be:
- Human-readable for implementation
- Compatible with Figma variable import
- Convertible to CSS custom properties or Tailwind config

## Full Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Extracted Design System",
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "source": { "type": "string" },
        "extractedAt": { "type": "string", "format": "date-time" },
        "frameCount": { "type": "integer" },
        "overallConfidence": { "type": "string", "enum": ["high", "medium", "low"] }
      }
    },
    "colors": { "$ref": "#/$defs/colors" },
    "typography": { "$ref": "#/$defs/typography" },
    "spacing": { "$ref": "#/$defs/spacing" },
    "radii": { "$ref": "#/$defs/radii" },
    "shadows": { "$ref": "#/$defs/shadows" },
    "breakpoints": { "$ref": "#/$defs/breakpoints" },
    "motion": { "$ref": "#/$defs/motion" }
  },
  "$defs": {
    "confidence": {
      "type": "string",
      "enum": ["high", "medium", "low"]
    },
    "colorToken": {
      "type": "object",
      "properties": {
        "hex": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
        "rgb": { "type": "string" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["hex", "confidence"]
    },
    "colors": {
      "type": "object",
      "properties": {
        "primary": { "$ref": "#/$defs/colorToken" },
        "secondary": { "$ref": "#/$defs/colorToken" },
        "accent": { "$ref": "#/$defs/colorToken" },
        "background": {
          "type": "object",
          "properties": {
            "default": { "$ref": "#/$defs/colorToken" },
            "paper": { "$ref": "#/$defs/colorToken" },
            "elevated": { "$ref": "#/$defs/colorToken" }
          }
        },
        "text": {
          "type": "object",
          "properties": {
            "primary": { "$ref": "#/$defs/colorToken" },
            "secondary": { "$ref": "#/$defs/colorToken" },
            "disabled": { "$ref": "#/$defs/colorToken" },
            "inverse": { "$ref": "#/$defs/colorToken" }
          }
        },
        "border": {
          "type": "object",
          "properties": {
            "default": { "$ref": "#/$defs/colorToken" },
            "focus": { "$ref": "#/$defs/colorToken" }
          }
        },
        "semantic": {
          "type": "object",
          "properties": {
            "success": { "$ref": "#/$defs/colorToken" },
            "warning": { "$ref": "#/$defs/colorToken" },
            "error": { "$ref": "#/$defs/colorToken" },
            "info": { "$ref": "#/$defs/colorToken" }
          }
        }
      }
    },
    "typographyStyle": {
      "type": "object",
      "properties": {
        "fontSize": { "type": "string" },
        "fontWeight": { "type": "string" },
        "lineHeight": { "type": "string" },
        "letterSpacing": { "type": "string" },
        "fontFamily": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["fontSize", "confidence"]
    },
    "typography": {
      "type": "object",
      "properties": {
        "fontFamilies": {
          "type": "object",
          "properties": {
            "heading": { "type": "string" },
            "body": { "type": "string" },
            "mono": { "type": "string" }
          }
        },
        "styles": {
          "type": "object",
          "properties": {
            "h1": { "$ref": "#/$defs/typographyStyle" },
            "h2": { "$ref": "#/$defs/typographyStyle" },
            "h3": { "$ref": "#/$defs/typographyStyle" },
            "h4": { "$ref": "#/$defs/typographyStyle" },
            "body": { "$ref": "#/$defs/typographyStyle" },
            "bodySmall": { "$ref": "#/$defs/typographyStyle" },
            "caption": { "$ref": "#/$defs/typographyStyle" },
            "button": { "$ref": "#/$defs/typographyStyle" },
            "label": { "$ref": "#/$defs/typographyStyle" }
          }
        }
      }
    },
    "spacingToken": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["value", "confidence"]
    },
    "spacing": {
      "type": "object",
      "properties": {
        "unit": { "type": "string", "description": "Base spacing unit (e.g., '4px', '0.25rem')" },
        "scale": {
          "type": "object",
          "properties": {
            "xs": { "$ref": "#/$defs/spacingToken" },
            "sm": { "$ref": "#/$defs/spacingToken" },
            "md": { "$ref": "#/$defs/spacingToken" },
            "lg": { "$ref": "#/$defs/spacingToken" },
            "xl": { "$ref": "#/$defs/spacingToken" },
            "2xl": { "$ref": "#/$defs/spacingToken" },
            "3xl": { "$ref": "#/$defs/spacingToken" }
          }
        },
        "componentPadding": {
          "type": "object",
          "properties": {
            "button": { "$ref": "#/$defs/spacingToken" },
            "input": { "$ref": "#/$defs/spacingToken" },
            "card": { "$ref": "#/$defs/spacingToken" },
            "modal": { "$ref": "#/$defs/spacingToken" }
          }
        },
        "pageMargin": { "$ref": "#/$defs/spacingToken" },
        "sectionGap": { "$ref": "#/$defs/spacingToken" }
      }
    },
    "radiusToken": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["value", "confidence"]
    },
    "radii": {
      "type": "object",
      "properties": {
        "none": { "$ref": "#/$defs/radiusToken" },
        "sm": { "$ref": "#/$defs/radiusToken" },
        "md": { "$ref": "#/$defs/radiusToken" },
        "lg": { "$ref": "#/$defs/radiusToken" },
        "xl": { "$ref": "#/$defs/radiusToken" },
        "full": { "$ref": "#/$defs/radiusToken" }
      }
    },
    "shadowToken": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["value", "confidence"]
    },
    "shadows": {
      "type": "object",
      "properties": {
        "sm": { "$ref": "#/$defs/shadowToken" },
        "md": { "$ref": "#/$defs/shadowToken" },
        "lg": { "$ref": "#/$defs/shadowToken" },
        "xl": { "$ref": "#/$defs/shadowToken" }
      }
    },
    "breakpoints": {
      "type": "object",
      "properties": {
        "sm": { "type": "string" },
        "md": { "type": "string" },
        "lg": { "type": "string" },
        "xl": { "type": "string" }
      }
    },
    "durationToken": {
      "type": "object",
      "properties": {
        "value": { "type": "string", "pattern": "^[0-9]+ms$" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["value", "confidence"]
    },
    "easingToken": {
      "type": "object",
      "properties": {
        "value": { "type": "string" },
        "cssValue": { "type": "string" },
        "usage": { "type": "string" },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["value", "confidence"]
    },
    "transitionToken": {
      "type": "object",
      "properties": {
        "duration": { "type": "string" },
        "easing": { "type": "string" },
        "type": { "type": "string", "enum": ["fade", "slide-up", "slide-down", "slide-left", "slide-right", "scale", "scale-fade", "none", "custom"] },
        "properties": { "type": "array", "items": { "type": "string" } },
        "detectedIn": { "type": "array", "items": { "type": "string" } },
        "confidence": { "$ref": "#/$defs/confidence" }
      },
      "required": ["duration", "type", "confidence"]
    },
    "motion": {
      "type": "object",
      "description": "Animation and motion design tokens (populated when temporal data is available)",
      "properties": {
        "durations": {
          "type": "object",
          "description": "Standard animation duration tokens",
          "properties": {
            "instant": { "$ref": "#/$defs/durationToken" },
            "fast": { "$ref": "#/$defs/durationToken" },
            "normal": { "$ref": "#/$defs/durationToken" },
            "slow": { "$ref": "#/$defs/durationToken" },
            "slower": { "$ref": "#/$defs/durationToken" }
          }
        },
        "easings": {
          "type": "object",
          "description": "Easing curve definitions",
          "properties": {
            "default": { "$ref": "#/$defs/easingToken" },
            "enter": { "$ref": "#/$defs/easingToken" },
            "exit": { "$ref": "#/$defs/easingToken" },
            "emphasized": { "$ref": "#/$defs/easingToken" }
          }
        },
        "transitions": {
          "type": "object",
          "description": "Named transition patterns",
          "additionalProperties": { "$ref": "#/$defs/transitionToken" }
        }
      }
    }
  }
}
```

## Example Output

```json
{
  "metadata": {
    "name": "Competitor App Design System",
    "source": "competitor-demo.mov",
    "extractedAt": "2024-01-15T10:30:00Z",
    "frameCount": 25,
    "overallConfidence": "high"
  },
  "colors": {
    "primary": {
      "hex": "#3B82F6",
      "rgb": "rgb(59, 130, 246)",
      "usage": "Primary buttons, links, active states",
      "confidence": "high"
    },
    "secondary": {
      "hex": "#8B5CF6",
      "rgb": "rgb(139, 92, 246)",
      "usage": "Secondary actions, accents",
      "confidence": "medium"
    },
    "background": {
      "default": {
        "hex": "#FFFFFF",
        "usage": "Main page background",
        "confidence": "high"
      },
      "paper": {
        "hex": "#F9FAFB",
        "usage": "Card backgrounds, sections",
        "confidence": "high"
      }
    },
    "text": {
      "primary": {
        "hex": "#111827",
        "usage": "Headings, body text",
        "confidence": "high"
      },
      "secondary": {
        "hex": "#6B7280",
        "usage": "Captions, hints",
        "confidence": "high"
      }
    },
    "border": {
      "default": {
        "hex": "#E5E7EB",
        "usage": "Card borders, dividers",
        "confidence": "high"
      }
    },
    "semantic": {
      "success": {
        "hex": "#10B981",
        "usage": "Success messages, positive actions",
        "confidence": "medium"
      },
      "error": {
        "hex": "#EF4444",
        "usage": "Error messages, destructive actions",
        "confidence": "high"
      }
    }
  },
  "typography": {
    "fontFamilies": {
      "heading": "Inter, system-ui, sans-serif",
      "body": "Inter, system-ui, sans-serif"
    },
    "styles": {
      "h1": {
        "fontSize": "36px",
        "fontWeight": "700",
        "lineHeight": "1.2",
        "confidence": "medium"
      },
      "h2": {
        "fontSize": "24px",
        "fontWeight": "600",
        "lineHeight": "1.3",
        "confidence": "high"
      },
      "body": {
        "fontSize": "16px",
        "fontWeight": "400",
        "lineHeight": "1.5",
        "confidence": "high"
      },
      "caption": {
        "fontSize": "12px",
        "fontWeight": "400",
        "lineHeight": "1.4",
        "confidence": "medium"
      },
      "button": {
        "fontSize": "14px",
        "fontWeight": "500",
        "lineHeight": "1",
        "confidence": "high"
      }
    }
  },
  "spacing": {
    "unit": "4px",
    "scale": {
      "xs": { "value": "4px", "confidence": "medium" },
      "sm": { "value": "8px", "confidence": "high" },
      "md": { "value": "16px", "confidence": "high" },
      "lg": { "value": "24px", "confidence": "high" },
      "xl": { "value": "32px", "confidence": "medium" },
      "2xl": { "value": "48px", "confidence": "low" }
    },
    "componentPadding": {
      "button": { "value": "12px 24px", "confidence": "high" },
      "input": { "value": "12px 16px", "confidence": "high" },
      "card": { "value": "24px", "confidence": "high" }
    },
    "pageMargin": { "value": "24px", "confidence": "high" },
    "sectionGap": { "value": "48px", "confidence": "medium" }
  },
  "radii": {
    "none": { "value": "0px", "confidence": "high" },
    "sm": { "value": "4px", "usage": "Small elements", "confidence": "medium" },
    "md": { "value": "8px", "usage": "Buttons, inputs", "confidence": "high" },
    "lg": { "value": "12px", "usage": "Cards, modals", "confidence": "high" },
    "full": { "value": "9999px", "usage": "Pills, avatars", "confidence": "high" }
  },
  "shadows": {
    "sm": {
      "value": "0 1px 2px rgba(0,0,0,0.05)",
      "usage": "Subtle elevation",
      "confidence": "low"
    },
    "md": {
      "value": "0 4px 6px rgba(0,0,0,0.1)",
      "usage": "Cards",
      "confidence": "medium"
    },
    "lg": {
      "value": "0 10px 15px rgba(0,0,0,0.1)",
      "usage": "Modals, dropdowns",
      "confidence": "medium"
    }
  },
  "motion": {
    "durations": {
      "fast": {
        "value": "150ms",
        "usage": "Hover effects, micro-interactions",
        "confidence": "medium"
      },
      "normal": {
        "value": "250ms",
        "usage": "Standard transitions, dropdowns",
        "confidence": "high"
      },
      "slow": {
        "value": "400ms",
        "usage": "Modal enter/exit, page transitions",
        "confidence": "high"
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
        "usage": "Elements entering",
        "confidence": "medium"
      },
      "exit": {
        "value": "ease-in",
        "cssValue": "cubic-bezier(0.4, 0, 1, 1)",
        "usage": "Elements exiting",
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
      "page-transition": {
        "duration": "200ms",
        "easing": "ease-in-out",
        "type": "fade",
        "properties": ["opacity"],
        "detectedIn": ["Login → Dashboard"],
        "confidence": "high"
      }
    }
  }
}
```

## CSS Custom Properties Export

The design system can be converted to CSS custom properties:

```css
:root {
  /* Colors */
  --color-primary: #3B82F6;
  --color-secondary: #8B5CF6;
  --color-background: #FFFFFF;
  --color-background-paper: #F9FAFB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-success: #10B981;
  --color-error: #EF4444;

  /* Typography */
  --font-family-heading: Inter, system-ui, sans-serif;
  --font-family-body: Inter, system-ui, sans-serif;
  --font-size-h1: 36px;
  --font-size-h2: 24px;
  --font-size-body: 16px;
  --font-size-caption: 12px;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Motion (when temporal data available) */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-default: cubic-bezier(0, 0, 0.2, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

## Tailwind Config Export

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        background: {
          DEFAULT: '#FFFFFF',
          paper: '#F9FAFB'
        },
        // ...
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      fontSize: {
        h1: ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        // ...
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px'
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px rgba(0,0,0,0.1)',
        lg: '0 10px 15px rgba(0,0,0,0.1)'
      },
      // Motion tokens (when temporal data available)
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms'
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)',
        enter: 'cubic-bezier(0, 0, 0.2, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)'
      }
    }
  }
}
```

## Figma Variables Format

See `figma-integration.md` for the specific format required by Figma's Variables API.
