# NC Practice Simulator

## English

A browser-based CNC practice app inspired by Mazak/Mazatrol, built with Vite, React, strict TypeScript, Zustand and Vitest. **Phase 6B** adds seven bilingual lessons, Mazatrol and G-code tracks, dimensioned goals, automatic stock/feature checks, error highlights and saved progress. The eight-chapter **How to use** guide remains available from contextual **?** buttons. The simulator includes a program library and Mazatrol-style unit forms, automatic editable tool sequences, unit shape previews, and equivalent G-code. Both formats share the control panel, 3D stock removal, magazine and safety checks. XY/XZ paths and stock/vise outlines use **WORK coordinates**; POSITION shows machine coordinates separately. Japanese (default) / English, glossary tooltips and three sample G-code programs are included. EIA/ISO and Mazatrol programs, language, input settings, G54–G59, tool records and the optional pocket-width limit persist in this browser; no backend. Stock removal and machine position are session-only.

**Screenshot:** _Placeholder — add Lessons, progress and highlighted stock here._

Requires **Node.js 22.12+** (24 LTS recommended) and npm:

```sh
npm install
npm run dev             # Open the URL printed by Vite
npm test                # Unit and UI tests
npm run test:coverage   # Core coverage with enforced thresholds
npm run build           # Strict type check + production build
npm run preview         # Serve the production build
```

- Open **Lessons** in the header. Choose a part and track, read the dimension table and hint, then edit the deliberately unfinished starter. **Run and check** starts with fresh default stock/tools without changing free practice. Try lesson 1: select **3 · FACE MILL**, change depth from 0.5 to **1**, regenerate tools, and check for **Pass**. Repeat on the EIA track with facing passes at Z−1.
- Checks compare an independent target heightmap at **±0.1 mm Z**, hole positions/diameters/depths, completed pilot depth before tapping, tap pitch and alarms. Select a reported issue to highlight it on the goal drawing and 3D stock. The XY grid is **1 mm**; threads are validated from motion, not thread geometry. The contour goal is a 6 mm wide outside groove, not removal of all surrounding stock. Lesson 7 combines all earlier operations.
- **Progress** keeps attempts, best and last results separately for all 14 lesson/track combinations. Drafts and progress persist in localStorage. **Export/Import progress JSON** backs up results only; importing merges best/latest results and takes the larger attempt count, so repeated imports are idempotent. Storage-blocked browsers retain only session data. Lesson checks run instantly; single-block practice remains in the simulator.
- Open **How to use** in the header, or **?** on a screen to open its matching chapter. The guide follows the language switch. Opening it holds a running cycle and stops jog input; returning requires CYCLE START to resume.
- In **EDIT → PROGRAM**, open **Program list / Create program**. Enter a name and choose **Mazatrol** or **EIA/ISO (G-code)**, then Create program. The original EIA program remains available in the list.
- For the conversational example, first use **Reset to default setup**, then **Load Mazatrol sample**. It faces 1 mm, drills/taps four M8 holes, and mills a 40×20 pocket to stock Z−5. Click a unit to edit its forms, shape rows or tool sequence. **Generate tool sequence** replaces that unit's rows with practice starting values; subsequent edits are retained. TOOL DATA must match the selected tools.
- Hole rows show editable total depths. Blind tapping/reaming pilots include bottom clearance and drill-point allowance; the shared alarm rejects a finishing depth at or below its pilot bottom. The default Ø10, 90° spot tool makes a chamfer 0.5 mm wider than the hole. Reload the sample after resetting older saved setups. Pocket entry defaults to a ≤3° zig-zag ramp; **Plunge** uses 30% feed.
- Open **View as G-code** to compare the equivalent program. **SHAPE CHECK** draws the unit shapes immediately; **Run** calculates the same stock removal and alarms as MEMORY. WPC XYZ is the work origin in machine coordinates, independent of G54; θ rotates about Z. New/sample WPC defaults to (−500, −250, −400, θ0), and stock/vise follow this frame. Old saved relative WPC values are migrated once by adding the current G54. View as G-code documents the equivalent G54 setup with a commented G10 line. SINGLE BLOCK stops on each generated block, with its unit shown on POSITION.
- For EIA/ISO, load a sample or enter G-code. Select **MEMORY → CYCLE START** to run. Try **FEED HOLD**, resume with CYCLE START, or enable **SINGLE BLOCK**. M00 always stops; M01 stops with OPTIONAL STOP enabled. RESET clears the run without moving the machine or restoring removed material.
- **POSITION** shows work/machine/remaining coordinates and live paths. **SHAPE CHECK → Run** calculates an instant preview without moving the machine; RESET clears an executed trace to enable a new preview.
- **WORK OFFSET** edits G54–G59; **TOOL DATA** edits 20 rows (type, diameters, length, life). Valid values save on blur/Enter. H1–H20 use those lengths. Setup is locked during an active/held cycle.
- **MDI** executes temporary commands from the current position/modal state. `T` preselects a tool; `M06` exchanges it in two simulated seconds at machine Z0 with the spindle stopped. Apply `G43 H` before approaching stock. **JOG/RAPID** move while an axis key is held; **HANDLE** moves 0.001 mm ×1/10/100 per click. Arrow keys move X/Y and Page Up/Down move Z when focus is outside inputs/buttons. TAPE is disabled.
- Decimal-less distance words show a yellow warning: `X10` means 10 mm normally, or 0.010 mm with **Strict decimal input**; `X10.` always means 10 mm. Real controls depend on their settings.

