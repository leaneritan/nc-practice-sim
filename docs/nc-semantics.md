# Phase 5 control and interpreter reference / インタープリター仕様

### Scope and conventions

- Supported: G00/G01, G02/G03 (XY plane, incremental I/J or signed R, including helical Z), G17/G21/G40/G94, G43 H/G49, G54–G59, G28/G80/G81/G82/G83/G84, G90/G91, G98/G99; F/S/T/H/D/P/N/O; M00/M01/M03/M04/M05/M06/M08/M09/M02/M30. Parenthesized comments, semicolon comments and `%` delimiter lines are accepted.
- Modal motion/feed settings persist between blocks. Unknown codes, unsupported words and invalid geometry produce an alarm with the **physical source line**. A syntax error prevents the whole program from running; an execution alarm stops at that block and retains only earlier completed blocks. The pure `runProgram` API starts fresh unless `initialModalState` is provided; panel runs start at the current machine position and modal state.
- The page starts at machine home `(0, 0, 0)` (also the G28 reference), with G54–G59 = `(−500, −250, −400)` and 100–180 mm tool lengths. WORK OFFSET and TOOL DATA edit these values; valid entries persist in localStorage. The pure API (`runProgram(source, options)`) defaults to only H1 = 0; other H registers must be configured explicitly.
- Segments describe the **machine reference point**: absolute machine target = programmed work coordinate + work offset + active tool length (Z only). Changing G54–G59 or G43/G49 without an axis command does not move the machine. Omitted axes keep their machine positions. G91 moves by the specified displacement; I/J always remain relative to the arc start. Positive R selects the minor arc; negative R selects the major arc. Full circles require I/J.
- G81/G83 retain R/Z and G83 Q across holes; axis words or an explicit cycle call trigger another hole. G98 returns to the initial plane (or R if higher); G99 returns to R. In G91, R is measured from the cycle's initial plane and Z from R. G83 fully retracts to R between pecks, then rapidly returns 0.5 mm above the preceding bottom. Cancel with G80 (or G00–G03) before changing the coordinate system, distance mode or length compensation.
- The parser limits input to 200,000 characters / 10,000 lines; execution allows at most 20,000 segments. The UI shows 100 segments per page. Numeric magnitudes are limited to 1,000,000.
- **Not implemented:** lessons, JSON import/export, and codes outside the list above (including G41/G42 and G18/G19).

### 対応範囲と計算規則

- 対応：G00/G01、G02/G03（XY平面、増分I/Jまたは符号付きR、Z方向のヘリカル移動も可）、G17/G21/G40/G94、G43 H/G49、G54〜G59、G28/G80/G81/G82/G83/G84、G90/G91、G98/G99、F/S/T/H/D/P/N/O、M00/M01/M03/M04/M05/M06/M08/M09/M02/M30。括弧コメント、セミコロンコメント、`%`行に対応します。
- 移動モードや送り速度は次のブロックにも引き継がれます。未対応のコード・ワードや不正な形状は、**入力テキストの行番号**付きのアラームになります。構文エラー時は全体を実行せず、実行時エラーではそのブロックで停止して、前の正常な結果のみを残します。純粋なAPIの`runProgram`は`initialModalState`を省略すると状態を初期化します。操作盤は現在位置・モーダル状態から実行します。
- 画面の初期機械位置とG28復帰位置は`(0, 0, 0)`、G54〜G59は`(−500, −250, −400)`、工具長は100〜180 mmです。WORK OFFSET・TOOL DATAで編集し、有効値をブラウザーに保存します。純粋なAPIの既定値はH1 = 0のみで、他のH番号は明示的に設定します。
- コアの移動区間は**機械基準点**を保持し、図はワーク座標へ変換します。絶対値の移動先は「指令ワーク座標 + ワーク座標オフセット + 工具長補正（Zのみ）」で計算します。軸指令なしの座標系・補正変更では移動せず、省略した軸の機械位置も変えません。G91は移動量指定です。I/Jは常に円弧始点からの増分、正のRは短い円弧、負のRは長い円弧です。全円にはI/Jが必要です。
- G81/G83はR/Z、G83はQも保持し、軸指令または明示的なサイクル呼出しで次の穴を加工します。G98は開始時の高さ（R点が高ければR点）、G99はR点へ戻ります。G91ではRは開始時の高さから、ZはR点からの増分です。G83は各切込み後にR点まで戻り、前回の穴底の0.5 mm上まで早送りで再進入します。座標系・指令方式・工具長補正を変更する前にG80（またはG00〜G03）で解除してください。
- 入力は20万文字・1万行、移動区間は2万件が上限です。画面は100件ずつ表示し、数値の絶対値は100万以下に制限します。
- **未実装：** レッスン、JSON入出力、上記以外のコード（G41/G42、G18/G19など）。


