class Flight {
    constructor(data) {
        this.icao24 = data.icao24;
        this.callsign = data.callsign || 'N/A';
        this.origin_country = data.origin_country;
        this.destination_country = data.destination_country || 'N/A';
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.altitude = data.altitude || 0;
        this.velocity = data.velocity || 0;
        this.heading = data.heading || 0;
        this.last_contact = data.last_contact || 'N/A';
    }

    isMilitary() {
        if (!this.callsign) return false;
        const militaryPrefixes = ["AF", "NAVY", "ARMY", "MARINE", "CG", "PAT"];
        return militaryPrefixes.some(prefix => this.callsign.startsWith(prefix));
    }

    isPrivate() {
        if (!this.callsign) return false;
        const privatePrefixes = ["N", "G", "D", "F", "HB", "VP", "C"];
        return privatePrefixes.some(prefix => this.callsign.startsWith(prefix)) || this.callsign.length <= 5;
    }
}

class MapManager {
    constructor(mapElementId) {
        this.map = null;
        this.flightMarkers = [];
        this.flightPath = null;
        this.initializeMap(mapElementId);
    }

    initializeMap(mapElementId) {
        this.map = L.map(mapElementId, {
            preferCanvas: true,
            zoomSnap: 0.25,
            zoomDelta: 0.25,
            inertia: true,
            inertiaDeceleration: 1000
        }).setView([50.8503, 4.3517], 4);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 10,
            minZoom: 2
        }).addTo(this.map);

        this.addMapControls();
    }

    addMapControls() {
        const legend = L.control({ position: 'bottomleft' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'map-legend');
            div.innerHTML = `
                <h4>Flight Types</h4>
                <div><span class="legend-military">■</span> Military</div>
                <div><span class="legend-private">■</span> Private</div>
            `;
            return div;
        };
        legend.addTo(this.map);
    }

    addFlightMarker(flight, onClickCallback) {
        const isMilitary = flight.isMilitary();
        const iconColor = isMilitary ? '#ff6b6b' : '#51cf66';
        
        const icon = L.divIcon({
            className: 'flight-marker',
            html: `<span style="color:${iconColor}">✈</span>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([flight.latitude, flight.longitude], {
            icon: icon,
            rotationAngle: flight.heading,
            icao24: flight.icao24
        });
        
        marker.bindPopup(this.createFlightPopup(flight));
        marker.addTo(this.map);
        marker.flightData = flight;
        marker.on('click', () => onClickCallback(flight.icao24));
        this.flightMarkers.push(marker);
        return marker;
    }

    createFlightPopup(flight) {
        const isMilitary = flight.isMilitary();
        return `
            <div class="flight-popup">
                <h4>${flight.callsign}</h4>
                <p><strong>Type:</strong> <span class="${isMilitary ? 'military' : 'private'}">
                    ${isMilitary ? 'MILITARY' : 'PRIVATE'}
                </span></p>
                <p><strong>From:</strong> ${flight.origin_country}</p>
                <p><strong>To:</strong> ${flight.destination_country}</p>
                <p><strong>Altitude:</strong> ${Math.round(flight.altitude)} m</p>
                <p><strong>Speed:</strong> ${Math.round(flight.velocity * 3.6)} km/h</p>
                <button class="popup-btn focus-flight" data-icao="${flight.icao24}">
                    <span>✈</span> Track Flight
                </button>
            </div>`;
    }

    clearMarkers() {
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
            this.flightPath = null;
        }
        this.flightMarkers.forEach(marker => this.map.removeLayer(marker));
        this.flightMarkers = [];
    }

    highlightFlight(marker) {
        this.flightMarkers.forEach(m => {
            if (m._icon) {
                m._icon.style.transform = '';
                m._icon.style.zIndex = '';
                m._icon.style.filter = '';
            }
        });
        if (marker._icon) {
            marker._icon.style.transform = 'scale(1.5)';
            marker._icon.style.zIndex = '1000';
            marker._icon.style.filter = 'drop-shadow(0 0 8px currentColor)';
            if (!marker._popup || !marker._popup._map) {
                marker.openPopup();
            }
        }
    }

    showFlightPath(flight) {
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
            this.flightPath = null;
        }
        if (!flight.heading || !flight.velocity) return;

        const distance = flight.velocity * 0.2;
        const headingRad = (flight.heading * Math.PI) / 180;
        const lat1 = flight.latitude * Math.PI / 180;
        const lon1 = flight.longitude * Math.PI / 180;
        const R = 6371;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance/R) + 
                      Math.cos(lat1) * Math.sin(distance/R) * Math.cos(headingRad));
        const lon2 = lon1 + Math.atan2(Math.sin(headingRad) * Math.sin(distance/R) * Math.cos(lat1), 
                      Math.cos(distance/R) - Math.sin(lat1) * Math.sin(lat2));
        const endLat = lat2 * 180 / Math.PI;
        const endLng = lon2 * 180 / Math.PI;

        this.flightPath = L.curve([
            'M', [flight.latitude, flight.longitude],
            'Q', [
                flight.latitude + (endLat - flight.latitude) * 0.5 + 0.5,
                flight.longitude + (endLng - flight.longitude) * 0.5
            ],
            [endLat, endLng]
        ], {
            color: '#667eea',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.7,
            fill: false,
            smoothFactor: 1
        }).addTo(this.map);

        const arrowhead = L.polygon([
            [endLat, endLng],
            [endLat + 0.2, endLng + 0.2],
            [endLat + 0.2, endLng - 0.2]
        ], {
            color: '#667eea',
            fillColor: '#667eea',
            fillOpacity: 0.7,
            weight: 1
        }).addTo(this.map);
        
        this.flightPath.arrowhead = arrowhead;
    }

    resetMapView() {
        this.map.flyTo([40.7128, -74.0060], 3, {
            duration: 1,
            easeLinearity: 0.25
        });
    }
}

class FlightDataManager {
    constructor() {
        this.flightData = [];
        this.filteredFlights = [];
        this.selectedCountries = new Set([
            'United States', 'India', 'France', 'Latvia', 'Germany', 
            'United Kingdom', 'China', 'Japan', 'Canada', 'Australia', 'Russia', 'Brazil'
        ]);
        this.showMilitaryOnly = false;
        this.maxMarkers = 500;
    }

    async fetchFlightData() {
        try {
            const response = await fetch('/api/flights');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.flights || !Array.isArray(data.flights)) throw new Error('Invalid flight data');
            this.flightData = data.flights.map(flight => new Flight(flight));
            this.filteredFlights = this.filterFlights();
            return { count: data.count, last_updated: data.last_updated, demo_mode: data.demo_mode };
        } catch (error) {
            console.error('Fetch error:', error.message);
            throw error;
        }
    }

    filterFlights() {
        return this.flightData.filter(flight => {
            if (!this.selectedCountries.has(flight.origin_country)) return false;
            if (this.showMilitaryOnly && !flight.isMilitary()) return false;
            return true;
        });
    }

    toggleCountry(country) {
        if (this.selectedCountries.has(country)) {
            this.selectedCountries.delete(country);
        } else {
            this.selectedCountries.add(country);
        }
        this.filteredFlights = this.filterFlights();
    }

    toggleMilitaryFilter() {
        this.showMilitaryOnly = !this.showMilitaryOnly;
        this.filteredFlights = this.filterFlights();
    }
}

class UIManager {
    constructor() {
        this.focusedFlight = null;
        this.selectors = {
            flightList: '#flight-list',
            flightModal: '#flight-modal',
            modalTitle: '#modal-title',
            modalBody: '#modal-body',
            connectionStatus: '#connection-status',
            connectionText: '#connection-text',
            flightCount: '#flight-count',
            lastUpdated: '#last-updated'
        };
    }

    createWelcomePopup(closeCallback) {
        const popup = document.createElement('div');
        popup.id = 'welcome-popup';
        popup.className = 'welcome-popup';
        popup.innerHTML = `
            <div class="welcome-popup-content">
                <div class="welcome-header">
                    <div class="welcome-icon">✈️</div>
                    <h3>Welcome to Flight Tracker</h3>
                </div>
                <div class="welcome-body">
                    <p>This website displays live flight data from around the world and is intended for educational purposes only.<br> If live data is unavailable, it switches to demo mode with slightly delayed data due to usage limit. You can try it later or change your IP address..<br></p>
                </div>
                <div class="welcome-footer">
                    <button id="welcome-close" class="welcome-btn">
                        <span></span> ✓ GOT IT !<br> (click to hide)
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        setTimeout(() => popup.classList.add('show'), 2000);
        document.getElementById('welcome-close').addEventListener('click', closeCallback);
        setTimeout(() => {
            if (document.getElementById('welcome-popup')) {
                closeCallback();
            }
        }, 20000);
    }

    closeWelcomePopup() {
        const popup = document.getElementById('welcome-popup');
        if (popup) {
            popup.style.transform = 'translateY(-50%) translateX(-100px)';
            popup.style.opacity = '0';
            popup.style.left = '-400px';
            setTimeout(() => popup.remove(), 600);
        }
    }

    setupControls(countries, toggleCountryCallback, toggleMilitaryCallback, resetViewCallback) {
        const controls = document.createElement('div');
        controls.className = 'filter-controls';
        controls.innerHTML = `
            <div class="country-filters">
                <h3>Filter Countries</h3>
                <div class="country-buttons">
                    ${Array.from(countries).map(country => `
                        <button class="country-btn active" data-country="${country}">
                            ${country}
                            </button>
                    `).join('')}
                </div>
            </div>
            <div class="type-filters">
                <button id="military-filter" class="type-filter-btn">
                    🛡️ Military Only
                </button>
                <button id="reset-view" class="control-btn">
                    🌍 Reset View
                </button>
            </div>
        `;
        document.querySelector('.flight-list-section').prepend(controls);

        document.querySelectorAll('.country-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                toggleCountryCallback(btn.dataset.country);
            });
        });

        document.getElementById('military-filter').addEventListener('click', () => {
            toggleMilitaryCallback();
            document.getElementById('military-filter').textContent = 
                document.getElementById('military-filter').textContent.includes('Military Only') 
                ? '🛩️ All Types' : '🛡️ Military Only';
        });

        document.getElementById('reset-view').addEventListener('click', resetViewCallback);
    }

    updateFlightList(flights, focusFlightCallback) {
        const flightList = document.querySelector(this.selectors.flightList);
        flightList.innerHTML = '';
        
        if (flights.length === 0) {
            flightList.innerHTML = '<div class="loading-message"><p>No flights in selected countries</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const visibleFlights = flights.slice(0, 50);
        
        visibleFlights.forEach(flight => {
            const flightItem = document.createElement('div');
            flightItem.className = 'flight-item';
            if (this.focusedFlight && this.focusedFlight.icao24 === flight.icao24) {
                flightItem.classList.add('focused');
            }
            flightItem.innerHTML = this.createFlightItemHTML(flight);
            flightItem.addEventListener('click', () => focusFlightCallback(flight.icao24));
            fragment.appendChild(flightItem);
        });
        
        flightList.appendChild(fragment);
    }

    createFlightItemHTML(flight) {
        const isMilitary = flight.isMilitary();
        return `
            <div class="flight-header">
                <div class="flight-callsign">${flight.callsign}</div>
                <div class="flight-country ${isMilitary ? 'military' : 'private'}">
                    ${flight.origin_country}
                </div>
            </div>
            <div class="flight-details">
                <div class="flight-detail">
                    <span class="flight-type ${isMilitary ? 'military' : 'private'}">
                        ${isMilitary ? '🛡️ Military' : '✈️ Private'}
                    </span>
                    <span>${Math.round(flight.velocity * 3.6)} km/h</span>
                </div>
                <div class="flight-detail">
                    <span>${Math.round(flight.altitude)} m</span>
                    <span>${flight.last_contact}</span>
                </div>
            </div>`;
    }

    updateStats(count, lastUpdated, demoMode) {
        document.querySelector(this.selectors.flightCount).textContent = count;
        document.querySelector(this.selectors.lastUpdated).textContent = lastUpdated;
        
        const demoIndicator = document.getElementById('demo-indicator');
        if (demoMode) {
            if (!demoIndicator) {
                const header = document.querySelector('.header');
                const indicator = document.createElement('div');
                indicator.id = 'demo-indicator';
                indicator.className = 'demo-indicator';
                indicator.innerHTML = `
                    <span>🎯 Demo Mode Active</span>
                    <small> 🔍 "Displaying slightly delayed sample data due to usage limit. Please try again later or change your IP address.</small>
                `;
                header.appendChild(indicator);
            }
        } else if (demoIndicator) {
            demoIndicator.remove();
        }
    }

    updateConnectionStatus(status) {
        const statusDot = document.querySelector(this.selectors.connectionStatus);
        const statusText = document.querySelector(this.selectors.connectionText);
        
        statusDot.className = 'status-dot';
        switch (status) {
            case 'connected':
                statusDot.classList.add('connected');
                statusText.textContent = 'Live Data';
                break;
            case 'demo':
                statusDot.classList.add('demo');
                statusText.textContent = 'Demo Mode';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            default:
                statusText.textContent = 'Connection Error';
        }
    }

    showFlightDetails(flight, focusFlightCallback, closeModalCallback) {
        this.focusedFlight = flight;
        const isMilitary = flight.isMilitary();
        
        document.querySelector(this.selectors.modalTitle).textContent = 
            `${isMilitary ? '🛡️' : '✈️'} Flight ${flight.callsign}`;
            
        document.querySelector(this.selectors.modalBody).innerHTML = `
            <div class="modal-grid">
                <div>
                    <h4>Flight Information</h4>
                    <p><strong>Callsign:</strong> ${flight.callsign}</p>
                    <p><strong>Type:</strong> <span class="${isMilitary ? 'military' : 'private'}">
                        ${isMilitary ? 'MILITARY' : 'PRIVATE'}
                    </span></p>
                    <p><strong>From:</strong> ${flight.origin_country}</p>
                    <p><strong>To:</strong> ${flight.destination_country}</p>
                </div>
                <div>
                    <h4>Position Data</h4>
                    <p><strong>Coordinates:</strong> ${flight.latitude?.toFixed(4)}, ${flight.longitude?.toFixed(4)}</p>
                    <p><strong>Altitude:</strong> ${Math.round(flight.altitude)} m</p>
                    <p><strong>Speed:</strong> ${Math.round(flight.velocity * 3.6)} km/h</p>
                    <p><strong>Heading:</strong> ${Math.round(flight.heading)}°</p>
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn primary focus-flight" data-icao="${flight.icao24}">
                    <span>✈</span> Track on Map
                </button>
                <button class="modal-btn secondary" id="modal-close-btn">
                    Close
                </button>
            </div>
        `;
        
        document.querySelectorAll('.focus-flight').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                focusFlightCallback(btn.dataset.icao);
                closeModalCallback();
            });
        });
        
        document.getElementById('modal-close-btn').addEventListener('click', closeModalCallback);
        document.querySelector(this.selectors.flightModal).style.display = 'block';
    }

    closeModal() {
        document.querySelector(this.selectors.flightModal).style.display = 'none';
    }
}

