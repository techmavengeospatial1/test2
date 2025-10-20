from playwright.sync_api import sync_playwright, expect

def test_app_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8000")
            expect(page.get_by_placeholder("Esri FeatureServer URL")).to_be_visible()
            expect(page.get_by_role("button", name="Load Esri FS")).to_be_visible()
            expect(page.get_by_placeholder("Esri SceneServer URL")).to_be_visible()
            expect(page.get_by_role("button", name="Load Esri SS")).to_be_visible()
            page.screenshot(path="jules-scratch/verification/esri_ui.png")
            print("Screenshot taken")
        finally:
            browser.close()

if __name__ == "__main__":
    test_app_loads()