## Configuring offsets / オフセットの設定

```ts
import { runProgram, workPosition } from './src/nc';

const options = {
  workOffsets: { 54: { x: 100, y: 200, z: 30 } },
  toolLengths: { 1: 50 },
};
const result = runProgram('G54 G43 H1 G00 X10. Y20. Z5.', options);
// Machine reference point / 機械基準点: { x: 110, y: 220, z: 85 }
console.log(result.state.position);
// Programmed tool-tip position / 指令工具先端位置: { x: 10, y: 20, z: 5 }
console.log(workPosition(result.state, options));
```

## G-code execution details

- **G28** is non-modal. First, rapid to the programmed intermediate point using G90/G91 and active work/length offsets; then rapid the named axes to `referencePosition` in machine coordinates. Omitted axes stay put. With no axis words, all axes return directly. `G91 G28 Z0.` therefore returns only Z without an intermediate displacement. The API reference and initial position default to `(0, 0, 0)`; the page also supplies `(0, 0, 0)` for both. A conflicting explicit motion command or active drilling cycle must be cancelled first; `G80 G28` is accepted. Modal motion and length compensation remain selected after G28.
- **G82** follows G81 motion with a bottom dwell. `P` is a non-negative integer **milliseconds** value: `P500` means 0.5 seconds. P is required on first entry and retained for repeated holes in that cycle. `P0` is valid. Events record the dwell without adding false motion. The instant preview skips elapsed time; timed panel execution waits for P milliseconds. A new cycle type or G80 cancellation clears the inherited dwell.
- **G84** is a simplified right-hand tapping cycle. It requires M03, positive S and positive F. Feed down clockwise, optionally dwell P at depth, reverse the spindle, **feed back to R**, restore clockwise rotation, then rapid to the G98 initial plane if higher. G99 ends at R. In G94, pitch is `F / S`; the M8 × 1.25 sample uses S400/F500. No pitch verification, rigid-tapping servo model or thread geometry is implemented. The sample drills 6.8 mm pilot holes with T2 before exchanging to the T3 tap; material removal uses the tap’s cylindrical envelope.
- **M00/M01** act after all motion in their block. M00 always pauses calculation; M01 pauses only with `optionalStop: true`. `resumeProgram(result)` continues the saved program/options from the next block, retaining modal values. It does not rerun earlier blocks or mutate the previous result. In the instant interpreter these are calculation pauses; panel execution resumes with CYCLE START: commanded spindle/coolant state is retained. Skipped M01s are recorded as events. M02/M30 end execution permanently. Editing input/settings invalidates the page's Continue action until Run is pressed again.
- **D** is a non-negative integer cutter-offset register stored in modal state and segment metadata. D0 clears the selection. G41/G42 cutter compensation is still unsupported; D does not shift the path. **P** is only accepted for G82/G84; standalone dwell G04 is not implemented.
- **Decimal-less input:** the parser preserves numeric spelling. X/Y/Z/I/J/R/Q without a `.` receive line-numbered warnings in either mode, including zero and signed values. In normal mode `X10` means 10 mm; `strictDecimals: true` converts it to 0.010 mm. `X10.`, `X10.0` and `X.5` always use millimetres. F, S, P, D, H, T, N, O and G/M numbers are never scaled. Configured offsets and reference positions are always in mm. This models a common 0.001 mm input increment; actual controls depend on model and settings.
- **Events and geometry:** `events` records dwell, tapping spindle reversal and program stops with their source line, position and `afterSegment` count. The preview renders calculated segments; timed execution renders completed and partially traversed segments, including sampled arcs/helices. Rapids are dashed; feeds are solid. Both projections preserve equal axis scales but fit independently. The marker tracks the current position, including a mid-move hold. Geometry and marker are transformed to WORK coordinates.
- **Workholding:** the fixed A5052 stock is X0–100, Y0–60, Z−20–0 mm. Vise jaws touch the Y0/Y60 faces; the base lies below Z−30. The same illustrative jaw/base boxes are used by collision checks; they do not model a specific physical vise. Stock and vise remain fixed in WORK coordinates. Each segment subtracts its saved work offset and active tool length from both endpoints and its arc center; changing setup later never reinterprets old segments. Switching G54–G59 overlays each programmed work frame on the same illustrative stock, rather than displaying multiple physical fixtures.

