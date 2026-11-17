# Phase 2 interpreter reference / インタープリター仕様

### Phase 2 scope and conventions

- Supported: G00/G01, G02/G03 (XY plane, incremental I/J or signed R, including helical Z), G17/G21/G40/G94, G43 H/G49, G54–G59, G28/G80/G81/G82/G83/G84, G90/G91, G98/G99; F/S/T/H/D/P/N/O; M00/M01/M03/M04/M05/M06/M08/M09/M02/M30. Parenthesized comments, semicolon comments and `%` delimiter lines are accepted.
- Modal motion/feed settings persist between blocks. Unknown codes, unsupported words and invalid geometry produce an alarm with the **physical source line**. A syntax error prevents the whole program from running; an execution alarm stops at that block and retains only earlier completed blocks. Each Run starts from fresh machine state.
- The page starts at machine `(0, 0, 80)` and uses the same illustrative G28 reference position, with all G54–G59 offsets zero and **H1 = 0 mm**. Nonzero work offsets and tool lengths are supported through the pure TypeScript API (`runProgram(source, options)` in `src/nc/`). Other H registers must be configured explicitly.
- Segments describe the **machine reference point**: absolute machine target = programmed work coordinate + work offset + active tool length (Z only). Changing G54–G59 or G43/G49 without an axis command does not move the machine. Omitted axes keep their machine positions. G91 moves by the specified displacement; I/J always remain relative to the arc start. Positive R selects the minor arc; negative R selects the major arc. Full circles require I/J.
- G81/G83 retain R/Z and G83 Q across holes; axis words or an explicit cycle call trigger another hole. G98 returns to the initial plane (or R if higher); G99 returns to R. In G91, R is measured from the cycle's initial plane and Z from R. G83 fully retracts to R between pecks, then rapidly returns 0.5 mm above the preceding bottom. Cancel with G80 (or G00–G03) before changing the coordinate system, distance mode or length compensation.
- The parser limits input to 200,000 characters / 10,000 lines; execution allows at most 20,000 segments. The UI shows 100 segments per page. Numeric magnitudes are limited to 1,000,000.
- **Not implemented:** 3D views, material removal, machine panel, collision/travel/safety alarms, Mazatrol unit editing, lessons, JSON import/export, and codes outside the list above (including G41/G42 and G18/G19).

### フェーズ2の範囲と計算規則

- 対応：G00/G01、G02/G03（XY平面、増分I/Jまたは符号付きR、Z方向のヘリカル移動も可）、G17/G21/G40/G94、G43 H/G49、G54〜G59、G28/G80/G81/G82/G83/G84、G90/G91、G98/G99、F/S/T/H/D/P/N/O、M00/M01/M03/M04/M05/M06/M08/M09/M02/M30。括弧コメント、セミコロンコメント、`%`行に対応します。
- 移動モードや送り速度は次のブロックにも引き継がれます。未対応のコード・ワードや不正な形状は、**入力テキストの行番号**付きのアラームになります。構文エラー時は全体を実行せず、実行時エラーではそのブロックで停止して、前の正常な結果のみを残します。実行のたびに機械状態を初期化します。
- 画面の初期機械位置と模式的なG28復帰位置は`(0, 0, 80)`、G54〜G59のオフセットはすべて0、**H1 = 0 mm**です。ゼロ以外のオフセットや工具長は、`src/nc/`の純粋なTypeScript API（`runProgram(source, options)`）で設定できます。他のH番号は明示的な設定が必要です。
- 表示座標は**機械基準点**です。絶対値の移動先は「指令ワーク座標 + ワーク座標オフセット + 工具長補正（Zのみ）」で計算します。軸指令なしの座標系・補正変更では移動せず、省略した軸の機械位置も変えません。G91は移動量指定です。I/Jは常に円弧始点からの増分、正のRは短い円弧、負のRは長い円弧です。全円にはI/Jが必要です。
- G81/G83はR/Z、G83はQも保持し、軸指令または明示的なサイクル呼出しで次の穴を加工します。G98は開始時の高さ（R点が高ければR点）、G99はR点へ戻ります。G91ではRは開始時の高さから、ZはR点からの増分です。G83は各切込み後にR点まで戻り、前回の穴底の0.5 mm上まで早送りで再進入します。座標系・指令方式・工具長補正を変更する前にG80（またはG00〜G03）で解除してください。
- 入力は20万文字・1万行、移動区間は2万件が上限です。画面は100件ずつ表示し、数値の絶対値は100万以下に制限します。
- **未実装：** 3D表示、材料除去、操作盤、干渉・ストロークリミットなどの安全確認、Mazatrolユニット編集、レッスン、JSON入出力、上記以外のコード（G41/G42、G18/G19など）。


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

## Phase 2 execution details

