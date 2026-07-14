import os
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from groq import Groq
import pypdf
from dotenv import load_dotenv

# Load environment variables if present
load_dotenv()

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

# Helper to fetch configuration secrets from either environment or .streamlit/secrets.toml
def get_secret(key, default=None):
    try:
        from dotenv import load_dotenv
        load_dotenv(override=True)
    except Exception:
        pass
    val = os.environ.get(key)
    if val is not None:
        return val
    try:
        import toml
        secrets_path = os.path.join(".streamlit", "secrets.toml")
        if os.path.exists(secrets_path):
            with open(secrets_path, "r") as f:
                data = toml.load(f)
                if key in data:
                    return data[key]
    except Exception:
        pass
    return default

FIREBASE_API_KEY = get_secret("FIREBASE_API_KEY")
FIREBASE_PROJECT_ID = get_secret("FIREBASE_PROJECT_ID")
ADMIN_EMAIL = get_secret("ADMIN_EMAIL", "admin@studysync.com")
ADMIN_PASSWORD = get_secret("ADMIN_PASSWORD", "AdminSecure2026")
GROQ_API_KEY = get_secret("GROQ_API_KEY")

# Lazy Groq client initialization
groq_client = None
def get_groq_client():
    global groq_client
    if groq_client is None:
        key = get_secret("GROQ_API_KEY")
        if not key:
            raise ValueError("GROQ_API_KEY is not configured in the backend secrets (.env or environment variables).")
        os.environ["GROQ_API_KEY"] = key
        groq_client = Groq()
    return groq_client

# --- FIREBASE AUTHENTICATION FUNCTIONS ---
def firebase_auth(email, password, mode="signInWithPassword"):
    if not FIREBASE_API_KEY:
        return {"success": False, "message": "FIREBASE_API_KEY is not configured in the backend secrets."}
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:{mode}?key={FIREBASE_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    try:
        response = requests.post(url, json=payload)
        res_data = response.json()
        if response.status_code == 200:
            return {
                "success": True, 
                "email": res_data["email"], 
                "uid": res_data["localId"],
                "idToken": res_data["idToken"]
            }
        else:
            return {"success": False, "message": res_data.get("error", {}).get("message", "Authentication Failed")}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_email_from_username(username):
    if not FIREBASE_PROJECT_ID: 
        return None
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users/{username}"
    try:
        res = requests.get(url)
        if res.status_code == 200 and res.json():
            return res.json().get("fields", {}).get("email", {}).get("stringValue", None)
    except Exception: 
        return None
    return None

def get_username_from_email(email):
    if not FIREBASE_PROJECT_ID: 
        return None
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery"
    payload = {
        "structuredQuery": {
            "from": [{"collectionId": "users"}], 
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "email"}, 
                    "op": "EQUAL", 
                    "value": {"stringValue": email}
                }
            }, 
            "limit": 1
        }
    }
    try:
        res = requests.post(url, json=payload)
        if res.status_code == 200:
            res_data = res.json()
            if res_data and isinstance(res_data, list) and "document" in res_data[0]:
                return res_data[0]["document"]["name"].split("/")[-1]
    except Exception: 
        return None
    return None

def save_user_data_to_firestore(id_token, roadmap_list, username, email):
    if not FIREBASE_PROJECT_ID: 
        return False
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users/{username}"
    payload = {
        "fields": {
            "roadmap_json": {"stringValue": json.dumps(roadmap_list)}, 
            "username": {"stringValue": username}, 
            "email": {"stringValue": email}
        }
    }
    headers = {"Authorization": f"Bearer {id_token}"}
    try:
        res = requests.patch(url, json=payload, headers=headers)
        return res.status_code == 200
    except Exception: 
        return False

def load_user_data_from_firestore(username, id_token=None):
    if not FIREBASE_PROJECT_ID: 
        return []
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users/{username}"
    headers = {"Authorization": f"Bearer {id_token}"} if id_token else {}
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200 and res.json():
            return json.loads(res.json().get("fields", {}).get("roadmap_json", {}).get("stringValue", "[]"))
    except Exception: 
        return []
    return []