## Gコードの実行規則

- **G28：** 非モーダルです。G90/G91と有効なワーク座標・工具長補正で中間点へ早送りし、その後、指定軸だけを機械座標の`referencePosition`へ戻します。軸指定なしでは全軸が直接復帰します。`G91 G28 Z0.`は中間移動なしでZだけ復帰します。APIの初期・復帰位置の既定値は`(0, 0, 0)`、画面も`(0, 0, 0)`です。移動指令の重複や有効な固定サイクルは事前に解除してください（`G80 G28`は可）。移動モードと工具長補正の選択は保持します。
- **G82／P：** G81の動きに穴底ドウェルを加えます。Pは0以上の整数の**ミリ秒**です（P500 = 0.5秒）。初回に指定し、同じサイクルの次の穴にも保持します。別のサイクルやG80で保持は解除します。P0も有効です。即時計算では待機せず記録だけを残し、操作盤の実時間再生ではPミリ秒待機します。偽の移動区間は追加しません。
- **G84：** 簡略化した右ねじのタップサイクルです。M03、正のS・Fが必要です。正転で切削送りし、必要なら穴底でPのドウェル後、逆転して**R点まで切削送りで戻り**、正転を復帰します。G98ではその後に初期高さへ早送りし、G99はR点で終了します。G94でのピッチはF/Sで、M8 × 1.25の例はS400/F500です。ピッチ検証・剛性タップのサーボ同期・ねじ形状の生成は未実装です。サンプルはT2で6.8 mmの下穴を加工してからT3のタップへ交換し、材料除去はタップの円柱包絡で近似します。
- **M00／M01：** 同じブロックの動きが完了してから計算を停止します。M00は必ず停止し、M01は`optionalStop: true`のときだけ停止します。`resumeProgram(result)`または画面の「続行」で、保存済みのプログラム・設定・モーダル状態を使用して次のブロックから再開します。前の結果は変更せず、完了済みの動きも再実行しません。即時計算では計算の一時停止、操作盤ではCYCLE STARTによる再開として扱います。指令上の主軸・クーラント状態は保持します。M02/M30は終了で、再開できません。入力・設定変更後は再実行が必要です。
- **D：** 0以上の整数の工具径補正番号として状態と移動区間に保存し、D0で選択を解除します。G41/G42は未対応で、Dを指定しても経路は変えません。PはG82/G84でのみ使用でき、G04は未対応です。
- **小数点のない入力：** X/Y/Z/I/J/R/Qに小数点がない場合、符号付きや0も含めて行番号付きの警告を出します。通常モードのX10は10 mm、`strictDecimals: true`では0.010 mmです。X10.・X10.0・X.5は常にmmです。F・S・P・D・H・T・N・O・G/M番号は換算しません。設定したオフセット・復帰位置も常にmmです。実機の解釈は機種と設定によって異なります。
- **動作記録と表示：** `events`にはドウェル・主軸逆転・プログラム停止と、行・位置・直前までの移動区間数を記録します。プレビューは計算済み経路、実時間再生は完了済み経路と現在の移動途中までを表示し、円弧・ヘリカル移動も補間します。早送りは破線、切削送りは実線、マーカーは移動途中の停止を含む現在位置です。各図は縦横を同じ縮尺にし、独立して全体を収めます。図とマーカーはワーク座標へ変換します。
- **素材・保持具：** 固定のA5052素材はX0〜100、Y0〜60、Z−20〜0 mmです。バイス口金はY0/Y60の面に接し、ベースはZ−30より下にあります。この模式的な口金・ベース形状を干渉判定にも使用しますが、特定の実機バイスの形状ではありません。素材・バイスはワーク座標に固定します。各移動の始終点・円弧中心から、その時点のワークオフセットと工具長を差し引きます。後から設定を変えても過去の経路は変わりません。G54〜G59の切替では同じ模式的素材に各ワーク座標の経路を重ね、複数の実際の治具配置は表示しません。


