import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js';
import * as GaussianSplats3D from '/node_modules/@mkkellogg/gaussian-splats-3d/dist/gaussian-splats-3d.js';
import { TilesRenderer } from '/node_modules/3d-tiles-renderer/dist/index.js';
import SPL from '/node_modules/spl.js/dist/spl.js';
import { GLTFLoader } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { GeoPackageManager, FeatureTiles } from '/node_modules/@ngageoint/geopackage/dist/geopackage.js';
import { VectorTile } from '/node_modules/@mapbox/vector-tile/dist/vector-tile.js';
import Pbf from 'pbf';
import initSqlJs from 'https://cdn.jsdelivr.net/npm/sql.js@1.4.0/dist/sql-wasm.js';
import SLDParser from 'geostyler-sld-parser';

let renderer, tilesRenderer, googleTilesRenderer, selectedModel;
let tilesVisible = false;
let googleTilesVisible = false;
const GOOGLE_API_KEY = 'YOUR_API_KEY';
const notes = [];
let currentTagPosition = null;
let scene, camera;
let features = [];

function init() {
    renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#render-canvas'), antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const viewer = new GaussianSplats3D.Viewer({
        'cameraUp': [0, -1, -0.6],
        'initialCameraPosition': [-1, -4, 6],
        'initialCameraLookAt': [0, 4, 0],
        'webXRMode': GaussianSplats3D.WebXRMode.AR,
        'renderer': renderer,
        'threeScene': scene,
        'camera': camera
    });

    viewer.addSplatScene('bonsai/bonsai.ksplat', {
        'splatAlphaRemovalThreshold': 5,
        'showLoadingUI': true,
        'position': [0, 1, 0],
        'rotation': [0, 0, 0, 1],
        'scale': [1.5, 1.5, 1.5]
    })
    .then(() => {
        viewer.start();
    });

    tilesRenderer = new TilesRenderer('https://int.nyt.com/data/3d-models/2016/04/22/world-trade-center/3d-tiles/tileset.json');
    tilesRenderer.setCamera(camera);
    tilesRenderer.setResolutionFromRenderer(camera, renderer);
    scene.add(tilesRenderer.group);

    fetch(`https://tile.googleapis.com/v1/createSession?key=${GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "mapType": "photorealistic",
            "language": "en-US",
            "region": "US"
        })
    })
    .then(response => response.json())
    .then(data => {
        const session = data.session;
        googleTilesRenderer = new TilesRenderer(`https://tile.googleapis.com/v1/3d/photorealistic/tileset.json?session=${session}&key=${GOOGLE_API_KEY}`);
        googleTilesRenderer.setCamera(camera);
        googleTilesRenderer.setResolutionFromRenderer(camera, renderer);
        scene.add(googleTilesRenderer.group);
        googleTilesRenderer.group.visible = googleTilesVisible;
    });

    document.querySelector('#ar-button').addEventListener('click', () => {
        if (navigator.xr) {
            navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test']
            }).then((session) => {
                renderer.xr.setSession(session);
            });
        }
    });

    document.querySelector('#toggle-tiles-button').addEventListener('click', () => {
        tilesVisible = !tilesVisible;
        tilesRenderer.group.visible = tilesVisible;
    });

    document.querySelector('#toggle-google-tiles-button').addEventListener('click', () => {
        googleTilesVisible = !googleTilesVisible;
        if (googleTilesRenderer) {
            googleTilesRenderer.group.visible = googleTilesVisible;
        }
    });

    const renderLoop = () => {
        if (tilesRenderer) {
            tilesRenderer.update();
        }
        if (googleTilesRenderer) {
            googleTilesRenderer.update();
        }
    }

    renderer.setAnimationLoop(renderLoop);

    document.getElementById('convert-mbtiles-button').addEventListener('click', async () => {
        const mbtilesInput = document.getElementById('mbtiles-input');
        const file = mbtilesInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const SQL = await initSqlJs();
                const mbtilesDb = new SQL.Database(new Uint8Array(e.target.result));

                const geoPackage = await GeoPackageManager.create();
                const srs = geoPackage.getSpatialReferenceSystemDao().createWgs84();
                const contents = geoPackage.getContentsDao().create();
                contents.table_name = 'tiles';
                contents.data_type = 'tiles';
                contents.identifier = 'tiles';
                contents.srs_id = srs.srs_id;

                const tileMatrixSet = geoPackage.getTileMatrixSetDao().create();
                tileMatrixSet.contents = contents;
                tileMatrixSet.srs = srs;

                const tileMatrixDao = geoPackage.getTileMatrixDao();
                const tiles = mbtilesDb.exec("SELECT DISTINCT zoom_level FROM tiles");
                tiles[0].values.forEach(zoom => {
                    const tileMatrix = tileMatrixDao.create();
                    tileMatrix.contents = contents;
                    tileMatrix.zoom_level = zoom;
                    tileMatrix.matrix_width = Math.pow(2, zoom);
                    tileMatrix.matrix_height = Math.pow(2, zoom);
                    tileMatrix.tile_width = 256;
                    tileMatrix.tile_height = 256;
                    tileMatrixDao.create(tileMatrix);
                });

                const tileDao = geoPackage.getTileDao('tiles');
                const tileData = mbtilesDb.exec("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles");
                tileData[0].values.forEach(async (row) => {
                    const [z, x, y, data] = row;
                    const newRow = tileDao.newRow();
                    newRow.setZoomLevel(z);
                    newRow.setTileColumn(x);
                    newRow.setTileRow(y);
                    newRow.setTileData(data);
                    await tileDao.create(newRow);
                });

                const gpkgData = await geoPackage.export();
                const blob = new Blob([gpkgData], { type: 'application/geopackage+sqlite3' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'converted.gpkg';
                a.click();
            };
            reader.readAsArrayBuffer(file);
        }
    });

    document.getElementById('convert-sld-button').addEventListener('click', async () => {
        const gpkgInput = document.getElementById('gpkg-input');
        const file = gpkgInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const geoPackage = await GeoPackageManager.open(new Uint8Array(e.target.result));
                const styles = await geoPackage.getStylesDao().queryForAll();
                if (styles.length > 0) {
                    const sld = styles[0].style;
                    const sldParser = new SLDParser();
                    const geoStylerStyle = await sldParser.readStyle(sld);

                    await geoPackage.getFeatureStyleExtension().getOrCreateExtension();
                    const styleDao = geoPackage.getFeatureStyleExtension().getStyleDao();
                    const styleMappingDao = geoPackage.getFeatureStyleExtension().getStyleMappingDao();

                    const styleRow = styleDao.newRow();
                    styleRow.setName(geoStylerStyle.name);
                    styleRow.setColor(geoStylerStyle.rules[0].symbolizer.color);
                    styleRow.setWidth(geoStylerStyle.rules[0].symbolizer.width);
                    styleDao.create(styleRow);

                    const mappingRow = styleMappingDao.newRow();
                    mappingRow.setBaseTableName('tiles');
                    mappingRow.setGeometryTypeName('point');
                    mappingRow.setStyleId(styleRow.getId());
                    styleMappingDao.create(mappingRow);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    });

    document.getElementById('filter-by-view-button').addEventListener('click', () => {
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

        const filteredFeatures = features.filter(feature => {
            const coordinates = feature.geojson.geometry.coordinates[0];
            const points = coordinates.map(p => new THREE.Vector3(p[0], 0, p[1]));
            const box = new THREE.Box3().setFromPoints(points);
            return frustum.intersectsBox(box);
        });

        generateTable(filteredFeatures);

        features.forEach(feature => {
            feature.line.visible = filteredFeatures.includes(feature);
        });
    });

    document.getElementById('show-table-button').addEventListener('click', () => {
        const tableContainer = document.getElementById('table-container');
        if (tableContainer.style.display === 'none') {
            tableContainer.style.display = 'block';
            generateTable(features);
        } else {
            tableContainer.style.display = 'none';
        }
    });

    function generateTable(features) {
        const tableContainer = document.getElementById('table-container');
        tableContainer.innerHTML = '';
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headerRow = document.createElement('tr');
        const headers = ['ID', 'Properties', 'Go To'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        features.forEach((feature, index) => {
            const row = document.createElement('tr');
            const idCell = document.createElement('td');
            idCell.textContent = feature.feature.id;
            row.appendChild(idCell);

            const propsCell = document.createElement('td');
            propsCell.textContent = JSON.stringify(feature.feature.properties);
            row.appendChild(propsCell);

            const goToCell = document.createElement('td');
            const goToButton = document.createElement('button');
            goToButton.textContent = 'Go To';
            goToButton.addEventListener('click', () => {
                const coordinates = feature.geojson.geometry.coordinates[0];
                const center = coordinates.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]).map(c => c / coordinates.length);
                camera.position.set(center[0], 5, center[1]);
                camera.lookAt(center[0], 0, center[1]);
            });
            goToCell.appendChild(goToButton);
            row.appendChild(goToCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);
    }

    document.getElementById('load-gpkg-button').addEventListener('click', () => {
        const gpkgInput = document.getElementById('gpkg-input');
        const file = gpkgInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const geoPackage = await GeoPackageManager.open(new Uint8Array(e.target.result));
                const tileTables = geoPackage.getTileTables();
                if (tileTables.length > 0) {
                    const tileDao = geoPackage.getTileDao(tileTables[0]);
                    const grid = new THREE.GridHelper(10, 10);
                    scene.add(grid);

                    for (let z = 0; z < 4; z++) {
                        for (let x = 0; x < Math.pow(2, z); x++) {
                            for (let y = 0; y < Math.pow(2, z); y++) {
                                const tile = await tileDao.queryForTile(x, y, z);
                                if (tile) {
                                    const tileData = tile.getTileData();
                                    const pbf = new Pbf(tileData);
                                    const vectorTile = new VectorTile(pbf);
                                    const layer = vectorTile.layers[Object.keys(vectorTile.layers)[0]];
                                    if (layer) {
                                        for (let i = 0; i < layer.length; i++) {
                                            const feature = layer.feature(i);
                                            const geojson = feature.toGeoJSON(x, y, z);
                                            const geometry = new THREE.BufferGeometry().setFromPoints(geojson.geometry.coordinates[0].map(p => new THREE.Vector3(p[0], 0, p[1])));
                                            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
                                            const line = new THREE.Line(geometry, material);
                                            features.push({ geojson: geojson, feature: feature, line: line });
                                            scene.add(line);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        }
    });

    const voiceWorker = new Worker('voice-worker.js', { type: 'module' });
    voiceWorker.postMessage({ type: 'load' });

    voiceWorker.addEventListener('message', (e) => {
        const { status, output } = e.data;
        if (status === 'complete') {
            handleVoiceCommand(output.text);
        }
    });

    document.getElementById('start-listening-button').addEventListener('click', () => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.addEventListener('dataavailable', (event) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const audio = new Audio(reader.result);
                    audio.play();
                    voiceWorker.postMessage({ type: 'generate', data: { audio: reader.result } });
                };
                reader.readAsDataURL(event.data);
            });
            mediaRecorder.start(1000);
        });
    });

    function handleVoiceCommand(command) {
        const lowerCaseCommand = command.toLowerCase();
        if (lowerCaseCommand.includes('place model')) {
            document.getElementById('place-model-button').click();
        } else if (lowerCaseCommand.includes('add note')) {
            document.getElementById('add-note-button').click();
        }
    }

    document.getElementById('model-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const loader = new GLTFLoader();
                loader.parse(e.target.result, '', (gltf) => {
                    selectedModel = gltf.scene;
                });
            };
            reader.readAsArrayBuffer(file);
        }
    });

    document.getElementById('place-model-button').addEventListener('click', () => {
        if (selectedModel) {
            const model = selectedModel.clone();
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(camera.matrixWorld);
            position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(2));
            position.x += (Math.random() - 0.5) * 0.1;
            position.z += (Math.random() - 0.5) * 0.1;
            model.position.copy(position);
            scene.add(model);
        }
    });

    document.getElementById('save-notes-gpkg-button').addEventListener('click', async () => {
        const spl = await SPL();
        const db = await spl.db();

        await db.exec(`
            SELECT InitSpatialMetaData();
        `);

        await db.exec(`
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT
            );
        `);

        await db.exec(`
            SELECT gpkgAddGeometryColumn('notes', 'geom', 'POINTZ', 4326, 0, 0);
        `);

        await db.exec(`
            CREATE TABLE attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id INTEGER,
                name TEXT,
                data BLOB,
                FOREIGN KEY (note_id) REFERENCES notes(id)
            );
        `);

        for (const note of notes) {
            const { x, y, z } = note.position;
            const wkt = `POINTZ(${x} ${y} ${z})`;
            await db.exec('INSERT INTO notes (geom, text) VALUES (GeomFromText(?, 4326), ?)', [wkt, note.text]);
            const noteId = await db.exec('SELECT last_insert_rowid()').get.first;
            if (note.attachment) {
                await db.exec('INSERT INTO attachments (note_id, name, data) VALUES (?, ?, ?)', [noteId, note.attachment.name, note.attachment.data]);
            }
        }

        const gpkgData = await db.save();
        const blob = new Blob([gpkgData], { type: 'application/geopackage+sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.gpkg';
        a.click();
    });

    document.getElementById('add-note-button').addEventListener('click', () => {
        currentTagPosition = camera.position.clone();
        const noteForm = document.getElementById('note-form');
        noteForm.style.display = 'block';
    });

    document.getElementById('save-note-button').addEventListener('click', () => {
        const noteInput = document.getElementById('note-input');
        const noteText = noteInput.value;
        const attachmentInput = document.getElementById('attachment-input');
        const attachment = attachmentInput.files[0];

        if (noteText && currentTagPosition) {
            if (attachment) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    notes.push({ position: currentTagPosition, text: noteText, attachment: { name: attachment.name, data: e.target.result } });
                    addTagToScene(currentTagPosition, noteText);
                    noteInput.value = '';
                    attachmentInput.value = '';
                    currentTagPosition = null;
                    const noteForm = document.getElementById('note-form');
                    noteForm.style.display = 'none';
                };
                reader.readAsArrayBuffer(attachment);
            } else {
                notes.push({ position: currentTagPosition, text: noteText, attachment: null });
                addTagToScene(currentTagPosition, noteText);
                noteInput.value = '';
                currentTagPosition = null;
                const noteForm = document.getElementById('note-form');
                noteForm.style.display = 'none';
            }
        }
    });
}

function addTagToScene(position, text) {
    const spriteMaterial = new THREE.SpriteMaterial({ color: 0xff0000 });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(0.1, 0.1, 0.1);
    sprite.userData = { text: text };
    scene.add(sprite);
}

init();
