# ScreenNote design system — Field Notes

**Status:** implemented in `rebuild/src/styles.css`  
**Font policy:** retain the existing system font stack; no remote font or subscription dependency.

## Brand direction

Field Notes is a calm, warm, editorial workspace: mineral paper, deep evergreen, restrained sage, precise mono metadata, and quiet borders. The product should feel like a considered creative tool—not a generic AI dashboard.

- Evergreen is reserved for primary actions, selected states, focus and meaningful links.
- Sage is a supporting surface/highlight, not a page-wide wash.
- Rust is for destructive, error or caution states.
- Avoid neon lime, purple/blue gradients, glossy glass, oversized decorative cards and emoji iconography.
- Use Lucide line icons consistently; keep video itself uncropped and visually dominant.

## Semantic color tokens

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--sn-paper` | `#f4f2ec` | `#171d19` | App/page background |
| `--sn-surface` | `#fbfaf6` | `#202822` | Cards, panels |
| `--sn-raised` | `#fffefa` | `#263129` | Inputs, raised controls |
| `--sn-ink` | `#202a24` | `#edf0e9` | Primary text |
| `--sn-muted` | `#626c63` | `#b0b9af` | Secondary text |
| `--sn-subtle` | `#879087` | `#89958a` | Tertiary metadata |
| `--sn-line` | `#d9ddd4` | `#39453c` | Borders/dividers |
| `--sn-line-strong` | `#bcc5b9` | `#536256` | Emphasized borders |
| `--sn-accent` | `#315b45` | `#a8c7ad` | Primary action/selected state |
| `--sn-accent-hover` | `#254a37` | `#bdd6c0` | Action hover |
| `--sn-accent-soft` | `#e5ece4` | `#2d3c31` | Selected/quiet action surface |
| `--sn-accent-ink` | `#fffdf8` | `#172019` | Text on accent |
| `--sn-highlight` | `#d9dfc7` | `#435343` | Subtle emphasis |
| `--sn-alert` | `#a6533d` | `#e1a08a` | Error/destructive state |
| `--sn-alert-soft` | `#f3e5df` | `#3c2b27` | Alert surface |

The legacy aliases (`--paper`, `--panel`, `--white`, `--ink`, `--muted`, `--line`, `--acid`, `--acid-ink`, `--rust`, `--shadow`) map to semantic tokens so existing components remain compatible while migrating.

## Typography

Use the existing stack:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Metadata may use the existing system monospace stack.

| Token | Size | Line height | Use |
|---|---:|---:|---|
| `--sn-text-xs` | 12px | 1.4 | Dense metadata |
| `--sn-text-sm` | 13px | 1.5 | Secondary controls/body |
| `--sn-text-md` | 15px | 1.58 | Default reading size |
| `--sn-text-lg` | 18px | 1.4 | Section lead |
| `--sn-text-xl` | 22px | 1.3 | Card/section heading |
| `--sn-text-2xl` | 30px | 1.22 | Page heading |
| `--sn-text-display` | `clamp(36px, 5.2vw, 62px)` | 1.12 | Landing headline |

Headings use tight negative tracking and balanced wrapping. Body copy uses comfortable leading; timestamps and technical metadata use tabular/monospace numerals. Avoid shrinking text merely to fit—allow wrapping and reflow.

## Spacing, radius and depth

Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px` (`--sn-space-1` through `--sn-space-16`).

Radius scale: `4, 7, 12, 18px` (`--sn-radius-xs` through `--sn-radius-lg`). Use small radii for controls and medium/large only for primary work surfaces.

Shadows are layered and restrained:
- `--sn-shadow-sm`: quiet elevation for cards/controls.
- `--sn-shadow-md`: hover or modal separation.
- `--sn-shadow-lg`: modal/overlay only.

## Interaction and accessibility rules

- Primary action is visually singular in each state.
- Interactive targets are at least 44px high where practical.
- Every interactive control has a visible keyboard focus ring.
- Reduced-motion preference disables nonessential animation.
- Normal text contrast must remain at least 4.5:1; large text at least 3:1.
- Light/dark mode changes semantic tokens, not individual hard-coded component colors.
- Keep controls, tables, comments, long titles and metadata contained at 320px; never force horizontal page scroll.
- Video previews use `object-fit: contain` and preserve the source aspect ratio.

## Performance guardrails

These are product targets, not measured field results: p75 LCP <= 1.8s, INP <= 150ms, CLS <= 0.05. Measure separately on mobile and desktop; never state competitor superiority without matched-device/network tests.
