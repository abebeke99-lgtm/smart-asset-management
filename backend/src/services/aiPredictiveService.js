/**
 * AI Predictive Service
 * Provides predictive analytics for asset maintenance and depreciation
 */

class AIPredictiveService {
  /**
   * Predict maintenance needs based on asset history
   * @param {Object} asset - Asset data
   * @returns {Object} Prediction results
   */
  static predictMaintenance(asset) {
    try {
      // Simple prediction logic based on asset age and usage
      const ageInMonths = this.calculateAssetAge(asset.createdAt);
      const riskScore = this.calculateRiskScore(asset, ageInMonths);
      
      return {
        success: true,
        riskScore,
        recommendation: this.getRecommendation(riskScore),
        predictedMaintenanceDate: this.calculateNextMaintenanceDate(asset, ageInMonths)
      };
    } catch (error) {
      console.error('Predictive maintenance error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate asset depreciation
   * @param {Object} asset - Asset data
   * @returns {Object} Depreciation data
   */
  static calculateDepreciation(asset) {
    try {
      const ageInYears = this.calculateAssetAge(asset.createdAt) / 12;
      const depreciationRate = asset.depreciationRate || 0.15; // 15% per year default
      const currentValue = asset.purchaseValue * Math.pow(1 - depreciationRate, ageInYears);
      const totalDepreciation = asset.purchaseValue - currentValue;

      return {
        success: true,
        originalValue: asset.purchaseValue,
        currentValue: Math.max(0, currentValue),
        totalDepreciation,
        percentageDepreciated: (totalDepreciation / asset.purchaseValue) * 100,
        ageInYears: ageInYears.toFixed(2)
      };
    } catch (error) {
      console.error('Depreciation calculation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate asset age in months
   * @param {Date} createdDate - Asset creation date
   * @returns {number} Age in months
   */
  static calculateAssetAge(createdDate) {
    const now = new Date();
    const created = new Date(createdDate);
    const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    return Math.max(0, months);
  }

  /**
   * Calculate risk score (0-100)
   * @param {Object} asset - Asset data
   * @param {number} ageInMonths - Asset age in months
   * @returns {number} Risk score
   */
  static calculateRiskScore(asset, ageInMonths) {
    let score = 0;

    // Age factor (max 40 points)
    if (ageInMonths > 60) score += 40;
    else if (ageInMonths > 36) score += 30;
    else if (ageInMonths > 24) score += 20;
    else if (ageInMonths > 12) score += 10;

    // Condition factor (max 40 points)
    if (asset.condition === 'poor') score += 40;
    else if (asset.condition === 'fair') score += 20;
    else if (asset.condition === 'good') score += 5;

    // Status factor (max 20 points)
    if (asset.status === 'inactive') score += 20;
    else if (asset.status === 'in-maintenance') score += 15;

    return Math.min(100, score);
  }

  /**
   * Get maintenance recommendation based on risk score
   * @param {number} riskScore - Risk score (0-100)
   * @returns {string} Recommendation
   */
  static getRecommendation(riskScore) {
    if (riskScore >= 70) return 'URGENT: Schedule maintenance immediately';
    if (riskScore >= 50) return 'HIGH: Schedule maintenance within 2 weeks';
    if (riskScore >= 30) return 'MEDIUM: Schedule maintenance within 1 month';
    return 'LOW: Routine maintenance recommended';
  }

  /**
   * Calculate next maintenance date
   * @param {Object} asset - Asset data
   * @param {number} ageInMonths - Asset age in months
   * @returns {Date} Predicted maintenance date
   */
  static calculateNextMaintenanceDate(asset, ageInMonths) {
    const lastMaintenance = new Date(asset.lastMaintenanceDate || asset.createdAt);
    const nextDate = new Date(lastMaintenance);
    
    // Add months based on asset condition and age
    const monthsToAdd = asset.condition === 'poor' ? 1 : asset.condition === 'fair' ? 3 : 6;
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    
    return nextDate;
  }
}

module.exports = AIPredictiveService;
