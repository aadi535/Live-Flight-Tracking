from flask import Flask, render_template, jsonify
import requests
import json
from datetime import datetime
import threading
import time
import random

app = Flask(__name__)

# Global variables
flight_data = []
last_api_call = 0
api_call_interval = 60  # Minimum 60 seconds between API calls
demo_mode = False

class FlightDataUpdater:
    def __init__(self):
        self.api_url = "https://opensky-network.org/api/states/all"
        self.retry_count = 0
        self.max_retries = 3
        
    def get_demo_flights(self):
        """Generate demo flight data when API is unavailable"""
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
        
        # Military/private flight identifiers
        military_prefixes = ["AF", "NAVY", "ARMY", "MARINE", "CG", "PAT"]
        private_prefixes = ["N", "G", "D", "F", "HB", "VP", "C"]
        
        for i in range(25):
            origin = random.choice(cities)
            destination = random.choice([c for c in cities if c != origin])
            
            # Only create military/private flights for demo
            prefix_type = random.choice(["military", "private"])
            if prefix_type == "military":
                prefix = random.choice(military_prefixes)
            else:
                prefix = random.choice(private_prefixes)
            
            flight = {
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
            demo_flights.append(flight)
        
        return demo_flights
        
    def is_military_private(self, callsign):
        """Check if a callsign indicates military or private flight"""
        if not callsign or callsign == 'N/A':
            return False
            
        callsign = str(callsign).strip()
        
        military_prefixes = ("AF", "NAVY", "ARMY", "MARINE", "CG", "PAT")
        private_prefixes = ("N", "G", "D", "F", "HB", "VP", "C")
        
        return (
            callsign.startswith(military_prefixes) or
            callsign.startswith(private_prefixes) or
            len(callsign) <= 5  # Many private flights have short callsigns
        )

    def fetch_flight_data(self):
        """Fetch live flight data from OpenSky Network API with military/private filtering"""
        global last_api_call, demo_mode
        
        current_time = time.time()
        
        # Check rate limiting
        if current_time - last_api_call < api_call_interval:
            print(f"Rate limiting: {api_call_interval - (current_time - last_api_call):.0f}s remaining")
            if demo_mode:
                return self.get_demo_flights()
            return []
        
        try:
            print("Fetching live flight data...")
            headers = {'User-Agent': 'FlightTracker/1.0 (Educational Purpose)'}
            response = requests.get(self.api_url, headers=headers, timeout=15)
            last_api_call = current_time
            
            if response.status_code == 200:
                data = response.json()
                flights = []
                
                if data and 'states' in data and data['states']:
                    for state in data['states']:
                        if state[5] and state[6]:  # Check if lat/lon exist
                            callsign = state[1].strip() if state[1] else 'N/A'
                            
                            # Only include military/private flights
                            if not self.is_military_private(callsign):
                                continue
                                
                            flight_type = "military" if str(callsign).startswith(("AF", "NAVY", "ARMY", "MARINE", "CG", "PAT")) else "private"
                            
                            flight = {
                                'icao24': state[0],
                                'callsign': callsign,
                                'origin_country': state[2],
                                'destination_country': 'N/A',  # OpenSky doesn't provide destination
                                'longitude': state[5],
                                'latitude': state[6],
                                'altitude': state[7] if state[7] else 0,
                                'velocity': state[9] if state[9] else 0,
                                'heading': state[10] if state[10] else 0,
                                'last_contact': datetime.fromtimestamp(state[4]).strftime('%H:%M:%S') if state[4] else 'N/A',
                                'is_european': state[2] in ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'],
                                'flight_type': flight_type
                            }
                            flights.append(flight)
                
                self.retry_count = 0
                demo_mode = False
                print(f"Successfully fetched {len(flights)} military/private flights")
                return flights
                
            elif response.status_code == 429:
                print("API Rate Limited (429) - Switching to demo mode")
                demo_mode = True
                return self.get_demo_flights()
            else:
                print(f"API Error: {response.status_code}")
                if self.retry_count < self.max_retries:
                    self.retry_count += 1
                    print(f"Retry attempt {self.retry_count}/{self.max_retries}")
                    time.sleep(5)
                    return self.fetch_flight_data()
                else:
                    print("Max retries reached, switching to demo mode")
                    demo_mode = True
                    return self.get_demo_flights()
                
        except requests.exceptions.Timeout:
            print("API request timed out - using demo data")
            demo_mode = True
            return self.get_demo_flights()
        except Exception as e:
            print(f"Error fetching flight data: {e}")
            demo_mode = True
            return self.get_demo_flights()

    def background_update(self):
        """Background thread to update flight data with intelligent intervals"""
        global flight_data
        while True:
            try:
                new_data = self.fetch_flight_data()
                if new_data:
                    flight_data = new_data
                    mode = "DEMO" if demo_mode else "LIVE"
                    print(f"Updated flight data: {len(flight_data)} military/private flights [{mode} MODE]")
                
                # Dynamic sleep based on API status
                sleep_time = 90 if demo_mode else 60
                time.sleep(sleep_time)
                
            except Exception as e:
                print(f"Error in background update: {e}")
                time.sleep(60)

# Initialize flight tracker
data_updater = FlightDataUpdater()

@app.route('/')
def index():
    """Main page route"""
    return render_template('index.html')

@app.route('/api/flights')
def get_flights():
    """API endpoint to get current flight data (only military/private)"""
    global flight_data, demo_mode
    return jsonify({
        'flights': flight_data,  # Already filtered by the updater
        'count': len(flight_data),
        'last_updated': datetime.now().strftime('%H:%M:%S'),
        'demo_mode': demo_mode,
        'status': 'demo' if demo_mode else 'live'
    })

@app.route('/api/flight/<icao24>')
def get_flight_details(icao24):
    """Get details for a specific flight"""
    global flight_data
    for flight in flight_data:
        if flight['icao24'] == icao24:
            return jsonify(flight)
    return jsonify({'error': 'Flight not found'}), 404

@app.route('/api/status')
def get_status():
    """Get API status information"""
    global demo_mode, last_api_call
    next_update = max(0, api_call_interval - (time.time() - last_api_call))
    return jsonify({
        'demo_mode': demo_mode,
        'next_update_in': int(next_update),
        'flight_count': len(flight_data),
        'api_interval': api_call_interval
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
