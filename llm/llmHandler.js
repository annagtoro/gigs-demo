require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require("@google/generative-ai");

class LLMHandler {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }

  /**
   * Use LLM to interpret ambiguous eSIM issues when rule engine doesn't match
   * @param {object} subscriptionData - Gigs API data
   * @param {string} userIssue - User's description of the problem
   * @returns {Promise<object>} LLM diagnosis with action recommendation
   */
  async diagnose(subscriptionData, userIssue) {
    const prompt = this._buildPrompt(subscriptionData, userIssue);

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      // Parse JSON response from Gemini
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON');
      }

      const diagnosis = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        diagnosis: diagnosis,
        rawResponse: responseText
      };

    } catch (error) {
      console.error('LLM Error:', error.message);

      // Fallback response if LLM fails
      return {
        success: false,
        error: error.message,
        diagnosis: {
          diagnosis: 'Unable to diagnose automatically',
          recommendedAction: 'escalate',
          confidence: 0,
          reasoning: `LLM error: ${error.message}`
        }
      };
    }
  }

  /**
   * Build the prompt for Gemini
   * @private
   */
  _buildPrompt(subscriptionData, userIssue) {
    return `You are a diagnostic assistant for Gigs mobile eSIM service. Your job is to diagnose eSIM activation issues when the rule engine cannot determine the problem.

**User's Issue:**
"${userIssue}"

**Current API State:**
${JSON.stringify(subscriptionData, null, 2)}

**Your Task:**
Analyze the user's description and API state to determine:
1. The most likely root cause
2. What action should be taken
3. Your confidence level (0-100)

**Important Context:**
- eSIM activation normally takes 10-15 minutes
- Common issues: provisioning timeout, billing holds, device configuration, carrier sync errors
- If the API shows unknown error codes, interpret them based on the error message
- If confidence is below 80%, recommend escalation to human support

**Respond ONLY with valid JSON in this exact format:**
{
  "diagnosis": "brief description of the likely issue",
  "recommendedAction": "reprovision" | "escalate" | "route_to_payment" | "route_to_settings_guide" | "wait",
  "confidence": 0-100,
  "reasoning": "explanation of why you reached this conclusion",
  "userMessage": "friendly message to send to the user explaining next steps"
}`;
  }
}

module.exports = new LLMHandler();
