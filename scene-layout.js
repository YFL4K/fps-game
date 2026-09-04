/**
 * scene-layout.js — 场景布局文件（v3：大地图 + 建筑/植被/车辆/台阶/爆炸物）
 * 记录场景中所有元素的坐标/位置/旋转/缩放/碰撞等信息。
 * 主程序通过 window.SCENE_LAYOUT 加载模型并确定模型位置。
 *
 * 约定：
 * - position: [x, y, z]  模型中心（或底部，见各模型注释）坐标
 * - rotation: [x, y, z]  弧度（默认 [0,0,0]）
 * - scale:    [x, y, z]  缩放（默认 [1,1,1]）
 * - collision: true 参与玩家碰撞（主程序用 AABB 推挤 + 低台阶可踩踏）
 * - model 对应的文件: models/<model>.js，注册在 window.MODELS
 * - 敌人不再在布局中静态放置：由主程序按关卡波次随机生成（回车开始后才出现）
 */
window.SCENE_LAYOUT = {
  version: 3,

  playerSpawn: {
    position: [0, 1.6, 14],
    yaw: 0        // 初始朝向：朝 -Z（面向北方敌人区）
  },

  world: {
    fogColor: 0x9db4cc,
    fogNear: 35,
    fogFar: 150,
    gravity: -22,
    playerSpeed: 6,
    sprintSpeed: 9,
    jumpSpeed: 8,
    eyeHeight: 1.6,
    playerRadius: 0.4,
    playerHeight: 1.7,
    maxHealth: 100
  },

  lights: [
    { type: 'ambient', color: 0x8899bb, intensity: 0.55 },
    { type: 'directional', color: 0xfff0dd, intensity: 1.15, position: [25, 40, 15], shadow: true }
  ],

  entities: [
    // ---- 天空 & 地板（floor 默认 40x40，scale 2.5 → 100x100） ----
    { id: 'sky-1', model: 'sky', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'floor-1', model: 'floor', position: [0, 0, 0], rotation: [0, 0, 0], scale: [2.5, 1, 2.5], collision: false },

    // ---- 四面围墙（wall 默认 8x4x0.5，scale.x=11.5 → 92 宽，围出 90x90 场地） ----
    { id: 'wall-n', model: 'wall', position: [0, 0, -45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-s', model: 'wall', position: [0, 0, 45], rotation: [0, 0, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-e', model: 'wall', position: [45, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true },
    { id: 'wall-w', model: 'wall', position: [-45, 0, 0], rotation: [0, -Math.PI / 2, 0], scale: [11.5, 1, 1], collision: true },

    // ---- 建筑（小屋，w/d/h 控制尺寸） ----
    { id: 'build-1', model: 'building', position: [18, 0, -14], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true, w: 6, d: 6, h: 3.6, color: 0x9aa7b8, roofColor: 0x5d4a3a },
    { id: 'build-2', model: 'building', position: [-20, 0, -10], rotation: [0, -0.4, 0], scale: [1, 1, 1], collision: true, w: 8, d: 6, h: 4.0, color: 0xa89070, roofColor: 0x6b4a2f },
    { id: 'build-3', model: 'building', position: [24, 0, 12], rotation: [0, 0.8, 0], scale: [1, 1, 1], collision: true, w: 7, d: 5, h: 3.8, color: 0x8d9bb0, roofColor: 0x4a5568 },
    { id: 'build-4', model: 'building', position: [-26, 0, 16], rotation: [0, -0.9, 0], scale: [1, 1, 1], collision: true, w: 6, d: 7, h: 3.4, color: 0xb0a48a, roofColor: 0x5d4a3a },
    { id: 'build-5', model: 'building', position: [10, 0, 28], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true, w: 5, d: 5, h: 3.2, color: 0x7c8a9e, roofColor: 0x4a5568 },
    { id: 'build-6', model: 'building', position: [-14, 0, 30], rotation: [0, -0.15, 0], scale: [1, 1, 1], collision: true, w: 7, d: 5, h: 3.6, color: 0xa58a68, roofColor: 0x6b4a2f },
    { id: 'build-7', model: 'building', position: [34, 0, -26], rotation: [0, 0.5, 0], scale: [1, 1, 1], collision: true, w: 8, d: 6, h: 4.2, color: 0x93a3b8, roofColor: 0x5d4a3a },
    { id: 'build-8', model: 'building', position: [-36, 0, -28], rotation: [0, -0.6, 0], scale: [1, 1, 1], collision: true, w: 6, d: 8, h: 3.8, color: 0xb2a088, roofColor: 0x4a5568 },

    // ---- 车辆（可破坏） ----
    { id: 'vehicle-1', model: 'vehicle', position: [0, 0, 6], rotation: [0, 0.4, 0], scale: [1, 1, 1], collision: true, variant: 'car', color: 0x2b6cb0 },
    { id: 'vehicle-2', model: 'vehicle', position: [-30, 0, -14], rotation: [0, 0.9, 0], scale: [1, 1, 1], collision: true, variant: 'truck', color: 0x8b6f47 },
    { id: 'vehicle-3', model: 'vehicle', position: [33, 0, 8], rotation: [0, -0.6, 0], scale: [1, 1, 1], collision: true, variant: 'jeep', color: 0x4a5d3a },
    { id: 'vehicle-4', model: 'vehicle', position: [-10, 0, 24], rotation: [0, 1.2, 0], scale: [1, 1, 1], collision: true, variant: 'car', color: 0xb03a2e },

    // ---- 台阶（低台阶 0.28 高，可逐级踩踏；position.y = 顶面高度 - 0.14） ----
    // 楼梯 A：从 z=-15.2 向 -z 上行，宽 4
    { id: 'step-a1', model: 'step', position: [-8, 0.14, -15.2], rotation: [0, 0, 0], scale: [4, 1, 1], collision: true },
    { id: 'step-a2', model: 'step', position: [-8, 0.42, -16.8], rotation: [0, 0, 0], scale: [4, 1, 1], collision: true },
    { id: 'step-a3', model: 'step', position: [-8, 0.70, -18.4], rotation: [0, 0, 0], scale: [4, 1, 1], collision: true },
    { id: 'step-a4', model: 'step', position: [-8, 0.98, -20.0], rotation: [0, 0, 0], scale: [4, 1, 1], collision: true },
    // 楼梯 B：从 z=16 向 +z 上行，宽 5
    { id: 'step-b1', model: 'step', position: [20, 0.14, 16.0], rotation: [0, 0, 0], scale: [5, 1, 1], collision: true },
    { id: 'step-b2', model: 'step', position: [20, 0.42, 17.6], rotation: [0, 0, 0], scale: [5, 1, 1], collision: true },
    { id: 'step-b3', model: 'step', position: [20, 0.70, 19.2], rotation: [0, 0, 0], scale: [5, 1, 1], collision: true },
    { id: 'step-b4', model: 'step', position: [20, 0.98, 20.8], rotation: [0, 0, 0], scale: [5, 1, 1], collision: true },

    // ---- 树木（点缀场地） ----
    { id: 'tree-1', model: 'tree', position: [6, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-2', model: 'tree', position: [-7, 0, 5], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], collision: true },
    { id: 'tree-3', model: 'tree', position: [9, 0, -6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-4', model: 'tree', position: [-9, 0, -8], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9], collision: true },
    { id: 'tree-5', model: 'tree', position: [12, 0, 18], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-6', model: 'tree', position: [-13, 0, 20], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-7', model: 'tree', position: [16, 0, -20], rotation: [0, 0, 0], scale: [1.3, 1.3, 1.3], collision: true },
    { id: 'tree-8', model: 'tree', position: [-18, 0, -22], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-9', model: 'tree', position: [28, 0, 4], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-10', model: 'tree', position: [-28, 0, 2], rotation: [0, 0, 0], scale: [0.9, 0.9, 0.9], collision: true },
    { id: 'tree-11', model: 'tree', position: [4, 0, 34], rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], collision: true },
    { id: 'tree-12', model: 'tree', position: [-6, 0, -30], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-13', model: 'tree', position: [30, 0, 24], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'tree-14', model: 'tree', position: [-32, 0, -6], rotation: [0, 0, 0], scale: [1.1, 1.1, 1.1], collision: true },
    { id: 'tree-15', model: 'tree', position: [22, 0, -32], rotation: [0, 0, 0], scale: [0.8, 0.8, 0.8], collision: true },

    // ---- 可爆炸油桶（击中 → 大范围爆炸 + 连环引爆） ----
    { id: 'barrel-1', model: 'barrel', position: [6, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-2', model: 'barrel', position: [-6, 0, -6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-3', model: 'barrel', position: [2, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-4', model: 'barrel', position: [10, 0, 6], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-5', model: 'barrel', position: [-10, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-6', model: 'barrel', position: [15, 0, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-7', model: 'barrel', position: [-15, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'barrel-8', model: 'barrel', position: [0, 0, 12], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    // ---- 可爆炸 TNT（更强） ----
    { id: 'tnt-1', model: 'tnt', position: [-2, 0, 10], rotation: [0, 0.4, 0], scale: [1, 1, 1], collision: true },
    { id: 'tnt-2', model: 'tnt', position: [22, 0, -22], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'tnt-3', model: 'tnt', position: [-24, 0, 20], rotation: [0, 0.8, 0], scale: [1, 1, 1], collision: true },
    { id: 'tnt-4', model: 'tnt', position: [8, 0, -26], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true },

    // ---- 木箱掩体（crate 1x1x1，position.y=0.5 放地面，可破坏） ----
    { id: 'crate-1', model: 'crate', position: [3, 0.5, -2], rotation: [0, 0.5, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-2', model: 'crate', position: [4.6, 0.5, -1.5], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-3', model: 'crate', position: [-3, 0.5, -3], rotation: [0, 0.8, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-4', model: 'crate', position: [0, 0.5, -5], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-5', model: 'crate', position: [1.5, 1.5, -4.5], rotation: [0, 0.4, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-6', model: 'crate', position: [3, 1.5, -3.2], rotation: [0, -0.2, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-7', model: 'crate', position: [8, 0.5, 4], rotation: [0, 0.6, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-8', model: 'crate', position: [-8, 0.5, 3], rotation: [0, -0.4, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-9', model: 'crate', position: [11, 0.5, -10], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-10', model: 'crate', position: [-12, 0.5, -9], rotation: [0, -0.7, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-11', model: 'crate', position: [6, 0.5, -14], rotation: [0, 0.2, 0], scale: [1, 1, 1], collision: true },
    { id: 'crate-12', model: 'crate', position: [-5, 0.5, -16], rotation: [0, -0.5, 0], scale: [1, 1, 1], collision: true },

    // ---- 灯柱（自带点光源） ----
    { id: 'lamp-1', model: 'lamp', position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-2', model: 'lamp', position: [-8, 0, 7], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-3', model: 'lamp', position: [5, 0, -9], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-4', model: 'lamp', position: [-5, 0, -10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-5', model: 'lamp', position: [16, 0, 10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-6', model: 'lamp', position: [-16, 0, 12], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-7', model: 'lamp', position: [12, 0, -16], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },
    { id: 'lamp-8', model: 'lamp', position: [-12, 0, -18], rotation: [0, 0, 0], scale: [1, 1, 1], collision: true },

    // ---- 射击靶 ----
    { id: 'target-1', model: 'target', position: [0, 0, -10], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, score: 50 },
    { id: 'target-2', model: 'target', position: [-8, 0, -12], rotation: [0, 0.3, 0], scale: [1, 1, 1], collision: false, score: 50 },
    { id: 'target-3', model: 'target', position: [10, 0, -12], rotation: [0, -0.3, 0], scale: [1, 1, 1], collision: false, score: 50 },

    // ---- 拾取物（kind: health/ammo/weapon；拾取后按 respawn 秒重生） ----
    { id: 'pickup-health-1', model: 'pickup', position: [1, 0.8, -3], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'health', respawn: 15 },
    { id: 'pickup-ammo-1', model: 'pickup', position: [-2, 0.8, -4], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },
    { id: 'pickup-health-2', model: 'pickup', position: [6, 0.8, 2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'health', respawn: 15 },
    { id: 'pickup-ammo-2', model: 'pickup', position: [-6, 0.8, 0], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },
    { id: 'pickup-ammo-3', model: 'pickup', position: [0, 0.8, -8], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'ammo', respawn: 15 },

    // ---- 武器掉落（可直接拾取新枪） ----
    { id: 'weapon-drop-1', model: 'weapon', position: [14, 0.8, 2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'rifle', respawn: 25 },
    { id: 'weapon-drop-2', model: 'weapon', position: [-14, 0.8, -2], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'shotgun', respawn: 25 },
    { id: 'weapon-drop-3', model: 'weapon', position: [0, 0.8, -20], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false, kind: 'weapon', type: 'sniper', respawn: 25 },

    // ---- 刷怪点（装饰性发光传送门） ----
    { id: 'spawner-1', model: 'spawner', position: [-18, 0, -22], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false },
    { id: 'spawner-2', model: 'spawner', position: [18, 0, -24], rotation: [0, 0, 0], scale: [1, 1, 1], collision: false }
  ]
};
