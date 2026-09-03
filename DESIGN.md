# 程序化 FPS 射击游戏 — 设计文档（v2）

## 1. 目标
- 双击 `index.html` 即玩（file:// 协议，无服务器、无构建、无安装）
- 主程序 = 单个 HTML 文件：核心逻辑、主循环、玩家移动/射击、光影、调试模式、HUD、错误面板、音效
- 所有模型程序化生成（无外部美术资源），每个模型一个独立 JS 文件
- 场景布局独立文件，主程序按布局加载模型与位置/旋转/缩放/碰撞
- 健壮性：任何模块加载失败不崩主程序，错误面板显示 + 占位模型兜底
- 敌人 AI/动画/子弹全部封装在 `models/enemy.js`，主程序只通过通用 `update` 接口驱动

## 2. 关键技术决策

### 2.1 file:// 下的加载策略（最重要）
浏览器在 file:// 下会拦截 `<script type="module">`（CORS）与 `fetch()` 本地文件（CORS）。因此：
- 所有分离文件用**经典 `<script src>`** 引入，挂 `window` 全局
- 模型文件统一接口：
  ```js
  (function (global) {
    global.MODELS = global.MODELS || {};
    global.MODELS.enemy = {
      name: 'enemy',
      create: function (config, ctx) { /* 返回 THREE.Group */ },
      update: function (inst, dt, ctx) { /* 可选：每帧 */ },
      onHit: function (inst, point, ctx) { /* 可选：被玩家射击命中，返回 true=爆头 */ }
    };
  })(window);
  ```
- 主程序是**通用加载器**：遍历 `SCENE_LAYOUT.entities` → `MODELS[model].create(config, ctx)` → 应用 transform → 每帧调用 `update`。主程序不知道也不关心敌人内部逻辑。

### 2.2 实体-主程序交互接口
`ctx`（主程序构造，传给 create/update/onHit）：
```js
ctx = {
  THREE, scene, camera, player, sfx, hitPlayer,
  shootDamage,        // 玩家当前武器基础伤害（敌人爆头用）
  currentDamage,      // 单次射击的实际伤害（onHit 时）
  playerRadius, playerHeight, // 玩家碰撞体参数（敌人子弹命中判定用）
  time, spawnPos,
  spawnTracer(from, to, color),  // 曳光弹特效（敌人发射也调用）
  spawnSparks(point, color),     // 命中火花特效
  onEnemyKilled(pos)             // 敌人死亡回调（主程序计击杀/掉武器）
}
```

### 2.3 three.js 版本
- **r147 UMD 版**（`three.min.js`，最后一个带经典 script 构建的稳定版），本地化（约 600KB）
- 缺失时回退 CDN：`<script>` onerror 动态注入 jsdelivr URL

### 2.4 目录结构
```
fps-game/
  index.html        主程序（全部核心逻辑内联）
  three.min.js      three.js UMD 本地库
  scene-layout.js   场景布局（90×90 大地图）
  models/
    gun.js          第一人称枪械（4 种武器外观 + 后坐力）
    enemy.js        敌人机器人（持枪 AI + 动画 + 子弹 + 爆头判定）
    weapon.js       武器拾取物（随机掉落）
    building.js     程序化建筑（房屋/仓库）
    tree.js         程序化树木
    crate.js        箱子（碰撞）
    wall.js         墙板（碰撞）
    floor.js        地板（程序化网格纹理）
    target.js       射击靶（纯分数）
    pickup.js       拾取物（血包/弹药）
    sky.js          天空盒（程序化渐变天空）
    lamp.js         灯柱（点光源）
    obstacle.js     障碍物（油桶/柱子）
    spawner.js      刷怪点（发光环）
```

## 3. 玩法系统（v2 新增）
- **多武器**：手枪/步枪/霰弹枪/狙击枪，各自伤害/射速/弹匣/换弹/射程/散射不同；数字键 1-4 切换；场景固定掉落 + 敌人死亡 25% 掉落
- **爆头**：命中点高于敌人头部 → 伤害 ×3，HUD 爆头提示 + 专属音效
- **弹道/击中特效**：玩家与敌人曳光弹、发光长条子弹、命中火花 + 扩散环、命中标记
- **枪械后坐力**：射击时枪身后坐/上扬/侧偏 + 枪口闪光脉冲，按武器类型力度不同
- **关卡任务**：5 关递增（击杀 10→42），每关敌人数量/血量/伤害递增；任务完成按 E 或自动进入下一关，进关回血补弹
- **玩家命中判定**：敌人子弹对玩家用圆柱体判定（水平距离 + 高度范围），修复旧版只比对脚底的 bug

## 4. 主程序职责划分
1. 加载引导：script 引入 + onerror；window.onerror 全局捕获
2. 渲染器/场景/相机：WebGLRenderer(antialias, shadows)、PerspectiveCamera、fog、sky
3. 场景构建：读 SCENE_LAYOUT → 实例化 → 灯光 → 碰撞盒（AABB）
4. 玩家：Pointer Lock 视角、WASD、Shift 冲刺、Space 跳、重力、AABB 碰撞
5. 射击：raycast + 多弹丸散射 + 伤害/分数/爆头 + 曳光/火花/枪口闪光
6. 实体循环：update 每帧调用（enemy AI 全在模型文件）
7. 光影：方向光阴影、环境光、雾、枪口闪光点光源、灯柱点光源
8. 调试模式：**F9** 切换（避开浏览器 F3 快捷键）；重力=0、无碰撞、W/S 沿镜头朝向自由飞行、A/D 左右、Space 上、Ctrl 下
9. HUD：准星、血量、弹药、当前武器、关卡任务进度、分数、FPS、错误面板
10. 音效：WebAudio 程序化生成（不同武器不同枪声；命中/爆头/拾取/换弹/受伤/关卡完成），无外部文件
11. 主循环：requestAnimationFrame，delta 钳制，每帧 try/catch

## 5. 健壮性设计
- 每个 `<script src>` 带 onerror → 错误面板「模型加载失败: xxx.js」
- 主程序校验 SCENE_LAYOUT 引用的模型名是否存在于 `window.MODELS`；缺失 → 半透明红 Box 兜底 + 错误面板，游戏继续
- `window.onerror` / `unhandledrejection` → 错误面板追加
- scene-layout.js 失败 → 内置默认迷你场景兜底
- 实体 update 单独 try/catch，单实体报错不影响其他实体

## 6. 操作键位
- 点击画面锁定鼠标；Esc 解锁暂停
- W/A/S/D 移动，Shift 冲刺，Space 跳
- 鼠标左键射击（可按住连发），R 换弹
- 1-4 切换武器；E 关卡完成进入下一关；F9 调试模式
- HUD：左上关卡任务/血量/武器弹药/分数，右上 FPS，中央准星，底部错误栏

## 7. 默认测试场景
- 90×90 地板 + 四周围墙 + 天空 + 雾
- 8 栋建筑 + 15 棵树 + 箱子/油桶/灯柱掩体
- 3 个初始敌人（每关递增），射击靶，刷怪点
- 血包/弹药拾取物 + 3 把固定武器掉落
- 玩家出生点 (0, 1.6, 14)