## Phase 3 panel conventions / 操作盤の規則

- MEMORY and MDI use the same pure TypeScript block planner as the instant interpreter. A run snapshots its setup. Setup/program/mode changes are locked until RESET while running, held, at SINGLE BLOCK, or at a program stop. MDI entries preserve modal state between commands and do not overwrite the memory program.
- FEED HOLD freezes the current motion or dwell; CYCLE START resumes without replay. SINGLE BLOCK stops after a complete **source block**, including every peck/retract in a canned cycle. M01 reads the live OPTIONAL STOP setting at the stop boundary. Stops retain commanded spindle/coolant state in this simplified model.
- Feed override is 0–150%; rapid is 25/50/100%; spindle is 50–120%. Illustrative rapid speed is 6000 mm/min, JOG is 300 mm/min, and DRY RUN uses 1000 mm/min cutting feed before feed override. G84 cutting/retract feed follows spindle override, ignoring feed override/DRY RUN to preserve F/S. FEED HOLD still pauses tapping; no real servo synchronization is simulated.
- HANDLE is 0.001 mm ×1/10/100 per pulse. ZERO RETURN instantly returns the selected axis to the illustrative machine reference `(0, 0, 0)`. It is not a homing procedure. Manual movement changes physical machine position; offsets affect the work readout only.
- RESET cancels the run, motion mode and canned cycle, clears trace/alarms, and turns spindle/coolant off. Physical position, removed stock, selected work system, H, tool and other modal settings remain. Mode changes also perform this reset. Execution position and active modes are session-only; reload starts at `(0, 0, 0)` in EDIT.
- The TOOL DATA rows map T/H1–20. G43 uses the H length; physical removal/collision uses the mounted tool’s actual diameter, length and type. Remaining life is metadata; wear and life consumption are not simulated. T preselects; M06 mounts a registered tool at home after a 2-second event, and cancels H. Work offsets allow ±1,000,000 mm, tool lengths 0–10,000 mm; these are numeric input guards; actual movement is also checked against the configured machine travel.
- `segment.workShift` freezes offset + active H at motion creation. `segmentInWorkCoordinates` translates endpoints and arc centers, preserving radius/sweep. POSITION converts the current machine point with the active frame; remaining distance is signed distance to the current segment endpoint, not total path length.

