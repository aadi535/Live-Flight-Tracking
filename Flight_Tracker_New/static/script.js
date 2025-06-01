// Enhanced Flight Tracker with Smooth Flight Focusing and Welcome Popup
class FlightTracker {
    constructor() {
        this.map = null;
        this.flightMarkers = [];
        this.flightData = [];
        this.filteredFlights = [];
        this.updateInterval = null;
        this.selectedCountries = new Set([
            'United States','India','France','Latvia','Germany', 
            'United Kingdom','China',
            'Japan', 'Canada', 'Australia','Russia','Brazil',
        ]);
        this.showMilitaryOnly = false;
        this.maxMarkers = 500;
        this.focusedFlight = null;
        this.flightPath = null;
        
        this.initializeMap();
        this.setupControls();
        this.setupEventListeners();
        this.createWelcomePopup();
        this.startDataUpdate();
    }
    

    createWelcomePopup() {
        // Create popup HTML
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
        

        // Add styles for the popup
        const styles = document.createElement('style');
        styles.textContent = `
            .welcome-popup {
                position: fixed;
                top: 55%;
                left: -400px;
                transform: translateY(-50%);
                width: 350px;
                background: linear-gradient(135deg,rgba(8, 36, 92, 0.93) 0%,rgba(13, 58, 114, 0.62) 100%);
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(255, 2, 2, 0.44);
                z-index: 10000;
                opacity: 0;
                transition: all 0.7s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                backdrop-filter: blur(28px);
                border: 1px solid rgba(0, 0, 0, 0.2);
            }

            .welcome-popup.show {
                left: 40px;
                opacity: 1;
            }

            .welcome-popup-content {
                padding: 25px;
                color: white;
                position: relative;
            }

            .welcome-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .welcome-icon {
                font-size: 32px;
                animation: float 3s ease-in-out infinite;
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
            }

            .welcome-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .welcome-body p {
                margin: 0;
                line-height: 1.6;
                font-size: 14px;
                opacity: 0.95;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }

            .welcome-footer {
                margin-top: 20px;
                display: flex;
                justify-content: flex-end;
            }

            .welcome-btn {
                background: rgba(184, 244, 18, 0.67);
                border: 1px solid rgba(0, 0, 0, 0.3);
                color: black;
                padding: 10px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                backdrop-filter: blur(10px);
            }

            .welcome-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgb(0, 255, 17);
            }

            .welcome-btn:active {
                transform: translateY(0);
            }

            .welcome-popup::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.1) 0%, 
                    rgba(255, 255, 255, 0.05) 50%, 
                    rgba(255, 255, 255, 0.1) 100%);
                border-radius: 16px;
                pointer-events: none;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .welcome-popup {
                    width: 90%;
                    max-width: 350px;
                    left: -100%;
                }
                
                .welcome-popup.show {
                    left: 5%;
                }
            }

            /* Pulse animation for the close button */
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }

            .welcome-btn span {
                animation: pulse 2s ease-in-out infinite;
            }
        `;

        // Add styles to head
        document.head.appendChild(styles);
        
        // Add popup to body
        document.body.appendChild(popup);

        // Show popup with delay for smooth entry
        setTimeout(() => {
            popup.classList.add('show');
        }, 2000);

        // Add close event listener
        document.getElementById('welcome-close').addEventListener('click', () => {
            this.closeWelcomePopup();
        });

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (document.getElementById('welcome-popup')) {
                this.closeWelcomePopup();
            }
        }, 20000);
    }

    closeWelcomePopup() {
        const popup = document.getElementById('welcome-popup');
        if (popup) {
            popup.style.transform = 'translateY(-50%) translateX(-100px)';
            popup.style.opacity = '0';
            popup.style.left = '-400px';
            
            setTimeout(() => {
                popup.remove();
            }, 600);
        }
    }

    initializeMap() {
        this.map = L.map('map', {
            preferCanvas: true,
            zoomSnap: 0.25,
            zoomDelta: 0.25,
            inertia: true,
            inertiaDeceleration: 3000
        }).setView([50.8503, 4.3517], 4);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 10,
            minZoom: 2
        }).addTo(this.map);

        this.addMapControls();
    }

    addMapControls() {
        const legend = L.control({position: 'bottomleft'});
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

    setupControls() {
        const controls = document.createElement('div');
        controls.className = 'filter-controls';
        controls.innerHTML = `
            <div class="country-filters">
                <h3>Filter Countries</h3>
                <div class="country-buttons">
                    ${Array.from(this.selectedCountries).map(country => `
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
    }

    setupEventListeners() {
        // Country filter buttons
        document.querySelectorAll('.country-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                const country = btn.dataset.country;
                if (btn.classList.contains('active')) {
                    this.selectedCountries.add(country);
                } else {
                    this.selectedCountries.delete(country);
                }
                this.updateFlightDisplay();
            });
        });

        // Military filter
        document.getElementById('military-filter').addEventListener('click', () => {
            this.showMilitaryOnly = !this.showMilitaryOnly;
            document.getElementById('military-filter').textContent = 
                this.showMilitaryOnly ? '🛩️ All Types' : '🛡️ Military Only';
            this.updateFlightDisplay();
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.fetchFlightData();
        });
          // Center map button
      // In your setupEventListeners or wherever the center button is defined:
