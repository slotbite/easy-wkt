// Geospatial Feature Playground App
class GeospatialApp {
    constructor() {
        this.drawnItems = new L.FeatureGroup();
        this.initMap();
        this.initControls();
        this.initDrawing();
        this.initDarkMode();
    }

    initMap() {
        // Initialize Leaflet map with Mapbox tile layer
        this.map = L.map('map').setView([0, 0], 2);
        
        // Add the tile layer
        L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${config.MAPBOX_TOKEN}`, {
            attribution: ' Mapbox | OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(this.map);

        // Add feature group to map after map initialization
        this.map.addLayer(this.drawnItems);

        // Get user's geolocation
        this.map.locate({setView: true, maxZoom: 10});
    }

    initControls() {
        // Initialize buttons
        this.clearButton = document.getElementById('clearButton');
        this.wktInput = document.getElementById('wktInput');
        this.plotWktButton = document.getElementById('plotWktButton');
        this.exportButton = document.getElementById('exportButton');
        this.copyWktButton = document.getElementById('copyWktButton');

        // Initialize geometry buttons
        this.drawPoint = document.getElementById('drawPoint');
        this.drawLine = document.getElementById('drawLine');
        this.drawPolygon = document.getElementById('drawPolygon');
        this.drawCircle = document.getElementById('drawCircle');
        this.drawRectangle = document.getElementById('drawRectangle');

        // Create feedback element
        this.feedbackEl = document.createElement('div');
        this.feedbackEl.className = 'copy-feedback';
        this.feedbackEl.textContent = 'Copied to clipboard!';
        document.body.appendChild(this.feedbackEl);

        // Event listeners for main controls
        this.clearButton.addEventListener('click', () => this.clearFeatures());
        this.plotWktButton.addEventListener('click', () => this.plotWKT());
        this.exportButton.addEventListener('click', () => this.exportFeatures());
        this.copyWktButton.addEventListener('click', () => this.copyWKT());

        // Event listeners for geometry buttons
        this.drawPoint.addEventListener('click', () => this.startDrawing('marker'));
        this.drawLine.addEventListener('click', () => this.startDrawing('polyline'));
        this.drawPolygon.addEventListener('click', () => this.startDrawing('polygon'));
        this.drawCircle.addEventListener('click', () => this.startDrawing('circle'));
        this.drawRectangle.addEventListener('click', () => this.startDrawing('rectangle'));
    }

    copyWKT() {
        const wktText = this.wktInput.value;
        if (!wktText) {
            this.showFeedback('No WKT to copy!', 'error');
            return;
        }

        navigator.clipboard.writeText(wktText).then(() => {
            this.showFeedback('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            this.showFeedback('Failed to copy!', 'error');
        });
    }

    showFeedback(message, type = 'success') {
        this.feedbackEl.textContent = message;
        this.feedbackEl.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
        this.feedbackEl.classList.add('show');
        
        setTimeout(() => {
            this.feedbackEl.classList.remove('show');
        }, 2000);
    }

    initDrawing() {
        // Initialize Leaflet.draw plugin with all drawing controls
        this.drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true
                },
                polyline: true,
                rectangle: true,
                circle: true,
                circlemarker: true,
                marker: true
            },
            edit: {
                featureGroup: this.drawnItems,
                remove: true,
                edit: {
                    selectedPathOptions: {
                        maintainColor: true,
                        moveMarkers: true
                    }
                }
            }
        });

        this.map.addControl(this.drawControl);

        // Handle draw created event
        this.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            if (layer instanceof L.Circle) {
                layer.options.editing = { enable: () => {} }; // Add dummy editing handler
            }
            this.drawnItems.addLayer(layer);
            this.updateWKTInput();
        });

        // Handle edit events
        this.map.on(L.Draw.Event.EDITED, (e) => {
            this.updateWKTInput();
        });

        // Handle delete events
        this.map.on(L.Draw.Event.DELETED, (e) => {
            this.updateWKTInput();
        });
    }

    startDrawing(type) {
        // Remove active class from all buttons
        const buttons = document.querySelectorAll('.geometry-button');
        buttons.forEach(button => button.classList.remove('active'));

        // Add active class to clicked button
        const buttonMap = {
            'marker': this.drawPoint,
            'polyline': this.drawLine,
            'polygon': this.drawPolygon,
            'circle': this.drawCircle,
            'rectangle': this.drawRectangle
        };
        buttonMap[type].classList.add('active');

        // Disable current drawing handler if exists
        if (this.currentDrawHandler) {
            this.currentDrawHandler.disable();
        }

        // Enable new drawing handler
        this.currentDrawHandler = new L.Draw[type.charAt(0).toUpperCase() + type.slice(1)](this.map);
        this.currentDrawHandler.enable();

        // Remove active class when drawing is complete
        this.map.once(L.Draw.Event.CREATED, () => {
            buttonMap[type].classList.remove('active');
        });
    }

    clearFeatures() {
        this.drawnItems.clearLayers();
        this.wktInput.value = '';
    }

    updateWKTInput() {
        const features = [];
        this.drawnItems.eachLayer((layer) => {
            if (layer instanceof L.Circle) {
                const center = layer.getLatLng();
                const radius = layer.getRadius(); // radius in meters
                const points = this.generateCirclePoints(center, radius);
                const coordsStr = points.map(point => `${point[0]} ${point[1]}`).join(', ');
                features.push(`POLYGON((${coordsStr}))`);
            }
            else if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                const latlng = layer.getLatLng();
                features.push(`POINT(${latlng.lng} ${latlng.lat})`);
            } 
            else if (layer instanceof L.Rectangle) {
                const bounds = layer.getBounds();
                const coords = [
                    [bounds.getNorthWest().lng, bounds.getNorthWest().lat],
                    [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
                    [bounds.getSouthEast().lng, bounds.getSouthEast().lat],
                    [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
                    [bounds.getNorthWest().lng, bounds.getNorthWest().lat]
                ];
                features.push(`POLYGON((${coords.map(c => c.join(' ')).join(', ')}))`);
            }
            else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                const coords = layer.getLatLngs();
                const coordsStr = this.flattenCoordinates(coords).map(c => `${c.lng} ${c.lat}`).join(', ');
                features.push(`LINESTRING(${coordsStr})`);
            }
            else if (layer instanceof L.Polygon) {
                const coords = layer.getLatLngs();
                const coordsStr = this.flattenCoordinates(coords[0]).map(c => `${c.lng} ${c.lat}`).join(', ');
                features.push(`POLYGON((${coordsStr}))`);
            }
        });

        if (features.length === 0) {
            this.wktInput.value = '';
        } else if (features.length === 1) {
            this.wktInput.value = features[0];
        } else {
            this.wktInput.value = `GEOMETRYCOLLECTION(${features.join(', ')})`;
        }
    }

    convertGeoJSONToWKT(feature) {
        // Simple WKT conversion (basic implementation)
        const type = feature.geometry.type;
        const coords = feature.geometry.coordinates;

        switch(type) {
            case 'Point':
                return `POINT (${coords[0]} ${coords[1]})`;
            case 'LineString':
                return `LINESTRING (${coords.map(c => `${c[0]} ${c[1]}`).join(', ')})`;
            case 'Polygon':
                const polyCoords = coords[0].map(c => `${c[0]} ${c[1]}`).join(', ');
                return `POLYGON ((${polyCoords}))`;
            default:
                return 'UNSUPPORTED GEOMETRY';
        }
    }

    plotWKT() {
        const wktText = this.wktInput.value.trim();
        if (!wktText) {
            this.wktInput.classList.add('empty-error');
            setTimeout(() => {
                this.wktInput.classList.remove('empty-error');
            }, 1000);
            return;
        }

        try {
            // Clear existing features
            this.drawnItems.clearLayers();

            // Check if it's a geometry collection
            if (wktText.toUpperCase().startsWith('GEOMETRYCOLLECTION')) {
                const collectionMatch = wktText.match(/GEOMETRYCOLLECTION\s*\(\s*(.*)\s*\)/i);
                if (collectionMatch) {
                    const geometries = this.splitGeometries(collectionMatch[1]);
                    geometries.forEach(geom => {
                        const geojson = this.wktToGeoJSON(geom);
                        if (geojson) {
                            const layer = L.geoJSON(geojson);
                            this.drawnItems.addLayer(layer);
                        }
                    });
                }
            } else {
                const geojson = this.wktToGeoJSON(wktText);
                if (!geojson) {
                    alert('Invalid WKT format');
                    return;
                }
                const layer = L.geoJSON(geojson);
                this.drawnItems.addLayer(layer);
            }

            // Fit map to the features
            if (this.drawnItems.getLayers().length > 0) {
                this.map.fitBounds(this.drawnItems.getBounds());
            }
        } catch (error) {
            console.error('Error plotting WKT:', error);
            alert('Error plotting WKT. Please check the format.');
        }
    }

    wktToGeoJSON(wkt) {
        // Remove any newlines and extra spaces
        wkt = wkt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        let coordinates, type, feature;

        // POINT(30 10)
        const pointMatch = wkt.match(/POINT\s*\(\s*([^\)]+)\s*\)/i);
        if (pointMatch) {
            coordinates = pointMatch[1].split(' ').map(Number);
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [coordinates[0], coordinates[1]]
                },
                properties: {}
            };
        }

        // LINESTRING(30 10, 10 30, 40 40)
        const lineMatch = wkt.match(/LINESTRING\s*\(\s*([^\)]+)\s*\)/i);
        if (lineMatch) {
            coordinates = lineMatch[1].split(',').map(pair => 
                pair.trim().split(' ').map(Number)
            );
            return {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {}
            };
        }

        // POLYGON((30 10, 40 40, 20 40, 10 20, 30 10))
        const polygonMatch = wkt.match(/POLYGON\s*\(\s*\(\s*([^\)]+)\s*\)\s*\)/i);
        if (polygonMatch) {
            coordinates = [polygonMatch[1].split(',').map(pair => 
                pair.trim().split(' ').map(Number)
            )];
            return {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: coordinates
                },
                properties: {}
            };
        }

        // MULTIPOINT((10 40), (40 30), (20 20), (30 10))
        const multipointMatch = wkt.match(/MULTIPOINT\s*\(\s*([^\)]+)\s*\)/i);
        if (multipointMatch) {
            coordinates = multipointMatch[1].split(',').map(point => {
                const pair = point.replace(/[\(\)]/g, '').trim().split(' ').map(Number);
                return pair;
            });
            return {
                type: 'Feature',
                geometry: {
                    type: 'MultiPoint',
                    coordinates: coordinates
                },
                properties: {}
            };
        }

        return null;
    }

    splitGeometries(geometryString) {
        const geometries = [];
        let parenthesesCount = 0;
        let currentGeom = '';
        
        for (let i = 0; i < geometryString.length; i++) {
            const char = geometryString[i];
            
            if (char === '(') parenthesesCount++;
            if (char === ')') parenthesesCount--;
            
            currentGeom += char;
            
            // Only split on commas that are not within parentheses
            if (char === ',' && parenthesesCount === 0) {
                geometries.push(currentGeom.slice(0, -1).trim());
                currentGeom = '';
            }
        }
        
        if (currentGeom) {
            geometries.push(currentGeom.trim());
        }
        
        return geometries;
    }

    exportFeatures() {
        const geoJSON = this.drawnItems.toGeoJSON();
        const exportBlob = new Blob([JSON.stringify(geoJSON, null, 2)], {type: 'application/json'});
        const exportUrl = URL.createObjectURL(exportBlob);
        
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = 'geospatial_features.geojson';
        link.click();
    }

    generateCirclePoints(center, radius) {
        const points = [];
        const numPoints = 32; // number of points to approximate the circle
        
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i * 2 * Math.PI) / numPoints;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            
            // Convert offset from meters to approximate degrees
            // This is a simple approximation. For more accuracy, you might want to use a proper geodesic calculation
            const latOffset = (dy / 111111); // 111111 meters per degree of latitude
            const lngOffset = (dx / (111111 * Math.cos(center.lat * Math.PI / 180))); // adjust for latitude
            
            const lat = center.lat + latOffset;
            const lng = center.lng + lngOffset;
            
            points.push([lng, lat]);
        }
        
        // Close the polygon by repeating the first point
        points.push(points[0]);
        
        return points;
    }

    flattenCoordinates(coords) {
        if (!Array.isArray(coords)) return [coords];
        if (coords.length === 0) return [];
        if (coords[0] instanceof L.LatLng) return coords;
        return coords.reduce((acc, val) => acc.concat(this.flattenCoordinates(val)), []);
    }

    initDarkMode() {
        this.darkModeToggle = document.getElementById('darkModeToggle');
        
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark-mode');
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });

        // Toggle button click
        this.darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GeospatialApp();
});
