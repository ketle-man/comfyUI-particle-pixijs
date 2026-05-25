# DEVLOG — comfyUI-particle

## 概要

ComfyUI カスタムノード。Three.js を使用してパーティクルをキャンバス上に描画し、任意のタイミングで画像としてキャプチャして後続ノードへ出力する。

---

## セッション 1

### 基本構造の構築

**目的**: ComfyUI カスタムノードとして Three.js パーティクルレンダラーを実装する。

**実装内容**:
- `__init__.py` — ノードマッピング登録、`WEB_DIRECTORY = "./web"` 宣言
- `particle_node.py` — Python ノードクラス、`/particle/capture` POST エンドポイント
- `web/particle_widget.js` — LiteGraph 拡張によるフロントエンド UI

**ノード入力**:
- `particle_type` : enum (smoke / spark / ray)
- `particle_color` : COLOR ウィジェット
- `width` / `height` : INT (64〜2048)
- `particle_count` : INT (10〜2000)
- `node_id` : STRING (複数ノード識別用)
- `image` (optional) : IMAGE — 入力画像へパーティクルをオーバーレイ

**Three.js 構成**:
- `OrthographicCamera` (-W/2, W/2, H/2, -H/2)
- `PointsMaterial` with `vertexColors: true`
- `BufferGeometry` に `position` / `color` BufferAttribute
- オフスクリーンキャンバス (`position:fixed; left:-9999px`) で描画

---

### キャプチャ・キャッシュ方式

- 再生中に「停止してキャプチャ」ボタン押下 → canvas を base64 PNG に変換 → `/particle/capture` POST
- Python 側で `captured_images[node_id]` に PIL Image として保存（**上書き保持、削除しない**）
- `IS_CHANGED` は画像データの MD5 ハッシュを返す → 内容が変わった時のみ再実行
- 手動キューでも最後のキャプチャ画像を返し続ける

**解決した問題**:
- `captured_images.pop()` でキャッシュを消費していたため手動実行時に透明画像が返っていた → `.get()` に変更

---

### 自動キューの削除

- `promptQueued` イベントで自動キューしていたが、接続中の他ノードも巻き込んで実行してしまう問題
- 「停止してキャプチャ」ボタン内で `app.queuePrompt(0)` を直接呼び出す方式に変更

---

## セッション 2

### カラーグラデーション（カラーランプ）

**目的**: 単色指定からパーティクルの誕生〜消滅に沿ったグラデーション指定へ拡張。

**実装**:
- `colorStops` 配列: `[{ pos: 0〜1, color: "#rrggbb" }]`
- `evalGradient(stops, t)` — ソート済みストップ間を線形補間
- Three.js 側: `vertexColors: true` + `_setColor(i, t)` で各パーティクルに個別色を付与
- `gradientFn = t => evalGradient(colorStops, t)` を ParticleSystem に渡す

**UI**:
- グラデーショントラック（canvas 上に `createLinearGradient` で描画）
- 三角ハンドル: ドラッグで位置変更、クリックで選択
- `+` / `-` ボタンでストップ追加・削除（最低1個を保持）
- 選択ストップの色は `particle_color` (COLOR ウィジェット) で変更
- `node.properties.colorStops` に保存（ワークフロー保存時に維持）

**解決した問題**:
- ComfyUI の `"COLOR"` ウィジェット型を `org_MultiColorPicker` 参照ノードから発見
- 隠し `input[type=color]` DOM 要素方式は LiteGraph のイベントインターセプトにより動作せず
- `"COLOR"` 型を Python の `INPUT_TYPES` に宣言することでネイティブカラーピッカーが機能

---

### パーティクルサイズスライダー

- Python の `INPUT_TYPES` からは削除（JS 側のみで管理）
- カスタム描画スライダー: 範囲 1.0〜20.0
- `onDrawForeground` でバー描画、`onMouseDown/Move` でヒットテスト

---

### 発生位置・方向ポインター

**実装**:
- プレビューキャンバス上に十字マーカーを `onDrawForeground` で描画
- 黄色いハンドルをドラッグ → `Math.atan2` で方向角、距離で強さを算出
- `ARROW_MIN=20` / `ARROW_MAX=200` → 強さ 0.2〜3.0 にマッピング
- `getStrength(em)` = `0.2 + (arrowLenPx - 20) / 180 * 2.8`

**座標変換**:
- `threeToPreview(tx, ty)` — Three.js 座標 → ノードローカル座標
- `previewToThree(px, py)` — ノードローカル座標 → Three.js 座標

**解決した問題**:
- ポインターがウィジェット領域外へはみ出す問題 → `getPreviewY()` を `widget.last_y` ベースの動的計算に変更
- 右クリックが ComfyUI コンテキストメニューと競合 → `e.button !== 0` チェックで左クリックのみ処理

---

## セッション 3

### 複数発生点（マルチエミッター）

**目的**: プレビューキャンバス上に複数のパーティクル発生点を配置できるようにする。

**実装**:

`emitters` 配列:
```js
[{ origin: {x, y}, direction: rad, arrowLenPx: 80 }]
```

`particleSystems` 配列:
- エミッター 1 個につき `ParticleSystem` インスタンスを 1 つ生成
- `particle_count` をエミッター数で均等分割
- 全システムを同一 Three.js `scene` に追加

**UI インタラクション**:

| 操作 | 動作 |
|------|------|
| プレビュー空き部分をクリック | 新しい発生点を追加 |
| 既存の十字をクリック | 発生点を選択（青ハイライト） |
| 黄色ハンドルをドラッグ | 選択中の発生点の方向・強さを変更 |
| 「発生点削除」ボタン | 選択中の発生点を削除（1個の場合は無効） |

- 各発生点に番号ラベル（1〜n）を表示
- 選択中のエミッターのみ方向矢印（黄色）を表示
- `node.properties.emitters` に保存（ワークフロー保存時に維持）

---

## アーキテクチャメモ

### ファイル構成

`ComfyUI/custom_nodes/comfyUI-particle-pixijs/` 直下がリポジトリルートになっている（サブフォルダなし）。

```
comfyUI-particle-pixijs/          ← git clone 先 / ComfyUI custom_nodes フォルダに直置き
├── __init__.py                   # ノード登録・WEB_DIRECTORY = "./web"
├── particle_node.py              # Python ノードクラス・capture / input API
├── DEVLOG.md
├── README.md
├── docs/images/                  # スクリーンショット等
└── web/
    ├── particle_widget.js        # LiteGraph 拡張・PixiJS UI メイン
    ├── filter_library.js         # フィルタライブラリモーダル
    └── i18n.js                   # 多言語対応（en / ja / zh）
```

### レイアウトスタック（onDrawForeground 描画順）