- **G28** is non-modal. First, rapid to the programmed intermediate point using G90/G91 and active work/length offsets; then rapid the named axes to `referencePosition` in machine coordinates. Omitted axes stay put. With no axis words, all axes return directly. `G91 G28 Z0.` therefore returns only Z without an intermediate displacement. The API reference and initial position default to `(0, 0, 0)`; the page supplies `(0, 0, 80)` for both. A conflicting explicit motion command or active drilling cycle must be cancelled first; `G80 G28` is accepted. Modal motion and length compensation remain selected after G28.
- **G82** follows G81 motion with a bottom dwell. `P` is a non-negative integer **milliseconds** value: `P500` means 0.5 seconds. P is required on first entry and retained for repeated holes in that cycle. `P0` is valid. Events record the dwell without adding false motion or waiting in real time. A new cycle type or G80 cancellation clears the inherited dwell.
- **G84** is a simplified right-hand tapping cycle. It requires M03, positive S and positive F. Feed down clockwise, optionally dwell P at depth, reverse the spindle, **feed back to R**, restore clockwise rotation, then rapid to the G98 initial plane if higher. G99 ends at R. In G94, pitch is `F / S`; the M8 × 1.25 sample uses S400/F500. No pitch verification, rigid-tapping servo model or thread/material removal is implemented. The example assumes pre-drilled holes.
- **M00/M01** act after all motion in their block. M00 always pauses calculation; M01 pauses only with `optionalStop: true`. `resumeProgram(result)` continues the saved program/options from the next block, retaining modal values. It does not rerun earlier blocks or mutate the previous result. These are execution pauses, not a simulated machine control panel: commanded spindle/coolant state is retained. Skipped M01s are recorded as events. M02/M30 end execution permanently. Editing input/settings invalidates the page's Continue action until Run is pressed again.
- **D** is a non-negative integer cutter-offset register stored in modal state and segment metadata. D0 clears the selection. G41/G42 cutter compensation is still unsupported; D does not shift the path. **P** is only accepted for G82/G84; standalone dwell G04 is not implemented.
- **Decimal-less input:** the parser preserves numeric spelling. X/Y/Z/I/J/R/Q without a `.` receive line-numbered warnings in either mode, including zero and signed values. In normal mode `X10` means 10 mm; `strictDecimals: true` converts it to 0.010 mm. `X10.`, `X10.0` and `X.5` always use millimetres. F, S, P, D, H, T, N, O and G/M numbers are never scaled. Configured offsets and reference positions are always in mm. This models a common 0.001 mm input increment; actual controls depend on model and settings.
- **Events and geometry:** `events` records dwell, tapping spindle reversal and program stops with their source line, position and `afterSegment` count. The static canvas views render completed segments only, including sampled arcs/helices. Rapids are dashed; feeds are solid. Both projections preserve equal axis scales but fit independently. The marker is the current calculated endpoint (including at a pause), not animated machine motion.
- **Workholding:** the fixed A5052 stock is X0–100, Y0–60, Z−20–0 mm. Vise jaws touch the Y0/Y60 faces; the base lies below Z−30. They are illustrative outlines, not collision geometry. Canvas coordinates match the page's zero offsets/H1; a future configurable setup must also transform the stock/vise accordingly.

## フェーズ2の実行規則

- **G28：** 非モーダルです。G90/G91と有効なワーク座標・工具長補正で中間点へ早送りし、その後、指定軸だけを機械座標の`referencePosition`へ戻します。軸指定なしでは全軸が直接復帰します。`G91 G28 Z0.`は中間移動なしでZだけ復帰します。APIの初期・復帰位置の既定値は`(0, 0, 0)`、画面は模式的な`(0, 0, 80)`です。移動指令の重複や有効な固定サイクルは事前に解除してください（`G80 G28`は可）。移動モードと工具長補正の選択は保持します。
- **G82／P：** G81の動きに穴底ドウェルを加えます。Pは0以上の整数の**ミリ秒**です（P500 = 0.5秒）。初回に指定し、同じサイクルの次の穴にも保持します。別のサイクルやG80で保持は解除します。P0も有効です。ドウェルは動作記録に表示し、実時間の待機や偽の移動区間は追加しません。
- **G84：** 簡略化した右ねじのタップサイクルです。M03、正のS・Fが必要です。正転で切削送りし、必要なら穴底でPのドウェル後、逆転して**R点まで切削送りで戻り**、正転を復帰します。G98ではその後に初期高さへ早送りし、G99はR点で終了します。G94でのピッチはF/Sで、M8 × 1.25の例はS400/F500です。ピッチ検証・剛性タップのサーボ同期・ねじ形状の生成は未実装で、下穴加工済みを想定します。
- **M00／M01：** 同じブロックの動きが完了してから計算を停止します。M00は必ず停止し、M01は`optionalStop: true`のときだけ停止します。`resumeProgram(result)`または画面の「続行」で、保存済みのプログラム・設定・モーダル状態を使用して次のブロックから再開します。前の結果は変更せず、完了済みの動きも再実行しません。計算の一時停止として扱い、実機操作盤は再現しません。指令上の主軸・クーラント状態は保持します。M02/M30は終了で、再開できません。入力・設定変更後は再実行が必要です。
- **D：** 0以上の整数の工具径補正番号として状態と移動区間に保存し、D0で選択を解除します。G41/G42は未対応で、Dを指定しても経路は変えません。PはG82/G84でのみ使用でき、G04は未対応です。
- **小数点のない入力：** X/Y/Z/I/J/R/Qに小数点がない場合、符号付きや0も含めて行番号付きの警告を出します。通常モードのX10は10 mm、`strictDecimals: true`では0.010 mmです。X10.・X10.0・X.5は常にmmです。F・S・P・D・H・T・N・O・G/M番号は換算しません。設定したオフセット・復帰位置も常にmmです。実機の解釈は機種と設定によって異なります。
- **動作記録と表示：** `events`にはドウェル・主軸逆転・プログラム停止と、行・位置・直前までの移動区間数を記録します。XY/XZ図は完了した移動のみを表示し、円弧・ヘリカル移動も補間して描きます。早送りは破線、切削送りは実線、マーカーは停止中を含む現在の計算終点です。各図は縦横を同じ縮尺にし、独立して全体を収めます。実時間の動作再生ではありません。
- **素材・保持具：** 固定のA5052素材はX0〜100、Y0〜60、Z−20〜0 mmです。バイス口金はY0/Y60の面に接し、ベースはZ−30より下にあります。干渉判定用ではなく模式的な輪郭です。画面のゼロオフセット・H1に対応しており、今後段取りを変更可能にする場合は素材・バイスにも同じ座標変換が必要です。