**Editing the guide:** Edit `src/guide/en.md` and `src/guide/ja.md`. Keep the eight numbered H2 headings (`## 1.` through `## 8.`) in order. Use standard Markdown with `[label](term:workOffset)` for a glossary tooltip and `[label](#basics)` for a chapter link. Term links resolve inside the app; repository copies retain readable link labels. Run `npm run guide:export` to copy the exact content to `docs/guide-en.md` and `docs/guide-ja.md`. Tests check chapter/term/alarm coverage, navigation and export parity.

**Realistic defaults:** Machine home is `(0, 0, 0)`, with travel X −1020…0, Y −510…0, Z −460…0 mm and the table at Z−460. G54–G59 default to `(−500, −250, −400)` at a stock top-face corner; stock extends +X/+Y and down 20 mm. Tool lengths are 100–180 mm by type. **Reset to default setup** restores these values, returns the simulated machine home, unloads its tool and replaces the stock; program/language stay intact. Existing saved setup is retained until reset.

**Coordinate check:** Starting from defaults, run:

```gcode
T1 M06
G54 G00 G43 H1 X10. Y15. Z5.
```

With H1 = 120 mm, POSITION shows work `(10, 15, 5)` and machine `(−490, −235, −275)`. Try **SHAPE CHECK → Run** with the contour sample to see the cut in 3D; drag to orbit and scroll to zoom. **Replace stock** restores a fresh block without resetting setup. See [control and interpreter conventions](docs/nc-semantics.md).

**Safety checks:** spindle stopped while cutting, missing feed, rapid into remaining material, vise collision, below-stock cutting, missing length compensation, travel limits, missing tool, and tool diameter exceeding an explicitly configured pocket width. Set that width in TOOL DATA (0 = unset); G-code does not identify pocket boundaries. Unsafe source blocks are rejected before motion/removal. Checks also apply to manual movement; M06 has a home/spindle interlock.

**Not yet implemented:** program/setup JSON import/export, G41/G42, wear/life consumption, alternate machines or exact Matrix/Smooth compatibility. LINE OUT currently accepts closed convex contours with tangent arc joins. Pockets are rectangular with tool-radius internal corners; automatic cutting data are editable practice suggestions, not machining recommendations. The 1 mm heightmap cannot represent undercuts or threads; collisions use sampled cutter envelopes, not holders, real servo physics, or certified machine geometry. WebGL is required for 3D; the core simulation and 2D views still work without it.

**Practice only:** Practice simulator — always follow company training on real machines. This simplified learning app is not an official Mazak/Mazatrol product or a real CAM/CNC tool. Do not use its programs or results to operate real equipment. No machine connection or export is intended.

## 日本語

Mazak／Mazatrolを参考にしたブラウザー練習用CNCシミュレーターです。Vite・React・厳格なTypeScript・Zustand・Vitestを使用しています。**フェーズ6B**では7つの日本語／英語レッスン、Mazatrol・Gコードの両形式、寸法付き目標図、素材・加工条件の自動採点、指摘箇所表示、進捗保存を追加しました。8章の「使い方ガイド」も画面別の「?」から利用できます。プログラム一覧、Mazatrol風ユニット入力、自動工具展開、形状プレビュー、比較用Gコード表示も利用できます。両形式は操作盤・3D材料除去・マガジン・安全アラームを共用します。XY/XZ経路と素材・バイスは**ワーク座標**で表示し、POSITIONには機械座標も別に表示します。日本語（初期設定）／英語、用語解説、3つのGコード例を利用できます。プログラム・言語・入力設定・G54〜G59・工具データ・ポケット幅はブラウザー内に保存され、バックエンドは不要です。除去形状・機械位置は再読込み時に初期化します。