```
[ComfyUI 標準ウィジェット群]
  ↓ getWidgetsBottom() — widget.last_y で動的計算
[カラーランプラベル + +/- ボタン]
[グラデーショントラック + ハンドル]
[サイズスライダー]
[エミッター管理行 (削除ボタン + 情報テキスト)]
[プレビューキャンバス]
```

### Three.js パーティクルシステム

| クラス | ブレンド | 特徴 |
|--------|----------|------|
| `SmokeSystem` | NormalBlending | 揺らぎ、膨張、低透明度 |
| `SparkSystem` | AdditiveBlending | 重力あり、高速放散 |
| `RaySystem`   | AdditiveBlending | 直線放射、減速フェード |

### キャプチャフロー

```
[■ 停止してキャプチャ]
  → animating=false
  → renderer.render(scene, camera)
  → canvas.toDataURL("image/png")
  → POST /particle/capture  { node_id, image: "data:image/png;base64,..." }
  → Python: base64デコード → PIL Image → captured_images[node_id]
  → app.queuePrompt(0)
  → render() が captured_images[node_id] を取得して tensor 変換
```

---

## セッション 5

### Three.js 残存記述の整理

PixiJS 移行後に残っていた Three.js 関連記述をコード全体から除去した。

- `particle_node.py` — docstring「Three.js パーティクル」→「PixiJS パーティクル」に修正
- `particle_node.py` — `NODE_DISPLAY_NAME_MAPPINGS` の表示名を `"Particle Renderer (PixiJS)"` に修正
- `particle_widget.js` — コメント・関数名内の Three.js 系記述をすべて PixiJS 相当に修正

---

### ComfyUI 再起動後にキャンバス全体が崩れる問題の調査・修正

**症状**: ワークフローを保存した状態で ComfyUI を再起動すると、ブラウザ上のキャンバス全体の操作が困難になる。

**根本原因**: PixiJS の `PIXI.Application` はインスタンス生成時に WebGL コンテキストを取得する。ブラウザは同一ページ上の WebGL コンテキスト数を 8〜16 個に制限しており、保存されたワークフローを復元する際にノード数分のコンテキストを一斉生成してこの上限を超えていた。

**修正**: PixiJS の初期化（`initPixiApp`）を**▶ 再生ボタン押下時まで遅延**する Lazy 初期化方式に変更。グラフ復元時にはコンテキストを消費しない。

```js
function initPixiApp(w, h) {
  if (pixiApp) return;
  pixiApp = new PIXI.Application({ view: canvas, ... });
  ...
}
// ▶ 再生ボタンのコールバック内でのみ呼び出す
```

---

### `dz_mtb_widgets.js:283` TypeError クラッシュの修正

**症状**: グラフ復元時に `TypeError: Cannot read properties of null (reading 'default')` が発生し、MTB の COLOR ウィジェットが描画できずノード全体がクラッシュする。

**根本原因**: `onNodeCreated` を `async` 関数にしていたため、内部の `await loadPixiJS()` が JS イベントループを手放した隙に LiteGraph の `node.configure(savedData)` が同期的に実行され、`widget.value = null`（保存データが null）で上書きされていた。その後 MTB の `draw` コールバックが `this.value.default` を参照してクラッシュ。

**修正**:

1. `loadPixiJS()` の `await` を `beforeRegisterNodeDef` に移動し、PIXI のロードを事前に完了させる
2. `onNodeCreated` を**同期関数**に変更（`async` を除去）
3. `hookWidgets` の遅延呼び出しを `setTimeout(150ms)` から `queueMicrotask` に変更（同一マイクロタスクキューで完了させる）
4. `onConfigure` フックを追加してグラフ復元後に `colorStops` を再同期、NULL 値を `#ffffff` で保護

```js
async beforeRegisterNodeDef(nodeType, nodeData) {
  if (nodeData.name !== "ParticleRenderer") return;
  const PIXI = await loadPixiJS();  // ← ここで完了させる
  nodeType.prototype.onNodeCreated = function () {  // ← async ではない
    ...
    queueMicrotask(hookWidgets);
  };
}
```

---

### particle_widget_backup.js による二重登録問題の修正

**症状**: バックアップ用に残していた `particle_widget_backup.js` が ComfyUI によって本体と同時に読み込まれ、同一ノードに対して `onNodeCreated` が 2 回パッチされていた。

**修正**: ファイルを `particle_widget_backup.js.bak` にリネームし ComfyUI のスキャン対象から除外。

---

### particle_color ウィジェット重複・カラー変更不能問題の修正

**経緯**:

1. ComfyUI は Python `INPUT_TYPES` に `"COLOR"` 型を宣言すると**標準プレースホルダー**を生成する
2. MTB の `ensureColorWidgets` が `onNodeCreated` チェーン内で**追加の `COLOR` ウィジェット**を生成する
3. 結果として `particle_color` という名前のウィジェットが 2 つ存在する

**最終方針**: 両ウィジェットを共存させ、どちらを操作しても同じ色に同期する。

**実装**:
- `syncColorWidget()` を `forEach` でイテレートするよう変更し、全 `particle_color` ウィジェットへ一括同期
- `hookWidgets()` のコールバック内でカラー変更後に `syncColorWidget()` を呼び出す
- `onConfigure` フックも `forEach` に変更し、グラフ復元時に両ウィジェットの NULL 値を修正

---

### star_warp パーティクルタイプの追加

**概要**: PixiJS 公式サンプル「star warp」を参考に、ワープ飛行演出用の `star_warp` タイプを追加した。

**実装クラス**: `StarWarpSystem extends ParticleSystem`

**動作原理**:
- 星を 3D 空間 `(x, y, z)` に配置し、透視投影 (`fov / z`) で 2D scene 座標に変換
- カメラが Z 軸方向に前進することで星が中心（消失点）から外向きに広がる
- 速度に比例して `scale.y` を引き伸ばし、放射状のストリーク（光条）を表現

**パラメータ対応**:

| パラメータ | star_warp での役割 |
|---|---|
| `particle_count` | 星の数 |
| サイズスライダー | 星の基本サイズ・ストレッチ量 |
| 矢印の長さ (strength) | ワープ速度（短=ゆっくり漂う / 長=フルワープ） |
| emitter の origin | 消失点の位置（複数配置で多点ワープも可能） |
| カラーグラデーション | 遠い星→近い星の色変化 |

**技術的注意点 — scene.scale.y=-1 下での回転計算**:

`scene` コンテナが `scale.y = -1`（Y 軸反転）であるため、PixiJS のワールド変換行列を展開すると合成 2×2 行列は:
```
[[cosθ, -sinθ],
 [-sinθ, -cosθ]]
```
`local -Y` のキャンバス方向 = `(sinθ, cosθ)`。

ストリークの 70%（`anchor.y=0.7`）を消失点から外向きに延ばすには `local -Y` をキャンバス上の外向きベクトル `(dx, -dy)` に合わせる必要があり:

```js
sprite.rotation = Math.atan2(dx, -dy);
// dx = projX - origin.x, dy = projY - origin.y（scene 座標）
```

`atan2(-dx, -dy)` や `atan2(dx, dy)` では 180° or 90° ずれるため、直接行列から導出した式を使用する。

**その他の対応**:
- **コンストラクタを持たない設計**: `ParticleSystem` の基底コンストラクタが `init()` を呼ぶため、サブクラス固有の初期化（`this.stars = []` 等）はすべて `init()` の先頭で行う。コンストラクタで定義すると `super()` 呼び出し後に設定され `init()` 実行時に未定義となりクラッシュする。
- **キャンバス外クリッピング**: z が小さい星は `fov/z * W` が爆発的に大きくなるため、scene 座標が `|px| > W/2 * 1.3` を超えた星は非表示にして巨大ストレッチを防止。
- **ストレッチ係数の正規化**: 元サンプルは 1920px ウィンドウ想定。512px キャンバスに合わせて `starStretch = particleSize * 0.4` に調整。

---

## セッション 4

### PIXIJSへの描画エンジン差し替え

**目的**: より2D・軽量なUI用途に適した描画処理とするため、Three.js ベースから PIXIJS (v7.3) ベースのパーティクルレンダラーへ完全移行する。

**実装内容**:
- `THREE.WebGLRenderer` を `PIXI.Application` ベース（Offscreen canvas）に変更
- 既存の `SmokeSystem`, `SparkSystem`, `RaySystem` を `PIXI.Sprite` の管理クラスとして再構築
- ベーステクスチャ `getParticleTexture` 関数を用いてCanvas内部で白グラデーション円を生成し、将来的により高度なカスタムテクスチャを追加可能に設計
- 座標系について、PIXIJS(左上が原点・Y下方向)のコンテナを画面中央に配置し、`scale.y = -1` (Y軸反転)することで、従来の Three.js (`OrthographicCamera`) 用に計算されていた発生位置や方向などの内部ロジック計算式を無加工で維持
- PIXIJS の `sprite.tint` および `sprite.blendMode` (`NORMAL` vs `ADD`) による高度な色補間・ブレンド処理を適用

**特記事項**: 
- `particle_widget.js` は完全に書き換えられましたが、`DEVLOG.md` 等で記録している動作仕様やUI機能（カラーランプ、複数発生点、キャプチャ通信など）は全く同じ動作をするよう後方互換性が保たれています。

### PIXIJS移行に伴う修正・安定化（トラブルシューティング）

- **キャプチャ画像のアルファ合成の修正**:
  - `image` 入力が無い場合、PIXIJSのキャプチャ画像変換時にアルファ成分が欠落してパーティクルのフチが硬くなる・白浮きする問題を修正。`particle_node.py` 側でダミーの黒背景（RGBA: 0, 0, 0, 255）を敷き、その上に合成してからRGB画像へ変換することでプレビュー通りの美しいアルファブレンドを維持しました。
- **重複発生したウィジェットによるUIクラッシュ解消**:
  - ComfyUIの仕様により、カスタムカラーピッカーと標準のテキスト入力欄が `particle_color` という同名で重複して生成され、UIのレイアウト情報（`last_y`等）が破壊・混線してウィジェットが重なる問題が発生。
  - JSの `hookWidgets()` 内で、2つ目以降に生成された余分な `particle_color`（白いテキスト枠など）を検知して削除（`splice`）するガード処理を追加。これによりカラーランプとカラーピッカーの同期が正常に機能し、UIの重なりや入力値の `NaN` 化を防ぎました。
- **初期再生時のパーティクル非表示（NaN伝搬）バグ修正**:
  - 「再生」ボタンを押した直後、一番最初のフレームにおいて経過時間（`time`）が未定義のまま処理が進み、時間の差分計算（`delta`）が `NaN` になってすべての描画座標が破壊（画面外へ消滅）される問題を修正。
  - 再生開始時に直接 `animate()` を呼ばず、ブラウザの `requestAnimationFrame(animate)` の呼び出しに委ねることで、正確なタイムスタンプ（`time`）を取得し、再生直後から確実かつスムーズにパーティクルが描画されるよう安定化させました。

---

## セッション 6

### particle_type "none" 追加

**目的**: パーティクルを発生させず、フィルターと入力画像の合成のみを行うモードを追加する。

**実装**:
- `NoneSystem extends ParticleSystem` を追加（`init` / `update` が空実装）
- `particle_type` の選択肢に `"none"` を追加（Python 側 `INPUT_TYPES` は変更済み）
- `rebuildParticles` 内で `"none"` タイプの場合は `countPerEm = 0` を渡す
- `particle_node.py` に `/particle/input/{node_id}` GET エンドポイントを追加し、入力画像を base64 で JS 側へ配信
- `render()` 内で入力画像を `input_images[node_id]` にキャッシュ。入力が切断された場合は `input_images.pop(node_id, None)` でキャッシュをクリアし、古い画像が背景に残るのを防ぐ

---

### pixi-filters v5 対応・フィルタライブラリ実装

**目的**: GlowFilter / BloomFilter など映像フィルターをシーンに適用できるようにし、設定 UI を専用モーダルに集約する。

**新規ファイル**: `web/filter_library.js`

**対応フィルター（12種）**:

| カテゴリ | フィルター |
|---------|-----------|
| 基本 | none / Glow / Bloom / KawaseBlur / Pixelate / OldFilm / CRT |
| 追加 | Dot / DropShadow / MotionBlur / Outline / RGBSplit / ZoomBlur |

**CDN ロード**:
```js
async function loadPixiFilters() {
  if (window.PIXI?.filters?.GlowFilter) return;
  // pixi-filters@5 を動的に <script> タグで挿入
  script.src = "https://cdn.jsdelivr.net/npm/pixi-filters@5/dist/browser/pixi-filters.min.js";
}
```
`beforeRegisterNodeDef` 内で `loadPixiJS()` と `loadPixiFilters()` を直列に `await` する。

**UI 構成（3カラムモーダル）**:
- 左パネル: フィルター一覧リスト（基本 / 追加 / パーティクル設定）
- 中央パネル: mainCanvas をリアルタイムミラーするプレビューキャンバス
- 右パネル: 選択フィルターのパラメータ（スライダー + 数値入力 + カラーピッカー）

**保存**:
- フィルター設定を `node.properties.filterSettings` に保存
- ワークフロー保存・復元後も設定を維持（`onConfigure` で復元）

**ノード UI からのフィルター選択 UI 削除**:
- 以前はノードキャンバス上にフィルタータイプ選択ボタンとパラメータスライダーを直接描画していたが、すべてライブラリモーダルに移行しノード UI を簡潔化した

---

### BG+フィルタ モード

**目的**: 入力画像＋パーティクルをまとめてフィルター処理して出力するモードを追加する。

