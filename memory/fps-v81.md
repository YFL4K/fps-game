# fps-game v8.1（2026-09-06）

## 需求（用户原话）
1. 空中支援道具由数量上限 1、不重复累计，改为数量上限 3
2. 优化游戏贴图穿模问题 + 优化运行性能

## 实施
- **空中支援上限 1→3**：
  - 新增 `var AIR_MAX = 3;` 和 `function airCount() { return (walkie?1:0) + (walkieBonus||0); }`
  - checkScoreMilestone：`airCount() < 3` 时 walkieBonus++（累计到 3），否则只回血
  - spawnWalkieDrop：`airCount() >= 3` 时不掉落
  - applyPickup walkie：可重复拾取——首个对讲机 walkie=true，再捡 walkieBonus++（共最多 3）
  - BOSS 掉落 toast 判定 `canDrop = airCount() < 3`
- **穿模扩展**：collideBigEntities 从 pig/boss 扩展到所有敌人（human/monster/spider/pig/boss），排除直升机；加 5 米距离预过滤
- **性能优化**：`_tmpColor` 复用（flame 每帧变色）、爆炸火球/内焰/冲击环共享几何、烟雾共享 Sphere(1,6,6)+scale、火花冲击环 Ring 缓存

## 测试（test_v81.py 13/13 通过）
- awardMilestoneTest：bonus 0→1→1→3→3（累计到 3 封顶）、useAirSupport 后 -1
- itemCapTest：air bonus 1→2→3→3 封顶、满 3 不重复掉落、核弹仍上限 1
- 回归：gunClip/mushroom/pigTrigger/enemyHealth/shield/gunStats/bossStats/collideBig/perf 全过

## 发布
- commit b15d36e「v8.1: air-support cap 1->3 + enemy no-clip extended + perf (shared geo/color)」push 成功
- README 履历 v8.1 已加；线上 GitHub Pages 待验证 versionTag=v8.1