#!/usr/bin/env python3
# v6.6 headless E2E test — 每关战斗 BGM
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
    check("versionTag == v6.6", vtag.strip() == "v6.6", vtag)

    # 1. 过关模式 L1 → BGM 曲目 0「巷战冲锋」播放中
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1800)
    s = st()
    check("L1 BGM playing track 0", s["bgm"]["playing"] and s["bgm"]["idx"] == 0, s["bgm"])
    check("L1 track name", s["bgm"]["name"] == "巷战冲锋", s["bgm"]["name"])
    banner = page.evaluate("document.getElementById('levelBannerSub').textContent")
    check("banner shows BGM name", "巷战冲锋" in banner, banner)

    # 2. 过关切换 → 换曲
    page.evaluate("document.getElementById('tComplete').click()")
    page.wait_for_timeout(300)
    page.evaluate("document.getElementById('tNext').click()")
    page.wait_for_timeout(1500)
    s = st()
    check("L2 BGM switched to track 1", s["bgm"]["playing"] and s["bgm"]["idx"] == 1 and s["bgm"]["name"] == "火力围猎", s["bgm"])

    # 3. 无尽模式 → 专属曲「无尽鏖战」(idx 5)
    page.reload()
    page.wait_for_timeout(2000)
    page.click("#modeEndlessBtn")
    page.wait_for_timeout(1800)
    s = st()
    check("endless BGM track 5", s["bgm"]["playing"] and s["bgm"]["idx"] == 5 and s["bgm"]["name"] == "无尽鏖战", s["bgm"])

    # 4. M 键静音 / 恢复
    page.keyboard.press("KeyM")
    page.wait_for_timeout(300)
    s = st()
    check("M mutes BGM", s["bgm"]["muted"], s["bgm"])
    page.keyboard.press("KeyM")
    page.wait_for_timeout(300)
    s = st()
    check("M unmutes BGM", not s["bgm"]["muted"], s["bgm"])

    # 5. 死亡 → BGM 停止
    page.keyboard.press("KeyH")
    page.wait_for_timeout(300)
    page.keyboard.press("KeyN")
    page.wait_for_timeout(200)
    page.keyboard.press("KeyG")
    page.wait_for_timeout(1500)
    s = st()
    check("dead stops BGM", s["state"] == "dead" and not s["bgm"]["playing"], (s["state"], s["bgm"]))

    # 6. Enter → 菜单（BGM 不播），再开始 L1 → 恢复播放
    page.keyboard.press("Enter")
    page.wait_for_timeout(800)
    s = st()
    check("menu BGM stopped", s["state"] == "menu" and not s["bgm"]["playing"], (s["state"], s["bgm"]))
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1500)
    s = st()
    check("restart L1 BGM plays again", s["bgm"]["playing"] and s["bgm"]["idx"] == 0, s["bgm"])

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
