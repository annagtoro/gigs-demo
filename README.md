# Gigs eSIM Automation Prototype

**Rule Engine + LLM Hybrid System for eSIM Activation Issue Diagnosis**

This prototype is an intelligent automation system designed to accurately diagnose and resolve eSIM activation issues reported by users.

## 🎯 What the Application Does

The system resolves support requests utilizing a hybrid approach:
1. **Deterministic Rule Engine (Fast & Reliable):** Evaluates 7 common rules (e.g., stuck provisioning, billing holds, device configuration issues, payment overdue) based on real-time subscription and SIM data from the Gigs API.
2. **LLM Fallback (Flexible):** For ambiguous user descriptions or unknown errors, it falls back to **Google's Gemini 2.5 Flash** to interpret the situation and suggest a course of action.
3. **Automated Actions & Guardrails:** If the system is highly confident (e.g., ≥ 80%), it automatically executes solutions like reprovisioning the eSIM. If confidence is lower or actions are uncertain, it safely escalates the case to human support.

## 🚀 How to Configure It

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- **Gigs API sandbox key** (obtainable from your Gigs developer workspace)
- **Google API key** (available via [Google AI Studio](https://aistudio.google.com/))

### Configuration Steps
1. Clone the repository and navigate into the project directory:
   ```bash
   git clone <repository-url>
   cd gigs-esim-prototype
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables by copying the template:
   ```bash
   cp .env.example .env
   ```
4. Update properties in `.env` with your API keys:
   ```env
   # Gigs API Configuration
   GIGS_API_KEY=your_actual_gigs_sandbox_key_here
   GIGS_API_BASE_URL=https://api.gigs.com

   # Google AI Configuration
   GOOGLE_API_KEY=your_google_ai_key_here
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

## 💻 How to Use It

### Start the Server
Start the local Express server:
```bash
npm start
```
*(Optionally, use `npm run dev` to start with nodemon for auto-restarts during development).* 
The server will be available at `http://localhost:3000`.

### Make a Diagnosis Request
You can diagnose an issue by sending a `POST` request to the `/diagnose` endpoint with a Gigs subscription ID and the user's reported description.

**Example Request:**
```bash
curl -X POST http://localhost:3000/diagnose \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "sub_YOUR_ACTUAL_SUBSCRIPTION_ID",
    "userIssue": "my eSIM has been stuck for 2 hours"
  }'
```

**Expected Response:**
The endpoint will return a detailed JSON response indicating the method used (`rule_engine` or `llm`), the matching rule or inference, the action triggered (e.g., `reprovision`, `route_to_payment`, or `escalate`), an explanation, and the system's confidence score. 

### Run Predefined Tests
You can run automated test scenarios to observe how the application handles different issue types (both deterministic rules and LLM interpretations):
```bash
npm test
```