document.getElementById('center-btn').addEventListener('click', () => {
    this.map.setView([50.8503, 4.3517], 4);  // Reset to Europe view
});

        // Reset view button
        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetMapView();
        });

        // Modal close
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('flight-modal').addEventListener('click', (e) => {
            if (e.target.id === 'flight-modal') this.closeModal();
        });
    }

    isMilitaryFlight(callsign) {
        if (!callsign) return false;
        const militaryPrefixes = ["AF", "NAVY", "ARMY", "MARINE", "CG", "PAT"];
        return militaryPrefixes.some(prefix => callsign.startsWith(prefix));
    }
    isPrivateFlight(callsign) {
        if (!callsign) return false;
        const privatePrefixes = ["N", "G", "D", "F", "HB", "VP", "C"];
        return privatePrefixes.some(prefix => callsign.startsWith(prefix)) || callsign.length <= 5;
    }

    filterFlights() {
        const now = Date.now();
        return this.flightData.filter(flight => {
            // Country filter
            if (!this.selectedCountries.has(flight.origin_country)) return false;
            
            // Military filter
            if (this.showMilitaryOnly && !this.isMilitaryFlight(flight.callsign)) return false;
            
            return true;
        });
    }

    async fetchFlightData() {
        try {
            this.updateConnectionStatus('connecting');
            const response = await fetch('/api/flights');
            const data = await response.json();
            
            if (response.ok) {
                this.flightData = data.flights;
                this.updateFlightDisplay();
                this.updateStats(data.count, data.last_updated, data.demo_mode);
                this.updateConnectionStatus(data.demo_mode ? 'demo' : 'connected');
            }
        } catch (error) {
            console.error('Error:', error);
            this.updateConnectionStatus('error');
        }
    }

    updateConnectionStatus(status) {
        const statusDot = document.getElementById('connection-status');
        const statusText = document.getElementById('connection-text');
        
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

    updateStats(count, lastUpdated, demoMode = false) {
        document.getElementById('flight-count').textContent = this.filteredFlights.length;
        document.getElementById('last-updated').textContent = lastUpdated;
        
        const demoIndicator = document.getElementById('demo-indicator');
        if (demoMode) {
            if (!demoIndicator) {
                const header = document.querySelector('.header');
                const indicator = document.createElement('div');
                indicator.id = 'demo-indicator';
                indicator.className = 'demo-indicator';
                indicator.innerHTML = `
                    <span>🎯 Demo Mode Active</span>
                    <small> 🔍 "Displaying slightly delayed sample data due to usage limit. Please try again later or change your IP address.
                `;
                header.appendChild(indicator);
            }
        } else if (demoIndicator) {
            demoIndicator.remove();
        }
    }

    updateFlightDisplay() {
        this.filteredFlights = this.filterFlights();
        document.getElementById('flight-count').textContent = this.filteredFlights.length;
        this.updateFlightList();
        this.updateMapMarkers();
    }

    updateFlightList() {
        const flightList = document.getElementById('flight-list');
        flightList.innerHTML = '';
        
        if (this.filteredFlights.length === 0) {
            flightList.innerHTML = '<div class="loading-message"><p>No flights in selected countries</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const visibleFlights = this.filteredFlights.slice(0, 50);
        
        visibleFlights.forEach(flight => {
            const flightItem = document.createElement('div');
            flightItem.className = 'flight-item';
            if (this.focusedFlight && this.focusedFlight.icao24 === flight.icao24) {
                flightItem.classList.add('focused');
            }
            flightItem.innerHTML = this.createFlightItemHTML(flight);
            flightItem.addEventListener('click', () => this.showFlightDetails(flight.icao24));
            fragment.appendChild(flightItem);
        });
        
        flightList.appendChild(fragment);
    }

    createFlightItemHTML(flight) {
        const isMilitary = this.isMilitaryFlight(flight.callsign);
        return `
            <div class="flight-header">
                <div class="flight-callsign">${flight.callsign || 'N/A'}</div>
                <div class="flight-country ${isMilitary ? 'military' : 'private'}">
                    ${flight.origin_country}
                </div>
            </div>
            <div class="flight-details">
                <div class="flight-detail">
                    <span class="flight-type ${isMilitary ? 'military' : 'private'}">
                        ${isMilitary ? '🛡️ Military' : '✈️ Private'}
                    </span>
                    <span>${Math.round((flight.velocity || 0) * 3.6)} km/h</span>
                </div>
                <div class="flight-detail">
                    <span>${Math.round(flight.altitude || 0)} m</span>
                    <span>${flight.last_contact || 'N/A'}</span>
                </div>
            </div>
            </button>`;
    }

    updateMapMarkers() {
        this.clearMarkers();
        
        const flightsToShow = this.filteredFlights.slice(0, this.maxMarkers);
        
        flightsToShow.forEach(flight => {
            if (flight.latitude && flight.longitude) {
                this.addFlightMarker(flight);
            }
        });
        
        // If we have a focused flight, ensure it's visible
        if (this.focusedFlight) {
            const focusedMarker = this.flightMarkers.find(
                m => m.options.icao24 === this.focusedFlight.icao24
            );
            if (focusedMarker) {
                this.highlightFlight(focusedMarker);
            }
        }
    }

    clearMarkers() {
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
            this.flightPath = null;
        }
        this.flightMarkers.forEach(marker => this.map.removeLayer(marker));
        this.flightMarkers = [];
    }

    addFlightMarker(flight) {
        const isMilitary = this.isMilitaryFlight(flight.callsign);
        const iconColor = isMilitary ? '#ff6b6b' : '#51cf66';
        
        const icon = L.divIcon({
            className: 'flight-marker',
            html: `<span style="color:${iconColor}">✈</span>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([flight.latitude, flight.longitude], {
            icon: icon,
            rotationAngle: flight.heading || 0,
            icao24: flight.icao24
        });
        
        marker.bindPopup(this.createFlightPopup(flight));
        marker.addTo(this.map);
        
        // Store reference to the original flight data
        marker.flightData = flight;
        
        // Add click handler to focus on this flight
        marker.on('click', () => {
            this.focusOnFlight(flight.icao24);
        });
        
        this.flightMarkers.push(marker);
        
        // If this is the focused flight, highlight it
        if (this.focusedFlight && this.focusedFlight.icao24 === flight.icao24) {
            this.highlightFlight(marker);
        }
    }

    createFlightPopup(flight) {
        const isMilitary = this.isMilitaryFlight(flight.callsign);
        return `
            <div class="flight-popup">
                <h4>${flight.callsign || 'UNKNOWN'}</h4>
                <p><strong>Type:</strong> <span class="${isMilitary ? 'military' : 'private'}">
                    ${isMilitary ? 'MILITARY' : 'PRIVATE'}
                </span></p>
                <p><strong>From:</strong> ${flight.origin_country}</p>
                ${flight.destination_country ? `<p><strong>To:</strong> ${flight.destination_country}</p>` : ''}
                <p><strong>Altitude:</strong> ${Math.round(flight.altitude || 0)} m</p>
                <p><strong>Speed:</strong> ${Math.round((flight.velocity || 0) * 3.6)} km/h</p>
                <button class="popup-btn focus-flight" data-icao="${flight.icao24}">
                    <span>✈</span> Track Flight
                </button>
            </div>`;
    }

    showFlightDetails(icao24) {
        const flight = this.flightData.find(f => f.icao24 === icao24);
        if (!flight) return;

        this.focusedFlight = flight;
        
        const isMilitary = this.isMilitaryFlight(flight.callsign);
        
        document.getElementById('modal-title').textContent = 
            `${isMilitary ? '🛡️' : '✈️'} Flight ${flight.callsign || 'Unknown'}`;
            
        document.getElementById('modal-body').innerHTML = `
            <div class="modal-grid">
                <div>
                    <h4>Flight Information</h4>
                    <p><strong>Callsign:</strong> ${flight.callsign || 'N/A'}</p>
                    <p><strong>Type:</strong> <span class="${isMilitary ? 'military' : 'private'}">
                        ${isMilitary ? 'MILITARY' : 'PRIVATE'}
                    </span></p>
                    <p><strong>From:</strong> ${flight.origin_country}</p>
                    <p><strong>To:</strong> ${flight.destination_country || 'N/A'}</p>
                </div>
                <div>
                    <h4>Position Data</h4>
                    <p><strong>Coordinates:</strong> ${flight.latitude?.toFixed(4)}, ${flight.longitude?.toFixed(4)}</p>
                    <p><strong>Altitude:</strong> ${Math.round(flight.altitude || 0)} m</p>
                    <p><strong>Speed:</strong> ${Math.round((flight.velocity || 0) * 3.6)} km/h</p>
                    <p><strong>Heading:</strong> ${Math.round(flight.heading || 0)}°</p>
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn primary focus-flight" data-icao="${icao24}">
                    <span>✈</span> Track on Map
                </button>
                <button class="modal-btn secondary" onclick="flightTracker.closeModal()">
                    Close
                </button>
            </div>
        `;
        
        // Add event listeners to focus buttons in modal
        document.querySelectorAll('.focus-flight').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.focusOnFlight(btn.dataset.icao);
                this.closeModal();
            });
        });
        
        document.getElementById('flight-modal').style.display = 'block';
    }

    focusOnFlight(icao24) {
        const flight = this.flightData.find(f => f.icao24 === icao24);
        if (!flight || !flight.latitude || !flight.longitude) return;
        
        this.focusedFlight = flight;
        
        // Find the marker for this flight
        const marker = this.flightMarkers.find(m => m.options.icao24 === icao24);
        if (!marker) return;
        
        // Update flight list to highlight the focused flight
        this.updateFlightList();
        
        // Fly to the flight's location with smooth animation
        this.map.flyTo([flight.latitude, flight.longitude], 8, {
            duration: 1.5,
            easeLinearity: 0.25,
            noMoveStart: true
        });
        
        // Highlight the flight on the map
        this.highlightFlight(marker);
        
        // Show flight path if we have heading and speed
        this.showFlightPath(flight);
    }

    highlightFlight(marker) {
        // Remove any existing highlights first
        this.flightMarkers.forEach(m => {
            if (m._icon) {
                m._icon.style.transform = '';
                m._icon.style.zIndex = '';
                m._icon.style.filter = '';
            }
        });
        
        // Highlight the selected marker
        if (marker._icon) {
            marker._icon.style.transform = 'scale(1.5)';
            marker._icon.style.zIndex = '1000';
            marker._icon.style.filter = 'drop-shadow(0 0 8px currentColor)';
            
            // Open popup if not already open
            if (!marker._popup || !marker._popup._map) {
                marker.openPopup();
            }
        }
    }

    showFlightPath(flight) {
        // Remove any existing flight path
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
        }
        
        if (!flight.heading || !flight.velocity) return;
        
        // Calculate endpoint based on heading and velocity (scaled for visibility)
        const distance = flight.velocity * 0.2; // Scale factor
        const headingRad = (flight.heading * Math.PI) / 180;
        
        const lat1 = flight.latitude * Math.PI / 180;
        const lon1 = flight.longitude * Math.PI / 180;
        const R = 6371; // Earth's radius in km
        
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance/R) + 
                      Math.cos(lat1) * Math.sin(distance/R) * Math.cos(headingRad));
        const lon2 = lon1 + Math.atan2(Math.sin(headingRad) * Math.sin(distance/R) * Math.cos(lat1), 
                      Math.cos(distance/R) - Math.sin(lat1) * Math.sin(lat2));
        
        const endLat = lat2 * 180 / Math.PI;
        const endLng = lon2 * 180 / Math.PI;
        
        // Create a curved path to show direction
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
        
        // Add arrowhead at the end
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
        this.focusedFlight = null;
        this.map.flyTo([40.7128, -74.0060], 3, {
            duration: 1,
            easeLinearity: 0.25
        });
        
        if (this.flightPath) {
            this.map.removeLayer(this.flightPath);
            this.flightPath = null;
        }
        
        // Reset marker highlights
        this.flightMarkers.forEach(marker => {
            if (marker._icon) {
                marker._icon.style.transform = '';
                marker._icon.style.zIndex = '';
                marker._icon.style.filter = '';
            }
        });
        
        // Update flight list to remove focus highlights
        this.updateFlightList();
    }

    closeModal() {
        document.getElementById('flight-modal').style.display = 'none';
    }

    startDataUpdate() {
        this.fetchFlightData();
        this.updateInterval = setInterval(() => this.fetchFlightData(), 30000);
    }

    stopDataUpdate() {
        clearInterval(this.updateInterval);
    }
}

// Initialize
let flightTracker;
document.addEventListener('DOMContentLoaded', () => {
    flightTracker = new FlightTracker();
    
    // Delegate focus flight button events
    document.addEventListener('click', (e) => {
        if (e.target.closest('.focus-flight-btn')) {
            const icao = e.target.closest('.focus-flight-btn').dataset.icao;
            flightTracker.focusOnFlight(icao);
        }
    });
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        flightTracker?.stopDataUpdate();
    } else {
        flightTracker?.startDataUpdate();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    flightTracker?.map?.invalidateSize();
});