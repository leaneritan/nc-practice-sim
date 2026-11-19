import type { AlarmCode } from '../nc';

const contourProgram = `%
O2001 (ROUNDED CONTOUR - A5052)
(T1 - 6MM END MILL / H1 / D1)
G21 G17 G90 G94 G40 G49 G80
G91 G28 Z0.
G90
T1 M06
G54 S2500 M03
G00 G43 H1 Z15.
G00 X20. Y10.
D1 M08
G01 Z-2. F100
G01 X80. F300
G03 X90. Y20. I0. J10.
G01 Y40.
G03 X80. Y50. I-10. J0.
G01 X20.
G03 X10. Y40. I0. J-10.
G01 Y20.
G03 X20. Y10. I10. J0.
G00 Z15.
M09 M05
G91 G28 Z0.
G90
M30
%`;

const drillingProgram = `%
O2002 (FOUR HOLES - A5052)
(T2 - 6.8MM DRILL / H2)
G21 G17 G90 G94 G40 G49 G80
G91 G28 Z0.
G90
T2 M06
G54 S1800 M03
G00 G43 H2 Z15.
M08
G98 G82 X20. Y15. Z-8. R3. P500 F120
X80.
G80
M01
G99 G83 X80. Y45. Z-12. R3. Q3. F100
X20.
G80
G00 Z15.
M09 M05
G91 G28 Z0.
G90
M30
%`;

const tappingProgram = `%
O2003 (M8 X 1.25 TAPPING - DRILL THEN TAP)
(T2 - PILOT DRILL / H2, T3 - M8 TAP / H3)
(G94: F = S X PITCH = 400 X 1.25 = 500 MM/MIN)
G21 G17 G90 G94 G40 G49 G80
G91 G28 Z0.
G90
T2 M06
G54 G00 G43 H2 Z15.
S1800 M03
G98 G81 X25. Y30. Z-12. R3. F120
X75.
G80
G00 Z15.
M05
G91 G28 Z0.
G90
T3 M06
G00 G43 H3 Z15.
G00 X25. Y30.
M00 (CHECK PRE-DRILLED HOLES)
S400 M03 M08
G98 G84 X25. Y30. Z-10. R3. P250 F500
X75.
G80
G00 Z15.
M09 M05
G91 G28 Z0.
G90
M30
%`;

