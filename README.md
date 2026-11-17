# NC Practice Simulator

## English

A browser-based CNC learning simulator inspired by Mazak/Mazatrol. **Phase 1** implements a G-code editor and motion-segment list, Japanese/English switching (Japanese by default), and 20 NC terms with readings, romaji and explanations. Built with Vite, React, strict TypeScript, Zustand and Vitest; no backend. Your program and language preference are saved in this browser.

**Screenshot:** _Placeholder — add a screenshot of the Phase 1 editor and motion list here._

### Run and test

Requires **Node.js 22.12+** (Node.js 24 LTS recommended) and npm. From the repository directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Click **Run** to execute the included example, or edit the program first. Hover, focus or tap an underlined term to view its definition; Escape closes it. Switch between **日本語 / English** in the header. Motion coordinates are in mm; feed rates are in mm/min.

```sh
npm test                # Run all unit and UI tests once
npm run test:watch      # Watch tests during development
npm run test:coverage   # Core coverage, with enforced thresholds
npm run build           # Strict TypeScript check + production build in dist/
npm run preview         # Preview the production build locally
```

Supported codes include G00–G03, G43/G49, G54–G59, G80/G81/G83, G90/G91 and G98/G99. The page uses metric XY coordinates, zero work offsets and H1 = 0. See [supported codes and coordinate conventions](docs/nc-semantics.md) for details and API configuration.

**Not yet implemented:** 2D/3D views, material removal, machine panel, collision/safety checks, Mazatrol unit editing, lessons and JSON import/export.

**Practice only:** Practice simulator — always follow company training on real machines. This is a simplified learning tool, not an official Mazak/Mazatrol product or a real CAM/CNC tool. Real controls differ by version. Do not use its programs or simulated results to operate real equipment. No real-machine connection or export is intended.

## 日本語

Mazak／Mazatrolを参考にした、CNC初心者向けのブラウザー練習用シミュレーターです。**フェーズ1**では、Gコード入力と移動区間の一覧、日本語／英語切替（初期表示は日本語）、読み方・ローマ字・説明付きのNC用語20語を実装しています。Vite・React・厳格なTypeScript・Zustand・Vitestを使用し、バックエンドは不要です。プログラムと表示言語はブラウザー内に保存されます。

**スクリーンショット：** _準備中 — フェーズ1の入力画面と移動区間の一覧をここへ追加します。_

### 起動とテスト

**Node.js 22.12以降**（Node.js 24 LTS推奨）とnpmが必要です。リポジトリのディレクトリで実行します。

```sh
npm install
npm run dev
```

Viteが表示するローカルURLを開き、**実行**を押すとサンプルを計算します。プログラムは編集できます。下線付きの用語にカーソルを合わせるか、フォーカス・タップすると説明が表示され、Escapeで閉じます。ヘッダーの**日本語 / English**で表示言語を切り替えます。座標はmm、送り速度はmm/minです。

```sh
npm test                # ユニットテストとUIテストを1回実行
npm run test:watch      # 変更を監視してテスト
npm run test:coverage   # コアのカバレッジを測定・下限を検証
npm run build           # 厳格な型チェックと本番用ビルド（dist/）
npm run preview         # 本番用ビルドをローカルで確認
```

対応コード：G00–G03、G43/G49、G54–G59、G80/G81/G83、G90/G91、G98/G99など。画面ではXY平面・ミリ単位を使用し、ワーク座標オフセットとH1は0です。[対応範囲と計算規則](docs/nc-semantics.md)を参照してください。

**未実装：** 2D/3D表示、材料除去、操作盤、干渉・安全確認、Mazatrolユニット編集、レッスン、JSON入出力。

**練習専用：** 練習用シミュレーター — 実機の操作は必ず会社の指導に従うこと。本アプリは学習用に簡略化したもので、Mazak／Mazatrolの公式製品でも、実加工用のCAM・CNCツールでもありません。実機の画面や動作は制御装置のバージョンにより異なります。本アプリのプログラムやシミュレーション結果を実機の運転に使用しないでください。実機への接続・出力は対象外です。
