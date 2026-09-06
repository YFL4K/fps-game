#!/usr/bin/env python3
# v7.5 headless E2E test — 猪头佳激光 30°~50° 俯角扫射地面 + v7.4 回归
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
    check("versionTag == v7.5", vtag.strip() == "v7.5", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v7.4 回归 ---
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 4000 / boss 7500", h["ok"], h)
    b = page.evaluate("window.__fpsTest.berserkTest()")
    check("berserk 30% + instant on hit", b["ok"])
    wb = page.evaluate("window.__fpsTest.worldBoundPlayerTest()")
    check("player clamped inside walls", wb["ok"], wb)
    ws = page.evaluate("window.__fpsTest.worldBoundSpiderTest()")
    check("spider clamped inside walls", ws["ok"], ws)
    gm = page.evaluate("window.__fpsTest.gatlingModelTest()")
    check("gatling new model structure", gm["ok"], {k: v for k, v in gm.items() if k != "ok"})
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)

    # --- v7.5 激光俯角 ---
    s = page.evaluate("window.__fpsTest.pigLaserStateTest()")
    check("pig laser 5s on / 3s off cycle", s["ok"])
    sw = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("laser pitch sweeps 30~50 deg", sw["ok"], {k: v for k, v in sw.items() if k != "ok"})
    p1 = page.evaluate("window.__fpsTest.pigLaserPlayerTest()")
    check("laser dmg player 20/s at ground target", p1["ok"], p1)
    pe = page.evaluate("window.__fpsTest.pigLaserEnemyTest()")
    check("laser dmg enemy 50/s at ground low target", pe["ok"], pe)
    pr = page.evaluate("window.__fpsTest.pigLaserRangeTest()")
    check("far target not hit (beam to ground)", pr["ok"], pr)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)