# Phase 1 interpreter reference / インタープリター仕様

### Phase 1 scope and conventions

- Supported: G00/G01, G02/G03 (XY plane, incremental I/J or signed R, including helical Z), G17/G21/G40/G94, G43 H/G49, G54–G59, G80/G81/G83, G90/G91, G98/G99; F/S/T/H/N/O; M03/M04/M05/M06/M08/M09/M02/M30. Parenthesized comments, semicolon comments and `%` delimiter lines are accepted.
- Modal motion/feed settings persist between blocks. Unknown codes, unsupported words and invalid geometry produce an alarm with the **physical source line**. A syntax error prevents the whole program from running; an execution alarm stops at that block and retains only earlier completed blocks. Each Run starts from fresh machine state.
- The page starts at machine `(0, 0, 0)`, with all G54–G59 offsets zero and **H1 = 0 mm**. Nonzero work offsets and tool lengths are supported through the pure TypeScript API (`runProgram(source, options)` in `src/nc/`). Other H registers must be configured explicitly.
- Segments describe the **machine reference point**: absolute machine target = programmed work coordinate + work offset + active tool length (Z only). Changing G54–G59 or G43/G49 without an axis command does not move the machine. Omitted axes keep their machine positions. G91 moves by the specified displacement; I/J always remain relative to the arc start. Positive R selects the minor arc; negative R selects the major arc. Full circles require I/J.
- G81/G83 retain R/Z and G83 Q across holes; axis words or an explicit cycle call trigger another hole. G98 returns to the initial plane (or R if higher); G99 returns to R. In G91, R is measured from the cycle's initial plane and Z from R. G83 fully retracts to R between pecks, then rapidly returns 0.5 mm above the preceding bottom. Cancel with G80 (or G00–G03) before changing the coordinate system, distance mode or length compensation.
- The parser limits input to 200,000 characters / 10,000 lines; execution allows at most 20,000 segments. The UI shows 100 segments per page. Numeric magnitudes are limited to 1,000,000.
- **Not implemented:** 2D/3D views, material removal, machine panel, collision/travel/safety alarms, Mazatrol unit editing, lessons, JSON import/export, and codes outside the list above (including G28, G41/G42, G82/G84 and M00/M01).

### フェーズ1の範囲と計算規則

- 対応：G00/G01、G02/G03（XY平面、増分I/Jまたは符号付きR、Z方向のヘリカル移動も可）、G17/G21/G40/G94、G43 H/G49、G54〜G59、G80/G81/G83、G90/G91、G98/G99、F/S/T/H/N/O、M03/M04/M05/M06/M08/M09/M02/M30。括弧コメント、セミコロンコメント、`%`行に対応します。
- 移動モードや送り速度は次のブロックにも引き継がれます。未対応のコード・ワードや不正な形状は、**入力テキストの行番号**付きのアラームになります。構文エラー時は全体を実行せず、実行時エラーではそのブロックで停止して、前の正常な結果のみを残します。実行のたびに機械状態を初期化します。
- 画面の初期機械位置は`(0, 0, 0)`、G54〜G59のオフセットはすべて0、**H1 = 0 mm**です。ゼロ以外のオフセットや工具長は、`src/nc/`の純粋なTypeScript API（`runProgram(source, options)`）で設定できます。他のH番号は明示的な設定が必要です。
- 表示座標は**機械基準点**です。絶対値の移動先は「指令ワーク座標 + ワーク座標オフセット + 工具長補正（Zのみ）」で計算します。軸指令なしの座標系・補正変更では移動せず、省略した軸の機械位置も変えません。G91は移動量指定です。I/Jは常に円弧始点からの増分、正のRは短い円弧、負のRは長い円弧です。全円にはI/Jが必要です。
- G81/G83はR/Z、G83はQも保持し、軸指令または明示的なサイクル呼出しで次の穴を加工します。G98は開始時の高さ（R点が高ければR点）、G99はR点へ戻ります。G91ではRは開始時の高さから、ZはR点からの増分です。G83は各切込み後にR点まで戻り、前回の穴底の0.5 mm上まで早送りで再進入します。座標系・指令方式・工具長補正を変更する前にG80（またはG00〜G03）で解除してください。
- 入力は20万文字・1万行、移動区間は2万件が上限です。画面は100件ずつ表示し、数値の絶対値は100万以下に制限します。
- **未実装：** 2D/3D表示、材料除去、操作盤、干渉・ストロークリミットなどの安全確認、Mazatrolユニット編集、レッスン、JSON入出力、上記以外のコード（G28、G41/G42、G82/G84、M00/M01など）。


## Configuring offsets / オフセットの設定

```ts
import { runProgram, workPosition } from './src/nc';

const options = {
  workOffsets: { 54: { x: 100, y: 200, z: 30 } },
  toolLengths: { 1: 50 },
};
const result = runProgram('G54 G43 H1 G00 X10 Y20 Z5', options);
// Machine reference point / 機械基準点: { x: 110, y: 220, z: 85 }
console.log(result.state.position);
// Programmed tool-tip position / 指令工具先端位置: { x: 10, y: 20, z: 5 }
console.log(workPosition(result.state, options));
```
