# fps-game v7.6（2026-09-06）

## 需求（用户原话）
1. 猪头佳血量再提升 200%：4000 → 12000
2. BOSS 机甲血量再提升 200%：7500 → 22500
3. 每击杀一名敌人，护盾效果持续时间从 +2 秒 → +0.5 秒（60 秒上限不变）
4. 所有 BGM 音量加大 50%：master 增益 0.16 → 0.24

## 实施
- `index.html` spawnPig `health: 4000 → 12000`；spawnBoss `health: 7500 → 22500`
- 护盾击杀续时：`onEnemyKilled` 内 `Math.min(60, shieldTime + 2)` → `+ 0.5`
- BGM：`bgm.masterVol = 0.24`（原硬编码 0.16），`init()` 与 `setMuted(false)` 恢复均改用 masterVol
- UI 文案同步：help 面板 & applyShield toast 「击杀 +0.5 秒」；versionTag → v7.6

## 测试（test_v76.py 10/10 通过）
- 更新 enemyHealthTest 断言 pig 12000 / boss 22500（BOSS 钩子构建值同步 22500）
- 新增 shieldKillTest：30→30.5（+0.5）、59.9→60（上限）；内部保护 levelKills=0 防触发过关
- 新增 bgmVolumeTest：masterVol 0.24、pct 150%、实际 gain 0.24
- 回归：pigTrigger / gatlingModel / berserk / pigLaserPitchSweep / pigLaserEnemy
- **坑1**：v6.9 旧 shieldKillTest（`{before, after}`）在文件后部覆盖新钩子 → 需替换旧定义 & 删重复
- **坑2**：pigTriggerTest 断言 `before === false`，激光测试创建的猪仍存活会污染 → 测试顺序必须 pigTrigger 在激光测试之前（与 v7.5 一致）
- **坑3**：`var bgm` 是局部变量，钩子里不可用 `window.bgm`；钩子内 `window.bgm = window.bgm || bgm` 暴露

## 发布
- commit cc90b08「v7.6: pig 12000(+200%) boss 22500(+200%) shield +0.5s/kill bgm +50%」push 成功
- README 更新履历 v7.6 已加；线上 GitHub Pages 验证 versionTag=v7.6（部署后 1~2 分钟）

## 当前数值口径
- 血量：直升机 750 / 猪头佳 12000 / BOSS 机甲 22500 / 普通人类 60 / monster 90
- 护盾：30 秒减伤 90%，击杀 +0.5 秒（上限 60），20% 掉落（v7.1 表）