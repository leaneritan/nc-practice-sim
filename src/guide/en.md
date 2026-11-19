# NC Practice Simulator — How to use

## 1. Start here

1. Use this app to practise reading programs, entering Mazatrol units, operating a simplified panel and checking simulated cuts. **Practice simulator — always follow company training on real machines.** This is not an official Mazak control, a CAM system, a machine connection or proof that a program is safe on real equipment. Matrix/Smooth versions differ.
2. Find the four areas in the diagram. The bottom screen keys change what you see; the mode keys change how the simulated machine accepts commands.
3. Use **日本語 / English** in the header. The guide follows that switch and keeps the current chapter. Hover, focus or tap an underlined term such as [work coordinates](term:workCoordinate); Escape closes its tooltip. The glossary is below the simulator.
4. For a fresh exercise, stop/reset an active cycle, then click **Reset to default setup** below the panel. It restores G54–G59, all tools and pocket width, returns the simulated machine home, unloads the tool and replaces the stock. Programs and language remain saved.
5. Open **How to use** for this chapter, or **?** beside a screen for matching help. Opening help applies FEED HOLD and stops jog input. Return with **Back to simulator**; resume explicitly with CYCLE START. Programs/setup/language persist in this browser; position and removed stock do not survive a reload.

```text
[1] Header: title | How to use | 日本語 / English
[2] Display: status + selected screen     [3] Mode/cycle keys
    POSITION / PROGRAM / SHAPE CHECK         EDIT / MEMORY / …
    TOOL DATA / WORK OFFSET / ALARM          CYCLE START / …
[4] Below: Reset to default setup | Replace stock | Glossary
```

**Three different resets:** RESET clears a run/alarm without moving axes or replacing removed material. Replace stock gives a fresh block and clears pilot-hole history, retaining setup/position. Reset to default setup also restores setup and machine home. These simulator actions are not instructions for resetting a real machine.

## 2. Machine basics

1. Open POSITION after resetting the default setup. [Machine coordinates](term:machineCoordinate) reference the fixed machine home; [work coordinates](term:workCoordinate) reference the part origin. At home with H off, machine XYZ is `(0, 0, 0)` but work XYZ is `(500, 250, 400)`.
2. Open WORK OFFSET and inspect [G54](term:workOffset): **X−500, Y−250, Z−400 mm**. It places the stock's lower-left top corner in machine space. The stock extends +X/+Y, with work Z from −20 to 0. G55–G59 are other stored frames; all start with these same values here.
3. Inspect [tool-length compensation](term:toolLength). T selects a tool, M06 mounts it, and G43 H selects its length register. T1 is a Ø6 end mill, H1 = **120 mm**. H is a length value, not a work offset. G49 cancels its application; it does not shorten the physical tool.
4. For a coordinate-only exercise, reset defaults, select MDI and enter `T1 M06`, then CYCLE START. After completion, enter `G54 G00 G43 H1 X10. Y15. Z5.` and start again. POSITION should show work `(10, 15, 5)` and machine `(−490, −235, −275)`. The correct H makes the programmed work Z the tool-tip height.
5. Read the side-view diagram. Machine Z0 is at the top of travel, so normal working positions are negative. This does **not** mean the tool is below the stock: work Z5 is 5 mm above its top. The machine reference point, the tool tip and the table are different things.

```text
Z (machine)                     Example with T1 / H1 = 120
   0  ─ home: top of travel
−275  ─ machine reference point ┐
                               │ 120 mm tool length
−395  ─ tool tip                ┘  = work Z +5
−400  ─ stock top / G54 Z           = work Z  0
−420  ─ stock bottom               = work Z −20
−460  ─ table / lower Z travel limit

Machine X = G54 X + work X       −500 + 10 = −490
Machine Y = G54 Y + work Y       −250 + 15 = −235
Machine Z = G54 Z + work Z + H   −400 + 5 + 120 = −275
```