**実装**:
- `filterOnBg` フラグ（`node.properties.filterOnBg` で永続化）をトグルボタンで切り替え
- `loadBackgroundSprite()` — image 入力が接続されている場合のみ `/particle/input/{node_id}` から画像を取得し PixiJS Sprite としてシーン最背面に配置
- `bgBaked` フラグをキャプチャ時に Python 側へ送信し、背景合成済みの場合は Python 側での再合成をスキップ

**入力切断時の挙動**:
- JS 側: `node.inputs?.find(inp => inp.name === "image")?.link` で接続状態を確認し、切断済みなら Sprite をロードしない
- Python 側: `image=None` 時に `input_images.pop(node_id, None)` でキャッシュをクリア

---

### パーティクルテクスチャ・回転設定

**目的**: デフォルトのグラデーション円以外の画像をパーティクルテクスチャとして使用でき、回転も指定できるようにする。

**フィルタライブラリ「テクスチャ & 回転」パネル**:
- ファイル選択ボタン（`<input type="file" accept="image/*">`）で任意の画像を DataURL として保持
- テクスチャ 64px プレビュー画像
- クリアボタンでデフォルトに戻す
- 回転角度スライダー（0〜360°）+ 数値入力
- ランダム回転チェックボックス（パーティクルごとに個別ランダム回転を付与）

**実装**:
```js
// ParticleSystem コンストラクタに追加
this.customTexture         = customTexture;
this.particleRotation      = particleRotation;
this.randomParticleRotation = randomParticleRotation;

// _spawnAll() でスプライト生成時に適用
const baseRot = (this.particleRotation ?? 0) * Math.PI / 180;
sprite.rotation = baseRot + (this.randomParticleRotation ? Math.random() * Math.PI * 2 : 0);
```

**設定の永続化**: `node.properties.particleRotation` / `randomParticleRotation` / `particleTextureUrl`

---

### filterWrapper アーキテクチャによる BG+フィルタ ON 時の描画崩れ修正

**症状**: BG+フィルタ: ON にするとパーティクルが加算合成されたように見え、OFF 時と描画が異なっていた。

**根本原因**: PixiJS はフィルターを掛ける際、対象コンテナの変換行列（transform）をフィルターの内部テクスチャ座標系に適用する。`scene` コンテナが `scale.y = -1`（Y 軸反転）を持っているため、`scene.filters` にフィルターを設定するとフィルターテクスチャの上下が反転し、パーティクルの合成が崩れていた。

**解決策**: `filterWrapper` コンテナを導入し、フィルターは常に Y 反転を持たないコンテナに適用する。

**コンテナ階層（修正後）**:
```
stage
├── bgColorRect        (背景色 Graphics、フィルター対象外)
└── filterWrapper      (scale なし → フィルター適用の基準コンテナ)
    ├── bgSprite       (スクリーン座標: position.set(w/2, h/2)、Y反転なし)
    └── scene          (scale.y=-1 → パーティクル座標系)
        └── particleLayer  (パーティクルのみのフィルター対象)
```

**フィルター対象の切り替え**:
```js
const target = (filterOnBg || type === "none") ? filterWrapper : particleLayer;
target.filters = [filter];
```

- BG+フィルタ ON / particle_type=none → `filterWrapper`（bgSprite＋particles 両方に効く）
- BG+フィルタ OFF + particles あり → `particleLayer`（パーティクルのみに効く）

**bgSprite の配置変更**:
- 変更前: `scene.addChildAt(bgSprite, 0)` + `bgSprite.scale.y = -1`（Y反転を相殺）
- 変更後: `filterWrapper.addChildAt(bgSprite, 0)` + `bgSprite.position.set(w/2, h/2)`（スクリーン座標で配置、Y反転不要）

---

### プレビュー縦横比の動的対応

**目的**: width / height ウィジェットの値に応じてノード内プレビューとフィルタライブラリのプレビューの縦横比を正しく表示する。

**ノード UI プレビュー**:
```js
// 変更前
const getPreviewH = () => getPreviewW();

// 変更後
const getPreviewH = () => {
  const wv = parseInt(node.widgets?.find(w => w.name === "width")?.value  ?? 512);
  const hv = parseInt(node.widgets?.find(w => w.name === "height")?.value ?? 512);
  return Math.round(getPreviewW() * hv / Math.max(1, wv));
};
```

- ノード高さも `node.size[1] = requiredH`（`!==` 判定）に変更し、横長↔縦長の切り替え時にも自動縮小するように対応

**フィルタライブラリプレビュー**:
```js
const _ratio = mainCanvas.width / mainCanvas.height;
previewCanvas.width  = _ratio >= 1 ? 320 : Math.round(320 * _ratio);
previewCanvas.height = _ratio >= 1 ? Math.round(320 / _ratio) : 320;
```

- `mainCanvas`（PixiJS オフスクリーンキャンバス）の実寸から比率を取得
- 長辺を 320px に固定し、短辺を比率で計算
- CSS `max-width:100%; max-height:calc(100% - 40px)` によりダイアログ内に自動フィット

---

## セッション 7

### フィルタライブラリ リアルタイムプレビュー

**目的**: フィルタライブラリ内でパラメーターを変更した際に、モーダルを閉じなくてもノード上のプレビューに即時反映されるようにする。

**実装**:
- `openFilterLibrary()` に `onParticlePreview` コールバックを渡す
- `filter_library.js` 側でパラメーター変更のたびに `onParticlePreview(snap)` を呼び出す
- `snap` はその時点のフィルター・テクスチャ・サイズ・広がりを含む overrides オブジェクト
- `particle_widget.js` 側の `onParticlePreview` は async 化し、新規テクスチャを `PIXI.Texture.fromURL` で即時ロードしてから `rebuildParticles(snap)` を呼び出す

```js
onParticlePreview: async (snap) => {
  if (!pixiApp) return;
  if (snap?.textures?.length) {
    await Promise.all(snap.textures.map(async item => {
      const found = customParticleTextures.find(ct => ct.url === item.url);
      if (found?.tex && !found.tex.destroyed) { item.tex = found.tex; return; }
      try { item.tex = await PIXI.Texture.fromURL(item.url); } catch(_) {}
    }));
  }
  rebuildParticles(snap);
  if (!animating) pixiApp.render();
},
```

---

### パーティクルサイズ専用化 & 広がりパラメーター追加

**目的**: サイズスライダーを純粋な大きさ変更に限定し、放出角度の広がりを独立したパラメーターとして追加する（強さは Global Strength と各エミッターの矢印長で制御）。

