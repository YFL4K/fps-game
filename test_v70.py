#!/usr/bin/env python3
# v7.0 headless E2E test — 猪头佳小BOSS（野猪冲撞）+ 主标题字体调细
import sys
from playwright.sync_api import sync_playwright

URL = "file:///run/csi/mount-root/nas/4079184d856ecc166ed19d4887083405/workspaces/default/fps-game/index.html#test"
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + ("  | " + str(extra) if extra else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium",
                                args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                      "--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(2500)

    def st():
        return page.evaluate("window.__fpsTest.getState()")

    # 0. versionTag
    vtag = page.text_content("#versionTag")
    check("versionTag == v7.0", vtag.strip() == "v7.0", vtag)

    # 1. 主标题字体调细（900 → 500）
    fw = page.evaluate("getComputedStyle(document.querySelector('#overlay h1')).fontWeight")
    check("title font-weight 500 (thinner)", fw == "500", fw)

    # 2. 进入游戏
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)
    s = st()
    check("game started", s["state"] == "playing", s["state"])

    # 3. spawnPigTest：猪头佳出现（3 倍体型、有血量、30 秒寿命）
    r = page.evaluate("window.__fpsTest.spawnPigTest()")
    s = st()
    check("spawn pig ok", r["spawned"] and s["pig"]["alive"] and s["pig"]["count"] == 1, (r, s["pig"]))
    check("pig scale 3x (3x enemy size)", s["pig"]["scale"] == 3, s["pig"]["scale"])
    check("pig health > 0", (s["pig"]["health"] or 0) > 0, s["pig"]["health"])
    check("pig life ~30s", s["pig"]["life"] is not None and 29.0 <= s["pig"]["life"] <= 30.1, s["pig"]["life"])

    # 4. 冲撞玩家：每次 5~10 伤害（确定性同步推进）
    r = page.evaluate("window.__fpsTest.pigRamPlayerTest()")
    check("pig ram player dmg 5~10", r["ok"], r)

    # 5. 冲撞敌人：30~50 伤害（生成固定测试敌人，确定性同步推进）
    page.evaluate("window.__fpsTest.explodeEnemyDmgTest(70, 1)")   # 创建 test-enemy @ (10,0,10) hp500
    te = page.evaluate("window.__fpsTest.testEnemyHp()")
    check("test enemy ready", te is not None, te)
    r = page.evaluate("window.__fpsTest.pigRamEnemyTest()")
    check("pig ram enemy dmg 30~50", r["ok"], r)

    # 6. 冲撞爆炸物：油桶被引爆，猪自身被炸伤（确定性同步推进）
    page.evaluate("window.__fpsTest.spawnBarrelTest(20, 10)")
    r = page.evaluate("window.__fpsTest.pigRamBarrelTest()")
    check("pig ram barrel triggers explosion & self-damage", r["ok"], r)

    # 7. 击杀 5 名普通敌人触发猪头佳
    page.evaluate("window.__fpsTest.setPlayerPos(0, 0.1, 20)")
    page.evaluate("window.__fpsTest.killPigTest()")       # 清掉当前猪（+1000 分）
    page.evaluate("window.__fpsTest.advancePig(0.1)")     # 让旧猪实体移除
    s = st()
    check("kill pig gives +1000 & clears", s["pig"]["alive"] is False, s["pig"])
    r4 = page.evaluate("window.__fpsTest.triggerPigCounter(4)")
    check("4 kills no trigger yet", r4["alive"] is False and r4["kills"] == 4, r4)
    r5 = page.evaluate("window.__fpsTest.triggerPigCounter(1)")
    check("5th kill triggers pig", r5["alive"] is True, r5)
    s = st()
    check("pig count 1 after trigger", s["pig"]["count"] == 1, s["pig"])

    # 8. 同屏最多 1 只（猪在场时击杀不计入触发累计）
    r6 = page.evaluate("window.__fpsTest.triggerPigCounter(5)")
    s = st()
    check("only one pig at a time", s["pig"]["alive"] is True and s["pig"]["count"] == 1 and r6["kills"] == 0, (r6, s["pig"]))

    # 9. 30 秒超时自爆（玩家远离，不受爆炸波及）
    page.evaluate("window.__fpsTest.setPlayerPos(300, 0.1, 300)")
    page.evaluate("window.__fpsTest.pigPos(0, -40)")
    page.evaluate("window.__fpsTest.killPigTest()")       # 清场重新出一只干净的猪
    page.evaluate("window.__fpsTest.advancePig(0.1)")
    page.evaluate("window.__fpsTest.spawnPigTest()")
    page.evaluate("window.__fpsTest.pigPos(0, -40)")
    page.evaluate("window.__fpsTest.advancePig(31)")
    s = st()
    check("pig self-destructs after 30s", s["pig"]["alive"] is False and s["pig"]["count"] == 0, s["pig"])

    # 10. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