| Default tool | Length / H (mm) |
| --- | --- |
| T1 END MILL | 120 |
| T2 DRILL | 160 |
| T3 TAP | 150 |
| T4 FACE MILL | 100 |
| T5 BALL END MILL | 130 |
| T6 90° SPOT / CENTER DRILL | 110 |
| T7 REAMER | 180 |
| T8 CHAMFER CUTTER | 110 |

Travel is machine X −1020…0, Y −510…0, Z −460…0 mm. A wrong H can cause a physical collision even when the work numbers look reasonable.

## 3. Control panel

1. Choose a mode using the table. Screen selection and mode selection are separate. During an active/held cycle, mode changes and setup editing are locked; use RESET to abandon the run.
2. Practise **HANDLE** near home: select ×100 and click **Y−** three times. Each click is 0.001 × 100 = 0.100 mm; machine Y becomes −0.300. Y+ moves back toward 0. Positive travel beyond home raises an alarm. RESET does not return Y to zero; ZERO RETURN does.
3. To run a stored program, select MEMORY and CYCLE START. Use FEED HOLD to pause, CYCLE START to resume, and RESET to abandon. Use the button/override reference below before experimenting.

| Mode key | What it does / when to use it |
| --- | --- |
| EDIT | Create/select programs and edit text or units. Does not execute them. |
| MEMORY | Run the selected stored program with CYCLE START. |
| MDI | Enter temporary G-code, then CYCLE START; it continues from the current machine position/modal state. |
| JOG | Hold an axis key to move at 300 mm/min × feed override. Use for manual positioning practice. |
| HANDLE | Click an axis key for one 0.001 mm ×1/×10/×100 increment. Use for small adjustments. |
| RAPID | Hold an axis key at 6000 mm/min × rapid override. Use only with a clear route in the simulator. |
| ZERO RETURN | Click an axis key to return that axis directly to machine zero. It does not choose a collision-free route. |
| TAPE | Disabled; external tape/DNC input is not simulated. |

```text
EDIT → select program → MEMORY → CYCLE START → running
                                      FEED HOLD ↓ ↑ CYCLE START
                                               held
RESET → abandon run, retain position and removed stock
```

| Button / setting | What it does / when to use it |
| --- | --- |
| CYCLE START | Starts MEMORY/MDI, resumes a hold or program stop, or advances the next single block. |
| FEED HOLD | Pauses partway through motion, dwell or tool change; preserves the run for resuming. |
| RESET | Clears run/alarm and stops simulated spindle/coolant. Position and stock stay where they are. Fix the cause before restarting. |
| SINGLE BLOCK | Stops after each source block, including a whole drilling cycle's pecks/retract. Mazatrol stops on generated blocks, not whole units. |
| DRY RUN | Uses 1000 mm/min × feed override for ordinary feeds. It still removes stock and checks collisions here; it is not an air-cut switch. |
| OPTIONAL STOP | Enables M01 stops; M00 always stops. Resume either with CYCLE START. |
| COOLANT | Toggles simulated coolant. A later M08/M09 takes control again. No real fluid or cutting forces are modeled. |
| Feed override | 0–150% of ordinary programmed feed. 0 pauses cutting-feed progress but does not stop rapids. |
| Rapid override | 25%, 50% or 100% of 6000 mm/min rapid motion. |
| Spindle override | 50–120% of commanded rpm. G84 feed follows this override to preserve F/S pitch; feed override and DRY RUN do not change tapping feed. |

With focus outside inputs/buttons, arrow keys move X/Y and Page Up/Down move Z in JOG/RAPID/HANDLE. Hold for JOG/RAPID; HANDLE produces one pulse per key press. Reading the guide disables these shortcuts. [Rapid traverse](term:rapid) and [cutting feed](term:feed) are different motion types.

## 4. Setup

