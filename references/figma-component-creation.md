# Figma Component Creation Guide

This guide covers recreating extracted UI components in Figma using MCP tools.

## Prerequisites

- Figma MCP server connected and authenticated
- Target Figma file open/accessible
- Design system extracted from video analysis

## Workflow Overview

```
Extract Frames → Analyze UI → Extract Design System → Create Variables → Build Components
```

## Step 1: Create Design Token Variables

Before building components, establish the design system as Figma variables.

### Colors

```
For each color in designSystem.colors:
  1. Use create_variable to create color variable
  2. Name following convention: color/{category}/{name}
  3. Set value to extracted hex
```

Example variable structure:
```
color/primary → #3B82F6
color/secondary → #8B5CF6
color/background/default → #FFFFFF
color/background/paper → #F9FAFB
color/text/primary → #111827
color/text/secondary → #6B7280
color/border/default → #E5E7EB
color/semantic/success → #10B981
color/semantic/error → #EF4444
```

### Spacing

```
spacing/xs → 4
spacing/sm → 8
spacing/md → 16
spacing/lg → 24
spacing/xl → 32
```

### Border Radius

```
radius/sm → 4
radius/md → 8
radius/lg → 12
radius/xl → 16
radius/full → 9999
```

## Step 2: Build Base Components

For each component identified in the analysis, create a Figma component.

### Button Component Example

**Extracted spec:**
```json
{
  "type": "button",
  "name": "Primary Button",
  "variants": ["default", "hover", "disabled", "loading"],
  "description": "Rounded corners (8px), solid fill with primary color, white text, 14px medium weight"
}
```

**MCP creation sequence:**

1. **Create container frame**
```
create_frame:
  name: "Button / Primary / Default"
  width: auto (hug contents)
  height: auto (hug contents)
```

2. **Set auto-layout**
```
set_auto_layout:
  direction: horizontal
  padding: 12, 24, 12, 24  (top, right, bottom, left)
  gap: 8
  alignment: center
```

3. **Apply fill using variable**
```
set_fill:
  color: variable(color/primary)
```

4. **Set corner radius**
```
set_corner_radius:
  radius: variable(radius/md)  # 8px
```

5. **Add text layer**
```
create_text:
  content: "Button"
  font_size: 14
  font_weight: 500
  color: variable(color/text/inverse)  # white
```

6. **Convert to component**
```
create_component:
  frame: [created frame]
```

### Creating Variants

For each variant state:

1. Duplicate the base component
2. Rename with variant: "Button / Primary / Hover"
3. Modify properties for that state:
   - Hover: Slightly darker primary fill
   - Disabled: Reduced opacity, cursor change
   - Loading: Add spinner icon, dim text

4. Group all variants into component set:
```
create_component_set:
  components: [default, hover, disabled, loading]
  property_name: "State"
```

## Step 3: Component Templates

### Input Field

```
Frame: "Input / Default"
├── Auto-layout: horizontal, padding 12x16
├── Border: 1px, color/border/default
├── Corner radius: radius/md
├── Fill: color/background/default
└── Text: placeholder, color/text/disabled
```

Variants: default, focused, error, disabled

### Card

```
Frame: "Card"
├── Auto-layout: vertical, padding 24
├── Corner radius: radius/lg
├── Fill: color/background/paper
├── Shadow: elevation/md
└── Children:
    ├── Header slot
    ├── Content slot
    └── Footer slot
```

### Navigation Item

```
Frame: "Nav Item / Default"
├── Auto-layout: horizontal, padding 12x16, gap 12
├── Fill: transparent
├── Corner radius: radius/md
├── Icon slot (24x24)
└── Label text
```

Variants: default, hover, active

### Modal

```
Frame: "Modal"
├── Auto-layout: vertical
├── Corner radius: radius/xl
├── Fill: color/background/default
├── Shadow: elevation/lg
├── Width: fixed (480px typical)
└── Children:
    ├── Header (with close button)
    ├── Content area
    └── Footer (action buttons)
```

## Step 4: Component Organization

Organize components in Figma structure:

```
📁 Components
├── 📁 Buttons
│   ├── Primary
│   ├── Secondary
│   └── Ghost
├── 📁 Inputs
│   ├── Text Input
│   ├── Select
│   └── Checkbox
├── 📁 Cards
│   ├── Basic Card
│   └── Metric Card
├── 📁 Navigation
│   ├── Sidebar Nav
│   ├── Top Nav
│   └── Tab Bar
└── 📁 Feedback
    ├── Modal
    ├── Toast
    └── Spinner
```

## Step 5: Applying to Frames

After components are built, create example screens using them:

1. Create a frame for each identified screen
2. Instance components where detected
3. Apply actual content from screenshots
4. Verify layout matches original

## MCP Tool Reference

### Frame Creation
```
create_frame(name, width, height, x, y)
```

### Auto-layout
```
set_auto_layout(frame_id, {
  direction: "vertical" | "horizontal",
  padding: {top, right, bottom, left},
  gap: number,
  alignment: "start" | "center" | "end"
})
```

### Styling
```
set_fill(frame_id, color | variable_ref)
set_stroke(frame_id, color, weight)
set_corner_radius(frame_id, radius | variable_ref)
set_effects(frame_id, [shadows, blurs])
```

### Text
```
create_text(content, {
  font_family,
  font_size,
  font_weight,
  line_height,
  color
})
```

### Components
```
create_component(frame_id) → component_id
create_component_set(component_ids, property_definitions)
create_instance(component_id, x, y)
```

### Variables
```
create_variable_collection(name) → collection_id
create_variable(collection_id, name, type, value)
set_variable_value(variable_id, mode_id, value)
```

## Confidence-Based Approach

When building components, use extraction confidence to guide detail level:

- **High confidence**: Build complete component with all variants
- **Medium confidence**: Build base component, note uncertain properties
- **Low confidence**: Create placeholder with documented assumptions

Always document assumptions in component descriptions.

## Error Handling

### Component Creation Fails
- Check if parent frame exists
- Verify variable references are valid
- Ensure unique component names

### Variable Not Found
- Create missing variable first
- Use fallback hardcoded value with TODO comment

### Layout Issues
- Verify auto-layout settings match extracted spec
- Check padding/margin values are reasonable
- Confirm nested frame structure

## Best Practices

1. **Name consistently**: Use `Category / Name / Variant` pattern
2. **Use variables**: Never hardcode colors, use token references
3. **Document assumptions**: Add descriptions for low-confidence extractions
4. **Build incrementally**: Create base first, then variants
5. **Test instances**: Verify component instances work correctly
6. **Maintain hierarchy**: Keep component organization logical
