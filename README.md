# NC Practice Simulator

## English

A browser-based CNC practice app inspired by Mazak/Mazatrol, built with Vite, React, strict TypeScript, Zustand and Vitest. **Phase 4** adds a three.js 3D heightmap, tool-shaped material removal, a 20-pocket M06 magazine, and line-numbered safety alarms to the control panel. XY/XZ paths and stock/vise outlines use **WORK coordinates**; POSITION shows machine coordinates separately. Japanese (default) / English, glossary tooltips and three sample G-code programs are included. Programs, language, input settings, G54–G59, tool records and the optional pocket-width limit persist in this browser; no backend. Stock removal and machine position are session-only.

**Screenshot:** _Placeholder — add the Phase 4 POSITION screen and control panel here._

Requires **Node.js 22.12+** (24 LTS recommended) and npm:

```sh
npm install
npm run dev             # Open the URL printed by Vite
npm test                # Unit and UI tests
npm run test:coverage   # Core coverage with enforced thresholds
npm run build           # Strict type check + production build
npm run preview         # Serve the production build
```

- In **EDIT → PROGRAM**, load a sample or enter G-code. Select **MEMORY → CYCLE START** to run. Try **FEED HOLD**, resume with CYCLE START, or enable **SINGLE BLOCK**. M00 always stops; M01 stops with OPTIONAL STOP enabled. RESET clears the run without moving the machine or restoring removed material.
- **POSITION** shows work/machine/remaining coordinates and live paths. **SHAPE CHECK → Run** calculates an instant preview without moving the machine; RESET clears an executed trace to enable a new preview.
- **WORK OFFSET** edits G54–G59; **TOOL DATA** edits 20 rows (type, diameters, length, life). Valid values save on blur/Enter. H1–H20 use those lengths. Setup is locked during an active/held cycle.
- **MDI** executes temporary commands from the current position/modal state. `T` preselects a tool; `M06` exchanges it in two simulated seconds at machine Z0 with the spindle stopped. Apply `G43 H` before approaching stock. **JOG/RAPID** move while an axis key is held; **HANDLE** moves 0.001 mm ×1/10/100 per click. Arrow keys move X/Y and Page Up/Down move Z when focus is outside inputs/buttons. TAPE is disabled.
- Decimal-less distance words show a yellow warning: `X10` means 10 mm normally, or 0.010 mm with **Strict decimal input**; `X10.` always means 10 mm. Real controls depend on their settings.

**Realistic defaults:** Machine home is `(0, 0, 0)`, with travel X −1020…0, Y −510…0, Z −460…0 mm and the table at Z−460. G54–G59 default to `(−500, −250, −400)` at a stock top-face corner; stock extends +X/+Y and down 20 mm. Tool lengths are 100–180 mm by type. **Reset to default setup** restores these values, returns the simulated machine home, unloads its tool and replaces the stock; program/language stay intact. Existing saved setup is retained until reset.

**Coordinate check:** Starting from defaults, run:

```gcode
T1 M06
G54 G00 G43 H1 X10. Y15. Z5.
```

With H1 = 120 mm, POSITION shows work `(10, 15, 5)` and machine `(−490, −235, −275)`. Try **SHAPE CHECK → Run** with the contour sample to see the cut in 3D; drag to orbit and scroll to zoom. **Replace stock** restores a fresh block without resetting setup. See [control and interpreter conventions](docs/nc-semantics.md).

**Safety checks:** spindle stopped while cutting, missing feed, rapid into remaining material, vise collision, below-stock cutting, missing length compensation, travel limits, missing tool, and tool diameter exceeding an explicitly configured pocket width. Set that width in TOOL DATA (0 = unset); G-code does not identify pocket boundaries. Unsafe source blocks are rejected before motion/removal. Checks also apply to manual movement; M06 has a home/spindle interlock.

**Not yet implemented:** Mazatrol units, lessons, JSON import/export, G41/G42, wear/life consumption, alternate machines. The 1 mm heightmap cannot represent undercuts or threads; collisions use sampled cutter envelopes, not holders, real servo physics, or certified machine geometry. WebGL is required for 3D; the core simulation and 2D views still work without it.

**Practice only:** Practice simulator — always follow company training on real machines. This simplified learning app is not an official Mazak/Mazatrol product or a real CAM/CNC tool. Do not use its programs or results to operate real equipment. No machine connection or export is intended.

## 日本語

Mazak／Mazatrolを参考にしたブラウザー練習用CNCシミュレーターです。Vite・React・厳格なTypeScript・Zustand・Vitestを使用しています。**フェーズ4**では、three.jsの3D高さマップ、工具形状による材料除去、20本の工具マガジンとM06交換、行番号付き安全アラームを追加しました。XY/XZ経路と素材・バイスは**ワーク座標**で表示し、POSITIONには機械座標も別に表示します。日本語（初期設定）／英語、用語解説、3つのGコード例を利用できます。プログラム・言語・入力設定・G54〜G59・工具データ・ポケット幅はブラウザー内に保存され、バックエンドは不要です。除去形状・機械位置は再読込み時に初期化します。

**スクリーンショット：** _準備中 — フェーズ4のPOSITION画面と操作盤をここへ追加します。_

**Node.js 22.12以降**（24 LTS推奨）とnpmが必要です。

```sh
npm install
npm run dev             # Viteが表示するURLを開く
npm test                # ユニットテスト・UIテスト
npm run test:coverage   # コアのカバレッジ測定・下限検証
npm run build           # 型チェック・本番用ビルド
npm run preview         # 本番用ビルドの確認
```

- **EDIT → PROGRAM**でサンプルを読み込むかGコードを入力し、**MEMORY → CYCLE START**で実行します。**FEED HOLD**で一時停止、CYCLE STARTで再開し、**SINGLE BLOCK**では1ブロックずつ進めます。M00は必ず停止し、M01はOPTIONAL STOP有効時に停止します。RESETは機械を動かさず実行を解除し、除去形状は保持します。
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

**未実装：** Mazatrolユニット、レッスン、JSON入出力、G41/G42、摩耗・寿命消費、別機種。1 mmの高さマップではアンダーカット・ねじ形状は表現できません。干渉は工具包絡形状の標本検査で、ホルダー・サーボの物理計算・実機の正確な形状は未再現です。3DにはWebGLが必要ですが、利用できない場合も計算・2D表示は動作します。

**練習専用：** 練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと。Mazak／Mazatrolの公式製品でも実加工用のCAM・CNCツールでもありません。本アプリのプログラムや結果を実機の運転に使用しないでください。実機への接続・出力は対象外です。
