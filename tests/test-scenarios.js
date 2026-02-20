/**
 * Test scenarios for the eSIM automation prototype
 * Run with: npm test
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

const testScenarios = [
  {
    name: 'Rule Engine - Provisioning Stuck',
    description: 'Simulates an eSIM stuck in provisioning for >15 minutes',
    request: {
      subscriptionId: 'sub_test_stuck',
      userIssue: 'my eSIM has been stuck for 2 hours'
    },
    expectedMethod: 'rule_engine',
    expectedRule: 'provisioning_stuck'
  },
  {
    name: 'Rule Engine - Normal Delay',
    description: 'Simulates activation still in normal window (<15 min)',
    request: {
      subscriptionId: 'sub_test_recent',
      userIssue: 'my eSIM is still activating'
    },
    expectedMethod: 'rule_engine',
    expectedRule: 'normal_delay'
  },
  {
    name: 'Rule Engine - Device Config',
    description: 'SIM shows active but user has no service',
    request: {
      subscriptionId: 'sub_test_active',
      userIssue: 'I have no service even though it says active'
    },
    expectedMethod: 'rule_engine',
    expectedRule: 'device_config'
  },
  {
    name: 'LLM Fallback - Ambiguous Issue',
    description: 'Vague user input that requires LLM interpretation',
    request: {
      subscriptionId: 'sub_test_ambiguous',
      userIssue: 'it just doesn\'t work'
    },
    expectedMethod: 'llm'
  },
  {
    name: 'LLM Fallback - Unknown Error',
    description: 'Unknown error code requiring LLM interpretation',
    request: {
      subscriptionId: 'sub_test_error',
      userIssue: 'getting a weird error message'
    },
    expectedMethod: 'llm'
  }
];

async function runTests() {
  console.log('\n🧪 Running Test Scenarios\n');
  console.log('=' .repeat(80));
  
  let passed = 0;
  let failed = 0;

  for (const scenario of testScenarios) {
    console.log(`\n📝 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   Request: ${JSON.stringify(scenario.request)}`);
    
    try {
      const response = await axios.post(`${BASE_URL}/diagnose`, scenario.request);
      const result = response.data;
      
      console.log(`   ✓ Response received`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Action: ${result.action}`);
      console.log(`   Confidence: ${result.confidence}%`);
      
      if (scenario.expectedMethod && result.method !== scenario.expectedMethod) {
        console.log(`   ✗ FAILED: Expected method ${scenario.expectedMethod}, got ${result.method}`);
        failed++;
      } else if (scenario.expectedRule && result.rule !== scenario.expectedRule) {
        console.log(`   ✗ FAILED: Expected rule ${scenario.expectedRule}, got ${result.rule}`);
        failed++;
      } else {
        console.log(`   ✓ PASSED`);
        passed++;
      }
      
    } catch (error) {
      console.log(`   ✗ ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
}

// Check if server is running
axios.get(`${BASE_URL}/health`)
  .then(() => runTests())
  .catch(() => {
    console.error('\n❌ Error: Server is not running');
    console.error('Please start the server first: npm start\n');
    process.exit(1);
  });