**スクリーンショット：** _準備中 — レッスン・進捗・指摘箇所付き素材をここへ追加します。_

**Node.js 22.12以降**（24 LTS推奨）とnpmが必要です。

```sh
npm install
npm run dev             # Viteが表示するURLを開く
npm test                # ユニットテスト・UIテスト
npm run test:coverage   # コアのカバレッジ測定・下限検証
npm run build           # 型チェック・本番用ビルド
npm run preview         # 本番用ビルドの確認
```

- ヘッダーの**レッスン**で課題と形式を選び、寸法表・ヒントを読んで未完成の開始プログラムを編集します。**実行・採点**は毎回標準工具・新品素材から開始し、自由練習の内容を保持します。課題1では**3 · FACE MILL**の深さ0.5を**1**に変更し、工具を再展開して**合格**を確認。EIAでも面削りのパスをZ−1にして挑戦します。
- 独立した目標高さマップと**Z±0.1 mm**で比較し、穴位置・径・深さ、タップ前の下穴深さ、ねじピッチ、アラームも確認します。指摘を選ぶと目標図・3D素材に位置を表示します。XY格子は**1 mm**で、ねじ山形状ではなく指令動作を検証します。外周の目標は幅6 mmの周囲溝で、外側全面の除去ではありません。課題7はそれまでの加工を組み合わせます。
- **学習進捗**は全14組の課題・形式ごとに挑戦回数・最高成績・前回結果を保持します。編集中プログラムと進捗はlocalStorageに保存。**進捗JSON入出力**は成績のみをバックアップし、最高成績・最新結果と大きい方の回数を統合します。再読込でも重複加算しません。保存不可のブラウザーはセッション中のみ保持。レッスン採点は即時計算で、SINGLE BLOCKの練習はシミュレーターで行います。
- ヘッダーの**使い方ガイド**、または各画面の**?**から対応章を開きます。言語切替に追従し、開くと運転は一時停止・ジョグ入力は停止します。戻った後の再開はCYCLE STARTで行います。
- **EDIT → PROGRAM**で**プログラム一覧・新規作成**を開き、名前と**Mazatrol／EIA/ISO (G-code)**を選んで作成します。元のEIAプログラムも一覧に残ります。
- 対話式の例は**段取りを初期値に戻す**→**Mazatrolサンプルを読み込む**で開始します。上面を1 mm削り、M8タップ4穴、40×20のポケットを素材Z−5まで加工します。ユニットを選ぶと項目・形状行・工具行を編集できます。**工具を自動展開**は選択ユニットの行を練習用初期値で置換し、その後は手動編集できます。TOOL DATAと工具を一致させてください。
- 工具行で総深さを編集できます。止まりタップ・リーマの下穴には底部余裕とドリル先端長を追加し、下穴底以上の仕上げ深さは共通アラームで停止します。標準の径10・90°スポット工具で穴径＋0.5 mmの面取りを作ります。古い段取りは初期化後にサンプルを再読込みしてください。ポケットは最大3°の往復ランプ進入が初期値で、突込み選択時は送り30%です。
- **Gコードで表示**で等価な指令を比較できます。**SHAPE CHECK**は実行前の形状を表示し、**実行**でMEMORYと共通の除去・警告を計算します。WPCのXYZはワーク原点の機械座標でG54と独立し、θはZ軸まわりの回転です。新規・サンプルの初期値は（−500、−250、−400、θ0）で、素材・バイスも追従します。旧データは現在のG54を加えて一度だけ移行します。Gコード表示には等価G54の設定をG10コメントで示します。SINGLE BLOCKは生成ブロックごとに停止し、POSITIONに元のユニットを表示します。
- EIA/ISOではサンプルを読み込むかGコードを入力し、**MEMORY → CYCLE START**で実行します。**FEED HOLD**で一時停止、CYCLE STARTで再開し、**SINGLE BLOCK**では1ブロックずつ進めます。M00は必ず停止し、M01はOPTIONAL STOP有効時に停止します。RESETは機械を動かさず実行を解除し、除去形状は保持します。
- **POSITION**はワーク座標・機械座標・残移動量と動作経路を表示します。**SHAPE CHECK → 実行**は機械を動かさない即時計算です。実行済み経路はRESETで消去してから新しく確認できます。
- **WORK OFFSET**でG54〜G59、**TOOL DATA**で20本の工具種類・公称径・実径・長さ・寿命を編集します。有効値はフォーカス移動／Enterで保存し、H1〜H20が各行の工具長を使用します。実行・一時停止中は段取りを変更できません。
- **MDI**は現在の位置・モーダル状態から一時的な指令を実行します。Tで工具を選び、主軸停止・機械Z0でM06により2秒の交換を行います。素材へ接近する前にG43 Hを指定します。**JOG/RAPID**は軸キーを押している間移動し、**HANDLE**はクリックごとに0.001 mm ×1/10/100移動します。入力欄・ボタン以外にフォーカスがあるとき、矢印キーでX/Y、Page Up/DownでZを操作できます。TAPEは無効です。
- 小数点のない寸法指令には黄色の警告を表示します。通常の`X10`は10 mm、**厳密な小数点入力**では0.010 mmです。`X10.`は常に10 mmです。実機の解釈は設定によって異なります。