def get_all_users_from_firestore():
    if not FIREBASE_PROJECT_ID: 
        return []
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users"
    try:
        res = requests.get(url)
        if res.status_code == 200 and res.json():
            documents = res.json().get("documents", [])
            parsed_users = []
            for doc in documents:
                fields = doc.get("fields", {})
                doc_id = doc.get("name", "").split("/")[-1]
                email = fields.get("email", {}).get("stringValue", "N/A")
                username = fields.get("username", {}).get("stringValue", doc_id)
                roadmap_raw = fields.get("roadmap_json", {}).get("stringValue", "[]")
                try:
                    milestones = len(json.loads(roadmap_raw))
                except Exception:
                    milestones = 0
                parsed_users.append({
                    "username": username,
                    "email": email,
                    "milestones_count": milestones
                })
            return parsed_users
    except Exception:
        return []
    return []

# --- STATIC ROUTING ENDPOINTS ---
@app.route("/favicon.ico")
def favicon():
    return "", 204

@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")

@app.route("/<path:path>")
def static_files(path):
    # Fallback to static folder
    return send_from_directory("frontend", path)

# --- API ENDPOINTS ---
@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    username_input = data.get("username", "").strip()
    email_input = data.get("email", "").strip()
    password = data.get("password", "")

    if not username_input and not email_input:
        return jsonify({"success": False, "message": "Please provide either Username or Email."}), 400
    if not password:
        return jsonify({"success": False, "message": "Please enter your password."}), 400

    resolved_email = email_input
    if not resolved_email and username_input:
        resolved_email = get_email_from_username(username_input)
        if not resolved_email:
            return jsonify({"success": False, "message": "Username profile record not found."}), 404

    result = firebase_auth(resolved_email, password, mode="signInWithPassword")
    if result["success"]:
        resolved_username = username_input
        if email_input:
            user_from_db = get_username_from_email(result["email"])
            resolved_username = user_from_db if user_from_db else result["email"]

        roadmap_list = load_user_data_from_firestore(resolved_username, result["idToken"])
        return jsonify({
            "success": True,
            "email": result["email"],
            "uid": result["uid"],
            "idToken": result["idToken"],
            "username": resolved_username,
            "roadmap_list": roadmap_list
        })
    else:
        return jsonify({"success": False, "message": result["message"]}), 401

@app.route("/api/auth/signup", methods=["POST"])
def api_signup():
    data = request.get_json() or {}
    username_input = data.get("username", "").strip()
    email_input = data.get("email", "").strip()
    password = data.get("password", "")

    if not username_input or not email_input or not password:
        return jsonify({"success": False, "message": "Please fill out all registration fields."}), 400
    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400

    result = firebase_auth(email_input, password, mode="signUp")
    if result["success"]:
        save_user_data_to_firestore(result["idToken"], [], username_input, result["email"])
        return jsonify({
            "success": True,
            "email": result["email"],
            "uid": result["uid"],
            "idToken": result["idToken"],
            "username": username_input,
            "roadmap_list": []
        })
    else:
        return jsonify({"success": False, "message": result["message"]}), 400

@app.route("/api/auth/admin-login", methods=["POST"])
def api_admin_login():
    data = request.get_json() or {}
    email_input = data.get("email", "").strip()
    password = data.get("password", "")

    if not email_input or not password:
        return jsonify({"success": False, "message": "Please provide administrative credentials."}), 400

    if email_input == ADMIN_EMAIL and password == ADMIN_PASSWORD:
        return jsonify({
            "success": True,
            "isAdmin": True,
            "username": "Root_Admin",
            "email": ADMIN_EMAIL,
            "idToken": "root_admin_token"
        })
    
    result = firebase_auth(email_input, password, mode="signInWithPassword")
    if result["success"]:
        return jsonify({
            "success": True,
            "isAdmin": True,
            "username": "Admin_" + result["email"].split("@")[0],
            "email": result["email"],
            "idToken": result["idToken"]
        })
    else:
        return jsonify({"success": False, "message": "Administrative access credentials block failure."}), 401

