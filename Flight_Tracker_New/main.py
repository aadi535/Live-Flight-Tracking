from flask import Flask, render_template, jsonify
import requests
from datetime import datetime
import threading
import time
import random

# New Flight class
class Flight:
    def __init__(self, data):
        self.icao24 = data.get('icao24', 'N/A')
        self.callsign = data.get('callsign', 'N/A').strip()
        self.origin_country = data.get('origin_country', 'Unknown')
        self.destination_country = data.get('destination_country', 'N/A')
        self.longitude = data.get('longitude', 0.0)
        self.latitude = data.get('latitude', 0.0)
        self.altitude = data.get('altitude', 0)
        self.velocity = data.get('velocity', 0)
        self.heading = data.get('heading', 0)
        self.last_contact = data.get('last_contact', 'N/A')
        self.is_european = data.get('is_european', False)
        self.flight_type = data.get('flight_type', 'private')

    def is_military_private(self):
        """Check if the flight is military or private based on callsign"""
        if not self.callsign or self.callsign == 'N/A':
            return False
        military_prefixes = ("AF", "NAVY", "ARMY", "MARINE", "CG", "PAT")
        private_prefixes = ("N", "G", "D", "F", "HB", "VP", "C")
        return (
            self.callsign.startswith(military_prefixes) or
            self.callsign.startswith(private_prefixes) or
            len(self.callsign) <= 5
        )

    def to_dict(self):
        """Convert Flight object to dictionary for JSON serialization"""
        return {
            'icao24': self.icao24,
            'callsign': self.callsign,
            'origin_country': self.origin_country,
            'destination_country': self.destination_country,
            'longitude': self.longitude,
            'latitude': self.latitude,
            'altitude': self.altitude,
            'velocity': self.velocity,
            'heading': self.heading,
            'last_contact': self.last_contact,
            'is_european': self.is_european,
            'flight_type': self.flight_type
        }

class FlightDataManager:
    def __init__(self):
        self.flight_data = []  # List of Flight objects
        self.demo_mode = False
        self.last_updated = datetime.now().strftime('%H:%M:%S')

    def update_data(self, new_data, is_demo=False):
        """Update flight data with list of Flight objects"""
        self.flight_data = new_data  # Expect new_data to be list of Flight objects
        self.demo_mode = is_demo
        self.last_updated = datetime.now().strftime('%H:%M:%S')

    def get_flights(self):
        """Return list of flight dictionaries"""
        return [flight.to_dict() for flight in self.flight_data]

    def get_flight_by_icao(self, icao24):
        """Find a flight by ICAO24 code"""
        for flight in self.flight_data:
            if flight.icao24 == icao24:
                return flight.to_dict()
        return None

    def get_status(self):
        """Return data status"""
        return {
            'flight_count': len(self.flight_data),
            'demo_mode': self.demo_mode,
            'last_updated': self.last_updated
        }

