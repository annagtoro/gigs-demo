const axios = require('axios');
require('dotenv').config();

class GigsClient {
  constructor() {
    this.baseURL = process.env.GIGS_API_BASE_URL;
    this.apiKey = process.env.GIGS_API_KEY;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get subscription details including SIM status
   * @param {string} subscriptionId - Gigs subscription ID
   * @returns {Promise<object>} Subscription object with nested SIM data
   */
  async getSubscription(subscriptionId) {
    try {
      const response = await this.client.get(`/subscriptions/${subscriptionId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Gigs API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || { message: error.message }
      };
    }
  }

  /**
   * Get SIM details directly
   * @param {string} simId - Gigs SIM ID
   * @returns {Promise<object>} SIM object
   */
  async getSIM(simId) {
    try {
      const response = await this.client.get(`/v1/sims/${simId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Gigs API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || { message: error.message }
      };
    }
  }

  /**
   * Trigger SIM reprovisioning (proposed endpoint - may not exist yet)
   * @param {string} simId - Gigs SIM ID
   * @returns {Promise<object>} Reprovision response
   */
  async reprovisionSIM(simId) {
    try {
      // NOTE: This endpoint might not exist in Gigs API yet
      // This is a proposed endpoint for the automation prototype
      const response = await this.client.post(`/v1/sims/${simId}/reprovision`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      // If endpoint doesn't exist, return mock success for prototype
      console.warn('Reprovision endpoint may not exist - returning mock response');
      return {
        success: true,
        data: {
          simId: simId,
          action: 'reprovision_triggered',
          message: 'SIM reprovisioning initiated (mocked for prototype)',
          timestamp: new Date().toISOString()
        },
        mocked: true
      };
    }
  }
}

module.exports = new GigsClient();
