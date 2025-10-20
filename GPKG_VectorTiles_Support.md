Add support for new OGC GPKG GeoPackage Vector Tile Extensions for PBF with stylesheets and resources (sprites, glyphs) inside the sqlite. 
Be able to extract those from the tile_data blob (they are GZipped)
Modify the tile server to support serving the vector tiles (GZ PBF in the tile\_data blob) remember GPKG uses XYZ Naming and MBTILES using TMS.  So the data needs to be shown correctly.    
[http://rbt-gpkg-sprint-ogc-8631a67d386ea6d645dfee87553e7e144502c95ba7a.pages.ogc.org/documents/spec/24-010.html](http://rbt-gpkg-sprint-ogc-8631a67d386ea6d645dfee87553e7e144502c95ba7a.pages.ogc.org/documents/spec/24-010.html) we are supporting the Army Geospatial Center’s Releasable Basemap Tiles GPKG data.  
These extensions define how to store tiled vector (aka vector tiles) to be stored in a GeoPackage. These extensions were developed during the [OGC Vector Tiles Pilot](https://www.opengeospatial.org/projects/initiatives/vt-pilot-2018) [https://www.opengeospatial.org/projects/initiatives/vt-pilot-2018](https://www.opengeospatial.org/projects/initiatives/vt-pilot-2018)  and [OGC Vector Tiles Pilot Phase 2](https://www.ogc.org/projects/initiatives/vtp2).[https://www.ogc.org/projects/initiatives/vtp2](https://www.ogc.org/projects/initiatives/vtp2) 

[Vector Tiles Extension](https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/1-vte.adoc) https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/1-vte.adocdefines how vector tiles can be stored in a GeoPackage.

[Mapbox Vector Tiles Extension](https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/2-mvte.adoc) [https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/2-mvte.adoc](https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/2-mvte.adoc) defines how vector tiles can be stored in the [MapBox Vector Tiles](https://github.com/mapbox/vector-tile-spec)  [https://github.com/mapbox/vector-tile-spec](https://github.com/mapbox/vector-tile-spec) format.

[Vector Tiles Attributes Extension](https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/4-vtae.adoc)  [https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/4-vtae.adoc](https://gitlab.com/imagemattersllc/ogc-vtp2/-/blob/master/extensions/4-vtae.adoc) defines how correlation between features and the tiles containing them using the GeoPackage Related Tables Extension.

https://github.com/ngageoint/geopackage-android  https://ngageoint.github.io/geopackage-android/docs/api/   
https://ngageoint.github.io/geopackage-android/docs/api/mil/nga/geopackage/tiles/features/package-summary.html   
https://ngageoint.github.io/geopackage-ios/docs/api/Classes/GPKGFeatureTileGenerator.html 

https://ngageoint.github.io/geopackage-ios/docs/api/Classes/GPKGStyles.html   
https://ngageoint.github.io/geopackage-ios/docs/api/Classes/GPKGStyleUtils.html   