class FlightDataUpdater:
    def __init__(self, data_manager):
        self.api_url = "https://opensky-network.org/api/states/all"
        self.data_manager = data_manager
        self.retry_count = 0
        self.max_retries = 3
        self.api_call_interval = 60
        self.last_api_call = 0

    def get_demo_flights(self):
        """Generate demo flight data as Flight objects"""
        demo_flights = []
        cities = [
            {"name": "New York", "lat": 40.7128, "lon": -74.0060, "country": "United States"},
            {"name": "London", "lat": 51.5074, "lon": -0.1278, "country": "United Kingdom"},
            {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503, "country": "Japan"},
            {"name": "Paris", "lat": 48.8566, "lon": 2.3522, "country": "France"},
            {"name": "Sydney", "lat": -33.8688, "lon": 151.2093, "country": "Australia"},
            {"name": "Dubai", "lat": 25.2048, "lon": 55.2708, "country": "UAE"},
            {"name": "Singapore", "lat": 1.3521, "lon": 103.8198, "country": "Singapore"},
            {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437, "country": "United States"},
            {"name": "Frankfurt", "lat": 50.1109, "lon": 8.6821, "country": "Germany"},
            {"name": "Hong Kong", "lat": 22.3193, "lon": 114.1694, "country": "China"}
        ]
        military_prefixes = ["AF", "NAVY", "ARMY", "MARINE", "CG", "PAT"]
        private_prefixes = ["N", "G", "D", "F", "HB", "VP", "C"]
        
        for i in range(25):
            origin = random.choice(cities)
            destination = random.choice([c for c in cities if c != origin])
            prefix_type = random.choice(["military", "private"])
            prefix = random.choice(military_prefixes if prefix_type == "military" else private_prefixes)
            
            flight_data = {
                'icao24': f'demo{i:03d}',
                'callsign': f"{prefix}{random.randint(10, 999)}",
                'origin_country': origin['country'],
                'destination_country': destination['country'],
                'longitude': origin['lon'] + random.uniform(-2, 2),
                'latitude': origin['lat'] + random.uniform(-2, 2),
                'altitude': random.randint(8000, 12000),
                'velocity': random.randint(200, 300),
                'heading': random.randint(0, 359),
                'last_contact': datetime.now().strftime('%H:%M:%S'),
                'is_european': origin['country'] in ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'],
                'flight_type': prefix_type
            }
            demo_flights.append(Flight(flight_data))
        return demo_flights

    def fetch_flight_data(self):
        """Fetch live flight data from OpenSky Network API as Flight objects"""
        current_time = time.time()
        if current_time - self.last_api_call < self.api_call_interval:
            print(f"Rate limiting: {self.api_call_interval - (current_time - self.last_api_call):.0f}s remaining")
            return self.get_demo_flights(), True
        
        try:
            print("Fetching live flight data...")
            headers = {'User-Agent': 'FlightTracker/1.0 (Educational Purpose)'}
            response = requests.get(self.api_url, headers=headers, timeout=15)
            self.last_api_call = current_time
            
            if response.status_code == 200:
                data = response.json()
                flights = []
                if data and 'states' in data and data['states']:
                    for state in data['states']:
                        if state[5] and state[6]:  # Check lat/lon
                            callsign = state[1].strip() if state[1] else 'N/A'
                            flight = Flight({
                                'icao24': state[0],
                                'callsign': callsign,
                                'origin_country': state[2],
                                'destination_country': 'N/A',
                                'longitude': state[5],
                                'latitude': state[6],
                                'altitude': state[7] if state[7] else 0,
                                'velocity': state[9] if state[9] else 0,
                                'heading': state[10] if state[10] else 0,
                                'last_contact': datetime.fromtimestamp(state[4]).strftime('%H:%M:%S') if state[4] else 'N/A',
                                'is_european': state[2] in ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'],
                                'flight_type': 'military' if callsign.startswith(("AF", "NAVY", "ARMY", "MARINE", "CG", "PAT")) else 'private'
                            })
                            if flight.is_military_private():
                                flights.append(flight)
                self.retry_count = 0
                print(f"Successfully fetched {len(flights)} military/private flights")
                return flights, False
                
            elif response.status_code == 429:
                print("API Rate Limited (429) - Switching to demo mode")
                return self.get_demo_flights(), True
            else:
                print(f"API Error: {response.status_code}")
                if self.retry_count < self.max_retries:
                    self.retry_count += 1
                    print(f"Retry attempt {self.retry_count}/{self.max_retries}")
                    time.sleep(5)
                    return self.fetch_flight_data()
                return self.get_demo_flights(), True
                
        except requests.exceptions.Timeout:
            print("API request timed out - using demo data")
            return self.get_demo_flights(), True
        except Exception as e:
            print(f"Error fetching flight data: {e}")
            return self.get_demo_flights(), True

    def background_update(self):
        """Background thread to update flight data"""
        while True:
            try:
                new_data, is_demo = self.fetch_flight_data()
                if new_data:
                    self.data_manager.update_data(new_data, is_demo)
                    mode = "DEMO" if is_demo else "LIVE"
                    print(f"Updated flight data: {len(new_data)} military/private flights [{mode} MODE]")
                sleep_time = 90 if is_demo else 60
                time.sleep(sleep_time)
            except Exception as e:
                print(f"Error in background update: {e}")
                time.sleep(60)

class FlightTrackerApp:
    def __init__(self):
        self.app = Flask(__name__)
        self.data_manager = FlightDataManager()
        self.data_updater = FlightDataUpdater(self.data_manager)
        self.setup_routes()
        self.start_background_update()

    def setup_routes(self):
        """Define Flask routes"""
        @self.app.route('/')
        def index():
            return render_template('index.html')

        @self.app.route('/api/flights')
        def get_flights():
            flights = self.data_manager.get_flights()
            status = self.data_manager.get_status()
            return jsonify({
                'flights': flights,
                'count': status['flight_count'],
                'last_updated': status['last_updated'],
                'demo_mode': status['demo_mode'],
                'status': 'demo' if status['demo_mode'] else 'live'
            })

        @self.app.route('/api/flight/<icao24>')
        def get_flight_details(icao24):
            flight = self.data_manager.get_flight_by_icao(icao24)
            if flight:
                return jsonify(flight)
            return jsonify({'error': 'Flight not found'}), 404

        @self.app.route('/api/status')
        def get_status():
            status = self.data_manager.get_status()
            next_update = max(0, self.data_updater.api_call_interval - (time.time() - self.data_updater.last_api_call))
            return jsonify({
                'demo_mode': status['demo_mode'],
                'next_update_in': int(next_update),
                'flight_count': status['flight_count'],
                'api_interval': self.data_updater.api_call_interval
            })

    def start_background_update(self):
        """Start background update thread"""
        update_thread = threading.Thread(target=self.data_updater.background_update, daemon=True)
        update_thread.start()

    def run(self):
        """Run the Flask app"""
        print("=" * 50)
        print("🛩️  MILITARY/PRIVATE FLIGHT TRACKER STARTING")
        print("=" * 50)
        print("📡 Connecting to OpenSky Network API...")
        print("🔫 Tracking only military and private aircraft")
        print("🌐 Open your browser: http://localhost:5000")
        print("=" * 50)
        self.app.run(debug=True, host='0.0.0.0', port=5000)

if __name__ == '__main__':
    app = FlightTrackerApp()
    app.run()