class FlightTracker {
    constructor() {
        this.mapManager = new MapManager('map');
        this.dataManager = new FlightDataManager();
        this.uiManager = new UIManager();
        this.focusedFlight = null;
        this.updateInterval = null;
        
        this.setupEventListeners();
        this.uiManager.createWelcomePopup(() => this.uiManager.closeWelcomePopup());
        this.startDataUpdate();
    }

    setupEventListeners() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.dataManager.fetchFlightData().then(data => {
            this.uiManager.updateStats(this.dataManager.filteredFlights.length, data.last_updated, data.demo_mode);
            this.updateFlightDisplay();
        }));
        
        document.getElementById('center-btn').addEventListener('click', () => {
            this.mapManager.map.setView([50.8503, 4.3517], 4);
        });

        document.getElementById('close-modal').addEventListener('click', () => this.uiManager.closeModal());
        document.getElementById('flight-modal').addEventListener('click', (e) => {
            if (e.target.id === 'flight-modal') this.uiManager.closeModal();
        });

        this.uiManager.setupControls(
            this.dataManager.selectedCountries,
            country => {
                this.dataManager.toggleCountry(country);
                this.updateFlightDisplay();
            },
            () => {
                this.dataManager.toggleMilitaryFilter();
                this.updateFlightDisplay();
            },
            () => this.resetMapView()
        );

        document.addEventListener('click', (e) => {
            if (e.target.closest('.focus-flight-btn')) {
                const icao = e.target.closest('.focus-flight-btn').dataset.icao;
                this.focusOnFlight(icao);
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopDataUpdate();
            } else {
                this.startDataUpdate();
            }
        });

        window.addEventListener('resize', () => {
            this.mapManager.map.invalidateSize();
        });
    }

    updateFlightDisplay() {
        this.uiManager.updateFlightList(this.dataManager.filteredFlights, icao => this.focusOnFlight(icao));
        this.mapManager.clearMarkers();
        const flightsToShow = this.dataManager.filteredFlights.slice(0, this.dataManager.maxMarkers);
        flightsToShow.forEach(flight => {
            if (flight.latitude && flight.longitude) {
                const marker = this.mapManager.addFlightMarker(flight, icao => this.focusOnFlight(icao));
                if (this.focusedFlight && this.focusedFlight.icao24 === flight.icao24) {
                    this.mapManager.highlightFlight(marker);
                }
            }
        });
    }

    focusOnFlight(icao24) {
        const flight = this.dataManager.flightData.find(f => f.icao24 === icao24);
        if (!flight || !flight.latitude || !flight.longitude) return;
        
        this.focusedFlight = flight;
        this.uiManager.focusedFlight = flight;
        this.uiManager.updateFlightList(this.dataManager.filteredFlights, icao => this.focusOnFlight(icao));
        const marker = this.mapManager.flightMarkers.find(m => m.options.icao24 === icao24);
        if (marker) {
            this.mapManager.map.flyTo([flight.latitude, flight.longitude], 8, {
                duration: 1.5,
                easeLinearity: 0.25,
                noMoveStart: true
            });
            this.mapManager.highlightFlight(marker);
            this.mapManager.showFlightPath(flight);
        }
        this.uiManager.showFlightDetails(flight, icao => this.focusOnFlight(icao), () => this.uiManager.closeModal());
    }

    resetMapView() {
        this.focusedFlight = null;
        this.uiManager.focusedFlight = null;
        this.mapManager.resetMapView();
        this.mapManager.clearMarkers();
        this.updateFlightDisplay();
    }

    startDataUpdate() {
        this.dataManager.fetchFlightData().then(data => {
            this.uiManager.updateStats(this.dataManager.filteredFlights.length, data.last_updated, data.demo_mode);
            this.uiManager.updateConnectionStatus(data.demo_mode ? 'demo' : 'connected');
            this.updateFlightDisplay();
        }).catch(() => this.uiManager.updateConnectionStatus('error'));
        this.updateInterval = setInterval(() => {
            this.dataManager.fetchFlightData().then(data => {
                this.uiManager.updateStats(this.dataManager.filteredFlights.length, data.last_updated, data.demo_mode);
                this.uiManager.updateConnectionStatus(data.demo_mode ? 'demo' : 'connected');
                this.updateFlightDisplay();
            }).catch(() => this.uiManager.updateConnectionStatus('error'));
        }, 30000);
    }

    stopDataUpdate() {
        clearInterval(this.updateInterval);
    }
}

// Initialize
let flightTracker;
document.addEventListener('DOMContentLoaded', () => {
    flightTracker = new FlightTracker();
});
