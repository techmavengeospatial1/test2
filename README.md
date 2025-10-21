# WebXR Gaussian Splat Viewer

This is a proof-of-concept WebXR application that demonstrates the use of several technologies to create a rich, interactive 3D mapping experience.

## Features

*   **Gaussian Splat Viewer:** Renders Gaussian Splat models in a WebXR environment.
*   **OGC 3D Tiles:** Supports the display of OGC 3D Tilesets.
*   **Google Photorealistic 3D Buildings:** Integrates with the Google Maps API to display photorealistic 3D buildings.
*   **Location Tagging and Note-Taking:** Allows users to tag locations and add notes with attachments.
*   **GeoPackage Export:** Exports notes and attachments to a Z-enabled GeoPackage file.
*   **3D Model Placement:** Allows users to load and place GLB models in the scene.
*   **Voice Control:** Provides hands-free interaction through voice commands.
*   **Vector Tile Rendering:** Supports the rendering of vector tiles from a GeoPackage.
*   **MBTiles to GeoPackage Conversion:** Converts MBTiles vector tiles to GeoPackage vector tiles.
*   **SLD to GeoPackage Style Conversion:** Converts SLD styles to the GeoPackage feature styling extension format.

## Limitations

*   **Model Placement:** The 3D model placement is a proof-of-concept and places the model at a fixed distance in front of the camera. It does not use hit-testing to place the model on a real-world surface.
*   **Voice Control:** The voice control is a minimal implementation and only recognizes a few hardcoded commands.
*   **Style Conversion:** The SLD to GeoPackage style conversion is a partial implementation. It can parse the SLD and create the necessary tables, but it does not yet fully populate the tables with all the style information.
*   **Google Photorealistic 3D Buildings:** This feature requires a valid Google Maps API key. To use it, you must replace the placeholder `"YOUR_API_KEY"` in `main.js` with your own key.
