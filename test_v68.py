#!/usr/bin/env python3
# v6.8 headless E2E test — 狂暴击杀回血 + 喷火器突围增强 + 加特林机枪碉堡
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

    vtag = page.text_content("#versionTag")
    check("versionTag == v6.8", vtag.strip() == "v6.8", vtag)

    # 1. 过关模式 L1 → 每关随机生成 1 座加特林碉堡
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1800)
    s = st()
    sc = s["scenery"]
    check("gatling == 1 per level", sc["gatlings"] == 1, sc.get("gatlings"))

    # 2. 喷火器增强：射程 80 / 伤害 216 / 范围 9
    s = st()
    check("flamethrower range 80", s["flameRange"] == 80, s["flameRange"])
    check("flamethrower damage 216", s["flameDamage"] == 216, s["flameDamage"])
    check("flamethrower radius 9", s["flameRadius"] == 9, s["flameRadius"])

    # 3. 狂暴回血：压血到 ≤15%（KeyH）→ 狂暴 → 击杀敌人 +10 HP
    page.keyboard.press("KeyM")  # 满血
    page.wait_for_timeout(200)
    page.keyboard.press("KeyH")  # 压血触发狂暴
    page.wait_for_timeout(200)
    s = st()
    check("berserk triggered by low HP", s["berserk"], s["hp"])
    hp_berserk = s["hp"]
    hp_after = page.evaluate("window.__fpsTest.simulateEnemyKill()")
    page.wait_for_timeout(100)
    check("kill heals +10 while berserk", hp_after == hp_berserk + 10, (hp_berserk, hp_after))

    # 4. 非狂暴不触发回血（掉 20 血但不低于 15%，击杀后血量不变）
    page.keyboard.press("KeyM")  # 满血解除狂暴
    page.wait_for_timeout(300)
    page.evaluate("window.__fpsTest.hitPlayerTest(20)")
    page.wait_for_timeout(100)
    s = st()
    check("no berserk at 80% hp", not s["berserk"], s["hp"])
    hp_norm = s["hp"]
    hp_after2 = page.evaluate("window.__fpsTest.simulateEnemyKill()")
    check("no heal without berserk", hp_after2 == hp_norm, (hp_norm, hp_after2))

    # 5. 加特林碉堡：走近后 enter → active；超温后 30 秒冷却
    has_gatling = page.evaluate("window.__fpsTest.enterGatlingTest()")
    check("enter gatling near turret", has_gatling, has_gatling)
    page.wait_for_timeout(200)
    s = st()
    check("gatling active after enter", s["gatlingActive"], s)
    # 站桩开火（多发）无报错
    n = page.evaluate("window.__fpsTest.gatlingFireTest(12)")
    check("gatling fires 12 rounds", n == 12, n)
    # 推进超温：加速到 ≥30 秒 → 自动退出 + 冷却 30
    r = page.evaluate("window.__fpsTest.advanceGatling(30)")
    check("heat accumulates while active", r["heat"] >= 30, r)
    s = st()
    check("auto-exit on overheat", not s["gatlingActive"] and s["gatlingCooldown"] > 29.4, (s["gatlingActive"], s["gatlingCooldown"]))
    # 冷却中不能再进入
    blocked = page.evaluate("window.__fpsTest.enterGatlingTest()")
    check("cannot enter during cooldown", not blocked, blocked)
    # 推进冷却归零 → 可再次使用
    r = page.evaluate("window.__fpsTest.advanceGatling(31)")
    s = st()
    check("cooldown ends after 30s", s["gatlingCooldown"] == 0, s["gatlingCooldown"])
    ok2 = page.evaluate("window.__fpsTest.enterGatlingTest()")
    check("can re-enter after cooldown", ok2, ok2)
    page.evaluate("window.__fpsTest.exitGatlingTest()")
    page.wait_for_timeout(200)
    s = st()
    check("manual exit restores movement state", not s["gatlingActive"], s)

    # 6. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
