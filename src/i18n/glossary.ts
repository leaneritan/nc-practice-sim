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
  {"id":"commonUnit","ja":"共通ユニット","kana":"きょうつうゆにっと","romaji":"kyōtsū yunitto","en":"COMMON unit","meaningEn":"Sets material and the shared clearance height for the program.","meaningJa":"材質と、各加工で使う共通の退避高さを設定します。"},
  {"id":"wpcUnit","ja":"基本座標","kana":"きほんざひょう","romaji":"kihon zahyō","en":"WPC / basic coordinate","meaningEn":"Shifts and rotates the programmed shapes relative to G54 in this simulator.","meaningJa":"このシミュレーターではG54を基準に加工形状を移動・回転します。"},
  {"id":"counterbore","ja":"座ぐり加工","kana":"ざぐりかこう","romaji":"zaguri kakō","en":"Rough counterbore","meaningEn":"Enlarges a hole with a flat-bottom recess; RGH CBOR uses circular milling here.","meaningJa":"穴の入口などを平底に広げる加工です。ここでは円形のフライス加工で表現します。"},
  {"id":"tapping","ja":"タップ加工","kana":"たっぷかこう","romaji":"tappu kakō","en":"Tapping","meaningEn":"Cuts an internal thread; feed per minute equals spindle rpm times thread pitch.","meaningJa":"めねじを加工します。毎分送りは主軸回転数×ねじピッチです。"},
  {"id":"reaming","ja":"リーマ加工","kana":"りーまかこう","romaji":"rīma kakō","en":"Reaming","meaningEn":"Finishes a predrilled hole using a reamer; this simulator feeds in and out.","meaningJa":"下穴をリーマで仕上げます。このシミュレーターでは進入・戻りとも切削送りです。"},
  {"id":"facing","ja":"正面フライス加工","kana":"しょうめんふらいすかこう","romaji":"shōmen furaisu kakō","en":"Face milling","meaningEn":"Removes material across the top surface in parallel passes.","meaningJa":"素材の上面を平行な経路で削り、平らにする加工です。"},
  {"id":"pocket","ja":"ポケット加工","kana":"ぽけっとかこう","romaji":"poketto kakō","en":"Pocket milling","meaningEn":"Removes material inside a boundary; internal corners retain the cutter radius.","meaningJa":"輪郭の内側を削ります。内側の角には工具半径分の丸みが残ります。"},
  {"id":"outsideContour","ja":"外形加工","kana":"がいけいかこう","romaji":"gaikei kakō","en":"Outside contour","meaningEn":"LINE OUT offsets the tool centre outside a closed convex part boundary.","meaningJa":"LINE OUTでは閉じた凸形状の輪郭から工具半径分だけ外側を工具中心が通ります。"},
  {"id":"endUnit","ja":"終了ユニット","kana":"しゅうりょうゆにっと","romaji":"shūryō yunitto","en":"END unit","meaningEn":"Ends the program after stopping the spindle/coolant and returning Z home.","meaningJa":"主軸・クーラントを停止し、Zを機械原点に戻してプログラムを終了します。"},
  {"id":"pointPattern","ja":"単独点","kana":"たんどくてん","romaji":"tandokuten","en":"PT / single point","meaningEn":"Places one hole at the entered X and Y.","meaningJa":"入力したX・Y位置に1つの穴を配置します。"},
  {"id":"linePattern","ja":"直線配列","kana":"ちょくせんはいれつ","romaji":"chokusen hairetsu","en":"LIN / line pattern","meaningEn":"Places a count of holes using X and Y spacing from the first point.","meaningJa":"始点からX・Y間隔で指定数の穴を直線上に配置します。"},
  {"id":"rectanglePattern","ja":"四角配列","kana":"しかくはいれつ","romaji":"shikaku hairetsu","en":"SQR / rectangle pattern","meaningEn":"Places four holes at the corners of a rectangle.","meaningJa":"長方形の4隅に穴を配置します。"},
  {"id":"gridPattern","ja":"格子配列","kana":"こうしはいれつ","romaji":"kōshi hairetsu","en":"GRD / grid pattern","meaningEn":"Repeats holes in X and Y using separate counts and spacings.","meaningJa":"X・Y方向ごとに個数と間隔を指定して格子状に穴を配置します。"},
  {"id":"circlePattern","ja":"円周配列","kana":"えんしゅうはいれつ","romaji":"enshū hairetsu","en":"CIR / circle pattern","meaningEn":"Distributes holes evenly around a centre, starting at the specified angle.","meaningJa":"中心・半径・開始角度を指定し、円周上に穴を等間隔で配置します。"},
  {"id":"lineShape","ja":"直線形状","kana":"ちょくせんけいじょう","romaji":"chokusen keijō","en":"LINE shape","meaningEn":"Connects the preceding contour point to the entered endpoint.","meaningJa":"直前の輪郭点から入力した終点までを直線で結びます。"},
  {"id":"arcShape","ja":"円弧形状","kana":"えんこけいじょう","romaji":"enko keijō","en":"ARC shape","meaningEn":"Defines an arc by its endpoint, centre and clockwise/counterclockwise direction.","meaningJa":"終点・中心・回転方向で円弧を定義します。中心はWPC基準の座標です。"},
  {"id":"autoTools","ja":"自動工具展開","kana":"じどうこうぐてんかい","romaji":"jidō kōgu tenkai","en":"Automatic tool sequence","meaningEn":"Suggests tool rows and cutting values from the material and operation; rows stay editable.","meaningJa":"材質と加工内容から工具順序と切削条件の練習用初期値を作成します。各行は編集できます。"},
  {"id":"clearance","ja":"退避高さ","kana":"たいひたかさ","romaji":"taihi takasa","en":"Clearance height","meaningEn":"COMMON initial Z is the tool-tip height used for safe positioning above the features.","meaningJa":"COMMONの初期Zは加工部の上で位置決めする際の工具先端の退避高さです。"},
  {"id":"topSurface","ja":"加工上面","kana":"かこうじょうめん","romaji":"kakō jōmen","en":"Top Z","meaningEn":"The surface Z from which the unit depth is measured.","meaningJa":"ユニットの加工深さを測り始める面のZ座標です。"},
  {"id":"cutDepth","ja":"加工深さ","kana":"かこうふかさ","romaji":"kakō fukasa","en":"Cut depth","meaningEn":"A positive distance downward from the unit Top Z.","meaningJa":"ユニットの加工上面から下向きに測った正の距離です。"},
  {"id":"diameter","ja":"直径","kana":"ちょっけい","romaji":"chokkei","en":"Diameter","meaningEn":"The full width of a circle or tool, twice its radius.","meaningJa":"円や工具の中心を通る幅で、半径の2倍です。"},
  {"id":"threadPitch","ja":"ねじピッチ","kana":"ねじぴっち","romaji":"neji picchi","en":"Thread pitch","meaningEn":"Axial advance per spindle revolution for the simulated single-start thread.","meaningJa":"この練習用の一条ねじで、主軸1回転あたりに進む距離です。"},
  {"id":"depthPass","ja":"一回の切込み","kana":"いっかいのきりこみ","romaji":"ikkai no kirikomi","en":"Depth per pass","meaningEn":"Maximum depth increment per milling layer or drill peck.","meaningJa":"フライス加工の一層、または深穴あけの一回あたりの最大切込みです。"},
  {"id":"cuttingSpeed","ja":"切削速度","kana":"せっさくそくど","romaji":"sessaku sokudo","en":"Cutting speed","meaningEn":"C-SP is tool-edge speed in m/min; rpm = 1000 × C-SP / (π × diameter).","meaningJa":"C-SPは刃先の速さ（m/min）です。回転数＝1000×C-SP÷（π×直径）で求めます。"},
  {"id":"material","ja":"材質","kana":"ざいしつ","romaji":"zaishitsu","en":"Material","meaningEn":"The workpiece alloy; used to suggest practice cutting speeds and feeds.","meaningJa":"加工物の材料の種類です。練習用の切削速度・送りの初期値に使います。"},
  { id: 'pocketEntry', ja: 'ポケット進入', kana: 'ぽけっとしんにゅう', romaji: 'poketto shinnyū', en: 'Pocket entry', meaningEn: 'Ramp down while moving sideways; the optional straight plunge uses 30% of cutting feed.', meaningJa: '横に移動しながら斜めに切り込みます。垂直に突っ込む場合は切削送りの30%を使います。' },
  { id: 'spotDrill', ja: 'スポットドリル', kana: 'すぽっとどりる', romaji: 'supotto doriru', en: '90° spot drill', meaningEn: 'A conical tool for starting holes and chamfering. At 90°, spot diameter is twice the tip depth below the surface.', meaningJa: '穴の位置決めと面取りに使う円すい状の工具です。先端角90°では、スポット径は上面からの先端深さの2倍です。' },
] as const satisfies readonly GlossaryEntry[];

export type TermId = typeof glossary[number]['id'];
export const terms = Object.fromEntries(glossary.map(term => [term.id, term])) as Record<TermId, GlossaryEntry>;
