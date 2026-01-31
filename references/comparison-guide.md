# Comparison Mode Guide

This document describes how to use the comparison mode to analyze differences between a reference recording (competitor/design) and your current application.

## Overview

Comparison mode helps you:
- Identify gaps between your app and a reference
- Get specific recommendations for matching a design
- Track implementation progress against a reference
- Understand what's missing or different

## Input Requirements

### Reference Recording
The target you want to match:
- A competitor's application demo
- A design prototype recording
- A previous version of your app
- A mockup walkthrough

### Your Application
Your current implementation:
- A screen recording of your app
- Live URL (agent captures screenshots)
- Local dev server URL

## Comparison Workflow

### Step 1: Analyze Reference

First, the reference recording is analyzed to establish the "target" state:

```
Analyze the reference recording at ./reference/competitor.mov
Extract the full design system and component inventory.
```

This produces:
- Complete design system (colors, typography, spacing)
- Component inventory with all variants
- User flow mapping
- Interaction patterns

### Step 2: Analyze Your Application

Next, your application is analyzed:

```
Analyze my application at ./recordings/my-app.mov
Use the same analysis structure as the reference.
```

Or for a live app:
```
Navigate to http://localhost:3000 and capture the main flows.
Analyze against the reference structure.
```

### Step 3: Generate Gap Analysis

The comparison produces a detailed gap analysis:

```json
{
  "summary": {
    "overallMatch": "72%",
    "designSystemMatch": "85%",
    "componentMatch": "68%",
    "flowMatch": "65%"
  },
  "designSystem": {
    "colors": {
      "matching": [...],
      "different": [...],
      "missing": [...]
    },
    "typography": {...},
    "spacing": {...}
  },
  "components": {
    "matching": [...],
    "different": [...],
    "missing": [...]
  },
  "flows": {
    "matching": [...],
    "different": [...],
    "missing": [...]
  },
  "recommendations": [...]
}
```

## Output Sections

### Design System Differences

#### Colors
```json
{
  "matching": [
    {
      "token": "primary",
      "reference": "#3B82F6",
      "yours": "#3B82F6",
      "status": "exact"
    }
  ],
  "different": [
    {
      "token": "secondary",
      "reference": "#8B5CF6",
      "yours": "#6366F1",
      "delta": "Similar purple, slightly different hue",
      "recommendation": "Update to #8B5CF6 for exact match"
    }
  ],
  "missing": [
    {
      "token": "accent",
      "reference": "#F59E0B",
      "recommendation": "Add accent color #F59E0B"
    }
  ]
}
```

#### Typography
```json
{
  "different": [
    {
      "style": "h1",
      "reference": { "size": "36px", "weight": "700" },
      "yours": { "size": "32px", "weight": "600" },
      "recommendation": "Increase h1 to 36px/700"
    }
  ]
}
```

### Component Differences

```json
{
  "matching": [
    {
      "component": "Primary Button",
      "variants": ["default", "hover"],
      "status": "Visually equivalent"
    }
  ],
  "different": [
    {
      "component": "Card",
      "differences": [
        "Reference has 12px border-radius, yours has 8px",
        "Reference has subtle shadow, yours has no shadow"
      ],
      "recommendation": "Update Card component with rounded-lg and shadow-md"
    }
  ],
  "missing": [
    {
      "component": "Toast Notification",
      "description": "Reference shows toast notifications for actions",
      "reference_frames": [15, 23],
      "recommendation": "Implement toast component for user feedback"
    }
  ]
}
```

### Flow Differences

```json
{
  "different": [
    {
      "flow": "Login",
      "differences": [
        "Reference shows loading state after submit, yours doesn't",
        "Reference has 'Forgot password' link, yours is missing"
      ]
    }
  ],
  "missing": [
    {
      "flow": "Onboarding",
      "description": "Reference has a 3-step onboarding flow after signup",
      "screens": ["Welcome", "Preferences", "Complete"],
      "recommendation": "Implement onboarding flow"
    }
  ]
}
```

### Prioritized Recommendations

```json
{
  "recommendations": [
    {
      "priority": "high",
      "category": "design-system",
      "item": "Update primary color from #2563EB to #3B82F6",
      "impact": "Affects all interactive elements",
      "effort": "low"
    },
    {
      "priority": "high",
      "category": "component",
      "item": "Add loading states to buttons",
      "impact": "User feedback for all actions",
      "effort": "medium"
    },
    {
      "priority": "medium",
      "category": "flow",
      "item": "Implement onboarding flow",
      "impact": "New user experience",
      "effort": "high"
    }
  ]
}
```

## Usage Examples

### Compare competitor app to your implementation

```
Compare the recording at ./competitor-demo.mov with my app at ./my-app-recording.mov

Focus on:
- Design system differences (colors, typography)
- Missing components
- Flow gaps

Output a prioritized list of changes to match the competitor.
```

### Compare design mockup to implementation

```
Compare the design prototype at ./figma-walkthrough.mov with http://localhost:3000

This is a design review - identify any deviations from the intended design.
```

### Track implementation progress

```
I'm implementing the design from ./target-design.mov

Analyze my current state at ./current-implementation.mov

What percentage complete am I? What's left to do?
```

## Comparison Tips

1. **Match recording conditions**: Similar screen sizes, same flows covered
2. **Start with design system**: Foundation differences cascade to components
3. **Focus on high-impact items**: Not everything needs to match exactly
4. **Consider intentional differences**: Some differences may be deliberate
5. **Use confidence scores**: Low-confidence differences may be noise

## Output Formats

### Markdown Report
```markdown
# Gap Analysis: My App vs Competitor

## Summary
- Overall Match: 72%
- Design System: 85%
- Components: 68%
- Flows: 65%

## High Priority Changes
1. Update primary color to #3B82F6
2. Add loading states to buttons
...
```

### JSON (for programmatic use)
Full structured output as shown above.

### Checklist
```markdown
## Implementation Checklist

### Design System
- [ ] Update primary color: #2563EB → #3B82F6
- [ ] Add accent color: #F59E0B
- [x] Typography h1 size (matches)

### Components
- [ ] Add Toast component
- [ ] Update Card border-radius
- [x] Button styling (matches)
```
