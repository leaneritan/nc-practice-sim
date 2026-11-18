import type { AlarmCode } from '../nc';

const contourProgram = `%
O2001 (ROUNDED CONTOUR - A5052)
(T1 - 6MM END MILL / H1 / D1)
G21 G17 G90 G94 G40 G49 G80
T1 M06
G54 S2500 M03
G00 Z15.
G00 X20. Y10.
G43 H1 Z15.
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
(T1 - 5MM DRILL / H1)
G21 G17 G90 G94 G40 G49 G80
T1 M06
G54 S1800 M03
G00 Z15.
G43 H1 Z15.
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
O2003 (M8 X 1.25 TAPPING - PRE-DRILLED HOLES)
(T1 - M8 RIGHT-HAND TAP / H1)
(G94: F = S X PITCH = 400 X 1.25 = 500 MM/MIN)
G21 G17 G90 G94 G40 G49 G80
T1 M06
G54
G00 Z15.
G00 X25. Y30.
G43 H1 Z15.
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
  "referenceHint": "ZERO RETURN moves the selected axis to the illustrative machine reference (0, 0, 80).",
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
  "toolNote": "H1–H20 use the corresponding row’s length. Diameter and life are recorded only; wear and magazine animation are later phases.",
  "offsetNote": "Offsets are in machine millimetres. G54–G59 select a work origin; selecting a row changes the display frame without moving the machine.",
  "select": "Select",
  "active": "Active",
  "invalidNumber": "Enter a finite number within the stated range. The previous value is retained until valid.",
  "noAlarms": "No active alarms.",
  "alarmHint": "Correct the program or setup after RESET.",
  "machineHint": "Simplified Mazak-style training panel. Static previews remain available on SHAPE CHECK.",
  "traceHint": "Completed and current motion in each move’s saved work frame. Machine position is shown separately on POSITION.",
  "dryHint": "DRY RUN uses a 1000 mm/min base cutting feed. G84 instead follows the spindle override to preserve F/S. Rapids use 6000 mm/min at 100%.",
  "spindleHint": "Spindle override scales indicated rpm; cutting-feed override scales motion. No cutting physics or collision detection yet.",
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
  subtitle: 'Phase 3 · Control panel practice',
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
  limitNote: 'Other codes raise an alarm. This phase calculates motion only; it does not check collisions or machine safety.',
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
  stockNote: "Stock: 100 × 60 × 20 mm, A5052. Origin: lower-left top corner; stock Z = −20 to 0. Vise outlines are illustrative. Views fit independently; no collision check.",
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
    tapping: { name: "03 \u00b7 Two M8 tapped holes", description: "M00 setup pause, G84 tapping with spindle reversal; assumes pre-drilled holes.", program: tappingProgram },
  },
};

export type Messages = typeof en;