1. Reset defaults for the exercise. Identify the [stock](term:stock) and [vise](term:vise): a 100 × 60 × 20 mm block, top at work Z0; jaws alongside Y0/Y60 below Z−5. The table is at machine Z−460. Stock size and vise geometry are fixed, illustrative models, not editable machine-certified fixtures.
2. Open TOOL DATA. Check pocket number, tool type, nominal/actual diameter and length. Actual diameter controls removal/collision checks; H1–H20 use the row lengths. Save a valid field with Enter or blur. Life is stored but not consumed. A pocket-width limit of 0 disables that extra EIA check; otherwise it must describe the intended pocket, not the stock width.
3. Open WORK OFFSET. Check the active G54–G59 and XYZ values against the intended part origin. Changing G54 also places the fixed simulated stock/vise; G55–G59 select alternative programming frames. Check numbers rather than assuming the currently highlighted frame is correct.
4. Review the checklist before CYCLE START. T only preselects a tool. M06 requires machine Z0, stopped spindle and canceled cycle, then takes two simulated seconds. Apply the matching G43 H afterwards. See [machine basics](#basics) for the numbers.

```text
XY plan: stock top                 XZ side (work Z)
       Y60 ┌──────────────┐          0 ┌─────────┐ stock top
jaw        │ 100 × 60 mm  │         −5 ├─ jaws ─┤
       Y0  └──────────────┘        −20 └─────────┘ stock bottom
           X0           X100       −30 … vise base
           ↑ G54 work origin
```

| Setup checklist | Verify |
| --- | --- |
| Program and material | Correct program/type, units in mm, material and machining order? |
| Work origin | Correct G54–G59, signs and stock placement? Mazatrol WPC is relative to G54. |
| Tools | Correct T/type/actual diameter; H matches the physical tool length? |
| Holding and clearance | Stock/vise understood; approach/retract and tool-change route clear? |
| Depths and holes | Above the stock bottom; blind pilot deeper than tap/reamer; spot tool large enough? |
| Cutting conditions | Spindle direction/speed, feed, coolant, pocket entry and overrides checked? |
| First simulation | SHAPE CHECK reviewed; SINGLE BLOCK selected for careful inspection? |

Setup fields are locked during running/held cycles. Replace stock restores material and pilot history without moving the axes. Reset to default setup also restores the setup and home position.

## 5. Writing G-code

1. Reset defaults. In EDIT → PROGRAM → Program list / Create program, create **EIA/ISO (G-code)**. Paste the example below. It drills two Ø6.8 holes at (20,20) and (80,20), 8 mm below the original stock top. Its speeds/feeds are simulator practice values.
2. Read every commented line. The safe start explicitly sets [absolute positioning](term:absolute), millimetres, XY plane and feed/minute; it cancels an old cycle before tool change. [G28](term:machineCoordinate) goes via an intermediate point: `G91 G28 Z0.` uses zero incremental displacement, then returns Z home. Restore G90 afterwards.
3. Observe the [modal](term:modal) cycle: declare G81 with the first hole, use XY alone for the next hole, then **G80**. G83 adds peck Q, G82 adds dwell P in integer milliseconds, and G84 taps with M03/S and pitch-correct F. The complete G81 cycle is one single block.
4. Check decimal points. **X10. = 10 mm**. A yellow warning appears for **X10**: many real controls interpret it as **0.010 mm**, depending on settings. This app normally keeps 10 mm; **Strict decimal input** changes decimal-less X/Y/Z/I/J/R/Q to 0.001 mm units. F/S/P/T/H/D are not scaled. Use explicit decimals in distance words.
5. Open SHAPE CHECK and Run before MEMORY → CYCLE START. This example should finish without alarms and return machine Z to 0. Copy the code into this simulator only.

```text
Safe start → Z home → T / M06 → G43 H → spindle/coolant
          → cycle + XY repeats → G80 → retract → Z home → M30
```

```gcode
O6001 (TWO HOLES - SIMULATOR PRACTICE ONLY)
G21 G17 G90 G94 G40 G80 (MM, XY, ABSOLUTE, FEED/MIN, CANCEL CYCLES)
M05 M09 (STOP SPINDLE AND COOLANT)
G91 G28 Z0. (ZERO INCREMENTAL INTERMEDIATE POINT, THEN Z HOME)
G90 G49 G54 (ABSOLUTE, CANCEL OLD H, SELECT WORK OFFSET)
T2 M06 (MOUNT DEFAULT 6.8 MM DRILL AT MACHINE Z0)
G00 G43 H2 Z15. (APPLY 160 MM H2 AND POSITION TIP 15 MM ABOVE TOP)
S1800 M03 (SPINDLE CLOCKWISE AT 1800 RPM)
M08 (COOLANT ON)
G98 G81 X20. Y20. Z-8. R3. F120 (FIRST HOLE, RETURN TO INITIAL Z15)
X80. Y20. (SECOND HOLE, REUSE ACTIVE G81 PARAMETERS)
G80 (CANCEL THE DRILLING CYCLE)
G00 Z15. (RETRACT TO CLEARANCE)
M09 M05 (COOLANT AND SPINDLE OFF)
G91 G28 Z0. (RETURN Z HOME VIA ZERO INCREMENTAL DISPLACEMENT)
G90 (RESTORE ABSOLUTE INPUT)
M30 (END PROGRAM)
```

The simulator supports G00–G03, G17/G21/G40/G94, G43/G49, G54–G59, G28, G80–G84, G90/G91, G98/G99 and the implemented M codes. G41/G42 and unsupported codes raise an alarm; do not assume a real control's full dialect is available. [R plane](term:retractPlane) is the approach height; [initial plane](term:initialPlane) is the cycle-entry height used by G98.

## 6. Mazatrol

1. Reset defaults, select EDIT → PROGRAM, open the program list and create **Mazatrol**, or click **Load Mazatrol sample**. The original EIA program remains in the list. Programs are separate saved documents.
2. Select each unit button and fill the forms. [COMMON](term:commonUnit) sets material and initial/clearance Z; [WPC](term:wpcUnit) shifts/rotates the geometry relative to G54. Start with A5052, initial Z15 and WPC XYZ/θ = 0. WPC does not overwrite WORK OFFSET. [END](term:endUnit) finishes with spindle/coolant off and Z home.
3. Add machining units before END. Point units are DRILLING, [RGH CBOR](term:counterbore), [TAPPING](term:tapping) and [REAMING](term:reaming). Face units are [FACE MILL](term:facing) and [POCKET](term:pocket). [LINE OUT](term:outsideContour) accepts closed convex outlines, with LINE endpoints and ARC endpoints/centres/direction; arc joins must be tangent.
4. Add shape rows using the reference below. Remove the default PT if replacing it with a pattern; otherwise it remains an extra hole. For the sample's four M8 holes use SQR X15/Y15, width70/height30.
5. Click [Generate tool sequence](term:autoTools) after material/dimension changes. Rows stay editable; regeneration replaces manual overrides. T/H/type/diameter must match TOOL DATA; T0 means no matching tool. [Cutting speed](term:cuttingSpeed) C-SP is m/min; [feed](term:feed) FR is mm/min. These are practice suggestions, not validated cutting data.
6. Inspect SHAPE CHECK before running and open **View as G-code** to compare the equivalent EIA. Both formats use the same motion, stock and alarms. The generated code is for learning only; real Mazatrol versions differ.

```text
COMMON → WPC → FACE MILL → TAPPING → POCKET → END
                    each unit: shape + tool sequence
                         ↓
             equivalent EIA → shared simulation
```

| Shape row | Input / result |
| --- | --- |
| [PT](term:pointPattern) | One X/Y point. |
| [LIN](term:linePattern) | First X/Y, count, spacing X/Y; includes the first point. |
| [SQR](term:rectanglePattern) | X/Y, width/height; four rectangle corners. |
| [GRD](term:gridPattern) | X/Y, X/Y counts and spacings; a grid. |
| [CIR](term:circlePattern) | Centre X/Y, radius, count, start angle; equally spaced holes. |
| [LINE](term:lineShape) / [ARC](term:arcShape) | LINE OUT boundary endpoints; ARC also needs absolute centre X/Y and CW/CCW. |

**Sample checkpoints:** face from Z0 by 1 mm; the new top is Z−1. Tap M8×1.25 to depth10 from that top: tool-tip Z−11. The 90° [spot drill](term:spotDrill) makes Ø8.5 at depth4.25 using default T6 Ø10; T2 Ø6.8 drills to depth14.44, deeper than the thread. For blind tapping/reaming, pilot depth = finish depth + 0.3 × finish diameter + 0.3 × drill diameter. Through features of depth ≥20 omit the allowance. Total depths are editable; equal/deeper blind finishing raises an alarm. Reload the sample after resetting older saved setups.

The sample [pocket](term:pocket) starts at X30/Y20, size40×20, Top Z−1, depth4: bottom Z−5. [Pocket entry](term:pocketEntry) defaults to a ≤3° zig-zag ramp; optional plunge uses 30% Z feed. Internal corners retain the cutter radius. There is no general concave contour compensation or thread geometry.

## 7. Running and checking

1. In SHAPE CHECK, inspect Mazatrol unit shapes before execution. Click Run for an instant calculation using a copy of the current stock/setup/position. It does not move the panel machine. An executed/held trace is shown instead until RESET clears the run; RESET retains removed stock.
2. Read the XY top and XZ side views in [work coordinates](term:workCoordinate): dashed paths are rapid, solid paths are cutting feed, and the marker is the current endpoint. Each move keeps its own saved work frame; POSITION separately reports machine coordinates and distance remaining.
3. Inspect the 3D result: drag to orbit, scroll to zoom, right-drag to pan, Reset view to restore the camera. This is a 1 mm heightmap with sampled cutter geometry. It cannot represent threads/undercuts or certify holder collisions. Without WebGL, the core and 2D checks still work.
4. Select MEMORY, enable SINGLE BLOCK and press CYCLE START repeatedly. Check the source line/unit and expected position at each stop. A cycle block includes all pecks/retracts. FEED HOLD pauses within a move; RESET abandons it. Replace stock before repeating a fresh-material exercise.
5. On an [alarm](term:alarm), read ALARM and the source line (not N number), detail and Mazatrol unit. Line0 means configuration/unit validation. RESET clears the stop, then EDIT or setup screens let you fix the cause. Re-check SHAPE CHECK before restarting; RESET does not undo a cut or move the tool away.

```text
Shapes → instant preview → inspect paths / stock → single-block run
                              alarm ↓
           read line + cause → RESET → correct → preview again
```

### Alarm reference

Every current alarm code appears below. Both language meanings are included; causes and fixes follow the guide language. These are simulator diagnostics, not real Mazak alarm numbers.

| Code | 日本語の意味 | English meaning | Typical cause | Fix |
| --- | --- | --- | --- | --- |
| `pilotDepth` | 同じXY位置に、タップ・リーマより深い下穴が必要です。止まり穴の仕上げ深さは下穴深さ未満にしてください。貫通穴はともに素材底面へ到達できます。 | The tap/reamer needs a deeper pilot hole at the same XY. Blind finishing depth must be less than the drilled depth; through holes may reach the stock bottom together. | Missing, wrong-position or too-shallow pilot hole. | Drill a deeper smaller-diameter pilot at the same XY; check total depths. Equal depths are allowed only at the through-stock bottom. |
| `unitParameters` | 対話ユニットが不正です。PROGRAM画面を確認してください。 | Invalid conversational unit. Check the PROGRAM screen. | Invalid Mazatrol structure, dimensions or tool rows. | Read the PROGRAM unit errors; correct fields and TOOL DATA, then regenerate tool rows if needed. |
| `spindleStopped` | 材料切削中に主軸が停止しています。M03/M04と正のSを指定してください。 | Spindle is stopped while cutting material. Command M03/M04 and positive S. | A cutting move contacts material with M05 or S0. | Command the intended M03/M04 and positive S before cutting. |
| `rapidStock` | 早送りが未除去の素材に入ります。退避してから切削送りを使用してください。 | Rapid motion enters remaining stock. Retract first and use cutting feed. | G00 crosses material that remains. | Retract to clear Z before XY travel; use cutting feed for entry. DRY RUN does not disable removal. |
| `viseCollision` | 工具がバイスに干渉しています。 | The tool intersects the vise. | The cutter envelope intersects a jaw/base. | Review the fixed vise outlines, tool diameter/length and approach path; change the route or setup. |
| `belowStock` | 工具先端が素材底面より下にあります。 | The tool tip is below the stock bottom. | Physical tip drops below work-stock Z−20. | Check Top Z/depth, WPC, G54 and H, including added blind-pilot allowance. |
| `lengthRequired` | 切削には工具長補正が必要です。G43 Hを指定してください。 | Cutting requires tool-length compensation. Apply G43 H. | Cutting enters stock without an active H. | Mount the tool and apply matching G43 H before approaching material. |
| `travelLimit` | 機械のストロークリミットを超えています。 | Motion exceeds the machine travel limits. | Machine coordinate or an arc extremum exceeds travel. | Inspect machine XYZ, offsets, H, units and arc geometry; stay within the displayed travel limits. |
| `toolMissing` | 工具がTOOL DATAにありません。有効なTを選びM06で交換してください。 | The selected/mounted tool is missing from TOOL DATA. Select a valid T and use M06. | T is absent, no tool is mounted, or the tool record is invalid. | Select a configured T and complete M06; verify TOOL DATA. |
| `pocketDiameter` | 工具の実径が指定したポケット幅を超えています。 | Actual tool diameter exceeds the configured pocket width. | Actual cutter diameter exceeds the configured pocket width. | Choose a smaller suitable tool or correct the actual feature width; do not hide a mismatch by disabling the check. |
| `toolChangeUnsafe` | M06は機械Z0・主軸停止・軸指令なし・固定サイクル解除が必要です。先にM05とG28 Zを実行してください。 | M06 requires machine Z0, stopped spindle, no axis words and no active canned cycle. Use M05 and G28 Z first. | M06 while away from Z home, spindle running, cycle active, or with axis words. | Cancel with G80, M05, retract safely via G28 Z, then issue T/M06 without XYZ. |
| `tappingSpindle` | G84には主軸正転（M03）と正の回転速度Sが必要です。 | G84 requires clockwise spindle rotation (M03) and positive speed S. | G84 with stopped/reverse spindle or nonpositive S. | Set M03 and positive S before G84; verify F/S equals the intended pitch. |
| `syntax` | Gコードの書式が正しくありません。 | Invalid G-code syntax. | Malformed word, missing number or unsupported punctuation. | Use letter-number words such as X10.; remove invalid characters and inspect the reported line. |
| `comment` | コメントの括弧が対応していないか、入れ子になっています。 | Unbalanced or nested comment. | Unclosed or nested parentheses. | Use balanced, nonnested parenthesized comments. |
| `unsupportedWord` | このワードはこのシミュレーターでは未対応です。 | This word is not supported by this simulator. | An unimplemented word such as A or B. | Use supported XYZ/IJ/R and implemented control words; consult chapter 5. |
| `unsupportedCode` | このコードはこのシミュレーターでは未対応です。 | This code is not supported by this simulator. | An unimplemented G/M code, such as G41/G42. | Use the supported subset; do not substitute a code without understanding its motion. |
| `duplicateWord` | 同じブロックに同じワードが複数あります。 | A word appears more than once in the block. | The same non-G/M letter appears twice in one block. | Keep one value per word, or split the intended instructions into separate blocks. |
| `modalConflict` | 同じモーダルグループのコードが重複しています。 | Conflicting codes in the same modal group. | Two codes from one modal group, such as G90 G91. | Choose one mode per group for that block. |
| `invalidValue` | 数値が不正、範囲外、または必要な整数ではありません。 | Invalid, out-of-range or non-integer value. | Out-of-range, nonfinite, negative or noninteger parameter. | Check signs/ranges; T/H/D/N/O and P use integer rules, with positive H. |
| `missingFeed` | 切削移動の前に正の送り速度を指定してください。 | Set a positive feed rate before a cutting move. | G01/arc/cycle has no positive feed. | Set a positive F before or on the first cutting block. |
| `missingMotion` | 軸座標を指定する前に移動モードを選択してください。 | Select a motion mode before specifying axis coordinates. | Axis words occur after G80 with no movement mode. | Explicitly select G00/G01 or the intended cycle before coordinates. |
| `missingOffset` | 指定した工具長補正番号が設定されていません。 | The requested tool-length register is not configured. | H references a missing length register. | Check the registered H number and TOOL DATA; use the mounted tool length. |
| `arcDefinition` | 円弧はI/JまたはRのどちらか一方で指定してください。 | Use either I/J or R to define an arc. | Both I/J and R, or neither, define an arc. | Choose I/J centre offsets or radius R, not both. |
| `arcGeometry` | 円弧の形状に矛盾があるか、作成できない形状です。 | The arc geometry is inconsistent or impossible. | Endpoints/radius/centre cannot form the requested arc. | Check CW/CCW, endpoint and centre offsets; a full circle requires I/J. |
| `cycleParameters` | 穴あけにはZより高いR点が必要です。G82にはP（整数ms）、G83には正のQも必要です。 | Drilling needs R above Z; G82 needs P (integer ms), and G83 needs a positive Q. | R is not above depth, Q is invalid, or G82 P is missing. | Set R above Z, positive Q for G83, integer dwell P for G82; review G90/G91. |
| `cycleFrameChange` | 座標系や補正を変更する前にG80で固定サイクルを解除してください。 | Cancel the cycle with G80 before changing coordinates or compensation. | Changing work frame, distance mode or H during a cycle. | Cancel with G80 before changing G54–G59, G90/G91 or tool compensation. |
| `unexpectedWord` | 現在のモードでは使用できないパラメーターです。 | This parameter does not apply to the current mode. | A parameter is used outside its supported context. | Check whether I/J/R/Q/P/H applies to the current command; remove or relocate it. |
| `limit` | プログラムまたは移動区間の数がシミュレーターの上限を超えています。 | Program or motion expansion exceeds the simulator limit. | Too many blocks, points, passes or sampled motions. | Reduce repeated patterns/passes or split the exercise; do not increase limits to mask a malformed program. |
| `configuration` | インタープリターの設定が正しくありません。 | Invalid interpreter configuration. | Invalid saved offsets, tool lengths, travel or simulation settings. | Check setup values. Reset to default setup if appropriate; it also replaces stock and returns home. |

## 8. Safety habits for the real machine

1. Treat this guide as general background for supervised training. **Practice simulator — always follow company training on real machines.** Ask your trainer which procedures and control version apply. A successful simulation is not permission or evidence to run a real program.
2. Before a first run, verify the program/revision, units, workholding, tool numbers, actual tool lengths, G54–G59 and clearances using the shop's approved setup procedure. Have an experienced person check uncertain signs, measurements or offsets.
3. Use SINGLE BLOCK for a first run when your trainer's procedure calls for it. Check the distance-to-go and intended direction before each start. Set feed override to a low percentage approved for the operation, and check rapid override separately. Tapping and other synchronized cycles may handle overrides differently.
4. Keep a hand near FEED HOLD while observing the first run. Learn the real machine's FEED HOLD, RESET and emergency-stop behavior from your trainer: FEED HOLD is not an emergency stop and may not stop the spindle or coolant. Use the trained emergency procedure if danger develops.
5. Keep guards/interlocks in use and stay clear of moving tools/chips. Do not reach in, measure, clear chips or alter workholding while motion/spindle rotation can occur. Stop and ask when a result or sound is unexpected; do not guess a recovery path or bypass a protection.

```text
Trainer-approved setup check
          ↓
Offsets + tools + workholding + clearances verified
          ↓
Supervised first run: single block + appropriate overrides
          ↓
Observe → hold / trained emergency action if needed → ask
```

The simulator's ZERO RETURN, RESET and setup-reset shortcuts do not teach a real machine's homing/recovery procedure. Lessons with automatic grading, company-specific training and exact Matrix/Smooth compatibility are not part of this guide.
