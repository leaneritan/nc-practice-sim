export interface GlossaryEntry {
  id: string;
  ja: string;
  kana: string;
  romaji: string;
  en: string;
  meaningEn: string;
  meaningJa: string;
}

export const glossary = [
  { id: 'program', ja: 'プログラム', kana: 'ぷろぐらむ', romaji: 'puroguramu', en: 'Program', meaningEn: 'A sequence of instructions for the machine.', meaningJa: '機械の動作を順番に指示する命令の集まりです。' },
  { id: 'motion', ja: '移動区間', kana: 'いどうくかん', romaji: 'idō kukan', en: 'Motion segment', meaningEn: 'One calculated movement from a start point to an end point.', meaningJa: '始点から終点までの、計算された1つの動きです。' },
  { id: 'rapid', ja: '早送り', kana: 'はやおくり', romaji: 'hayaokuri', en: 'Rapid traverse', meaningEn: 'G00 positions the tool without a programmed cutting feed.', meaningJa: 'G00で切削送りを使わずに位置決めする動きです。' },
  { id: 'linear', ja: '直線補間', kana: 'ちょくせんほかん', romaji: 'chokusen hokan', en: 'Linear interpolation', meaningEn: 'G01 moves in a straight line at the programmed feed rate.', meaningJa: 'G01で指定した送り速度で直線上を移動します。' },
  { id: 'arcCW', ja: '時計回り円弧補間', kana: 'とけいまわりえんこほかん', romaji: 'tokeimawari enko hokan', en: 'Clockwise arc', meaningEn: 'G02 follows an arc clockwise when viewed from positive Z in G17.', meaningJa: 'G17ではZ軸の正方向から見て時計回りに円弧を描くG02の動きです。' },
  { id: 'arcCCW', ja: '反時計回り円弧補間', kana: 'はんとけいまわりえんこほかん', romaji: 'hantokeimawari enko hokan', en: 'Counterclockwise arc', meaningEn: 'G03 follows an arc counterclockwise when viewed from positive Z in G17.', meaningJa: 'G17ではZ軸の正方向から見て反時計回りに円弧を描くG03の動きです。' },
  { id: 'workCoordinate', ja: 'ワーク座標系', kana: 'わーくざひょうけい', romaji: 'wāku zahyōkei', en: 'Work coordinate system', meaningEn: 'Coordinates referenced to the chosen workpiece origin.', meaningJa: '加工物に設定した原点を基準とする座標系です。' },
  { id: 'machineCoordinate', ja: '機械座標系', kana: 'きかいざひょうけい', romaji: 'kikai zahyōkei', en: 'Machine coordinate system', meaningEn: 'Coordinates referenced to the fixed machine origin.', meaningJa: '機械固有の原点を基準とする座標系です。' },
  { id: 'workOffset', ja: 'ワーク座標オフセット', kana: 'わーくざひょうおふせっと', romaji: 'wāku zahyō ofusetto', en: 'Work offset', meaningEn: 'G54–G59 select stored shifts from the machine origin to a work origin.', meaningJa: 'G54〜G59で、機械原点からワーク原点までのずれ量を選択します。' },
  { id: 'toolLength', ja: '工具長補正', kana: 'こうぐちょうほせい', romaji: 'kōguchō hosei', en: 'Tool-length compensation', meaningEn: 'G43 H selects a tool-length value; G49 cancels its application.', meaningJa: 'G43 Hで工具の長さの補正値を選択し、G49で補正を解除します。' },
  { id: 'absolute', ja: '絶対値指令', kana: 'ぜったいちしれい', romaji: 'zettaichi shirei', en: 'Absolute positioning', meaningEn: 'G90 specifies target coordinates relative to the active origin.', meaningJa: 'G90で有効な座標原点を基準に移動先の座標を指定します。' },
  { id: 'incremental', ja: '増分値指令', kana: 'ぞうぶんちしれい', romaji: 'zōbunchi shirei', en: 'Incremental positioning', meaningEn: 'G91 specifies displacement from the current position.', meaningJa: 'G91で現在位置からの移動量を指定します。' },
  { id: 'feed', ja: '送り速度', kana: 'おくりそくど', romaji: 'okuri sokudo', en: 'Feed rate', meaningEn: 'F sets cutting travel speed in mm/min with G94.', meaningJa: 'G94ではFで毎分の移動量（mm/min）を指定します。' },
  { id: 'spindle', ja: '主軸', kana: 'しゅじく', romaji: 'shujiku', en: 'Spindle', meaningEn: 'The rotating shaft that holds the cutting tool on a machining centre.', meaningJa: 'マシニングセンタで工具を保持して回転させる軸です。' },
  { id: 'drilling', ja: '穴あけ固定サイクル', kana: 'あなあけこていさいくる', romaji: 'anaake kotei saikuru', en: 'Drilling cycle', meaningEn: 'G81 feeds from R to the hole bottom, then retracts rapidly.', meaningJa: 'G81でR点から穴底まで切削送りし、早送りで戻ります。' },
  { id: 'peckDrilling', ja: '深穴あけサイクル', kana: 'ふかあなあけさいくる', romaji: 'fukaanaake saikuru', en: 'Peck drilling cycle', meaningEn: 'G83 drills in Q-depth steps, retracting to R between pecks.', meaningJa: 'G83でQの切込み量ごとに穴あけし、途中でR点まで戻ります。' },
  { id: 'retractPlane', ja: 'R点', kana: 'あーるてん', romaji: 'āru ten', en: 'R plane', meaningEn: 'The approach plane above the hole; G99 returns here after drilling.', meaningJa: '穴あけを開始する高さで、G99では加工後にこの高さへ戻ります。' },
  { id: 'initialPlane', ja: 'イニシャル点', kana: 'いにしゃるてん', romaji: 'inisharu ten', en: 'Initial plane', meaningEn: 'The height at cycle entry; G98 returns here or to R if R is higher.', meaningJa: 'サイクル開始時の高さです。G98ではこの高さ（R点の方が高ければR点）へ戻ります。' },
  { id: 'modal', ja: 'モーダル', kana: 'もーだる', romaji: 'mōdaru', en: 'Modal state', meaningEn: 'A setting that remains active until another command changes it.', meaningJa: '別の指令で変更されるまで有効な状態が続くことです。' },
  { id: 'alarm', ja: 'アラーム', kana: 'あらーむ', romaji: 'arāmu', en: 'Alarm', meaningEn: 'An error that stops calculation and identifies the source line.', meaningJa: '計算を停止し、原因の行を知らせるエラーです。' },
  { id: 'stock', ja: '素材', kana: 'そざい', romaji: 'sozai', en: 'Stock', meaningEn: 'The starting block of material, before machining.', meaningJa: '加工を始める前の材料です。この画面では100×60×20 mmのブロックを示します。' },
  { id: 'vise', ja: 'バイス', kana: 'ばいす', romaji: 'baisu', en: 'Vise', meaningEn: 'A workholding device that grips the stock between jaws.', meaningJa: '口金の間に素材を挟んで固定する保持具です。' },
] as const satisfies readonly GlossaryEntry[];

export type TermId = typeof glossary[number]['id'];
export const terms = Object.fromEntries(glossary.map(term => [term.id, term])) as Record<TermId, GlossaryEntry>;