- MEMORY／MDIは即時計算と共通の純粋なTypeScriptブロック計算を使用し、開始時の段取りを保存します。実行中・一時停止・SINGLE BLOCK・プログラム停止中はRESETまでプログラム・モード・段取りを変更できません。MDIの次の入力にはモーダル状態を引き継ぎ、メモリープログラムは変更しません。
- FEED HOLDは移動・ドウェルの途中で停止し、CYCLE STARTでその位置から再開します。SINGLE BLOCKは固定サイクルの全切込み・退避を含む**入力1ブロック**の完了後に停止します。M01は停止判定時のOPTIONAL STOP設定を使います。この簡易モデルの停止中は主軸・クーラント指令を保持します。
- 送り倍率0〜150%、早送り25/50/100%、主軸50〜120%です。模式的な速度は早送り6000 mm/min、JOG 300 mm/min、DRY RUNの切削送り1000 mm/minで、各倍率を適用します。G84はF/Sを保つため送り倍率・DRY RUNを使わず主軸倍率に合わせます。FEED HOLDは有効ですが、実機のサーボ同期は再現しません。
- HANDLEは1パルス0.001 mm ×1/10/100です。ZERO RETURNは指定軸を模式的な機械原点`(0, 0, 0)`へ即時に戻し、原点検出手順は再現しません。手動移動は機械位置を変え、オフセットはワーク座標の表示に反映します。
- RESETは実行・移動モード・固定サイクルを解除し、経路・アラームを消去し、主軸・クーラントをOFFにします。機械位置・除去形状・ワーク座標系・H・工具などは保持します。モード切替でも同じリセットを行います。再読込みでは機械位置`(0, 0, 0)`・EDITから開始します。
- TOOL DATAの行はT/H1〜20に対応し、G43が工具長を使用します。実径・種類・工具長は材料除去と干渉に使用します。寿命は記録のみで、摩耗・寿命消費は未実装です。Tで選択、M06で原点にて2秒の交換を行い、Hを解除します。ワークオフセット±100万mm・工具長0〜1万mmは数値入力の制限です。移動は別途、機械ストロークを検査します。
- 各移動の`workShift`にはオフセット＋有効なHを保存し、始終点・円弧中心から差し引きます。POSITIONのワーク位置は現在の座標系で換算します。残移動量は現在区間の終点までの符号付き距離で、経路全体の長さではありません。


## Phase 4 physical simulation

- **Coordinates:** Machine position is the spindle reference, with home at Z0, travel Z−460…0 and the illustrative table at Z−460. Stock is fixed at the setup's G54 origin, X0…100/Y0…60/Z−20…0 in fixture coordinates. The default G54 Z−400 places its bottom at machine Z−420, above the vise/base and table. Programmed target = work + active WCS + active H. Physical tool tip = machine reference − mounted tool's actual length. Thus an incorrect/missing H does not magically move the physical tool away from collisions.
- **Views:** XY/XZ retains per-motion WORK frames for teaching and alignment. 3D removal and safety use one fixed G54 fixture; G55–G59 do not relocate physical stock. Changing setup is locked during execution and is treated as relocating the same stock when idle. The 3D cutter is an envelope display; removal uses flat, ball, 118° drill and 90° center-drill/chamfer profiles. Tap/reamer use cylindrical envelopes, not thread geometry.
- **Heightmap:** 101 × 61 nodes at 1 mm spacing; top surface starts at Z0, bottom clamps at −20. Motions (including arcs/helices) are sampled at ≤0.5 mm along the path. Cuts only lower the surface. Live playback removes the traversed fraction; sampling is anchored to the whole segment. A single height per XY cannot represent undercuts, side cavities or threads. Grid-scale features and thin collisions are approximate; sub-grid tools get conservative remaining-stock checks.
- **Safety:** Geometry checks occur before an entire source block is committed. A rejected multi-peck block removes no material and makes no motion. Checks include exact arc quadrant travel extrema and sampled tool/vise and remaining-stock contact. Remaining stock evolves within accepted peck cycles, permitting cleared-hole rapid re-entry. Cutting contact requires a mounted registered tool, active H, spindle direction/positive S, and positive feed. Feed validation is also enforced on G01/arc/cycle commands in air. Stock-bottom, vise and travel checks apply to manual movement too.
- **Pocket width:** TOOL DATA accepts an optional minimum intended pocket width. A cutting tool whose **actual** diameter exceeds this width raises `pocketDiameter`; 0 means no pocket constraint. This is explicit setup metadata, not inferred pocket recognition (conversational pocket dimensions are additionally checked during expansion).
- **ATC:** T only selects a pocket. M06 requires the spindle already stopped, Z at the reference, no axis words and no active canned cycle. It emits a 2000 ms tool-change event, mounts the selected tool and cancels H. FEED HOLD pauses that interval; RESET before completion retains the old tool. No hidden retract or XY movement is inserted. Tool pockets are fixed logical IDs; the magazine shows mounted/preselected/exchanging states rather than a physical random-pocket mechanism.
- **Lifecycle:** RESET and mode changes retain removed stock. Replace stock restores the block; reset-to-default setup also restores offsets/tool data/pocket width, returns the simulated machine home and unloads it. Program/language remain. Browser reload starts a fresh stock/home session; it preserves setup (including older saved values) until explicitly reset. Shape preview uses an independent copy and never changes the live machine/stock.
- **API:** `simulationOptions` in `src/setup.ts` constructs the physical profile. `runProgram`, `resumeProgram`, `planBlock` and manual/timed execution share safety checks when `options.safety` is present. The low-level interpreter without that profile remains a geometry-only API for earlier-phase callers. Core machine creation now defaults to home Z0; legacy tests explicitly supply their original fixture.
- **Limits:** No holder/spindle-body collisions, real homing switches, acceleration/servo model, tool wear, material mechanics, thread/undercut representation or machine-specific certification. This does not verify real equipment safety.