**変更点**:
- SparkSystem / RaySystem: 速度計算から `particleSize` を除去
- StarWarpSystem: `starStretch` を `2.0` 固定（サイズとは独立）
- `particleSpread` 状態変数を追加（デフォルト `1.0`、`node.properties.particleSpread` で永続化）
- Smoke / Spark / Ray 各システム: `(Math.random() - 0.5) * baseAngle * this.spread` で広がり倍率を適用
- `rebuildParticles(overrides)` に `_spread` オーバーライドを追加

**フィルタライブラリ「Particle」パネルに追加**:
- **Size** スライダー（1.0〜30.0）
- **Spread** スライダー（0.1〜5.0、説明テキスト付き）

---

### テクスチャ複数ファイル対応

**目的**: パーティクルテクスチャを複数登録し、パーティクル1粒ごとにランダム選択されるようにする。

**データ構造変更**:
```js
// 旧
let customParticleTextureUrl = null;
let customParticleTexture = null; // PIXI.Texture

// 新
let customParticleTextures = []; // [{url, name, tex}]
```

**追加関数**:
- `loadCustomTextures()` — 未ロードのテクスチャを一括 `PIXI.Texture.fromURL`
- `getLoadedTextures()` — 有効な `tex` のみを返す配列フィルター
- `_pickTex()` — `getLoadedTextures()` からランダム選択

**フィルタライブラリ UI 変更**:
- `<input type="file" multiple>` で複数選択可能に
- テクスチャリスト: 各アイテムに Canvas サムネイル（28×28px `drawThumb()`）+ 名前 + 削除ボタン
- 「× Default」ボタンでリスト全クリア

**バグ修正 — Apply & Close 後にデフォルトに戻る**:
- `onSave` で `customParticleTextures` を更新する際、URL が同じエントリは既存の `tex` を引き継ぐよう修正
- 修正前: 全 `tex` を null にリセット → `loadCustomTextures()` が呼ばれずテクスチャ消滅
- 修正後: `existing?.tex ?? null` で URL マッチ時に PIXI テクスチャを再利用

**バグ修正 — フィルタライブラリ内プレビューにテクスチャが反映されない**:
- 新規追加テクスチャは `customParticleTextures` に存在しないため、`overrides.textures` の `tex` が null になり `_texsArr` が null になっていた
- `onParticlePreview` の async 化（上記）で新規テクスチャをその場でロードして対応

**バグ修正 — テクスチャサムネイル非表示**:
- ComfyUI 環境では `<img src="data:...">` が描画されないケースがあった
- Canvas 2D API + `drawImage` 方式（`drawThumb()` ヘルパー）に変更
- プレースホルダー（灰色背景）を先描画し、`img.onload` で上書きする実装で表示を安定化

---

### BG+Filter:ON でフィルターが背景画像に適用されないバグ修正

**症状**: BG+Filter:ON を有効にしても、出力画像の背景部分にフィルターが適用されない。

**根本原因**: `input_images[node_id]` はサーバー起動後に Python の `render()` が一度も実行されていない状態では空（`{}`）である。そのため `loadBackgroundSprite()` が `/particle/input/{node_id}` から `{"image": null}` を受け取り早期 return し、`bgSprite` が null のまま残っていた。

`bgSprite === null` → `bgBaked = false` → Python 側が背景画像をフィルター適用外で別途合成 → フィルターがパーティクルにしか効かない。

**修正 1 — `filterOnBgBtn.onclick` の修正**（前修正）:
```js
filterOnBgBtn.onclick = async () => {
  filterOnBg = !filterOnBg;
  ...
  if (pixiApp) await loadBackgroundSprite();
  applyFilter();
  if (!animating && pixiApp) pixiApp.render();
};
```

**修正 2 — `node.onExecuted` の追加**（根本修正）:
```js
node.onExecuted = async function(data) {
  origOnExecuted?.apply(this, arguments);
  if (pixiApp && filterOnBg) {
    await loadBackgroundSprite();
    if (!animating) pixiApp.render();
    node.setDirtyCanvas(true, false);
  }
};
```

`onExecuted` は Python の `render()` 完了直後に発火するため、この時点で `input_images[node_id]` が確実に更新済みとなる。Queue Prompt 実行後に `bgSprite` が正しくロードされ、フィルターが背景画像＋パーティクル両方に適用される。

**修正 3 — `loadBackgroundSprite()` の安全化**:
- `PIXI.Texture.fromURL` を try-catch で保護（サイレントエラー防止）
- 非同期待機中に `filterWrapper` が破棄された場合のガード追加

```js
let tex;
try { tex = await PIXI.Texture.fromURL(data.image); } catch(_) { return; }
if (!filterWrapper) return;
```

**正しい使用手順**:
1. image ノードを Particle Renderer に接続
2. BG+Filter:ON を有効にする
3. ▶ Play でアニメーション開始
4. Queue Prompt を実行（Python `render()` が走り `bgSprite` がロードされる）
5. ■ Stop & Capture でキャプチャ → フィルターが背景＋パーティクル両方に適用された画像を出力

---

## セッション 8

### パーティクルブレンドモードのドロップダウン追加

**目的**: パーティクルスプライトのブレンドモードをUIから切り替えられるようにする。

**実装**:
- `currentBlendMode` 状態変数を追加（デフォルト: `"default"` = 各パーティクルタイプの標準値を使用）
- ボタン行2（BG+Filter ボタンの右隣）に `<select>` ドロップダウンを追加
- 選択肢: Default / Normal / Add / Multiply / Screen
- `applyBlendMode()` 関数を追加 — 選択されたブレンドモードをすべての既存スプライトに後から上書き適用
- `rebuildParticles()` の末尾で `applyBlendMode()` を呼び出し（`applyFilter()` の後）
- 設定は `node.properties.blendMode` で永続化・`onConfigure` で復元
- i18n: en / ja / zh に `blendMode` / `blendDefault` / `blendNormal` / `blendAdd` / `blendMultiply` / `blendScreen` キーを追加

**動作詳細**:
- `"default"` 選択時は何も上書きしない（SmokeSystem=NORMAL、Spark/Ray/StarWarp=ADD を維持）
- それ以外を選択すると `PIXI.BLEND_MODES[currentBlendMode]` を全スプライトに適用
- アニメーション再生中に変更した場合、`rebuildParticles()` が呼ばれるまで反映されないため、ドロップダウン変更時に `applyBlendMode()` と `pixiApp.render()` を直接呼び出して即時反映する

```js
function applyBlendMode() {
  if (currentBlendMode === "default" || particleSystems.length === 0) return;
  const bm = PIXI.BLEND_MODES[currentBlendMode] ?? PIXI.BLEND_MODES.NORMAL;
  for (const ps of particleSystems) {
    for (const sprite of ps.particles) sprite.blendMode = bm;
  }
}
```

---

### BG+Filter: ON 時の DropShadow / Outline 不表示バグの修正

**症状**: BG+Filter: ON の状態で DropShadow または Outline フィルターを選択しても、画面に変化が見られない。

**調査過程**:

