# Amiro · North Park 3D Explorer

Interactive 3D explorer by **Amiro** showing **North Park** by Genurise Builders (formerly MJR Builders),
KIADB Aerospace Park, Bagalur, North Bengaluru: towers → floors → furnished, walkable homes.
Tower massing, site amenities and specifications follow the developer's published master plan and
website; floor counts, unit plans, areas, prices and availability are **indicative placeholders**
(see `PROJECT.disclaimer` in `src/data/project.ts`) until the official price list and floor plans are added.
React 18 + TypeScript + Vite, three.js via @react-three/fiber/drei. Everything (buildings, trees,
people, furniture) is generated procedurally — no external model or HDR downloads at runtime.

## Run

Node isn't installed system-wide on this machine; a portable copy lives in `.node/` (git-ignored).

```powershell
& .\.node\node.exe node_modules\vite\bin\vite.js          # dev server → http://localhost:5173
& .\.node\node.exe node_modules\typescript\bin\tsc --noEmit # type-check
& .\.node\node.exe node_modules\vite\bin\vite.js build     # production build → dist/
```

On a normal machine: `npm install`, `npm run dev`, `npm run build`. Deploy `dist/` to Netlify/Vercel
(`public/_redirects` handles SPA routing).

## Features

- Site (North Park master plan): Towers A and B, each a slab of two lift-core wings with a recessed slot,
  white portico lobbies and a terrace sky garden under a white crown frame; clubhouse with terrace deck,
  pool + kids' pool, yoga deck, dribble court, cricket pitch, EPDM play area, toddlers' sand pit, stepped
  seating, elders' gym, work pods, drivable green, jogging loop and fire-tender driveway; real sun position
  (suncalc) with shadows, night mode with lit windows and street lights.
- Cinematic "show what you say" tours: narration is split into beats; for each sentence the Director
  frames the item (closeup / dolly / wide / orbit / balcony view), outlines and labels it, draws room
  dimensions or a compass, and the host (blazer, face, blinking, lip-sync to the voice) points at it.
  Karaoke subtitles, chapters, cinematic-camera toggle; drag the view to take over for 5 s.
- Search, filters, status colours, plan view, floors explode + furnished dollhouse, compare, EMI,
  price breakdown, Vastu, sunlight hours, PDF brochure, enquiry form, deep links (`?flat=A-1204`).
- Walk the site in 1st/3rd person with an avatar, guided site tour, site mini-map (tap to walk),
  ambient residents (guard, joggers, kids, strollers).
- Walk inside any flat: every flat has a deterministic home profile (7 themes, household type,
  open/closed kitchen, accent wall style, false-ceiling design) — rounded, merged procedural furniture
  (sofas with cushions, beds, wardrobes, modular kitchen, bathroom fittings, pooja, décor, clutter),
  textured marble/wood/tile floors, cove-lit false ceilings, curtains, fans, AC units, switch boards,
  doors that open as you approach, room labels and a room card (size, direction, Vastu, flooring,
  electrical points). `🎨 Interior` cycles themes; Auto / Sample / Lived-in / Bare-shell furnishing.
- Whole floor is walkable: lift lobby, corridor, fire exit and all four homes. Flat switcher
  (◀ 01 02 03 04 ▶) walks you through the corridor to another home; the lift panel rides to any
  floor (or back to the ground lobby). Floor map with live position — tap any room to walk there.
- Guided tours with voice narration (Web Speech API, offline system voices; Indian English preferred):
  this home (room by room + EMI/sunlight/Vastu summary), this floor (every home, entering available
  ones), site tour, and a complete tour (site → lobby → lift → floor → homes). Pause, previous/next
  step, mute, voice and speed settings. A sales host leads the way and talks at each stop.

Keyboard: `F` filters · `S` sun · `C` compare · `P` plan · `O` 3D · `L` floors · `W` walk · `Esc` back.
In walk modes: `WASD`/arrows, `Shift` to run, drag to look.

## Replacing project data

- `src/data/project.ts` — towers (position, facing), unit types (rooms in metres, plan coords:
  x along the façade, y from corridor to view side), pricing and flat generation.
- `src/data/site.ts` — site layout (roads, pool, clubhouse, parking…).
- `src/data/interiors.ts` — interior themes, households and handover specs.

## Writing tours

Tours are lists of waypoints (`src/lib/floor.ts` → `Waypoint`): `{ x, z, caption?, say?, pause?, action? }`.
Steps without a caption are just path points; captioned steps stop, show the caption, speak `say`
and run `action`. Build them in `src/lib/tours.ts` (narration text in `src/lib/narration.ts`) and start
them with `startTour(steps, title)` from `src/lib/tourEngine.ts`. Use `floorRoute()` to get walkable
paths across homes and the corridor.

## Code map

| Folder | Contents |
| --- | --- |
| `src/scene` | `TowerBlock` (façades, status overlay, dollhouse), `Vegetation`, `Cityscape`, `Site`, `Pool`, `Sun`, `CameraRig`, `PlayerControls` (walking/avatar camera), `InteriorScene` (doors, fans, host/residents), `HomeModel`, `Person` (procedural animated people), `People` |
| `src/lib` | geometry, walls (wall network from rooms), furniture (procedural furnishing), route (room graph path-finding), tours, pricing, vastu, sun, filter, brochure |
| `src/ui` | header, panels, flat sheet, floor plan SVG, walk UI (mode bar, room HUD, mini-maps) |
| `src/store` | zustand store + URL sync, per-frame `runtime` values |

## Adding real 3D assets later

Put compressed assets in `public/assets/` and load them with drei `useGLTF`/`useKTX2`
(never from a CDN). Compress with:

```bash
npx @gltf-transform/cli optimize in.glb public/assets/out.glb --compress meshopt --texture-compress ktx2
```