## フェーズ4の物理モデル

- **座標：** 機械位置は主軸基準点です。Z0が原点、Z−460〜0がストローク、模式的テーブルはZ−460です。素材はG54を基準にX0〜100・Y0〜60・Z−20〜0に固定し、初期G54 Z−400では底面が機械Z−420になります。指令位置＝ワーク座標＋有効WCS＋H、物理的な工具先端＝機械基準点−装着工具の実際の長さです。Hが間違っていても物理的な工具長は変わりません。
- **表示と除去：** XY/XZは各移動のワーク座標、3Dと干渉はG54の固定治具座標です。G55〜G59で素材は移動しません。1 mm間隔の101×61点で、移動を0.5 mm以下の間隔で標本化します。平底・ボール・118°ドリル・90°センタドリル／面取り形状を使用し、タップ・リーマは円柱包絡で近似します。高さ1値ではアンダーカット・側面空洞・ねじ形状を表現できません。
- **警告：** 入力1ブロック全体を事前に検査し、不正なブロックでは移動・除去を行いません。円弧のストローク検査は四半円の極値も対象です。工具／バイス・未除去素材の接触は標本検査で、固定サイクル内の除去を反映して安全な再進入を許可します。切削接触には登録・装着工具、有効なH、主軸回転と正のS・Fが必要です。手動移動にも素材底面・バイス・ストロークを適用します。
- **ポケット幅：** TOOL DATAで最小幅を指定し、実径が大きい工具での切削を停止します。0は未設定です。Gコードから形状を自動認識する機能ではありません。
- **工具交換：** Tは次工具選択のみです。M06は主軸停止済み・Z原点・軸指令なし・固定サイクル解除が必要です。2秒の交換後に装着しHを解除します。FEED HOLDで交換時間を停止し、完了前のRESETでは元の工具を保持します。自動退避は挿入しません。固定の論理工具番号を表示し、実機のランダムポケット方式は再現しません。
- **保持・初期化：** RESET・モード変更では除去形状を保持します。「素材を交換」で新品に戻り、「段取りを初期値に戻す」では設定・形状を戻して仮想機械を原点へ戻し、工具を外します。プログラム・言語は保持します。再読込みで素材・位置は初期化しますが、以前の保存済み段取りは明示的にリセットするまで保持します。形状チェックは独立したコピーを使用します。
- **未再現：** ホルダー・主軸本体の干渉、原点検出、加減速・サーボ、摩耗、材料物性、ねじ・アンダーカット、機種固有の正確な形状。実機の安全性を確認するツールではありません。


## Phase 5 conversational programming

The data model in `src/nc/mazatrol/model.ts` is versioned (`version: 1`) and uses tagged unit/shape records, stable unit IDs and optional `extensions`. It is a learning model, not a file format for a real Mazak control. Programs have one COMMON, one WPC, ordered machining units and END. The separate localStorage library preserves the earlier EIA text and validates saved documents before opening them.

