# NC Practice Simulator (Mazak / Mazatrol style) — project brief

## Who this is for
I am a web developer (TypeScript/React) starting a job at a Japanese precision machining company
(high-mix, low-volume prototype parts, mostly aluminium A5052, also stainless/steel).
Almost all their CNC machines are **Mazak** (Mazatrol control); CAM software is FeatureCAM.
I have ZERO machining experience. I have ~3 months before I start and will not run a real
machine for a year or more. I want a browser app to practise: programming (Mazatrol conversational
AND EIA/ISO G-code), operating the control panel, and seeing what my program does to a block of material.
It is a learning simulator, not a real CAM/CNC tool. Mainly used on a PC/laptop (landscape, mouse + keyboard).

## Language (EN / JA switch)
- A language toggle in the header: 日本語 / English. Default 日本語. Save choice in localStorage.
- All UI strings come from `src/i18n/ja.ts` and `src/i18n/en.ts` (no hard-coded text in components).
- Japanese mode uses real shop-floor Japanese (as on a Japanese machine screen).
  Every technical term is wrapped in a <Term> component: on hover/tap it shows
  Japanese term, reading (かな), romaji, English, and a one-line explanation.
  Terms live in `src/i18n/glossary.ts` (id, ja, kana, romaji, en, meaningEn, meaningJa).
- Keep key names that appear in English on real Mazak machines in English in both modes
  (e.g. MEMORY, MDI, CYCLE START, FEED HOLD, RESET, POSITION, PROGRAM, TOOL DATA).

## Tech stack
- Vite + React + TypeScript (strict). No backend. Runs with `npm run dev`. Deployable as a static site.
- Pure TypeScript core in `src/nc/` (parsers, interpreter, Mazatrol-unit → toolpath expansion,
  simulation) with NO React inside, covered by Vitest unit tests.
- 2D views: canvas. 3D view: three.js (@react-three/fiber OK).
- State: Zustand. Programs, tool data and lesson progress saved in localStorage; export/import as JSON.
- Readable code with comments that explain the machining logic — I want to learn from the code too.

## Machine models
- Default: Mazak FJV-250 style bridge-type vertical machining center (門形マシニングセンタ).
  Travel X 1020 / Y 510 / Z 460 mm (show alarm if exceeded). Metric only.
- Selectable later: small vertical MC (X 560 / Y 410 / Z 460) and a long-bed machine (X 3048 / Y 510 / Z 510).
- Table with a vise holding a stock block (default 100 × 60 × 20 mm, A5052).
- Tool magazine (ATC) ~20 pockets. TOOL DATA screen per tool: pocket no., tool name
  (END MILL, FACE MILL, CENTER DRILL, DRILL, TAP, REAMER, CHAMFER CUTTER, BALL END MILL),
  nominal diameter, actual diameter, length, life.

## Program type 1 — Mazatrol conversational (simplified, Mazatrol-like)
Programs are built from UNITS, filled in as forms/tables (not typed text):
- COMMON unit: material (A5052 / S45C / SUS304 / SS400), initial Z, multi-workpiece off.
- BASIC COORDINATE (WPC) unit: X, Y, Z, θ of the work origin.
- POINT machining units: DRILLING, RGH CBOR (counterbore), TAPPING, REAMING, CHAMFERING.
  Shape rows: PT (single points), LIN (points on a line), SQR (rectangle pattern), GRD (grid),
  CIR (circle pattern), with spacing and count.
- LINE machining units: LINE CTR / LINE RGT / LINE LFT / LINE OUT / LINE IN, CHMF RGT etc.
  Shape rows: LINE and ARC segments (like a simple contour editor).
- FACE machining units: FACE MILL, TOP EMIL, POCKET, STEP, SLOT.
- END unit.
- Each unit has a TOOL SEQUENCE (tool, nominal Ø, depth/pass, cutting speed C-SP, feed FR) that is
  auto-filled from material + tool ("自動工具展開", automatic tool sequence) and editable.
- Expand units into a toolpath (internally reuse the G-code motion model).
- "Shape check" (形状チェック) screen that draws the shapes before running.
Note in UI: this is a simplified imitation for learning; real Mazatrol screens differ by version
(Matrix / Smooth). Keep the data model flexible so I can adjust fields later.

