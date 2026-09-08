# fps-game v8.2（2026-09-06）

## 需求（用户原话）
1. 猪头佳生命值再提升 2 倍；超时自爆爆炸范围和伤害也再提升 2 倍
2. 猪头佳地面激光不能固定角度，俯角 35°~75° 动态变化
3. 所有武器增加双手持枪画面（含换弹，CS 风格）

## 实施
- **猪强化**：spawnPig health 12000→24000；onPigSelfDestruct 爆炸 explode(p,10,130)→(20,260)，对玩家范围伤害 5+15*(1-d/14)→10+30*(1-d/28)（范围 14→28）
- **激光俯角**：pig.js LASER_PITCH_MIN/MAX 30/50→35/75（动态 sin 摆动逻辑不变）
- **双手持枪**：gun.js 新增 buildHands()——右手(握把)+左手(护木)，每把枪不同握持位；前臂+拳 box 肤色材质，手部 mesh 标记 userData.isHand；换弹时左手沿 y 下移/前移模拟抽装弹匣，非换弹恢复；6 把枪全部支持
- 测试钩子：enemyHealthTest pig 断言 24000；pigLaserPitchSweepTest 断言 p55/p75/p35；新增 handsTest；__gunNDC 跳过 isHand（手臂从屏幕边伸入是正常 CS 表现）

## 测试（test_v82.py 13/13 通过）
- 猪 24000 / 激光 35~75 / 双手 6 枪 / 枪模无残缺（手部跳过，kit 三件套含手 23/23 等）全过
- 回归全过
- 踩坑：pigTriggerTest 仍要放最前（handsTest/enemyHealthTest/激光测试都会创建猪）

## 发布
- commit 4248595「v8.2: pig health 24000 + self-destruct x2 + laser pitch 35~75 + two-handed weapons」push 成功
- README 履历 v8.2 已加

## 当前数值口径
- 猪：24000 血 / 自爆半径20伤260 / 激光俯角35~75 / 速度18.2 / 90s自爆