1. 最初の仮説: `filterWrapper` に `filterArea` が設定されていないため、`scene.scale.y=-1` によるbounds計算の崩れでDropShadow/Outlineがクリップされている → `filterArea` と `padding` を設定したが改善なし

2. 次の仮説: `filterWrapper` への適用自体が問題 → ターゲットを `pixiApp.stage` に変更し、`bgColorRect` を `filterWrapper` の子に移動したが改善なし

3. **根本原因の特定**: DropShadow / Outline は「コンテンツのアルファエッジを検出して外側に描画する」タイプのフィルターである。BG+Filter: ON 時に `filterWrapper`（または `stage`）全体にこれらを適用すると、**検出されるエッジが「コンテンツ全体の外周 = キャンバスの端」** になる。背景画像がキャンバス全面を不透明に覆っている場合、外周はキャンバスの外側になり効果が完全に見えなくなる。

   一方、Glow / Bloom / KawaseBlur などの輝度系フィルターは画面上の明るいピクセルを拡散させるだけなので、全体適用でも意図通りに機能する。

**修正内容（最終）**:

Outline / DropShadow だけでなく **Glow も同様に効かない**ことが確認された。Glow も「コンテンツのアルファ境界から外向きに光を放射する」フィルターであり、不透明な背景全体に適用するとエッジがキャンバス端にしか出ないため見えなくなる。

また、「背景画像にもフィルターを効かせたい」という要件があるため、`particleLayer` と `bgSprite` に**それぞれ個別のフィルターインスタンスを適用する**方式に変更した。同一インスタンスを複数コンテナに割り当てると PixiJS の内部状態が競合するため、毎回新規インスタンスを生成する `makeFilter()` ファクトリ関数を導入した。

```js
function makeFilter() {
  switch (f) {
    case "glow": return new PF.GlowFilter({...});
    case "outline": { const fil = new PF.OutlineFilter(...); fil.padding = ...; return fil; }
    // ... 全フィルタータイプ
    default: return null;
  }
}

if (type === "none") {
  // particleLayer が空のため stage に適用
  const fil = makeFilter();
  pixiApp.stage.filters = [fil];
  pixiApp.stage.filterArea = new PIXI.Rectangle(-pad, -pad, currentW + pad*2, currentH + pad*2);
} else {
  // パーティクルレイヤーに適用（常に）
  particleLayer.filters = [makeFilter()];
  // BG+Filter: ON かつ bgSprite あり → 背景画像にも個別インスタンスで適用
  if (filterOnBg && bgSprite) {
    bgSprite.filters = [makeFilter()];
  }
}
```

**フィルター適用先まとめ（最終）**:

| 条件 | particleLayer | bgSprite |
|------|--------------|----------|
| BG+Filter: OFF、particles あり | ✓ 適用 | — |
| BG+Filter: ON、particles あり | ✓ 適用 | ✓ 適用（個別インスタンス） |
| particle_type=none | — | — （stage に適用） |

**副次的変更（stage への適用に伴うコンテナ構造変更）**:

`bgColorRect` を `pixiApp.stage` の直接の子から `filterWrapper` の最初の子に移動。これにより `stage` の直接の子は `filterWrapper` のみとなり、`stage` の bounds 計算が `scene.scale.y=-1` の影響を受けにくくなる。

```
変更前:
stage
├── bgColorRect   ← stage の直接の子
└── filterWrapper
    └── scene (scale.y=-1)

変更後:
stage              ← 子は filterWrapper のみ
└── filterWrapper
    ├── bgColorRect  ← filterWrapper の最初の子に移動
    ├── bgSprite
    └── scene (scale.y=-1)
```

---

### バグ修正: 再生ボタンを押すと bgSprite のフィルターが解除される問題

**症状**: フィルターライブラリでフィルターを設定して背景画像にプレビューできていても、▶ Play を押すと背景画像のフィルターが解除される。

**根本原因**: `playBtn.onclick` では `rebuildParticles()` → `applyFilter()` → `loadBackgroundSprite()` の順で処理されていた（`rebuildParticles()` 内部で `applyFilter()` が呼ばれるが、その時点では `bgSprite = null`）。`loadBackgroundSprite()` の完了後に `applyFilter()` が呼ばれないため、ロードされた `bgSprite` にフィルターが適用されないまま再生が開始されていた。`node.onExecuted` も同様の問題を抱えていた。

**修正**: `await loadBackgroundSprite()` の直後に `applyFilter()` を追加（`playBtn.onclick` と `node.onExecuted` の2箇所）。

```js
// playBtn.onclick
rebuildParticles();
await loadBackgroundSprite();
applyFilter();  // ← 追加: bgSprite ロード完了後にフィルターを適用
animating = true; lastTime = 0; requestAnimationFrame(animate);

// node.onExecuted
await loadBackgroundSprite();
applyFilter();  // ← 追加
if (!animating) pixiApp.render();
```

---

## セッション 9

### ボタンレイアウト再編成

**変更内容**:
- ボタン行1（上段）: `[▶ Play] [■ Stop & Capture] [✦ 全面散布]`
- ボタン行2（下段）: 左サブDiv `[🎬 Filter Library] [■ BG+Filter] [Blend Mode ▾]` + 右サブDiv `[背景色トグル] [bgColorInput]`

背景色ON/OFFボタンとカラーピッカーを、以前の上段右端から**下段右端**に移動した。

---

### 全面散布モード（Scatter Mode）

**目的**: 既存のエミッター発生点とは独立して、キャンバス全体にランダムにパーティクルを発生させるモードを追加する。

**実装**:
- `scatterMode` 状態変数（`node.properties.scatterMode` で永続化）
- 上段ボタン右端に `✦ 全面散布` トグルボタンを追加
  - ON 時: 背景色 `#8a4a8a`
  - OFF 時: 背景色 `#333344`
- `ParticleSystem` コンストラクタに `scatterMode = false` パラメーターを追加
- `_resetParticle` 内で scatterMode フラグを参照し、発生座標をオーバーライド:
  ```js
  const ox = this.scatterMode ? (Math.random() - 0.5) * this.renderer.width  : this.origin.x;
  const oy = this.scatterMode ? (Math.random() - 0.5) * this.renderer.height : this.origin.y;
  ```
  scene 座標系は中心原点・Y軸上向き（`scale.y=-1`）なので `(Math.random()-0.5)*W/H` でキャンバス全面をカバーできる

**対象システム**: `SmokeSystem`、`SparkSystem`、`RaySystem`（`StarWarpSystem` は独自の3D座標系を持つため対象外）

**設定の永続化**: `onConfigure` でワークフロー復元時に `scatterMode` を復元。`openFilterLibrary` 呼び出し時にも `scatterMode` を渡す。

---

### 背景画像の初回再生時スタレ問題の修正

