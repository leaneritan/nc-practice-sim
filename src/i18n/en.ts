import type { AlarmCode } from '../nc';

export const en = {
  title: 'NC Practice Simulator',
  subtitle: 'Phase 1 · G-code foundations',
  language: 'Language',
  japanese: '日本語',
  english: 'English',
  disclaimer: 'Practice simulator — always follow company training on real machines.',
  introduction: 'Edit the program, then run it to inspect each calculated movement.',
  programKey: 'PROGRAM',
  programLabel: 'G-code program',
  run: 'Run',
  reset: 'Load example',
  exampleHint: 'The example contains positioning, a straight cut, two arcs, drilling and peck drilling.',
  assumptions: 'Metric · XY plane · G54–G59 offsets = 0 · H1 = 0 mm · initial machine position = (0, 0, 0).',
  coordinates: 'Endpoints use machine reference-point coordinates, including work and tool-length offsets. Configure offsets through the TypeScript API in Phase 1.',
  capabilities: 'G00–G03 · G17/G21/G40/G94 · G43/G49 · G54–G59 · G80/G81/G83 · G90/G91 · G98/G99 · M03–M06/M08/M09/M02/M30',
  limitNote: 'Other codes raise an alarm. This phase calculates motion only; it does not check collisions or machine safety.',
  previous: 'Previous', next: 'Next', page: 'Page',
  results: 'Results',
  count: 'segments',
  ready: 'Run a program to see its motion segments.',
  empty: 'No motion segments were generated.',
  complete: 'Calculation complete',
  stopped: 'Calculation stopped; only completed blocks are listed.',
  stale: 'Program edited — run again to update the results.',
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
  glossary: 'First 20 NC terms',
  glossaryHint: 'Hover, focus or tap an underlined term to see its reading and meaning. Press Escape to close.',
  alarms: {
    syntax: 'Invalid G-code syntax.',
    comment: 'Unbalanced or nested comment.',
    unsupportedWord: 'This word is not supported in Phase 1.',
    unsupportedCode: 'This code is not supported in Phase 1.',
    duplicateWord: 'A word appears more than once in the block.',
    modalConflict: 'Conflicting codes in the same modal group.',
    invalidValue: 'Invalid, out-of-range or non-integer value.',
    missingFeed: 'Set a positive feed rate before a cutting move.',
    missingMotion: 'Select a motion mode before specifying axis coordinates.',
    missingOffset: 'The requested tool-length register is not configured.',
    arcDefinition: 'Use either I/J or R to define an arc.',
    arcGeometry: 'The arc geometry is inconsistent or impossible.',
    cycleParameters: 'Drilling needs R above Z; G83 also needs a positive Q.',
    cycleFrameChange: 'Cancel the cycle with G80 before changing coordinates or compensation.',
    unexpectedWord: 'This parameter does not apply to the current mode.',
    limit: 'Program or motion expansion exceeds the simulator limit.',
    configuration: 'Invalid interpreter configuration.',
  } satisfies Record<AlarmCode, string>,
  sampleProgram: `%
O1001
G21 G17 G90 G94 G40 G49 G80
T1 M06
G54 S1200 M03
G00 X0 Y0 Z10
G43 H1 Z10
M08
G01 Z0 F100
G01 X20 F200
G03 X30 Y10 I0 J10
G02 X40 Y20 R10
G00 Z10
G98 G81 X10 Y10 Z-5 R2 F100
X30
G80
G99 G83 X40 Y30 Z-8 R2 Q3 F80
G80
G00 Z10
M09
M05
M30
%`,
};

export type Messages = typeof en;
