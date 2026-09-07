#!/usr/bin/env python3
# v8.1 headless E2E test — 空中支援上限 3 · 穿模扩展 · 性能优化 · 回归
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
    check("versionTag == v8.1", vtag.strip() == "v8.1", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v8.1 核心：空中支援上限 3 ---
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("air-support stacks to 3 (bonus 1->3, cap 3, use -1)", am["ok"], am)
    ic = page.evaluate("window.__fpsTest.itemCapTest()")
    check("air-support cap 3 + nuke cap 1 (no re-drop when full)", ic["ok"], ic)

    # --- v8.1 穿模扩展（猪/BOSS 挡体回归） ---
    cb = page.evaluate("window.__fpsTest.collideBigTest()")
    check("player pushed out from under pig (no clip)", cb["ok"], cb)

    # --- 性能 ---
    per = page.evaluate("window.__fpsTest.perfTest()")
    check("pixelRatio cap 1.5 & FX_MAX 450", per["ok"], per)

    # --- 回归 ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75 (v8.0)", gc["ok"], gc)
    mu = page.evaluate("window.__fpsTest.mushroomTest()")
    check("mushrooms 6~12 (v8.0)", mu["ok"], mu)
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield 15s base +0.5/kill cap 15", s["ok"], s)
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("rocket dmg 210 / aoe 255", rk["ok"], rk)
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4", bs["ok"], bs)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)