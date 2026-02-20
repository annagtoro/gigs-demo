const express = require('express');
const gigsClient = require('./api/gigsClient');
const ruleEngine = require('./rules/ruleEngine');
const llmHandler = require('./llm/llmHandler');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * Main diagnostic endpoint
 * POST /diagnose
 * Body: { subscriptionId: string, userIssue: string }
 */
app.post('/diagnose', async (req, res) => {
  const startTime = Date.now();

  try {
    const { subscriptionId, userIssue } = req.body;

    // Validation
    if (!subscriptionId || !userIssue) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['subscriptionId', 'userIssue']
      });
    }

    console.log(`\n[DIAGNOSE] Starting diagnosis for subscription: ${subscriptionId}`);
    console.log(`[DIAGNOSE] User issue: "${userIssue}"\n`);

    // Step 1: Fetch subscription data from Gigs API
    console.log('[STEP 1] Fetching subscription data from Gigs API...');
    const subscriptionResponse = await gigsClient.getSubscription(subscriptionId);

    if (!subscriptionResponse.success) {
      return res.status(500).json({
        error: 'Failed to fetch subscription data',
        details: subscriptionResponse.error
      });
    }

    const subscriptionData = subscriptionResponse.data;
    console.log(`[STEP 1] ✓ Got subscription data - SIM status: ${subscriptionData.sim?.status}, Subscription status: ${subscriptionData.status}`);

    // Step 2: Try rule engine first
    console.log('\n[STEP 2] Running rule engine...');
    const ruleResult = ruleEngine.evaluate(subscriptionData, userIssue);

    if (ruleResult) {
      console.log(`[STEP 2] ✓ Rule matched: ${ruleResult.ruleName}`);

      // Execute action if needed
      let actionResult = null;
      if (ruleResult.action === 'reprovision' && ruleResult.simId) {
        console.log('[ACTION] Triggering SIM reprovision...');
        actionResult = await gigsClient.reprovisionSIM(ruleResult.simId);
      }

      const response = {
        method: 'rule_engine',
        rule: ruleResult.ruleName,
        confidence: ruleResult.confidence,
        action: ruleResult.action,
        message: ruleResult.message,
        reasoning: ruleResult.reasoning,
        actionResult: actionResult,
        apiCalls: [
          `GET /subscriptions/${subscriptionId}`,
          ...(actionResult ? [`POST /sims/${ruleResult.simId}/reprovision`] : [])
        ],
        processingTimeMs: Date.now() - startTime
      };

      console.log(`\n[RESULT] Rule engine resolved the issue`);
      return res.json(response);
    }

    console.log('[STEP 2] ✗ No rule matched - falling back to LLM');

    // Step 3: Fall back to LLM for ambiguous cases
    console.log('\n[STEP 3] Calling LLM for diagnosis...');
    const llmResult = await llmHandler.diagnose(subscriptionData, userIssue);

    if (!llmResult.success) {
      console.log('[STEP 3] ✗ LLM failed - escalating to human');
      return res.json({
        method: 'llm_failed',
        confidence: 0,
        action: 'escalate',
        message: 'Unable to diagnose automatically. A support agent will review your case.',
        reasoning: llmResult.error,
        apiCalls: [`GET /subscriptions/${subscriptionId}`],
        processingTimeMs: Date.now() - startTime
      });
    }

    const diagnosis = llmResult.diagnosis;
    console.log(`[STEP 3] ✓ LLM diagnosis: ${diagnosis.diagnosis} (confidence: ${diagnosis.confidence}%)`);

    // Execute action if LLM recommends and confidence is high enough
    let actionResult = null;
    if (diagnosis.confidence >= 80) {
      if (diagnosis.recommendedAction === 'reprovision' && subscriptionData.sim?.id) {
        console.log('[ACTION] LLM recommended reprovision - executing...');
        actionResult = await gigsClient.reprovisionSIM(subscriptionData.sim.id);
      }
    } else {
      console.log(`[ACTION] Confidence too low (${diagnosis.confidence}%) - escalating to human`);
      diagnosis.recommendedAction = 'escalate';
    }

    const response = {
      method: 'llm',
      confidence: diagnosis.confidence,
      action: diagnosis.recommendedAction,
      message: diagnosis.userMessage || diagnosis.diagnosis,
      reasoning: diagnosis.reasoning,
      actionResult: actionResult,
      apiCalls: [
        `GET /subscriptions/${subscriptionId}`,
        'POST /models/gemini-2.5-flash:generateContent (Gemini API)',
        ...(actionResult ? [`POST /sims/${subscriptionData.sim.id}/reprovision`] : [])
      ],
      processingTimeMs: Date.now() - startTime
    };

    console.log(`\n[RESULT] LLM diagnosis complete`);
    return res.json(response);

  } catch (error) {
    console.error('\n[ERROR]', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Root endpoint with API documentation
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Gigs eSIM Automation Prototype',
    description: 'Rule Engine + LLM hybrid for eSIM activation issue diagnosis',
    endpoints: {
      'POST /diagnose': {
        description: 'Diagnose eSIM activation issues',
        body: {
          subscriptionId: 'string (required) - Gigs subscription ID',
          userIssue: 'string (required) - User description of the problem'
        },
        example: {
          subscriptionId: 'sub_0SNlurA049MEWV2gSfSxi00xlPIi',
          userIssue: 'my eSIM has been stuck for 2 hours'
        }
      },
      'GET /health': {
        description: 'Health check endpoint'
      }
    },
    repository: 'https://github.com/[your-username]/gigs-esim-prototype'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Gigs eSIM Automation Prototype running on http://localhost:${PORT}`);
  console.log(`\n📋 Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/diagnose`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`\n💡 See README.md for usage examples\n`);
});

module.exports = app;