**症状**: 背景画像を変更した後、1度目の ▶ Play → ■ Stop & Capture サイクルでは前の画像が表示される。

**根本原因**: `input_images[node_id]` は Python 側で `render()` が実行されたタイミングでのみ更新される。背景画像を変更しても Python `render()` が走らなければ古い画像がキャッシュされたまま。

**修正**: 再生ボタン押下時、背景画像が必要なケース（`image` 入力接続済み、かつ `filterOnBg=true` または `particle_type=none`）では `queuePrompt(0)` を先行実行し、`onExecuted` の発火を待ってから背景をロードする。

```js
if (_hasImageLink && (filterOnBg || _type === "none")) {
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 8000); // タイムアウト8秒
    const prev = node.onExecuted;
    node.onExecuted = async function(data) {
      clearTimeout(timer);
      node.onExecuted = prev;
      await prev?.apply(this, arguments);
      resolve();
    };
    app.queuePrompt(0);
  });
}
```

**`onExecuted` のトリガー条件更新**: `filterOnBg` フラグの有無に加え、`particle_type === "none"` の場合も `loadBackgroundSprite()` と `applyFilter()` を実行するよう変更。

---

### フィルタライブラリ: モーション設定の独立パネル化

**目的**: フィルタライブラリの「Particle」パネルに混在していたモーション設定（乱気流・風・渦）を独立した左パネル項目として分離する。

**変更後の左パネル構成**:
1. None / Glow / Bloom / … （フィルター一覧）
2. --- （セパレーター）
3. Particle（パーティクル設定: テクスチャ・シェイプ）
4. Parameters（既存: 速度・寿命・サイズ・広がり等）
5. **Motion**（新規: 乱気流・風・渦）← 新設

**`filter_library.js` 変更**:
- `buildParticleParamPanel()` からモーション設定セクション（turbulence / turbFreq / windX / windY / swirl）を完全に除去
- 新関数 `buildMotionPanel()` を追加 — 同スライダー群を `t("motionSettings")` ヘッダー付きで描画
- 新関数 `selectParticleMotion()` を追加 — `currentKey = "particle_motion"` をセットして `buildMotionPanel()` を呼ぶ
- `highlightList()` に `"particle_motion"` キーの処理を追加（ハイライトカラー: `#da8a4a` / `#ffccaa`）
- i18n: `particleMotionDesc`（新規）を3言語に追加

---

### フィルタライブラリ: アルファベット・数字シェイプ

**目的**: プリセットシェイプ（円、星形など）に加えて、英字・数字をパーティクルの形状として使用できるようにする。

**UI（フィルタライブラリ「Particle」パネル下部）**:
- テキストボックス（プレースホルダー: `"A,B,C,1,2,3"`）— カンマ区切りで英数字を入力（大文字・小文字可）
- **[A-Z]** ボタン — アルファベット大文字 A〜Z を自動入力
- **[0-9]** ボタン — 数字 0〜9 を自動入力
- **[Clear]** ボタン — テキストボックスをクリア

**`filter_library.js` 変更**:
- `origParticle` に `charSet: particleSettings?.charSet ?? []` を追加
- `updateCharSet()` 関数: カンマ分割→トリム→英数字フィルタ（`/^[A-Za-z0-9]$/`）→ Set による重複除去（大文字小文字を保持、`toUpperCase` なし）
  ```js
  function updateCharSet() {
    const chars = charInput.value
      .split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9]$/.test(s));
    tempParticle.charSet = [...new Set(chars)];
    notifyParticle();
  }
  ```

**`particle_widget.js` 変更**:
- `particleCharSet` 状態変数（`node.properties.particleCharSet` で永続化）
- `createParticleSystem` に `charSet=[]` パラメーターを追加し、コンストラクタの `ex` 配列経由で各システムに渡す
- `ParticleSystem` コンストラクタ: `charSet` を最後のパラメーターとして追加
  ```js
  constructor(..., scatterMode = false, charSet = []) {
    this.charSet = (charSet && charSet.length > 0) ? charSet : null;
  }
  ```
- `_pickTex(i)`: 優先チェーン `customTextures > charSet > randomShape > shapePreset`
  ```js
  if (this.charSet) {
    const ch = this.charSet[Math.floor(Math.random() * this.charSet.length)];
    return getShapeTexture(this.PIXI, `char_${ch}`);
  }
  ```
- `_drawShape()` の `default` ケース: `"char_X"` 形式のシェイプキーに対応
  ```js
  default: {
    if (shapeType && shapeType.startsWith("char_")) {
      const ch = shapeType.slice(5);
      ctx.font = "bold 52px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 32, 34);
    }
    break;
  }
  ```
  64×64 Canvas を使用し、Y方向 +2px オフセット（34px）でフォントの視覚的中心をキャンバス中央に合わせる。

**大文字・小文字の保持**: テキストボックスで入力した文字はそのままの大小でパーティクルが出現する。`_shapeTexCache` のキーは `"char_A"` / `"char_a"` のように区別され、別々のテクスチャとしてキャッシュされる。

---

### i18n 追加キー

| キー | 用途 |
|-----|------|
| `scatterModeOn` | 全面散布ボタンのラベル（ON時） |
| `scatterModeOff` | 全面散布ボタンのラベル（OFF時） |
| `scatterModeTitle` | 全面散布ボタンのツールチップ |
| `particleMotionDesc` | モーション設定パネルの説明文 |
| `charShapeLabel` | 文字シェイプのラベル |
| `charShapePlaceholder` | テキストボックスのプレースホルダー |
| `charShapeDesc` | 文字シェイプの説明文 |
| `charShapeClear` | クリアボタンのラベル |

---

### リポジトリ構造のフラット化

**変更内容**: `comfyUI-particle/` サブフォルダを廃止し、全ファイルをリポジトリルートに移動。

**変更前**:
```
comfyUI-particle-pixijs/
└── comfyUI-particle/
    ├── __init__.py
    ├── particle_node.py
    ├── DEVLOG.md
    └── web/
```

**変更後**:
```
comfyUI-particle-pixijs/
├── __init__.py
├── particle_node.py
├── DEVLOG.md
├── README.md
└── web/
```

**理由**: `ComfyUI/custom_nodes/` 直下に `git clone` した場合、ComfyUI はリポジトリルートの `__init__.py` を探す。サブフォルダに格納されていると認識されないため、ルートに配置する必要があった。

---

### バグ修正: image 入力切断後も背景画像が残り続ける問題

**症状**: ノードの `image` 入力の接続を切断しても、プレビューに背景画像が表示されたまま残る。

**根本原因**: `image` 入力の接続変更を検知するフックが存在せず、切断時に `bgSprite` を除去するトリガーがなかった。`loadBackgroundSprite()` は Play ボタン・BG+Filter トグル・`onExecuted` の3箇所でのみ呼ばれるため、単純な切断操作では実行されない。

