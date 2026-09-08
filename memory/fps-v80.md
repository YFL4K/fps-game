# fps-game v8.0（2026-09-06）

## 需求（用户原话）
1. 枪械残缺 bug 依然存在，要确保常规状态和右键瞄准状态枪外形显示都正常
2. 增加蘑菇模型（不同尺寸、不同颜色），地图随机生成，提升美感

## 根因（这次才是真正的）
v7.9 只修了「枪托 z>0 在相机后方」，但残缺的真正根因是：
- 枪挂在 camera 下，**未关 material.depthTest** → 被近处场景物体（墙/箱子/地面）深度遮挡 → 部分部件"消失"
- **未关 frustumCulled** → 相机移动时枪模 bounding 与 matrixWorld 更新时序不一致，被视锥剔除误裁
- **未设 renderOrder** → 渲染顺序不保证置顶

## 修复
- buildGun 的 gunInst.traverse 加 FPS 枪模标准三件套：
  - `o.frustumCulled = false`
  - `o.material.depthTest = false`
  - `o.renderOrder = 999`
- gun.js：basePos.y 上抬 0.04（pistol -0.2→-0.15 等），手枪握把高度 0.15→0.11，避免常规 FOV75 下握把出屏（NDC y=-1.16 → 0）

## 蘑菇
- 新建 models/mushroom.js：菌柄(微锥圆柱)+菌盖(半球菌)，9 配色（红/毒蝇伞/棕/橙/紫/青/黄/粉/白），红/毒蝇伞/粉可带白斑
- scene-layout.js：每关随机 6~12 只，scale 0.4~1.6，不碰撞
- index.html 加 script 标签；versionTag v8.0

## 测试（test_v80.py 12/12 通过）
- gunClipTest 重写：**用 buildGun 真实产物**验证三件套（depthTest/frustum/renderOrder 全部 = mesh 数）+ hip FOV75 NDC 完整(bad=0) + aim 相机前方(behind=0)
- 关键认知：**瞄准 aim 时枪模 NDC 出屏是正常 ADS 表现**（狙击开镜 scopeLens 直接隐藏枪模、非狙击枪模下移放大），故 aim 只验证 behind=0，不要求 NDC 全在视锥内——否则会误报
- mushroomTest：6~12 只、多配色、多尺寸
- 回归全过

## 踩坑
- 测试直接 `MODELS.gun.create()` 新枪**不会经过 buildGun**，三件套全 0 → 必须改用 buildGun 产物验证
- `camera`/`gunInst`/`entities`/`renderer` 都是闭包变量，页面 evaluate 不可见，必须走 __fpsTest 钩子

## 发布
- commit 4eb09c1「v8.0: gun clipping fixed (depthTest+frustumCulled+renderOrder) + mushroom decor」push 成功
- README 履历 v8.0 已加