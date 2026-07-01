---
name: Octagon Elite
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#ffb4ac'
  on-secondary: '#690007'
  secondary-container: '#960711'
  on-secondary-container: '#ff9f95'
  tertiary: '#cecece'
  on-tertiary: '#2f3131'
  tertiary-container: '#b2b3b3'
  on-tertiary-container: '#444546'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ac'
  on-secondary-fixed: '#410003'
  on-secondary-fixed-variant: '#92030f'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  display-lg-mobile:
    fontFamily: Anton
    fontSize: 36px
    fontWeight: '400'
    lineHeight: '1.1'
  headline-md:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.04em
  stats-xl:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Archivo Narrow
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label-caps:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  gutter: 12px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style
The design system embodies the raw intensity and technical precision of professional mixed martial arts. It targets a competitive audience, evoking feelings of adrenaline, grit, and prestige. 

The aesthetic is a hybrid of **High-Contrast / Bold** and **Tactile** styles. It utilizes a dark, atmospheric foundation to make high-value elements—like championship titles and critical damage states—pop with visceral impact. The UI should feel like a premium sports broadcast mixed with a high-end training facility: aggressive, efficient, and authoritative.

## Colors
This design system is built on a "Dark Mode First" philosophy to mimic the dim, focused lighting of an arena.

- **Neutral (Deep Charcoal):** Used for the primary canvas and deep background layers to create a sense of infinite space and focus.
- **Primary (Championship Gold):** Reserved for moments of triumph, premium currency, and primary call-to-action buttons. It signifies the ultimate goal.
- **Secondary (Octagon Blood Red):** Used for high-intensity UI moments: health depletion, aggressive actions, "Live" status, and critical alerts.
- **Surface & Accents:** Silver and clean whites are used for secondary information and iconography to maintain legibility against the dark void.

## Typography
The typography strategy contrasts the "impact" of athletic branding with the "precision" of sports analytics.

- **Headlines:** Use **Anton**. Its condensed, heavy nature mimics heavy-weight boxing posters. All headlines should be uppercase to maintain a commanding presence.
- **Body & Metadata:** Use **Archivo Narrow**. It provides high information density—crucial for fighter bios and move descriptions—without sacrificing readability.
- **Stats & Data:** Use **Space Mono**. This monospaced font gives fighter statistics (Reach, Leg Kick Power, Win/Loss) a technical, calibrated feel that suggests a data-driven approach to combat.

## Elevation & Depth
Depth is created through "Chiaroscuro" lighting—high contrast between light and dark surfaces.

- **Card Elevation:** Cards use a dual-layer approach. A subtle inner glow (`#FFFFFF` at 5% opacity) defines the top edge, while a heavy, tight drop shadow (`#000000` at 80% opacity, 12px blur) anchors it to the background.
- **Tonal Layers:** 
    - Level 0: `#0D0D0D` (Background)
    - Level 1: `#1A1A1A` (Cards/Containers)
    - Level 2: `#262626` (Active States/Inputs)
- **Gradients:** Use subtle radial gradients in the background (center-out) to create a "spotlight" effect on the primary content area.

## Shapes
This design system utilizes a **Sharp** shape language. There is no rounding on primary UI containers. 

- **Hard Edges:** 0px border-radius communicates toughness and lack of compromise. 
- **Beveled Corners:** For specialized "Championship" elements, use a 45-degree chamfer (clipped corner) rather than a radius to reinforce the industrial, metallic feel.
- **Stat Bars:** These must have perfectly square caps. The "empty" portion of the bar should be a dark grey (`#262626`), and the "filled" portion should be a solid block of Red or Gold.

## Components
- **Primary Action Buttons:** Solid **Championship Gold** fill with black **Anton** text. Use a slight inner top-border (1px, white, 20% opacity) to give it a metallic, tactile "pressed" feel.
- **Fighter Cards:** Large imagery with a gradient fade to black at the bottom. Stats are overlaid using **Space Mono** in small, high-contrast labels.
- **Stat Bars:** Use a "segmented" look for XP or Power bars, dividing the bar into 10 distinct blocks to make progress feel incremental and earned.
- **Aggressive Icons:** 2px stroke weight minimum. Avoid rounded terminals; use miter joins for sharp, aggressive corners.
- **Input Fields:** Bottom-border only (2px, Silver). When focused, the border glows Red or Gold with a subtle neon-style outer blur.
- **Chips/Badges:** Small, rectangular boxes with heavy borders (2px) and all-caps text. For "KO" or "WIN" badges, use the Red/Gold primary colors respectively.