from flask import Flask, request, jsonify, send_from_directory
import json
import os
import logging
import requests
import time

app = Flask(__name__)

DATA_FILE = "data.json"
current_channel = None
RESOURCES_DIR = "resources"
HTML_DIR = "html"
JS_DIR = "js"

# -------------------------------------
# LOGGING CONFIGURATION
# -------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# -------------------------------------
# CORS FOR ALL ENDPOINTS
# -------------------------------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

# -------------------------------------
# PERSISTENT DATA HANDLING
# -------------------------------------
def load_data():
    if not os.path.exists(DATA_FILE):
        logger.info(f"{DATA_FILE} not found, creating default structure")
        return {"favourites": [], "stations": [], "laststation": ""}

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        logger.exception(f"Failed to read {DATA_FILE}")
        return {"favourites": [], "stations": [], "laststation": ""}


def save_data(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved data to {DATA_FILE}")
    except Exception:
        logger.exception(f"Failed to write {DATA_FILE}")

# -------------------------------------
# /favourites ENDPOINT
# -------------------------------------
@app.route("/favourites", methods=["GET"])
def get_favourites():
    data = load_data()
    return jsonify(data.get("favourites", []))


@app.route("/favourites", methods=["POST"])
def post_favourites():
    try:
        favourites = request.get_json(force=True)
        logger.info(f"Received favourites update: {favourites}")

        data = load_data()
        data["favourites"] = favourites
        save_data(data)

        return jsonify({"status": "ok", "count": len(favourites)})

    except Exception:
        logger.exception("Error processing /favourites POST")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /stations ENDPOINT
# -------------------------------------
@app.route("/stations", methods=["GET"])
def get_stations():
    data = load_data()
    return jsonify(data.get("stations", []))


@app.route("/stations", methods=["POST"])
def post_stations():
    try:
        stations = request.get_json(force=True)
        logger.info(f"Received stations update: {stations}")

        data = load_data()
        data["stations"] = stations
        save_data(data)

        return jsonify({"status": "ok", "count": len(stations)})

    except Exception:
        logger.exception("Error processing /stations POST")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /laststation ENDPOINT (persistent)
# -------------------------------------
@app.route("/laststation", methods=["GET"])
def get_laststation():
    data = load_data()
    last = data.get("laststation", "")
    logger.info(f"GET /laststation => {last}")
    return jsonify({"laststation": last})


@app.route("/laststation", methods=["POST"])
def post_laststation():
    try:
        station_id = request.data.decode("utf-8").strip()
        logger.info(f"POST /laststation => '{station_id}'")

        if not station_id:
            logger.error("Empty stationId received")
            return jsonify({"error": "Empty stationId"}), 400

        data = load_data()
        data["laststation"] = station_id
        save_data(data)

        return jsonify({"status": "ok", "laststation": station_id})

    except Exception:
        logger.exception("Error processing /laststation POST")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /channel ENDPOINT (plain text proxy)
# -------------------------------------
@app.route("/channel", methods=["POST"])
def set_channel():
    global current_channel

    try:
        channel_id = request.data.decode("utf-8").strip()
        logger.info(f"[PROXY] Received channelId: '{channel_id}'")

        if not channel_id:
            logger.error("Empty channelId received")
            return jsonify({"error": "Empty channelId"}), 400

        current_channel = channel_id
        logger.info(f"Current channel set to: {current_channel}")

        backend_url = "http://localhost:8888/channel"
        logger.info(f"[PROXY] Forwarding channelId to {backend_url}")

        backend_response = requests.post(
            backend_url,
            data=channel_id,
            headers={"Content-Type": "text/plain"}
        )

        logger.info("Sleeping 2 seconds before returning /channel response...")
        time.sleep(2)

        return backend_response.text, backend_response.status_code, {
            "Content-Type": backend_response.headers.get(
                "Content-Type", "text/plain"
            )
        }

    except Exception:
        logger.exception("Error in /channel proxy")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /mux.json ENDPOINT (proxy)
# -------------------------------------
@app.route("/mux.json", methods=["GET"])
def get_mux():
    if not current_channel:
        logger.error("GET /mux.json called but no channel is set")
        return jsonify({"error": "No channel set"}), 400

    channel_lc = current_channel.lower()
    backend_url = "http://localhost:8888/mux.json"

    logger.info(f"[PROXY] Forwarding mux request to {backend_url} with channel={channel_lc}")

    try:
        backend_response = requests.get(
            backend_url)

        return backend_response.text, backend_response.status_code, {
            "Content-Type": backend_response.headers.get(
                "Content-Type", "application/json"
            )
        }

    except Exception:
        logger.exception("Error proxying /mux.json request")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /radio ENDPOINT
# -------------------------------------
@app.route("/radio", methods=["GET"])
def get_radio_interface():
    filename = "html/radio.html"

    if not os.path.exists(filename):
        logger.error(f"{filename} not found")
        return "html/radio.html not found", 404

    try:
        with open(filename, "r", encoding="utf-8") as f:
            html = f.read()
        logger.info("Served radio interface page")
        return html, 200, {"Content-Type": "text/html"}

    except Exception:
        logger.exception(f"Error reading {filename}")
        return "Error reading HTML file", 500

# -------------------------------------
# /html/ ENDPOINT
# -------------------------------------
@app.route("/html/<path:filename>", methods=["GET"])
def serve_html(filename):
    try:
        full_path = os.path.join(HTML_DIR, filename)

        if not os.path.exists(full_path):
            logger.error(f"html file not found: {full_path}")
            return "File not found", 404

        logger.info(f"Serving html file: {full_path}")
        return send_from_directory(HTML_DIR, filename)

    except Exception:
        logger.exception("Error serving /html file")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /resources ENDPOINT (static file server)
# -------------------------------------
@app.route("/resources/<path:filename>", methods=["GET"])
def serve_resource(filename):
    try:
        full_path = os.path.join(RESOURCES_DIR, filename)

        if not os.path.exists(full_path):
            logger.error(f"Resource not found: {full_path}")
            return "File not found", 404

        logger.info(f"Serving resource file: {full_path}")
        return send_from_directory(RESOURCES_DIR, filename)

    except Exception:
        logger.exception("Error serving /resources file")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# /js ENDPOINT (serve JavaScript files)
# -------------------------------------
@app.route("/js/<path:filename>", methods=["GET"])
def serve_js(filename):
    try:
        full_path = os.path.join(JS_DIR, filename)

        if not os.path.exists(full_path):
            logger.error(f"JS file not found: {full_path}")
            return "File not found", 404

        logger.info(f"Serving JS file: {full_path}")
        return send_from_directory(JS_DIR, filename)

    except Exception:
        logger.exception("Error serving /js file")
        return jsonify({"error": "Internal server error"}), 500

# -------------------------------------
# MAIN ENTRY POINT
# -------------------------------------
if __name__ == "__main__":
    logger.info("Starting Flask radio service...")
    app.run(host="0.0.0.0", port=5000)
else:
    gunicorn_app = app
