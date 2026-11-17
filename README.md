# NC Practice Simulator

## English

A browser-based CNC learning simulator inspired by Mazak/Mazatrol. **Phase 2** adds canvas XY/XZ toolpath views, stock/vise outlines and three sample programs to the G-code editor and motion list. Japanese/English switching (Japanese by default) and 22 NC terms include readings, romaji and explanations. Built with Vite, React, strict TypeScript, Zustand and Vitest; no backend. Your program, language and input settings are saved in this browser.

**Screenshot:** _Placeholder — add a screenshot of the Phase 2 editor and XY/XZ views here._

### Run and test

Requires **Node.js 22.12+** (Node.js 24 LTS recommended) and npm. From the repository directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Choose one of the three samples, click **Load selected sample**, then **Run**. Samples cover a rounded contour, drilling with dwell/pecks, and tapping. **Continue** resumes M00 stops; M01 stops only with **OPTIONAL STOP** enabled. Hover, focus or tap an underlined term to view its definition; Escape closes it. Switch between **日本語 / English** in the header. Motion coordinates are in mm; feed rates are in mm/min.

```sh
npm test                # Run all unit and UI tests once
npm run test:watch      # Watch tests during development
npm run test:coverage   # Core coverage, with enforced thresholds
npm run build           # Strict TypeScript check + production build in dist/
npm run preview         # Preview the production build locally
```

Supported codes include G00–G03, G28, G43/G49, G54–G59, G80–G84, G90/G91, G98/G99, M00/M01, D and P. The page uses metric XY coordinates, zero work offsets and H1 = 0. See [supported codes and coordinate conventions](docs/nc-semantics.md) for details and API configuration.

**Not yet implemented:** 3D views, material removal, machine panel, collision/safety checks, Mazatrol unit editing, lessons and JSON import/export.

**Decimal point warning:** A yellow warning appears for decimal-less distance words. Normal mode reads `X10` as 10 mm; **Strict decimal input** reads it as 0.010 mm. `X10.` remains 10 mm in either mode. This models a common control setting, not every machine. Dwell `P` is an integer in milliseconds; `D` selects a register without applying cutter compensation.

**Practice only:** Practice simulator — always follow company training on real machines. This is a simplified learning tool, not an official Mazak/Mazatrol product or a real CAM/CNC tool. Real controls differ by version. Do not use its programs or simulated results to operate real equipment. No real-machine connection or export is intended.

## 日本語

Mazak／Mazatrolを参考にした、CNC初心者向けのブラウザー練習用シミュレーターです。**フェーズ2**では、Gコード入力・移動区間の一覧に、canvasのXY/XZ工具経路表示、素材・バイスの輪郭、3つのサンプルを追加しました。日本語／英語切替（初期表示は日本語）と、読み方・ローマ字・説明付きのNC用語22語も利用できます。Vite・React・厳格なTypeScript・Zustand・Vitestを使用し、バックエンドは不要です。プログラム・表示言語・入力設定はブラウザー内に保存されます。

**スクリーンショット：** _準備中 — フェーズ2の入力画面とXY/XZ図をここへ追加します。_

### 起動とテスト

**Node.js 22.12以降**（Node.js 24 LTS推奨）とnpmが必要です。リポジトリのディレクトリで実行します。

```sh
npm install
npm run dev
```

Viteが表示するローカルURLを開き、サンプルを選んで**選択したサンプルを読み込む**→**実行**を押します。角丸輪郭、ドウェル・深穴あけ、タップ加工の3例があります。M00の停止は**続行**で再開し、M01は**OPTIONAL STOP**が有効な場合だけ停止します。下線付きの用語にカーソルを合わせるか、フォーカス・タップすると説明が表示され、Escapeで閉じます。ヘッダーの**日本語 / English**で表示言語を切り替えます。座標はmm、送り速度はmm/minです。

```sh
npm test                # ユニットテストとUIテストを1回実行
npm run test:watch      # 変更を監視してテスト
npm run test:coverage   # コアのカバレッジを測定・下限を検証
npm run build           # 厳格な型チェックと本番用ビルド（dist/）
npm run preview         # 本番用ビルドをローカルで確認
```

対応コード：G00–G03、G28、G43/G49、G54–G59、G80–G84、G90/G91、G98/G99、M00/M01、D、Pなど。画面ではXY平面・ミリ単位を使用し、ワーク座標オフセットとH1は0です。[対応範囲と計算規則](docs/nc-semantics.md)を参照してください。

**未実装：** 3D表示、材料除去、操作盤、干渉・安全確認、Mazatrolユニット編集、レッスン、JSON入出力。

**小数点警告：** 小数点のない寸法指令には黄色の警告を表示します。通常モードの`X10`は10 mm、**厳密な小数点入力**では0.010 mmです。`X10.`はどちらも10 mmです。実機の解釈は制御装置と設定によって異なります。ドウェルの`P`は整数のミリ秒、`D`は補正番号の選択のみで、工具径補正は行いません。

**練習専用：** 練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと。本アプリは学習用に簡略化したもので、Mazak／Mazatrolの公式製品でも、実加工用のCAM・CNCツールでもありません。実機の画面や動作は制御装置のバージョンにより異なります。本アプリのプログラムやシミュレーション結果を実機の運転に使用しないでください。実機への接続・出力は対象外です。
