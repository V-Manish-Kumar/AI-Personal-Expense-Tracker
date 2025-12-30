from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime
from gemini_agent import chatbot

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("expenses.db", timeout=10) # Added timeout
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    try:
        with get_db() as db:
            # Check if date column exists by reading schema
            cursor = db.execute("PRAGMA table_info(expenses)")
            columns = [info[1] for info in cursor.fetchall()]
            
            if "date" not in columns:
                print("Migrating DB: Adding 'date' column.")
                try:
                    db.execute("ALTER TABLE expenses ADD COLUMN date TEXT")
                    # Update existing rows to have a date
                    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    db.execute("UPDATE expenses SET date = ? WHERE date IS NULL", (now,))
                    db.commit()
                    print("Migration Successful.")
                except Exception as e:
                    print(f"Migration Failed: {e}")
                    
    except Exception as e:
        print(f"DB Init Error: {e}")

# Initialize DB on startup
# Ensure 'expenses' table exists first (basic create)
with get_db() as db:
    db.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            note TEXT,
            date TEXT
        )
    """)
    db.commit()

init_db()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/add_expense", methods=["POST"])
def add_expense():
    try:
        data = request.json
        # Use Python datetime to ensure correct format
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with get_db() as db:
            db.execute(
                "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
                (data["amount"], data["category"], data["note"], now)
            )
            db.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/expenses")
def expenses():
    try:
        with get_db() as db:
            cur = db.execute(
                "SELECT category, SUM(amount) as total FROM expenses GROUP BY category"
            )
            data = [[row["category"], row["total"]] for row in cur.fetchall()]
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/recent_expenses")
def recent_expenses():
    try:
        with get_db() as db:
            # Fallback for old rows w/o date if migration failed partially
            cur = db.execute(
                "SELECT category, amount, note, COALESCE(date, 'N/A') as date FROM expenses ORDER BY date DESC LIMIT 10"
            )
            data = [dict(row) for row in cur.fetchall()]
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/spending_trend")
def spending_trend():
    try:
        with get_db() as db:
            # Group by YYYY-MM-DD
            # SQLite substring for YYYY-MM-DD from 'YYYY-MM-DD HH:MM:SS' is substr(date, 1, 10)
            cur = db.execute("""
                SELECT substr(date, 1, 10) as day, SUM(amount) as total 
                FROM expenses 
                WHERE date IS NOT NULL
                GROUP BY day 
                ORDER BY day DESC 
                LIMIT 7
            """)
            data = [[row["day"], row["total"]] for row in cur.fetchall()]
            data.reverse()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stats")
def stats():
    try:
        with get_db() as db:
            total_res = db.execute("SELECT SUM(amount) as t FROM expenses").fetchone()
            count_res = db.execute("SELECT COUNT(*) as c FROM expenses").fetchone()
            max_res = db.execute("SELECT category, MAX(amount) as m FROM expenses").fetchone()
            
            stats = {
                "total_balance": total_res["t"] if total_res["t"] else 0,
                "transaction_count": count_res["c"],
                "highest_category": max_res["category"] if max_res["category"] else "N/A"
            }
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/init_chat", methods=["POST"])
def init_chat():
    try:
        with get_db() as db:
            cur = db.execute("SELECT category, amount FROM expenses")
            data = [[row["category"], row["amount"]] for row in cur.fetchall()]
        
        greeting = chatbot.start_new_session(data)
        return jsonify({"response": greeting})
    except Exception as e:
        return jsonify({"response": f"Server Error: {str(e)}"})

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_msg = data.get("message")
    response = chatbot.send_message(user_msg)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run(debug=True)