**初期段取り：** 機械原点は`(0, 0, 0)`、ストロークはX −1020〜0、Y −510〜0、Z −460〜0 mm、テーブルはZ−460です。G54〜G59は素材上面の隅`(−500, −250, −400)`で、素材は+X/+Y方向に広がり、下へ20 mmの厚さです。工具長は種類により100〜180 mmです。**段取りを初期値に戻す**で設定を戻し、仮想機械を原点に戻して工具を外し、素材を交換します。プログラム・言語は保持します。以前の保存済み設定は、このボタンを押すまで保持されます。

**座標の確認：** 初期段取りから次を実行します。

```gcode
T1 M06
G54 G00 G43 H1 X10. Y15. Z5.
```

H1 = 120 mmなので、ワーク座標は`(10, 15, 5)`、機械座標は`(−490, −235, −275)`になります。輪郭サンプルを**SHAPE CHECK → 実行**で確認すると3Dの除去形状が表示されます。ドラッグで回転、スクロールで拡大縮小できます。**素材を交換**は段取りを保持して新しい素材に戻します。[操作・計算規則](docs/nc-semantics.md)も参照してください。

**安全アラーム：** 切削中の主軸停止、送り未指定、未除去素材への早送り、バイス干渉、素材底面より下への切削、工具長補正なし、ストロークリミット、工具未登録、指定ポケット幅より大きい工具径を検査します。ポケット幅はTOOL DATAで指定します（0＝未設定）。Gコード経路だけでは形状境界は分かりません。危険な入力ブロックは移動・除去前に停止します。手動移動にも適用し、M06には原点・主軸のインターロックがあります。

**未実装：** プログラム・段取りのJSON入出力、G41/G42、摩耗・寿命消費、別機種、Matrix/Smoothとの完全互換。LINE OUTは閉じた凸輪郭・接線の円弧接続に限定し、ポケットは工具半径の隅Rを持つ長方形です。自動切削条件は編集可能な練習用初期値で、実加工の推奨値ではありません。1 mmの高さマップではアンダーカット・ねじ形状は表現できません。干渉は工具包絡形状の標本検査で、ホルダー・サーボの物理計算・実機の正確な形状は未再現です。3DにはWebGLが必要ですが、利用できない場合も計算・2D表示は動作します。

**練習専用：** 練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと。Mazak／Mazatrolの公式製品でも実加工用のCAM・CNCツールでもありません。本アプリのプログラムや結果を実機の運転に使用しないでください。実機への接続・出力は対象外です。

**ガイドの編集：** `src/guide/ja.md`と`src/guide/en.md`を編集します。番号付きH2見出し`## 1.`〜`## 8.`の順番を維持してください。標準Markdownに加え、用語は`[表示名](term:workOffset)`、章リンクは`[表示名](#basics)`です。用語リンクはアプリ内で解説になり、リポジトリではリンク文字として読めます。`npm run guide:export`で`docs/guide-ja.md`／`docs/guide-en.md`に同じ内容をコピーします。テストで章・用語・全アラーム・遷移・コピー一致を検証します。

**Editing lessons / レッスンの追加:** `src/lessons/types.ts` defines IDs and target geometry; `catalog.ts` defines dimensions; `messages.ts` holds both languages (exposed via i18n); `programs.ts` builds starters/reference solutions. The independent checker and analytic target live in `src/nc/lessons/`. Add a definition and bilingual content, extend starters as needed, then test correct Mazatrol/EIA solutions and common failures. / ID・目標寸法・両言語の本文を追加し、必要に応じて開始プログラムを拡張して、両形式の正解と典型的な誤りをテストします。
