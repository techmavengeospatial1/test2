from playwright.sync_api import sync_playwright, expect

def test_app_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8000")
            expect(page.get_by_role("button", name="Enter AR")).to_be_visible()
            page.screenshot(path="jules-scratch/verification/initial_view.png")
            print("Screenshot taken")
        finally:
            browser.close()

if __name__ == "__main__":
    test_app_loads()