export const en = {
  maz: {
  entry: 'Pocket entry', ramp: 'Zig-zag ramp (3° maximum)', plunge: 'Plunge (30% feed)',
  unitNames: { COMMON: 'COMMON', WPC: 'WPC', DRILLING: 'DRILLING', 'RGH CBOR': 'RGH CBOR', TAPPING: 'TAPPING', REAMING: 'REAMING', 'FACE MILL': 'FACE MILL', POCKET: 'POCKET', 'LINE OUT': 'LINE OUT', END: 'END' },
  shapeNames: { PT: 'PT', LIN: 'LIN', SQR: 'SQR', GRD: 'GRD', CIR: 'CIR', LINE: 'LINE', ARC: 'ARC' },
  "library": "Program list / Create program",
  "program": "Selected program",
  "original": "Original EIA/ISO program",
  "name": "New program name",
  "format": "Program type",
  "formats": {
    "eia": "EIA/ISO (G-code)",
    "mazatrol": "Mazatrol"
  },
  "create": "Create program",
  "sample": "Facing + four M8 holes + pocket",
  "loadSample": "Load Mazatrol sample",
  "imitation": "Simplified Mazatrol-style learning forms. Real Matrix/Smooth controls differ. Dimensions are mm; depth is positive below Top Z.",
  "units": "Units",
  "unit": "Unit",
  "unitType": "Unit type",
  "addUnit": "Add unit",
  "up": "Move up",
  "down": "Move down",
  "removeUnit": "Remove unit",
  "material": "Material",
  "multiOff": "Multiple workpieces: OFF",
  "wpcHint": "WPC translates and rotates geometry relative to G54. It does not overwrite WORK OFFSET.",
  "shapes": "Shape rows",
  "shapeType": "Shape type",
  "addShape": "Add shape",
  "removeRow": "Remove row",
  "clockwise": "Clockwise",
  "lineHint": "Closed convex outline only. LINE corners use miters; ARC joins must be tangent. Enter the part boundary; the tool centre is offset outside it.",
  "auto": "Automatic tool sequence / 自動工具展開",
  "toolHint": "Practice starting values only. Regenerate after material/dimension changes; this replaces the tool rows. Rows remain editable. T/H, type and diameter must match TOOL DATA. Tapping FR must equal rounded rpm × pitch.",
  holeHint: '90° spot diameter = hole diameter + 0.5 mm. Blind pilot depth = finish depth + 0.3 × finish diameter + 0.3 × drill diameter; no allowance for through holes (depth ≥ 20 mm). Total depths are editable; regenerate to restore calculated values. The default Ø10 spot tool requires Reset to default setup for older saved setups.',
  "regenerate": "Generate tool sequence",
  "addTool": "Add tool row",
  "viewCode": "View as G-code",
  "learningOnly": "Equivalent EIA for learning only. Not for real machines. SINGLE BLOCK stops after each generated block; POSITION shows its source unit.",
  "shapeCheck": "Unit shapes · XY",
  "shapeHint": "Part boundaries and hole patterns after WPC transformation, before tool-radius offsets or execution.",
  "fields": {
    toolDepth: 'Total tool depth (mm)',
    "x": "X (mm)",
    "y": "Y (mm)",
    "z": "Z (mm)",
    "theta": "θ (degrees)",
    "initialZ": "Initial / clearance Z (mm)",
    "top": "Top Z (mm)",
    "depth": "Depth (positive mm)",
    "diameter": "Diameter (mm)",
    "pitch": "Pitch (mm/rev)",
    "width": "Width X (mm)",
    "height": "Height Y (mm)",
    "startX": "Start X (mm)",
    "startY": "Start Y (mm)",
    "cx": "Arc centre X (mm)",
    "cy": "Arc centre Y (mm)",
    "count": "Count",
    "dx": "Spacing X (mm)",
    "dy": "Spacing Y (mm)",
    "nx": "Count X",
    "ny": "Count Y",
    "radius": "Pattern radius (mm)",
    "angle": "Start angle (degrees)",
    "pocket": "T / H",
    "depthPass": "Depth/pass (mm)",
    "speed": "C-SP (m/min)",
    "feed": "FR (mm/min)"
  },
  "errors": {
    "structure": "Invalid unit structure. Use COMMON, WPC, machining units, END.",
    "value": "Enter finite values and positive dimensions, depths, speeds and feeds.",
    "limit": "Pattern or expansion exceeds the simulator limit; reduce counts or passes.",
    "tool": "Tool sequence does not match TOOL DATA. Check T/H, type and actual diameter; T0 means no matching tool was found.",
    "diameter": "Tool diameter does not fit the feature.",
    "contour": "LINE OUT requires a closed convex contour with valid radii and tangent arc joins.",
    "clearance": "COMMON initial Z must be more than 1 mm above each unit Top Z.",
    "sequence": "Tool type or tapping feed is incompatible with this operation. Regenerate or correct the sequence."
  }
},
  sim: {
  "title": "3D stock removal",
  "canvas": "3D stock, vise and tool",
  "removed": "Removed volume",
  "cubicMm": "mm³",
  "resetCamera": "Reset view",
  "noWebgl": "WebGL is unavailable. Stock simulation, alarms and the 2D views still work.",
  "viewHint": "Drag to orbit, scroll to zoom, right-drag to pan. Red X, green Y, blue Z. Fixed G54 fixture coordinates.",
  "modelHint": "1 mm heightmap with 0.5 mm motion sampling. Flat, ball and drill-point cuts; no undercuts, thread geometry, holder or cutting-force model. This is a practice approximation, not collision certification.",
  "magazine": "Tool magazine",
  "mounted": "In spindle",
  "selected": "Preselected",
  "changing": "Changing tool…",
  "magazineHint": "T selects a pocket. M06 swaps tools in 2 simulated seconds at machine Z0 with the spindle stopped; then apply G43 H. No automatic axis movement.",
  "toolChange": "Tool change",
  "resetSetup": "Reset to default setup",
  "resetHint": "Restores G54–G59, tools and pocket width; resets the simulated machine to home, unloads the tool and replaces stock. Program and language are retained.",
  "newStock": "Replace stock",
  "stockHint": "RESET retains removed material. Replace stock starts a fresh block when the cycle is inactive.",
  "pocketWidth": "Minimum pocket width (mm; 0 = unset)",
  "pocketHint": "Optional intended pocket width for G-code cutting. The simulator cannot infer feature boundaries from a centerline path.",
  "defaults": "FJV-style travel: X −1020…0, Y −510…0, Z −460…0 mm. Machine Z0 is home; table Z−460. Default stock top: G54 (−500, −250, −400).",
  "preview": "Preview uses a separate stock copy; it does not move the machine or remove its material."
},
  panel: {
  previewResetHint: "RESET clears the executed trace and enables a new instant preview.",
  statusLabel: "Machine status",
  "modes": {
    "ZERO RETURN": "ZERO RETURN",
    "RAPID": "RAPID",
    "JOG": "JOG",
    "HANDLE": "HANDLE",
    "TAPE": "TAPE",
    "MDI": "MDI",
    "MEMORY": "MEMORY",
    "EDIT": "EDIT"
  },
  "screens": {
    "POSITION": "POSITION",
    "PROGRAM": "PROGRAM",
    "SHAPE CHECK": "SHAPE CHECK",
    "TOOL DATA": "TOOL DATA",
    "WORK OFFSET": "WORK OFFSET",
    "ALARM": "ALARM"
  },
  "cycleStart": "CYCLE START",
  "feedHold": "FEED HOLD",
  "reset": "RESET",
  "singleBlock": "SINGLE BLOCK",
  "dryRun": "DRY RUN",
  "optionalStop": "OPTIONAL STOP",
  "coolant": "COOLANT",
  "mode": "Mode",
  "screensLabel": "Screens",
  "controls": "Control panel",
  "workPosition": "Work position",
  "machinePosition": "Machine position",
  "remaining": "Distance remaining",
  "block": "Block",
  "programNo": "Program",
  "spindleSpeed": "Spindle speed",
  "feedRate": "Feed rate",
  "tool": "Tool",
  "spindle": "Spindle",
  "on": "ON",
  "off": "OFF",
  "cw": "CW",
  "ccw": "CCW",
  "rpm": "rpm",
  "feedOverride": "Feed override",
  "rapidOverride": "Rapid override",
  "spindleOverride": "Spindle override",
  "percent": "%",
  "handleScale": "Handle multiplier",
  "manual": "Axis movement",
  "manualHint": "Hold a jog key to move. Arrow keys: X/Y; Page Up/Down: Z. HANDLE makes one 0.001 mm × multiplier pulse per click.",
  "referenceHint": "ZERO RETURN moves the selected axis to the illustrative machine reference (0, 0, 0).",
  "setupLocked": "RESET before changing mode, program, or setup during an active cycle.",
  "editHint": "Select EDIT to change the memory program, or MDI to enter a temporary command.",
  "mdiLabel": "MDI command",
  "mdiHint": "CYCLE START runs the command from the current position and modal state. The memory program is unchanged.",
  "memoryHint": "Select MEMORY, then CYCLE START. Use FEED HOLD to pause, or SINGLE BLOCK to stop after each source block.",
  "previewHint": "Instant calculation only; it does not move the panel machine. It uses the current position and saved setup.",
  "pocket": "Pocket / T / H",
  "kind": "Tool type",
  "nominal": "Nominal diameter",
  "actual": "Actual diameter",
  "length": "Tool length",
  "life": "Remaining life (min)",
  "toolNote": "H1–H20 use the corresponding row’s length. Actual diameter and type determine removal and collision checks. Life is recorded only; wear is not simulated.",
  "offsetNote": "Offsets are in machine millimetres. G54–G59 select a work origin; selecting a row changes the display frame without moving the machine.",
  "select": "Select",
  "active": "Active",
  "invalidNumber": "Enter a finite number within the stated range. The previous value is retained until valid.",
  "noAlarms": "No active alarms.",
  "alarmHint": "Correct the program or setup after RESET.",
  "machineHint": "Simplified Mazak-style training panel. Static previews remain available on SHAPE CHECK.",
  "traceHint": "Completed and current motion in each move’s saved work frame. Machine position is shown separately on POSITION.",
  "dryHint": "DRY RUN uses a 1000 mm/min base cutting feed. G84 instead follows the spindle override to preserve F/S. Rapids use 6000 mm/min at 100%.",
  "spindleHint": "Spindle override scales indicated rpm; cutting-feed override scales motion. Sampled geometry checks stop unsafe blocks; cutting forces are not simulated.",
  "saveHint": "Valid entries are saved when focus leaves the field.",
  "plus": "+",
  "minus": "−",
  "handleBase": "0.001 mm ×",
  "status": {
    "idle": "Ready",
    "running": "Running",
    "held": "Feed hold",
    "singleBlock": "Single block stop",
    "programStop": "Program stop",
    "complete": "Complete",
    "alarm": "Alarm"
  },
  "kinds": {
    "endMill": "END MILL",
    "faceMill": "FACE MILL",
    "centerDrill": "CENTER DRILL",
    "drill": "DRILL",
    "tap": "TAP",
    "reamer": "REAMER",
    "chamfer": "CHAMFER CUTTER",
    "ballMill": "BALL END MILL"
  }
},
  title: 'NC Practice Simulator',
  subtitle: 'Phase 5 · Conversational programming',
  language: 'Language',
  japanese: '日本語',
  english: 'English',
  disclaimer: 'Practice simulator — always follow company training on real machines.',
  introduction: 'Edit the program, then run it to inspect each calculated movement.',
  programKey: 'PROGRAM',
  programLabel: 'G-code program',
  run: 'Run',
  reset: 'Load selected sample',
  exampleHint: 'Choose a rounded contour, four drilled holes, or two tapped holes. Samples use explicit decimal points.',
  previewHint: "Instant calculation only; it does not move the panel machine. It uses the current position and saved setup.",
  assumptions: "Metric · G17 XY plane · work offsets and H lengths come from WORK OFFSET / TOOL DATA.",
  coordinates: "Paths and listed endpoints use each move’s saved work coordinates, including its active G54–G59 and H compensation. Machine position is shown on POSITION.",
  capabilities: 'G00–G03 · G17/G21/G40/G94 · G43/G49 · G54–G59 · G28/G80/G81/G82/G83/G84 · G90/G91 · G98/G99 · M00/M01/M03–M06/M08/M09/M02/M30',
  limitNote: 'Other codes raise an alarm. Sampled safety checks are for practice only and cannot certify real machining.',
  previous: 'Previous', next: 'Next', page: 'Page',
  selectSample: "Sample program",
  loadSample: "Load selected sample",
  pathView: "2D toolpath",
  xyView: "XY · Top",
  xzView: "XZ · Side",
  xyCanvas: "XY top view of the toolpath, stock and vise",
  xzCanvas: "XZ side view of the toolpath, stock and vise",
  cutting: "Cutting feed (solid)",
  toolMarker: "Current endpoint",
  stockNote: "Stock: 100 × 60 × 20 mm, A5052. Origin: lower-left top corner; stock Z = −20 to 0. Vise outlines are illustrative. Views fit independently; safety checks use a fixed G54 fixture.",
  strictDecimals: "Strict decimal input (0.001 mm)",
  decimalWarning: "Missing decimal point",
  decimalExplanation: "Many real controls interpret a coordinate without a decimal point in 0.001 mm units: X10 can mean 0.010 mm, while X10. means 10 mm. Actual behavior depends on the control and its settings.",
  decimalNormal: "Normal mode keeps X10 = 10 mm. Strict mode scales decimal-less X/Y/Z/I/J/R/Q words only; F, S, P and register numbers are unchanged.",
  decimalStrict: "Strict mode is ON: decimal-less X/Y/Z/I/J/R/Q words are interpreted in 0.001 mm units. Explicit decimal points keep millimetres.",
  interpreted: "Used",
  strictValue: "Strict value",
  warningLimit: "Showing the first 50 warnings.",
  optionalStop: "OPTIONAL STOP (M01)",
  continueRun: "Continue",
  paused: "Calculation paused at program stop",
  pauseHint: "Continue runs the remaining blocks. Editing the program or changing a setting requires a new Run.",
  events: "Program events",
  dwell: "Dwell",
  spindleCW: "Spindle clockwise",
  spindleCCW: "Spindle counterclockwise",
  mandatoryStop: "M00 · Program stop",
  optionalPaused: "M01 · Optional stop",
  optionalSkipped: "M01 · Optional stop skipped",
  milliseconds: "ms",
  afterSegment: "After segment",
  results: 'Results',
  count: 'segments',
  ready: 'Run a program to see its motion segments.',
  empty: 'No motion segments were generated.',
  complete: 'Calculation complete',
  stopped: 'Calculation stopped; only completed blocks are listed.',
  stale: 'Program or settings changed — run again to update the results.',
  line: 'Line',
  type: 'Type',
  from: 'From',
  to: 'To',
  geometry: 'Arc details',
  center: 'Centre',
  radius: 'Radius',
  sweep: 'Sweep',
  mm: 'mm',
  mmMin: 'mm/min',
  degrees: '°',
  dash: '—',
  x: 'X', y: 'Y', z: 'Z',
  explanation: 'Explanation',
  glossary: 'NC glossary',
  glossaryHint: 'Hover, focus or tap an underlined term to see its reading and meaning. Press Escape to close.',
  alarms: {
    pilotDepth: 'The tap/reamer needs a deeper pilot hole at the same XY. Blind finishing depth must be less than the drilled depth; through holes may reach the stock bottom together.',
    unitParameters: "Invalid conversational unit. Check the PROGRAM screen.",
    spindleStopped: "Spindle is stopped while cutting material. Command M03/M04 and positive S.",
    rapidStock: "Rapid motion enters remaining stock. Retract first and use cutting feed.",
    viseCollision: "The tool intersects the vise.",
    belowStock: "The tool tip is below the stock bottom.",
    lengthRequired: "Cutting requires tool-length compensation. Apply G43 H.",
    travelLimit: "Motion exceeds the machine travel limits.",
    toolMissing: "The selected/mounted tool is missing from TOOL DATA. Select a valid T and use M06.",
    pocketDiameter: "Actual tool diameter exceeds the configured pocket width.",
    toolChangeUnsafe: "M06 requires machine Z0, stopped spindle, no axis words and no active canned cycle. Use M05 and G28 Z first.",

    tappingSpindle: "G84 requires clockwise spindle rotation (M03) and positive speed S.",
    syntax: 'Invalid G-code syntax.',
    comment: 'Unbalanced or nested comment.',
    unsupportedWord: 'This word is not supported by this simulator.',
    unsupportedCode: 'This code is not supported by this simulator.',
    duplicateWord: 'A word appears more than once in the block.',
    modalConflict: 'Conflicting codes in the same modal group.',
    invalidValue: 'Invalid, out-of-range or non-integer value.',
    missingFeed: 'Set a positive feed rate before a cutting move.',
    missingMotion: 'Select a motion mode before specifying axis coordinates.',
    missingOffset: 'The requested tool-length register is not configured.',
    arcDefinition: 'Use either I/J or R to define an arc.',
    arcGeometry: 'The arc geometry is inconsistent or impossible.',
    cycleParameters: 'Drilling needs R above Z; G82 needs P (integer ms), and G83 needs a positive Q.',
    cycleFrameChange: 'Cancel the cycle with G80 before changing coordinates or compensation.',
    unexpectedWord: 'This parameter does not apply to the current mode.',
    limit: 'Program or motion expansion exceeds the simulator limit.',
    configuration: 'Invalid interpreter configuration.',
  } satisfies Record<AlarmCode, string>,
  sampleProgram: contourProgram,
  samples: {
    contour: { name: "01 \u00b7 Rounded contour", description: "End-mill contour with lines, I/J arcs, D1 and G28.", program: contourProgram },
    drilling: { name: "02 \u00b7 Four drilled holes", description: "G82 dwell, G83 pecks and an optional stop between rows.", program: drillingProgram },
    tapping: { name: "03 \u00b7 Two M8 tapped holes", description: "Drills pilot holes, exchanges to T3, then pauses at M00 before G84 tapping with spindle reversal.", program: tappingProgram },
  },
};

export type Messages = typeof en;
