---
name: Core Mobility System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system is engineered for efficiency, clarity, and reliability within the parking management sector. It balances the robust, systematic nature of Microsoft Fluent Design with the refined, high-end aesthetics of the Stripe Dashboard. The brand personality is professional, authoritative, and data-centric, ensuring that operators can manage complex logistics with minimal cognitive load.

The style is defined as **Corporate / Modern**. It utilizes high-contrast typography to establish clear information hierarchy, paired with a light, airy interface that feels premium. The aesthetic relies on precision: thin strokes, ample whitespace, and subtle depth through soft shadows and backdrop blurs to differentiate between the navigation, data layers, and interactive controls.

## Colors
The palette is rooted in a professional "Corporate Blue" to signal trust and stability. The "Success Green" is used strategically for availability status and revenue growth indicators. 

The neutral palette leverages a sophisticated range of Blue-Grays (Slate/Zinc) to prevent the interface from feeling "flat" or "dead." Backgrounds are kept pure white or very light gray (`#F8FAFC`) to maximize the contrast of the primary and secondary colors. Surfaces like sidebars and card headers use subtle shifts in the neutral scale to create containment without heavy borders.

## Typography
Inter is the foundation of this design system, chosen for its exceptional legibility in data-heavy environments. The hierarchy is strictly enforced: large headlines use tighter letter spacing and heavier weights for a "premium" feel, while body text uses a standard 14px size for enterprise-grade density. 

Uppercase labels are used sparingly for category headers and table columns to provide a clear visual break from dynamic data. On mobile, headlines scale down to ensure dashboard widgets remain readable without excessive scrolling.

## Layout & Spacing
The system uses a **Fixed Grid** on desktop (max-width 1440px) to maintain the "Dashboard" feel, transitioning to a fluid layout on smaller screens. A 12-column system is used for the main content area, with a fixed 280px sidebar for navigation.

Spacing follows a 4px baseline grid. Gaps between dashboard "cards" are set to 24px (`lg`) to provide significant breathing room, which is a hallmark of the Stripe-inspired aesthetic. Internal padding for containers should typically be 24px to ensure content does not feel cramped against its borders.

## Elevation & Depth
Depth is conveyed through a combination of **Tonal Layers** and **Ambient Shadows**. 

1.  **The Canvas:** The lowest layer is the pure white or light gray background.
2.  **The Card:** Interactive containers use a 1px border (`#E2E8F0`) and a very soft, diffused shadow (0px 4px 6px -1px rgba(0,0,0,0.05)).
3.  **The Popover:** Modals and dropdowns use a higher elevation with a more pronounced blur and a semi-transparent backdrop blur (glassmorphism) to keep the context of the underlying data visible.

This multi-layered approach ensures that the most important information (the data inside the cards) sits "closest" to the user.

## Shapes
The design system employs a **Rounded** shape language. Buttons and input fields use a 0.5rem (8px) corner radius to strike a balance between friendly and professional. 

Larger containers like dashboard cards use a 1rem (16px) radius to create a distinct "app-like" container feel. For specific utility elements like "Status Chips" (e.g., 'Occupied', 'Available'), a full pill-shape (999px) is used to differentiate them from interactive buttons.

## Components

### Buttons
Primary buttons use the Corporate Blue with white text. Hover states should involve a subtle darkening of the hue rather than a shadow increase. Use "Ghost" buttons for secondary actions to maintain the minimal aesthetic.

### Data Tables
Tables are the heart of the system. Implement **Zebra Striping** using `#F8FAFC` on even rows. Column headers should be `label-md` with subtle 1px bottom borders. High-contrast text is used for "ID" and "Status" columns.

### Cards
Cards must have a consistent internal padding of 24px. Titles within cards use `headline-md`. For parking slot status, use a small colored indicator dot (Secondary Green for available, Neutral for empty) next to the slot ID.

### Forms & Inputs
Inputs should have a 1px border that turns Primary Blue on focus. Labels sit clearly above the input in `label-md`. Use "Floating Labels" or clear placeholder text to keep the form clean.

### Interactive Charts
Use the primary and secondary colors for data series. Chart backgrounds should be transparent, utilizing the card's white surface. Grid lines on charts should be extremely faint (`#F1F5F9`).

### Status Chips
Small, high-contrast badges for "Slot Status."
- **Available:** Light green background with dark green text.
- **Occupied:** Light blue background with dark blue text.
- **Reserved:** Light amber background with dark amber text.