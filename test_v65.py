#!/usr/bin/env python3
# v6.5 headless E2E test — 击杀目标 / 机甲BOSS / 无尽模式
import sys
from playwright.sync_api import sync_playwright

URL = "file:///run/csi/mount-root/nas/4079184d856ecc166ed19d4887083405/workspaces/default/fps-game/index.html#test"
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + ("  | " + str(extra) if extra else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium",
                                args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(2500)

    def st():
        return page.evaluate("window.__fpsTest.getState()")

    # 1. 版本与菜单
    vtag = page.text_content("#versionTag")
    check("versionTag == v6.5", vtag.strip() == "v6.5", vtag)
    mode_btns = page.evaluate("document.getElementById('modeBtns').style.display")
    check("mode buttons visible at menu", mode_btns == "flex", mode_btns)

    # 2. 过关模式 L1：killTarget=30
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)
    s = st()
    check("story mode playing", s["state"] == "playing", s["state"])
    check("L1 killTarget=30", s["killTarget"] == 30, s["killTarget"])
    check("mode buttons hidden after start", page.evaluate("document.getElementById('modeBtns').style.display") == "none")

    # 3. 无尽模式
    page.reload()
    page.wait_for_timeout(2000)
    page.click("#modeEndlessBtn")
    page.wait_for_timeout(1500)
    s = st()
    check("endless mode playing", s["state"] == "playing" and s["mode"] == "endless", (s["state"], s["mode"]))
    check("endless killTarget is Infinity", str(s["killTarget"]) == "inf" or s["killTarget"] > 1e9, s["killTarget"])
    check("endlessWave starts 1", s["endlessWave"] == 1, s["endlessWave"])
    hud = page.evaluate("document.getElementById('stats').textContent")
    check("HUD shows 无尽模式", "无尽模式" in hud, hud.split("\n")[0])

    # 4. 无尽模式击杀计数（J 刷 human，N+G 核弹清场，确定性）
    page.keyboard.press("KeyJ")
    page.keyboard.press("KeyJ")
    page.wait_for_timeout(600)
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(2500)
    s = st()
    check("endless kills incremented", s["levelKills"] >= 2, s["levelKills"])

    # 5. 无尽模式 B 键召唤随机机甲 BOSS
    page.keyboard.press("KeyB")
    page.wait_for_timeout(1200)
    s = st()
    check("endless boss spawned", s["boss"]["appeared"] and s["boss"]["alive"], s["boss"])
    check("boss kind is mech", s["boss"]["kind"] == "mech", s["boss"]["kind"])

    # 6. 击杀机甲 BOSS：N 给核弹 + G 引爆
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(2500)
    s = st()
    check("boss killed after nuke", s["boss"]["appeared"] and not s["boss"]["alive"], s["boss"])
    check("boss kill grants nuke", s["nukes"] >= 1, s["nukes"])
    check("endless does NOT complete", s["state"] == "playing", s["state"])

    # 7. 过关模式 L2/L3 击杀目标 + L3 机甲 BOSS（story）
    page.reload()
    page.wait_for_timeout(2000)
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1000)
    page.evaluate("document.getElementById('tComplete').click()")
    page.wait_for_timeout(300)
    page.evaluate("document.getElementById('tNext').click()")
    page.wait_for_timeout(800)
    s = st()
    check("L2 killTarget=50", s["levelIndex"] == 1 and s["killTarget"] == 50, (s["levelIndex"], s["killTarget"]))
    page.evaluate("document.getElementById('tComplete').click()")
    page.wait_for_timeout(300)
    page.evaluate("document.getElementById('tNext').click()")
    page.wait_for_timeout(800)
    s = st()
    check("L3 killTarget=70", s["levelIndex"] == 2 and s["killTarget"] == 70, (s["levelIndex"], s["killTarget"]))
    page.evaluate("document.getElementById('tSetKills').click()")
    page.wait_for_timeout(1500)
    s = st()
    check("L3 mech boss triggered", s["boss"]["appeared"] and s["boss"]["alive"], s["boss"])
    check("L3 boss kind mech", s["boss"]["kind"] == "mech", s["boss"]["kind"])
    page.keyboard.press("KeyN")
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(2500)
    s = st()
    check("L3 boss killed -> complete", s["state"] == "complete", (s["state"], s["boss"]))
    check("L3 boss kill grants nuke", s["nukes"] >= 1, s["nukes"])

    # 8. 无尽模式死亡结算 + localStorage 最高记录（H 压低血量 → 核弹自杀）
    page.reload()
    page.wait_for_timeout(2000)
    page.click("#modeEndlessBtn")
    page.wait_for_timeout(1500)
    page.keyboard.press("KeyJ")
    page.keyboard.press("KeyJ")
    page.wait_for_timeout(600)
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(2500)
    page.keyboard.press("KeyH")
    page.wait_for_timeout(300)
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(2000)
    s = st()
    check("endless dead state", s["state"] == "dead", (s["state"], s["hp"]))
    overlay_txt = page.text_content("#overlaySub")
    h1 = page.text_content("#overlay h1") or ""
    check("endless end screen shows kills/score", "☢ 核爆致命" in h1 and "击杀" in overlay_txt and "历史最高" in overlay_txt, (h1, overlay_txt))
    best = s["endlessBest"]
    check("best recorded", best["kills"] >= s["levelKills"], (best, s["levelKills"]))
    ls = page.evaluate("({k: localStorage.getItem('fps_endless_kills'), s: localStorage.getItem('fps_endless_score')})")
    check("localStorage best saved", ls["k"] is not None and int(ls["k"]) == best["kills"], ls)

    # 9. Enter → 返回菜单（模式选择）
    page.keyboard.press("Enter")
    page.wait_for_timeout(800)
    s = st()
    mode_disp = page.evaluate("document.getElementById('modeBtns').style.display")
    check("Enter returns to menu with mode buttons", s["state"] == "menu" and mode_disp == "flex", (s["state"], mode_disp))

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