## Program type 2 — EIA/ISO G-code
G00 G01 G02 G03 (I/J and R), G17, G21, G28, G40 G41 G42 (later), G43 H / G49, G54–G59,
G80 G81 G82 G83 G84 (with R/Z/Q/P/F, G98/G99), G90 G91, G94.
M03 M04 M05 M06 M08 M09 M30, M00/M01. T S F H D N O words, ( ) comments, % lines.
Modal state tracked like a real control. Unknown code → alarm with line number, never a crash.
Include sample programs that look like FeatureCAM output (header comments, tool list, safe start block).

## Control panel (Mazak-like, simplified)
- Mode keys: ZERO RETURN, RAPID, JOG, HANDLE (×1/×10/×100), TAPE (disabled), MDI, MEMORY, EDIT.
- CYCLE START, FEED HOLD, RESET, SINGLE BLOCK, DRY RUN, OPTIONAL STOP, COOLANT.
- Overrides: feed 0–150 %, rapid 25/50/100 %, spindle 50–120 %.
- Screens (menu keys along the bottom): POSITION (work / machine / remaining distance, current unit or block),
  PROGRAM (Mazatrol unit editor or G-code editor), SHAPE CHECK, TOOL DATA, WORK OFFSET, ALARM.
- Status line: mode, program no., current unit/block, S, F, T, spindle/coolant state.

## Simulation
- Run in real time (scaled by overrides), step by step (single block / single unit), or instantly.
- 2D path view: XY top and XZ side; rapids dashed, feeds solid; current tool marker.
- 3D view: stock as a heightmap (2.5D) cut by the tool shape (flat end mill, ball end mill, drill point).
- Alarms (Japanese + English): spindle off while cutting, no feed on G01, rapid into stock,
  tool hits vise, below stock bottom, no tool length offset, travel limit, tool not in TOOL DATA,
  tool diameter too large for pocket.

## Learning features
- Lessons (レッスン): goal drawing + target shape + hint + automatic check (pass/fail + what was wrong).
  Do each lesson twice: once in Mazatrol, once in G-code, and compare the toolpaths.
  1 Face the top 1 mm · 2 Drill 4 holes · 3 Tap M8 ×4 · 4 Pocket 40×20 depth 5 ·
  5 Outside contour (LINE OUT) · 6 Counterbored hole grid like a chip rack ·
  7 A small real-looking part combining all of the above.
- 段取り (Setup) checklist before CYCLE START: work origin set? tools in TOOL DATA? stock size? coolant?
- Glossary page listing all <Term>s with search, linked from every tooltip.
- Visible note on start screen (in both languages): "練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと /
  Practice simulator — always follow company training on real machines."

## Non-goals
No real machine connection, no export to real machines, no CAM, no accounts.

## Roadmap (do ONE phase per task)
1. Project setup, i18n (EN/JA + <Term> + glossary), and the G-code parser + interpreter in src/nc/
   with tests. Minimal page: textarea + Run → list of motion segments.
2. 2D path view (XY / XZ), stock + vise outlines, 3 sample G-code programs.
3. Control panel + POSITION / PROGRAM / TOOL DATA / WORK OFFSET / ALARM screens; MEMORY run with
   single block, feed hold, overrides; MDI; JOG / HANDLE.
4. 3D heightmap stock removal + tool magazine + all alarms.
5. Mazatrol unit editor (COMMON, WPC, DRILLING, TAPPING, RGH CBOR, FACE MILL, POCKET, LINE OUT, END),
   automatic tool sequence, SHAPE CHECK, expansion to toolpath.
6. Lessons 1–7 with automatic checks and progress page.
7. (Later) NC lathe / multi-tasking mode (Mazak QUICK TURN / INTEGREX style).

## Working rules for the coding agent
- Do only the phase I ask for; keep earlier features working.
- Add or extend unit tests for every parser/interpreter/expansion change.
- No UI text outside the i18n files.
- End each task with: what changed, how to test it by hand, what is not done yet.
