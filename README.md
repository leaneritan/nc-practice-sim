# NC Practice Simulator

## English

A browser-based CNC practice app inspired by Mazak/Mazatrol, built with Vite, React, strict TypeScript, Zustand and Vitest. **Phase 3** adds a simplified control panel, timed MEMORY execution, MDI, manual axis movement, and editable work offsets/tool data. XY/XZ paths and stock/vise outlines use **WORK coordinates**; POSITION shows machine coordinates separately. Japanese (default) / English, glossary tooltips and three sample G-code programs are included. Programs, language, input settings, G54–G59 and 20 tool records persist in this browser; no backend.

**Screenshot:** _Placeholder — add the Phase 3 POSITION screen and control panel here._

Requires **Node.js 22.12+** (24 LTS recommended) and npm:

```sh
npm install
npm run dev             # Open the URL printed by Vite
npm test                # Unit and UI tests
npm run test:coverage   # Core coverage with enforced thresholds
npm run build           # Strict type check + production build
npm run preview         # Serve the production build
```

- In **EDIT → PROGRAM**, load a sample or enter G-code. Select **MEMORY → CYCLE START** to run. Try **FEED HOLD**, resume with CYCLE START, or enable **SINGLE BLOCK**. M00 always stops; M01 stops with OPTIONAL STOP enabled. RESET clears the run without moving the machine.
- **POSITION** shows work/machine/remaining coordinates and live paths. **SHAPE CHECK → Run** calculates an instant preview without moving the machine; RESET clears an executed trace to enable a new preview.
- **WORK OFFSET** edits G54–G59; **TOOL DATA** edits 20 rows (type, diameters, length, life). Valid values save on blur/Enter. H1–H20 use those lengths. Setup is locked during an active/held cycle.
- **MDI** executes temporary commands from the current position/modal state. **JOG/RAPID** move while an axis key is held; **HANDLE** moves 0.001 mm ×1/10/100 per click. Arrow keys move X/Y and Page Up/Down move Z when focus is outside inputs/buttons. TAPE is disabled.
- Decimal-less distance words show a yellow warning: `X10` means 10 mm normally, or 0.010 mm with **Strict decimal input**; `X10.` always means 10 mm. Real controls depend on their settings.

**Coordinate check:** Set G54 to `(100, 200, 30)` and H1 length to `50`, then run `G54 G43 H1 G0 X10. Y15. Z5.`. POSITION should show work `(10, 15, 5)` and machine `(110, 215, 85)`. The path endpoint stays at work `(10, 15, 5)` relative to the stock. See [control and interpreter conventions](docs/nc-semantics.md).

**Not yet implemented:** 3D/material removal, collision/travel/safety alarms, magazine animation, tool wear/life consumption, Mazatrol units, lessons, JSON import/export, G41/G42. Tool diameters and life are recorded only.

**Practice only:** Practice simulator — always follow company training on real machines. This simplified learning app is not an official Mazak/Mazatrol product or a real CAM/CNC tool. Do not use its programs or results to operate real equipment. No machine connection or export is intended.

## 日本語

Mazak／Mazatrolを参考にしたブラウザー練習用CNCシミュレーターです。Vite・React・厳格なTypeScript・Zustand・Vitestを使用しています。**フェーズ3**では、簡略化した操作盤、MEMORYの実時間再生、MDI、手動軸移動、ワーク座標・工具データ編集を追加しました。XY/XZ経路と素材・バイスは**ワーク座標**で表示し、POSITIONには機械座標も別に表示します。日本語（初期設定）／英語、用語解説、3つのGコード例を利用できます。プログラム・言語・入力設定・G54〜G59・工具20本分のデータはブラウザー内に保存され、バックエンドは不要です。

**スクリーンショット：** _準備中 — フェーズ3のPOSITION画面と操作盤をここへ追加します。_

**Node.js 22.12以降**（24 LTS推奨）とnpmが必要です。

```sh
npm install
npm run dev             # Viteが表示するURLを開く
npm test                # ユニットテスト・UIテスト
npm run test:coverage   # コアのカバレッジ測定・下限検証
npm run build           # 型チェック・本番用ビルド
npm run preview         # 本番用ビルドの確認
```

- **EDIT → PROGRAM**でサンプルを読み込むかGコードを入力し、**MEMORY → CYCLE START**で実行します。**FEED HOLD**で一時停止、CYCLE STARTで再開し、**SINGLE BLOCK**では1ブロックずつ進めます。M00は必ず停止し、M01はOPTIONAL STOP有効時に停止します。RESETは機械を動かさず実行を解除します。
- **POSITION**はワーク座標・機械座標・残移動量と動作経路を表示します。**SHAPE CHECK → 実行**は機械を動かさない即時計算です。実行済み経路はRESETで消去してから新しく確認できます。
- **WORK OFFSET**でG54〜G59、**TOOL DATA**で20本の工具種類・公称径・実径・長さ・寿命を編集します。有効値はフォーカス移動／Enterで保存し、H1〜H20が各行の工具長を使用します。実行・一時停止中は段取りを変更できません。
- **MDI**は現在の位置・モーダル状態から一時的な指令を実行します。**JOG/RAPID**は軸キーを押している間移動し、**HANDLE**はクリックごとに0.001 mm ×1/10/100移動します。入力欄・ボタン以外にフォーカスがあるとき、矢印キーでX/Y、Page Up/DownでZを操作できます。TAPEは無効です。
- 小数点のない寸法指令には黄色の警告を表示します。通常の`X10`は10 mm、**厳密な小数点入力**では0.010 mmです。`X10.`は常に10 mmです。実機の解釈は設定によって異なります。

**座標の確認：** G54を`(100, 200, 30)`、H1の工具長を`50`にして、`G54 G43 H1 G0 X10. Y15. Z5.`を実行します。ワーク座標は`(10, 15, 5)`、機械座標は`(110, 215, 85)`になります。経路の終点は素材に対してワーク座標`(10, 15, 5)`に表示されます。[操作・計算規則](docs/nc-semantics.md)も参照してください。

**未実装：** 3D・材料除去、干渉・ストロークリミットなどの安全確認、マガジンのアニメーション、工具摩耗・寿命消費、Mazatrolユニット、レッスン、JSON入出力、G41/G42。工具径・寿命は記録のみです。

**練習専用：** 練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと。Mazak／Mazatrolの公式製品でも実加工用のCAM・CNCツールでもありません。本アプリのプログラムや結果を実機の運転に使用しないでください。実機への接続・出力は対象外です。