- **COMMON:** A5052, S45C, SUS304 or SS400; initial/clearance Z must be more than 1 mm above every unit's Top Z. Multiple workpieces are off.
- **WPC:** X/Y/Z translation relative to G54, and θ in degrees counterclockwise about +Z. It transforms unit shapes, motion endpoints and arc centres; it does not alter WORK OFFSET. Existing machine/physical-stock conventions remain unchanged.
- **Point patterns:** PT is one point; LIN includes its first point and applies signed dx/dy spacing; SQR is four rectangle corners; GRD is an nx×ny grid; CIR distributes `count` points around a circle from the specified start angle. Units can combine multiple rows. Counts must be integers, with at most 500 expanded points per unit.
- **Tool expansion:** Material and operation select practice C-SP (m/min) and FR (mm/min) values. RPM is rounded from `1000 × C-SP / (π × diameter)`, capped at 12000. TAPPING M8×1.25 suggests a 90° spot tool (default Ø10), drill Ø6.8 and tap M8; tap FR must equal rounded RPM × pitch. T/H/type/actual diameter must match TOOL DATA; T0 means no matching tool exists. Regeneration explicitly replaces rows; editing material/dimensions never silently overwrites manual tool edits. Reaming suggests a pilot drill 0.2 mm undersize; configure that tool in TOOL DATA if it is absent.
- **DRILLING:** center spot then G81 or G83, according to the tool's depth/pass. **TAPPING:** G84 with feed synchronized to the nominal pitch. **REAMING:** feed down and feed out. **RGH CBOR:** flat-end-mill concentric circular clearing in depth layers, with a flat bottom. Depth is a positive distance below Top Z.
- **FACE MILL:** raster passes across the rectangle, extending beyond its X edges to cover the whole top. **POCKET:** layered rectangular raster with a finishing perimeter; the centreline is inset by tool radius. Internal corners therefore retain that radius. Tool diameter must be smaller than both pocket dimensions. Pocket entry defaults to a zig-zag ramp of at most 3° from the previous layer floor. Plunge entry is selectable and uses 30% of the cutting feed for vertical descent; XY cutting restores full feed. No automatic rest machining or machining-force model is implied.
- **LINE OUT:** enter a closed product contour using LINE endpoints or ARC endpoints/absolute centres/CW direction. Expansion offsets the tool centre outward by half the chosen diameter. Convex loops are supported in either orientation, with mitered LINE corners and tangent ARC connections. Open, degenerate, concave, self-intersecting or non-tangent mixed contours are rejected; full circles are supported. This avoids pretending to provide a general cutter-compensation engine.
- **Shared execution:** Expansion produces decimal-safe EIA plus a generated-line → unit-ID map. MEMORY and SHAPE CHECK use that exact EIA with the existing interpreter, tool changes, heightmap and alarms. SINGLE BLOCK stops after each generated block, including setup/retract blocks; POSITION and ALARM identify the source unit. MDI remains temporary EIA input. Shape drawings show the part/pattern geometry before cutter-radius offsets or simulation.
- **Hole preparation:** A 90° spot produces `feature diameter + 0.5 mm`, at half that diameter in depth; the tool body must be at least that large. Blind TAPPING/REAMING pilot depth is `finish depth + 0.3 × finish diameter + 0.3 × drill diameter` (tip depth). For feature depth ≥ 20 mm (stock thickness), no allowance is added. Tool rows expose an optional total-depth override; regeneration restores calculated depths. Each canned cycle is declared once with its first XY, followed by XY-only repeats and G80.
- **Pilot-depth alarm:** With safety enabled, both EIA and Mazatrol require a previously drilled, smaller-diameter hole at the same physical XY. Blind tap/reamer bottoms must be strictly above the recorded drill-tip bottom; both may reach the stock bottom for through holes. Spotting is not a pilot. Only traversed drilling depth is recorded; history follows the stock across hold/RESET/MDI, is rolled back for rejected blocks, and clears when replacing stock. Existing below-stock/vise/travel alarms still apply, including when a blind-hole allowance would exceed the stock.
- **Validation and bounds:** malformed units, nonfinite values, missing/incompatible tools, bad tapping feed, insufficient clearance and oversized tools prevent execution. Maximum 100 units, 100 pattern rows, 200 contour edges, 10 tool rows, 100 depth passes and 9000 generated lines. Invalid expansion returns no executable source. Geometrically valid but physically unsafe programs still stop through the ordinary simulation alarms.
- **Sample:** face the 100×60 stock to Z−1, tap M8×1.25 at (15,15), (85,15), (85,45), (15,45) to Z−11, then clear a 40×20 pocket at (30,20) to Z−5. The pilot tip reaches Z−15.44 (14.44 mm below the faced top); the 90° spot reaches Z−5.25 to make an Ø8.5 chamfer. Uses the default face mill T4, Ø10 spot drill T6, drill T2, tap T3 and end mill T1. Reset setup/replace stock before repeating the complete example.

