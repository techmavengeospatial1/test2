from playwright.sync_api import sync_playwright, expect

def test_app_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8000")
            expect(page.locator("#attribute-table")).to_be_hidden()
            expect(page.locator("#vqa-answer")).to_be_hidden()
            page.screenshot(path="jules-scratch/verification/vqa_ui.png")
            print("Screenshot taken")
        finally:
            browser.close()

if __name__ == "__main__":
    test_app_loads()