**修正**: `onConnectionsChange` フックを追加し、`image` スロットが切断されたタイミングで即座に `bgSprite` を `destroy()` して除去する。

```js
node.onConnectionsChange = function(type, slotIndex, isConnected) {
  origOnConnectionsChange?.apply(this, arguments);
  if (type === 1 && !isConnected && node.inputs?.[slotIndex]?.name === "image") {
    if (bgSprite && filterWrapper) {
      filterWrapper.removeChild(bgSprite);
      bgSprite.destroy();
      bgSprite = null;
    }
    if (pixiApp && !animating) pixiApp.render();
    node.setDirtyCanvas(true, false);
  }
};
```

- `type === 1`: 入力スロットの変更
- `!isConnected`: 切断イベント
- `node.inputs?.[slotIndex]?.name === "image"`: image スロットの特定

---

### 文字シェイプに記号を追加（48記号対応）

**目的**: 既存の英数字シェイプに加えて、記号文字をパーティクルシェイプとして使用できるようにする。

**追加内容**:

`[!?#:]` ボタンを `[0-9]` の右隣に追加。クリックすると以下の48記号をテキストボックスに一括設定する。

| 種類 | 記号 |
|------|------|
| ASCII記号（31） | `! " # $ % & ' ( ) * + - . / : ; < = > ? @ [ \ ] ^ _ ` { \| } ~` |
| Unicode記号（17） | `★ ☆ ♪ ♥ ♦ ♣ ♠ → ← ↑ ↓ ≠ ≤ ≥ ± ∞ ×` |

※ カンマはセパレーターとして使用しているため除外。

**`filter_library.js` 変更**:
- `SYMBOL_SET` 定数（配列 → `.join(",")` でカンマ区切り文字列）を定義
- `charSymBtn` ボタンを追加
- `updateCharSet()` のフィルター正規表現を拡張:
  ```js
  // 変更前: 英数字のみ
  .filter(s => /^[A-Za-z0-9]$/.test(s));
  // 変更後: 制御文字・空白・カンマ以外の任意の1文字
  .filter(s => s.length === 1 && /^[^\x00-\x1F\x7F\s,]$/.test(s));
  ```
  これによりテキストボックスへの直接入力でも記号・Unicodeを使用可能になった。

**`i18n.js` 変更**:
- `charShapeSymbols: "[!?#:]"` を en/ja/zh に追加
- `charShapePlaceholder` を `"例: A,B,C,1,2,3,!,★"` に更新（記号対応を示す）

---

## セッション 10

### バグ修正: ブレンドモード変更後に再生すると半透明になる問題

**症状**: ブレンドモードを変更して ▶ Play を押すと、停止状態では不透明だったパーティクルが再生中に半透明になる。

**根本原因**: `_spawnAll`（初期化時）は `alpha = 1.0`（デフォルト引数）でスプライトを設定する。一方、各システムの `update` は毎フレームハードコードされた別のalpha値で `_setColorAndAlpha` を呼び出していた。

| システム | `_spawnAll` 時のalpha | `update` 時のalpha |
|---|---|---|
| SmokeSystem | 1.0 | 0.35 |
| SparkSystem | 1.0 | 0.9 |
| RaySystem   | 1.0 | 0.8 × (1 - t) |

この不一致により「停止状態=不透明、再生中=半透明」という見た目の変化が生じていた。ブレンドモードの設定値に関わらず再現する。

**修正**:

1. `ParticleSystem` 基底クラスに `_getAlpha(t)` メソッドを追加（デフォルト `1.0`）
2. `SmokeSystem`・`SparkSystem`・`RaySystem` それぞれで `_getAlpha` をオーバーライド
3. `_spawnAll` でのalpha設定を `this._getAlpha(t0)` に変更
4. 各 `update` 内のハードコード値も `this._getAlpha(t)` に置き換え

```js
// ParticleSystem 基底クラス
_getAlpha(t) { return 1.0; }

// _spawnAll 内
const t0 = this.ages[i] / (this.lifetimes[i] || 1);
this._setColorAndAlpha(i, t0, this._getAlpha(t0));

// SmokeSystem
_getAlpha(_t) { return 0.35; }

// SparkSystem
_getAlpha(_t) { return 0.9; }

// RaySystem
_getAlpha(t) { return 0.8 * (1 - t); }
```

これにより停止状態・再生状態でalphaが一致し、ブレンドモードの効果が再生前後で同じ見た目になる。

---

### バグ修正: BG+フィルタ ON/OFF が効かなくなる問題

**症状**: BG+フィルタ のON/OFFを切り替えると、稀に操作が無効になり、ブラウザのハードリセットが必要になる。

**根本原因**: 競合状態（Race Condition）。`loadBackgroundSprite()` は非同期関数（fetch → `PIXI.Texture.fromURL`）のため、複数のトリガー（ボタン連打、playBtn + onExecuted の同時発火など）により並行して呼び出されると、以下の問題が発生していた。

1. 呼び出しA: bgSpriteをdestroyして後続処理を待機中
2. 呼び出しB: bgSpriteがnullのためdestroyをスキップして後続処理を待機中
3. Aが先に完了 → `filterWrapper.addChildAt(bgSprite①, 0)`
4. Bが完了 → `filterWrapper.addChildAt(bgSprite②, 0)`
5. **filterWrapper内にbgSpriteが2つ存在する状態になる**

次回 `loadBackgroundSprite()` が呼ばれると `bgSprite`（②）のみを`destroy()`するが、①がfilterWrapper内に残り続ける。ON/OFFを繰り返すたびに累積し、最終的には背景の制御が完全に失われる。

**修正**:

1. `_bgLoadToken` カウンター変数を追加
2. `loadBackgroundSprite()` 呼び出し時に filterWrapper の子を走査し、`scene` と `bgColorRect` 以外（＝余分なbgSprite）を全て除去
3. fetch・テクスチャロード完了後にトークンを照合し、新しい呼び出しに上書きされた場合は結果を破棄

```js
let _bgLoadToken = 0;

async function loadBackgroundSprite() {
  // filterWrapper 内の余分な bgSprite を全て除去
  if (filterWrapper) {
    const stale = filterWrapper.children.filter(c => c !== scene && c !== bgColorRect);
    for (const s of stale) { filterWrapper.removeChild(s); s.destroy(); }
  }
  bgSprite = null;

  const token = ++_bgLoadToken;
  ...
  await fetch(...);
  if (token !== _bgLoadToken) return; // 新しいロードが開始されていたら破棄
  ...
  await PIXI.Texture.fromURL(data.image);
  if (token !== _bgLoadToken) return; // テクスチャロード中に上書きされた場合も破棄
  ...
  filterWrapper.addChildAt(bgSprite, 0);
}
```

これにより複数の並行呼び出しが発生しても、最新の呼び出しの結果のみが反映される。
