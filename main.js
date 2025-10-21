import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js';
import * as GaussianSplats3D from 'node_modules/@mkkellogg/gaussian-splats-3d/dist/gaussian-splats-3d.js';
import { TilesRenderer } from 'node_modules/3d-tiles-renderer/dist/index.js';
import SPL from 'node_modules/spl.js/dist/spl.js';
import { GLTFLoader } from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { GeoPackageManager, FeatureTiles } from 'node_modules/@ngageoint/geopackage/dist/geopackage.js';
import { queryFeatures } from 'node_modules/@esri/arcgis-rest-feature-layer/dist/esm/query.js';
import { I3SLoader } from 'node_modules/@loaders.gl/i3s/dist/esm/i3s-loader.js';
import { load } from 'node_modules/@loaders.gl/core/dist/esm/load.js';
import proj4 from 'node_modules/proj4/dist/proj4.js';
import { kml } from 'node_modules/@tmcw/togeojson/dist/togeojson.es.js';
import { GeoJsonGeometry } from 'node_modules/three-geojson/dist/three-geojson.js';

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

    let i3sTileset;
    document.getElementById('load-esri-ss-button').addEventListener('click', async () => {
        const url = document.getElementById('esri-ss-url').value;
        if (url) {
            i3sTileset = await load(url, I3SLoader);
            scene.add(i3sTileset.root.content.scene);
        }
    });

    document.getElementById('load-esri-fs-button').addEventListener('click', () => {
        const url = document.getElementById('esri-fs-url').value;
        if (url) {
            const frustum = new THREE.Frustum();
            const projScreenMatrix = new THREE.Matrix4();
            projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustum.setFromProjectionMatrix(projScreenMatrix);

            const extent = new THREE.Box3();
            extent.setFromObject(scene);

            const min = proj4('EPSG:3857', 'EPSG:4326', [extent.min.x, extent.min.y]);
            const max = proj4('EPSG:3857', 'EPSG:4326', [extent.max.x, extent.max.y]);

            queryFeatures({
                url: url,
                geometry: [min[0], min[1], max[0], max[1]],
                geometryType: 'esriGeometryEnvelope',
                inSR: 4326,
                outSR: 4326,
                f: 'json'
            }).then(response => {
                response.features.forEach(feature => {
                    if (feature.geometry.paths) { // Lines
                        const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
                        feature.geometry.paths.forEach(path => {
                            const geometry = new THREE.BufferGeometry();
                            const vertices = [];
                            path.forEach(point => {
                                const [x, y, z] = proj4('EPSG:4326', 'EPSG:3857', [point[0], point[1], point[2] || 0]);
                                vertices.push(x, y, z);
                            });
                            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                            const line = new THREE.Line(geometry, material);
                            line.userData.attributes = feature.attributes;
                            scene.add(line);
                        });
                    } else if (feature.geometry.rings) { // Polygons
                        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
                        feature.geometry.rings.forEach(ring => {
                            const shape = new THREE.Shape();
                            ring.forEach((point, i) => {
                                const [x, y, z] = proj4('EPSG:4326', 'EPSG:3857', [point[0], point[1], point[2] || 0]);
                                if (i === 0) {
                                    shape.moveTo(x, y);
                                } else {
                                    shape.lineTo(x, y);
                                }
                            });
                            const geometry = new THREE.ShapeGeometry(shape);
                            const mesh = new THREE.Mesh(geometry, material);
                            mesh.userData.attributes = feature.attributes;
                            scene.add(mesh);
                        });
                    } else { // Points
                        const material = new THREE.PointsMaterial({ color: 0x00ff00, size: 0.1 });
                        const geometry = new THREE.BufferGeometry();
                        const vertices = [];
                        const { x, y, z } = feature.geometry;
                        const [px, py, pz] = proj4('EPSG:4326', 'EPSG:3857', [x, y, z || 0]);
                        vertices.push(px, py, pz);
                        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                        const points = new THREE.Points(geometry, material);
                        points.userData.attributes = feature.attributes;
                        scene.add(points);
                    }
                });
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

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.attributes) {
                const attributeTable = document.getElementById('attribute-table');
                const attributeContent = document.getElementById('attribute-content');
                attributeContent.innerHTML = '';
                for (const [key, value] of Object.entries(object.userData.attributes)) {
                    attributeContent.innerHTML += `<strong>${key}:</strong> ${value}<br>`;
                }
                attributeTable.style.display = 'block';
            }
        }
    });

    document.getElementById('close-attribute-table').addEventListener('click', () => {
        document.getElementById('attribute-table').style.display = 'none';
    });

    const renderLoop = () => {
        if (tilesRenderer) {
            tilesRenderer.update();
        }
        if (googleTilesRenderer) {
            googleTilesRenderer.update();
        }
        if (i3sTileset) {
            i3sTileset.update();
        }
    }

    renderer.setAnimationLoop(renderLoop);

    document.getElementById('load-gpkg-button').addEventListener('click', () => {
        const gpkgInput = document.getElementById('gpkg-input');
        const file = gpkgInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const geoPackage = await GeoPackageManager.open(new Uint8Array(e.target.result));
                const featureTables = geoPackage.getFeatureTables();
                if (featureTables.length > 0) {
                    const featureDao = geoPackage.getFeatureDao(featureTables[0]);
                    const ft = new FeatureTiles(geoPackage, featureDao);
                    for (let z = 0; z < 4; z++) {
                        for (let x = 0; x < Math.pow(2, z); x++) {
                            for (let y = 0; y < Math.pow(2, z); y++) {
                                const tile = await ft.drawTile(x, y, z);
                                if (tile) {
                                    const texture = new THREE.CanvasTexture(tile.getImage());
                                    const material = new THREE.MeshBasicMaterial({ map: texture });
                                    const plane = new THREE.PlaneGeometry(1, 1);
                                    const mesh = new THREE.Mesh(plane, material);
                                    mesh.position.set(x - Math.pow(2, z) / 2, 0, y - Math.pow(2, z) / 2);

                                    const geojson = await featureDao.queryForGeoJSONFeaturesInTable('features', {
                                        minX: x,
                                        minY: y,
                                        maxX: x + 1,
                                        maxY: y + 1
                                    });

                                    if (geojson.features.length > 0) {
                                        mesh.userData.attributes = geojson.features[0].properties;
                                    }

                                    scene.add(mesh);
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
        } else if (status === 'vqa-complete') {
            const answerDiv = document.getElementById('vqa-answer');
            answerDiv.innerHTML = output[0].answer;
            answerDiv.style.display = 'block';
            setTimeout(() => {
                answerDiv.style.display = 'none';
            }, 5000);
        }
    });

    document.getElementById('start-listening-button').addEventListener('click', () => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.addEventListener('dataavailable', (event) => {
                const reader = new FileReader();
                reader.onloadend = () => {
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
        } else if (lowerCaseCommand.startsWith('what is') || lowerCaseCommand.startsWith('how many') || lowerCaseCommand.startsWith('is there')) {
            const image = captureCanvas();
            voiceWorker.postMessage({ type: 'vqa', data: { image: image, question: command } });
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

    document.getElementById('vector-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                let geojson;
                if (file.name.endsWith('.kml')) {
                    const dom = new DOMParser().parseFromString(e.target.result, 'text/xml');
                    geojson = kml(dom);
                } else {
                    geojson = JSON.parse(e.target.result);
                }
                renderGeoJSON(geojson);
            };
            reader.readAsText(file);
        }
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

function renderGeoJSON(geojson) {
    geojson.features.forEach(feature => {
        const { geometry, properties } = feature;
        const mesh = new THREE.Mesh(new GeoJsonGeometry(geometry), new THREE.MeshBasicMaterial({ color: 'yellow' }));
        mesh.userData.attributes = properties;
        scene.add(mesh);
    });
}

function captureCanvas() {
    return renderer.domElement.toDataURL();
}

init();
