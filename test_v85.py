#!/usr/bin/env python3
# v8.5 headless E2E test — 结算画面 · 猪激光20度 · 椰子树替代巨石 · 自动拾取枪 + 回归
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

    vtag = page.text_content("#versionTag")
    check("versionTag == v8.5", vtag.strip() == "v8.5", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- 回归：pigTrigger 需在无猪状态下跑（放最前，激光测试会创建猪） ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)

    # --- v8.5 需求2：猪激光 20 度 ---
    ls = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("pig laser fixed 20 deg", ls["ok"], ls)

    # --- v8.5 需求3+4：椰子树替代巨石 ---
    co = page.evaluate("window.__fpsTest.coconutTest()")
    check("coconut 4~7 (no boulder)", co["ok"], co)

    # --- v8.5 需求5：自动拾取枪不切换 ---
    gp = page.evaluate("window.__fpsTest.gunPickupTest()")
    check("gun pickup adds ammo without switching", gp["ok"], gp)

    # --- v8.5 需求1：结算统计字段 ---
    st = page.evaluate("window.__fpsTest.statsTest()")
    check("stats fields exist (killCounts/shotsFired/headshot)", st["ok"], st)

    # --- 回归 ---
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("pig 24000 / boss 22500 / heli 750", h["ok"], h)
    tx = page.evaluate("window.__fpsTest.trexTest()")
    check("trex 24000 / life 60", tx["ok"], tx)
    jp = page.evaluate("window.__fpsTest.jetpackTest()")
    check("jetpack cap 1", jp["ok"], jp)
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("sniper 3/s reload 1s", rk["ok"], rk)
    hs = page.evaluate("window.__fpsTest.handsTest()")
    check("stock hidden + barrel tag", hs["ok"], hs)
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75", gc["ok"], gc)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)