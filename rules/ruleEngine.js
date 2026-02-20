/**
 * Rule Engine for eSIM Activation Issues
 * Handles deterministic cases where no LLM is needed (70-80% of issues)
 */

class RuleEngine {
  /**
   * Evaluate subscription/SIM state against all rules
   * @param {object} subscriptionData - Data from Gigs API
   * @param {string} userIssue - User's description of the problem
   * @returns {object|null} Matched rule with action, or null if no match
   */
  evaluate(subscriptionData, userIssue) {
    const rules = [
      this.ruleProvisioningStuck,
      this.ruleBillingHold,
      this.ruleNormalDelay,
      this.ruleDeviceConfig,
      this.rulePaymentOverdue,
      this.ruleSubscriptionEnded,
      this.ruleActivationFailed
    ];

    for (const rule of rules) {
      const result = rule.call(this, subscriptionData, userIssue);
      if (result) {
        return result;
      }
    }

    return null; // No rule matched - will fall back to LLM
  }

  /**
   * RULE 1: Provisioning Stuck (>15 min)
   * Condition: SIM inactive, subscription pending, >15 min elapsed
   * Action: Trigger reprovision
   */
  ruleProvisioningStuck(data, userIssue) {
    const sim = data.sim || {};
    const subscription = data;

    if (sim.status === 'inactive' &&
      subscription.status === 'pending' &&
      this._minutesSinceActivation(data) > 15) {

      return {
        ruleName: 'provisioning_stuck',
        confidence: 95,
        action: 'reprovision',
        simId: sim.id,
        message: "We detected your activation was stuck. We've reset it — please restart your phone in 2 minutes and check again.",
        reasoning: `Provisioning has been pending for ${this._minutesSinceActivation(data)} minutes (>15 min threshold)`
      };
    }
    return null;
  }

  /**
   * RULE 2: Billing Hold
   * Condition: SIM inactive, subscription initiated, first invoice unpaid
   * Action: Route to payment update
   */
  ruleBillingHold(data, userIssue) {
    const sim = data.sim || {};
    const subscription = data;

    if (sim.status === 'inactive' &&
      subscription.status === 'initiated') {

      return {
        ruleName: 'billing_hold',
        confidence: 98,
        action: 'route_to_payment',
        message: "Your activation is on hold due to a payment issue. Please update your payment method to continue.",
        reasoning: "Subscription is in 'initiated' status, indicating unpaid first invoice"
      };
    }
    return null;
  }

  /**
   * RULE 3: Normal Delay (<15 min)
   * Condition: SIM inactive, subscription pending, <15 min elapsed
   * Action: Inform user to wait
   */
  ruleNormalDelay(data, userIssue) {
    const sim = data.sim || {};
    const subscription = data;
    const minutesElapsed = this._minutesSinceActivation(data);

    if (sim.status === 'inactive' &&
      subscription.status === 'pending' &&
      minutesElapsed < 15) {

      const minutesRemaining = Math.ceil(15 - minutesElapsed);

      return {
        ruleName: 'normal_delay',
        confidence: 90,
        action: 'wait',
        message: `Your activation is in progress. This usually takes 10-15 minutes. Please wait ${minutesRemaining} more minute(s) and restart your phone.`,
        reasoning: `Only ${minutesElapsed} minutes have elapsed - still within normal activation window`
      };
    }
    return null;
  }

  /**
   * RULE 4: Device Config Issue
   * Condition: SIM active, subscription active, user reports no service
   * Action: Route to device settings guide
   */
  ruleDeviceConfig(data, userIssue) {
    const sim = data.sim || {};
    const subscription = data;

    // Check if issue description mentions "no service" or similar
    const noServiceKeywords = ['no service', 'no data', 'not working', 'no signal'];
    const mentionsNoService = noServiceKeywords.some(kw =>
      userIssue.toLowerCase().includes(kw)
    );

    if (sim.status === 'active' &&
      subscription.status === 'active' &&
      mentionsNoService) {

      return {
        ruleName: 'device_config',
        confidence: 85,
        action: 'route_to_settings_guide',
        message: "Your line is active on our end. Let's check your device settings:\n1. Is your eSIM selected as the default for calls/data?\n2. Is Airplane Mode off?\n3. Have you restarted your phone?\n[Link to detailed settings guide would go here]",
        reasoning: "Backend shows active status but user reports no service - likely device configuration issue"
      };
    }
    return null;
  }

  /**
   * RULE 5: Payment Overdue
   * Condition: SIM active, subscription restricted
   * Action: Route to payment restoration
   */
  rulePaymentOverdue(data, userIssue) {
    const subscription = data;

    if (subscription.status === 'restricted') {
      return {
        ruleName: 'payment_overdue',
        confidence: 98,
        action: 'route_to_payment_restoration',
        message: "Your service is restricted due to an overdue payment. Update your payment method to restore service immediately.",
        reasoning: "Subscription status is 'restricted' indicating service suspension"
      };
    }
    return null;
  }

  /**
   * RULE 6: Subscription Ended
   * Condition: Subscription status is 'ended'
   * Action: Inform user (no fix possible)
   */
  ruleSubscriptionEnded(data, userIssue) {
    const subscription = data;

    if (subscription.status === 'ended') {
      return {
        ruleName: 'subscription_ended',
        confidence: 100,
        action: 'inform_only',
        message: "This subscription has been canceled. If you'd like to reactivate service, please contact support or purchase a new plan.",
        reasoning: "Subscription is in terminal 'ended' state"
      };
    }
    return null;
  }

  /**
  * RULE 7: Activation failed 
  * Condition: DEMO purpose only (Check if user mentions "activation failed")
  * Action: Reprovision 
  */
  ruleActivationFailed(data, userIssue) {
    // Check if issue description mentions "activation failed"
    const activationFailedKeyword = ['activation failed'];
    const mentionsActivationFailed = activationFailedKeyword.some(kw =>
      userIssue.toLowerCase().includes(kw)
    );

    if (mentionsActivationFailed) {

      return {
        ruleName: 'activation_failed',
        confidence: 85,
        action: 'reprovision',
        message: "We detected your activation was stuck. We've reset it — please restart your phone in 2 minutes and check again.",
        reasoning: "Provisioning has been pending for 20 minutes"
      };
    }
    return null;
  }

  /**
   * Helper: Calculate minutes since activation started
   * @private
   */
  _minutesSinceActivation(data) {
    // Try to find activation timestamp from various possible fields
    const createdAt = data.createdAt || data.sim?.createdAt;

    if (!createdAt) {
      return 0; // If no timestamp, assume just created
    }

    const createdTime = new Date(createdAt);
    const now = new Date();
    const diffMs = now - createdTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    return diffMinutes;
  }
}

module.exports = new RuleEngine();