## フェーズ5の対話プログラミング

`version: 1`のタグ付きユニット・形状データを使用し、安定したIDと拡張用`extensions`を保持します。実機のMazatrolファイル形式ではありません。COMMON、WPC、順番付き加工ユニット、ENDで構成し、元のEIAプログラムを残したまま別のプログラム一覧に保存します。

- COMMONで材質と退避Zを指定します。退避Zは各上面Zより1 mm超高くしてください。多数個取りは切です。WPCはG54からのXYZ移動と+Z軸まわり反時計回りθ（度）で、WORK OFFSETは変更しません。
- PT＝1点、LIN＝始点を含む等間隔列、SQR＝長方形4隅、GRD＝X/Y個数の格子、CIR＝開始角から円周に等配した点です。複数行を組み合わせ、1ユニット最大500点です。
- 自動工具展開は材質・加工から練習用C-SP（m/min）・FR（mm/min）を提案します。回転数は1000×C-SP÷(π×径)を丸め、12000で制限します。M8×1.25は90°スポット工具（初期径10）、ドリル6.8、タップ8を提案し、タップFR＝回転数×ピッチが必要です。工具番号・種類・実径をTOOL DATAと一致させます。T0は工具未一致です。再展開は明示操作で行い、材質変更だけでは手動編集を上書きしません。リーマの下穴は0.2 mm小さい径を提案し、未登録なら工具データを設定してください。
- DRILLINGはG81/G83、TAPPINGはG84、REAMINGは送りで進入・退避、RGH CBORは平底エンドミルで同心円を段階加工します。深さは上面から下向きの正の値です。
- FACE MILLは長方形を往復走査し、POCKETは工具半径を内側に取った段階走査と周囲仕上げです。隅には工具半径が残ります。LINE OUTは閉じた凸輪郭を外側へ工具半径分補正します。直線角は交点、円弧接続は接線のみです。開いた輪郭・凹形状・交差・不正半径・非接線接続は拒否します。全円にも対応します。
- 生成EIAを既存のインタープリター・3D・アラームへ渡し、生成行と元ユニットを対応付けます。SINGLE BLOCKは準備・退避を含む生成ブロックごとに停止し、POSITION/ALARMに元ユニットを表示します。MDIはEIA入力のままです。形状表示は補正・実行前の製品輪郭です。
- 90°スポット径は穴径＋0.5 mm、深さはその半径です。工具本体の径もそれ以上必要です。止まりタップ・リーマの下穴深さは仕上げ深さ＋0.3×仕上げ径＋0.3×ドリル径（先端まで）で、深さ20 mm以上の貫通穴には追加しません。工具の総深さは編集・再展開できます。固定サイクルは最初のXYで一度だけ指令し、続く穴はXYのみ、最後にG80です。
- 下穴履歴は実際に通った深さ・固定素材座標で保持し、EIA・Mazatrol共通でタップ／リーマ底が同位置の下穴底以上の深さならアラームになります。ともに素材底へ達する貫通穴は例外です。スポットは下穴とみなしません。履歴はRESETでも残り、素材交換で消去します。
- ポケットは最大3°の往復ランプ進入が初期値です。突込み選択時はZ送り30%、XY切削は元の送りに戻します。既存の素材底面・バイス・ストローク制限も適用します。
- サンプルは上面Z−1、4か所のM8タップ穴底Z−11、(30,20)から40×20のポケット底Z−5です。下穴先端はZ−15.44、90°スポット先端はZ−5.25（スポット径8.5）です。初期工具T4/T6（径10）/T2/T3/T1を使用します。再実行前に段取り初期化・素材交換を行ってください。
- 実機バージョンの完全互換、一般的な凹輪郭補正、加工負荷・削り残し最適化は未対応です。レッスンとJSON入出力は今後の範囲です。
