# fps-game v8.5（2026-09-06）

## 需求（用户原话）
1. 游戏结束画面显示结算：各种敌人击杀数、爆头率、命中率、历史最高分排名
2. 猪头佳激光改成与地面呈 20 度角
3. 删除巨石模型（boulder.js）
4. 增加巨大椰子树模型（精美，大中小三种，随机分布替代巨石）
5. 自动拾取枪但不切换，只加对应枪子弹

## 实施
- **结算画面**：showStatsScreen()（击杀数/爆头率/命中率/总击杀 + 历史最高分前5）；loadHighscores/saveHighscores（localStorage 'fps_highscores'）；统计变量 killCounts/headshotCount/shotsFired/shotsHit；onEnemyKilled/onBossKilled/onHelicopterKilled 计数 + tryShoot 射击/命中/爆头统计；死亡/通关/核弹死亡改用 showStatsScreen；resetGame 清零
- **猪激光 20 度**：pig.js LASER_PITCH_MIN/MAX = 20/20（固定，不再动态扫射）
- **椰子树替代巨石**：models/coconut.js（微弯棕榈树干3段+放射状下垂棕榈叶9片+挂果椰子+嫩芽，大中小 variant）；index.html script boulder→coconut；scene-layout.js boulder 生成→coconut 生成（4~7 只 variant large/medium/small）
- **自动拾取枪**：player.ammoPool 分枪备弹；switchGun 保存/恢复 ammoPool；applyPickup weapon 分支不 switchGun，给对应枪加备弹

## 测试（test_v85.py 13/13 通过）
- pigLaserPitchSweepTest(20°)、coconutTest(4~7 无 boulder)、gunPickupTest(不切换+sniper 20→25)、statsTest
- 回归全过
- 踩坑：gunPickupTest 初始 ammoPool.sniper 满 40 会钳制 → 设 20；pigTriggerTest 要放最前（激光测试创建猪）

## 发布
- commit 待 push；README 履历 v8.5 已加