@app.route("/api/admin/users", methods=["GET"])
def api_admin_users():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    users = get_all_users_from_firestore()
    return jsonify({"success": True, "users": users})

@app.route("/api/admin/load-roadmap", methods=["POST"])
def api_admin_load_roadmap():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    id_token = auth_header.split(" ")[1] if " " in auth_header else auth_header
    data = request.get_json() or {}
    target_username = data.get("username", "")
    if not target_username:
        return jsonify({"success": False, "message": "No username provided"}), 400
    
    deep_roadmap = load_user_data_from_firestore(target_username, id_token)
    if not deep_roadmap:
        if FIREBASE_PROJECT_ID:
            url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users/{target_username}"
            fallback_res = requests.get(url)
            if fallback_res.status_code == 200:
                deep_roadmap = json.loads(fallback_res.json().get("fields", {}).get("roadmap_json", {}).get("stringValue", "[]"))
    
    return jsonify({"success": True, "roadmap": deep_roadmap})

@app.route("/api/save-roadmap", methods=["POST"])
def api_save_roadmap():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    id_token = auth_header.split(" ")[1] if " " in auth_header else auth_header
    data = request.get_json() or {}
    username = data.get("username")
    email = data.get("email")
    roadmap_list = data.get("roadmap_list", [])

    if not username:
        return jsonify({"success": False, "message": "Username is required"}), 400
    
    if username == "Root_Admin" or id_token == "root_admin_token":
        return jsonify({"success": True, "message": "Admin changes simulated successfully!"})

    success = save_user_data_to_firestore(id_token, roadmap_list, username, email)
    if success:
        return jsonify({"success": True, "message": "Roadmap progress saved successfully."})
    else:
        return jsonify({"success": False, "message": "Failed to save roadmap to Firestore."}), 500

@app.route("/api/generate-roadmap", methods=["POST"])
def api_generate_roadmap():
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No syllabus PDF uploaded."}), 400
    
    file = request.files["file"]
    # Consume the upload stream fully to prevent browser TCP connection resets
    _ = file.read()
    file.seek(0)

    start_time_str = request.form.get("start_time", "09:00")
    end_time_str = request.form.get("end_time", "17:00")
    username = request.form.get("username", "")
    email = request.form.get("email", "")
    auth_header = request.headers.get("Authorization")
    id_token = None
    if auth_header and " " in auth_header:
        id_token = auth_header.split(" ")[1]

    if not file.filename.endswith(".pdf"):
        return jsonify({"success": False, "message": "Please upload a PDF file."}), 400
    
    try:
        reader = pypdf.PdfReader(file)
        pdf_text = ""
        
        for page in reader.pages[:20]:
            pdf_text += page.extract_text() or ""
            
        if not pdf_text.strip():
            return jsonify({
                "success": False, 
                "message": "❌ Generation Error: Unable to extract readable text characters. This document matches a flat picture image scan. Please upload a pure digital text PDF file."
            }), 400
        
        # Convert 24h format from HTML to 12h format
        try:
            from datetime import datetime
            st_time = datetime.strptime(start_time_str, "%H:%M")
            en_time = datetime.strptime(end_time_str, "%H:%M")
            formatted_start = st_time.strftime("%I:%M %p")
            formatted_end = en_time.strftime("%I:%M %p")
        except Exception:
            formatted_start = start_time_str
            formatted_end = end_time_str
            
        prompt = f"""
        Analyze this course syllabus text:
        {pdf_text[:14000]}
        
        Based on the syllabus content, construct a chronological study roadmap where:
        1. There is EXACTLY ONE entry (object) in the "roadmap" array for each study date. Do not duplicate dates.
        2. The "Time Slot" field for every single entry must be exactly the string: "{formatted_start} - {formatted_end}". Do not split this window into smaller intervals.
        3. For each date, extract 2 to 3 distinct sub-topics/units from the syllabus text and list them in the "Focus Topic" and "Suggested Activity" fields.
        
        Format your JSON output strictly as:
        {{
            "roadmap": [
                {{
                    "Scheduled Date": "YYYY-MM-DD",
                    "Time Slot": "{formatted_start} - {formatted_end}",
                    "Focus Topic": "Extracted Topic 1 & Extracted Topic 2 (e.g. Unit 1: Introduction to C & Unit 2: Pointers)",
                    "Suggested Activity": "1. Study Topic 1: [Specific description of first syllabus concept]\\n2. Study Topic 2: [Specific description of second syllabus concept]\\n3. Study Topic 3: [Specific description of third syllabus concept]"
                }}
            ]
        }}
        """
        try:
            active_groq_client = get_groq_client()
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 400

        response = active_groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this course syllabus text:
--- START SYLLABUS TEXT ---
{pdf_text[:6000]}
--- END SYLLABUS TEXT ---

You are a precise study roadmap JSON generator. Construct a daily study schedule based on the syllabus text above.

You MUST follow these CRITICAL rules:
1. EXACTLY ONE ENTRY (ROW) PER DAY: The "roadmap" array must contain exactly one object per calendar date. Do not create multiple rows or entries for the same date. Each study date must be unique.
2. TIME SLOT: The "Time Slot" field for every single entry in the array must be exactly the string: "{formatted_start} - {formatted_end}". Do not split this time slot into smaller sub-intervals.
3. SUBJECT-BY-SUBJECT SEQUENCE: Process the subjects sequentially. Completely finish all units and topics of the first subject before moving to the next subject. Do not jump back and forth between different subjects.
4. UNIT-BY-UNIT SEQUENCE: Within each subject, cover the units in strict sequential order (Unit 1, then Unit 2, then Unit 3, etc.). You must never combine multiple units into a single day.
5. SPREAD EACH UNIT OVER AT LEAST 3 DAYS: Each single unit must be divided and spread across AT LEAST 3 consecutive days. For example, Unit 1 must take at least 3 days of study (e.g. Day 1 covers Unit 1 part A, Day 2 covers Unit 1 part B, Day 3 covers Unit 1 part C). You can only proceed to Unit 2 after spending at least 3 days on Unit 1.
6. SLOW PROGRESSIVE DAILY PACE: For each day's entry, focus on exactly 1 or 2 small sub-topics from the current unit. Do not pack multiple units or subjects into a single day.

Format your JSON output strictly as:
{{
    "roadmap": [
        {{
            "Scheduled Date": "YYYY-MM-DD",
            "Time Slot": "{formatted_start} - {formatted_end}",
            "Focus Topic": "Subject Name - Unit X (Day Y of 3): Topic name (e.g. C Programming - Unit 1 (Day 1 of 3): Introduction to Variables)",
            "Suggested Activity": "1. Study Concept 1: [Specific description of first syllabus concept]\\n2. Study Concept 2: [Specific description of second syllabus concept]"
        }}
    ]
}}
"""
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2500  
        )
        
        raw_json = json.loads(response.choices[0].message.content)
        roadmap_data = raw_json.get("roadmap", [])
        for item in roadmap_data:
            item["Status"] = False
            
        # Save to database if not admin and username is provided
        if username and username != "Root_Admin" and id_token and id_token != "root_admin_token":
            save_user_data_to_firestore(id_token, roadmap_data, username, email)
            
        return jsonify({"success": True, "roadmap": roadmap_data})
        
    except Exception as e:
        return jsonify({"success": False, "message": f"App compilation process encountered an evaluation exception: {str(e)}"}), 500

if __name__ == "__main__":
    import os
    # Bind to PORT environment variable dynamically (required by Render/Heroku)
    port = int(os.environ.get("PORT", 5000))
    # Enable Flask auto-reload/debugger locally but disable in cloud production
    debug_mode = os.environ.get("PORT") is None
    app.run(host="0.0.0.0", port=port, debug=debug_mode)