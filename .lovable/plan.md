# Port theme from "Secure Bond Hub"

Apply the dark navy background palette and Space Grotesk / Inter typography from the Secure Bond Hub project to BondVDR, while keeping all existing app structure and components intact.

## What changes

### 1. `src/index.css`
- Add Google Fonts import for **Space Grotesk** (300–700) and **Inter** (300–600) at the top of the file.
- Replace the current black/gold HSL token set in `:root` with the navy + gold palette from Secure Bond Hub:
  - `--background: 222 47% 8%` (deep navy)
  - `--foreground: 210 40% 92%`
  - `--card / --popover: 222 41% 11%`
  - `--primary: 43 96% 56%` (gold) with navy foreground
  - `--secondary / --accent / --muted`: navy-tinted greys (`217 33% 15–20%`)
  - `--border / --input: 217 30% 18%`
  - `--sidebar-*`: matching navy sidebar tokens
  - Add helper tokens `--gold-glow`, `--navy-deep`, `--navy-light`
- Keep our existing extras that Secure Bond Hub doesn't have so the rest of the app keeps working: `--info`, `--info-foreground`, `--success` (kept as-is or remapped to `142 71% 45%`), `--timestamp`, and the `.stage-*` utility classes.
- Update `body` to use `font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif` and apply Space Grotesk to `h1–h6` with `tracking-tight`.
- Add the `.gold-glow` and `.card-elevated` utility classes from Secure Bond Hub.

### 2. `tailwind.config.ts`
- Add `fontFamily.sans` and `fontFamily.display` set to Space Grotesk / Inter stack.
- Add `colors.gold` and `colors.navy.{deep,light}` mapped to the new CSS vars.
- Leave existing color mappings (info, warning, success, sidebar, timestamp, etc.) untouched so current components keep compiling.

### 3. No component changes required
The existing components already consume these tokens via `bg-background`, `bg-card`, `text-foreground`, `bg-sidebar`, etc., so swapping the token values automatically restyles the whole app to the navy + gold look. The chat stage badges (`stage-mandate`, etc.) remain unchanged.

## Result
- Background switches from near-black to deep navy (`hsl(222 47% 8%)`).
- Cards and sidebar pick up matching navy surfaces.
- Headings render in Space Grotesk; body in Space Grotesk / Inter fallback.
- Gold accent (`hsl(43 96% 56%)`) remains the primary highlight, consistent with Secure Bond Hub.
