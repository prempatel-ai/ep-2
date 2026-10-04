import time
from playwright.sync_api import sync_playwright

BRAIN_DIR = r"C:\Users\ASUS\.gemini\antigravity\brain\36f547eb-293d-4f76-a4bc-df25485a4539"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 840},
            permissions=["microphone"]
        )
        page = context.new_page()

        # 1. Text chat empty state
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=f"{BRAIN_DIR}/screenshot_text_chat.png")
        page.screenshot(path="d:/fep/sahayak/screenshot_text_chat.png")
        print("Captured screenshot_text_chat.png")

        # 2. Language dropdown
        # Click the language selector button
        lang_btn = page.locator('button[aria-label="Select language"]')
        if lang_btn.count() > 0:
            lang_btn.click()
            time.sleep(0.5)
            page.screenshot(path=f"{BRAIN_DIR}/screenshot_language_dropdown.png")
            page.screenshot(path="d:/fep/sahayak/screenshot_language_dropdown.png")
            print("Captured screenshot_language_dropdown.png")
            # Close popover
            page.keyboard.press("Escape")
            time.sleep(0.3)

        # 3. Conversation view: click first suggested question
        first_q = page.locator("button:has-text('What are the early signs of breast cancer?')")
        if first_q.count() > 0:
            first_q.click()
            time.sleep(2)
            page.screenshot(path=f"{BRAIN_DIR}/screenshot_conversation.png")
            page.screenshot(path="d:/fep/sahayak/screenshot_conversation.png")
            print("Captured screenshot_conversation.png")

        # 4. Voice Mode
        # Click Voice Mode in header
        voice_btn = page.locator('button:has-text("Voice Mode")')
        if voice_btn.count() > 0:
            voice_btn.click()
            time.sleep(1)
            page.screenshot(path=f"{BRAIN_DIR}/screenshot_voice_mode.png")
            page.screenshot(path="d:/fep/sahayak/screenshot_voice_mode.png")
            print("Captured screenshot_voice_mode.png")

        browser.close()

if __name__ == "__main__":
    run()
