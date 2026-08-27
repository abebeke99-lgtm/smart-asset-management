/**
 * RFID Service
 * Handles RFID tag scanning and tracking
 */

class RFIDService {
  /**
   * Process RFID scan event
   * @param {Object} scanData - RFID scan data
   * @returns {Object} Processing result
   */
  static async processScan(scanData) {
    try {
      if (!scanData || !scanData.tagId) {
        throw new Error('Tag ID is required');
      }

      // Validate RFID tag format
      const validated = this.validateRFIDTag(scanData.tagId);
      if (!validated) {
        return {
          success: false,
          error: 'Invalid RFID tag format'
        };
      }

      return {
        success: true,
        tagId: scanData.tagId,
        timestamp: new Date(),
        location: scanData.location || 'Unknown',
        status: 'processed'
      };
    } catch (error) {
      console.error('RFID scan processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate RFID tag format
   * @param {string} tagId - RFID tag ID
   * @returns {boolean} Validation result
   */
  static validateRFIDTag(tagId) {
    // RFID tags are typically hexadecimal strings
    // Format: 0-9, a-f (case insensitive), usually 8-16 characters
    const rfidPattern = /^[0-9a-fA-F]{8,16}$/;
    return rfidPattern.test(tagId);
  }

  /**
   * Generate RFID tag ID
   * @returns {string} Generated tag ID
   */
  static generateTagId() {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2, 8);
    return (timestamp + random).substring(0, 16).toUpperCase();
  }

  /**
   * Track asset movement via RFID
   * @param {Object} trackingData - Tracking information
   * @returns {Object} Tracking result
   */
  static trackAssetMovement(trackingData) {
    try {
      if (!trackingData.assetId || !trackingData.tagId) {
        throw new Error('Asset ID and Tag ID are required');
      }

      return {
        success: true,
        assetId: trackingData.assetId,
        tagId: trackingData.tagId,
        timestamp: new Date(),
        location: trackingData.location,
        status: trackingData.status || 'active',
        coordinates: trackingData.coordinates || null
      };
    } catch (error) {
      console.error('Asset tracking error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check asset location via RFID
   * @param {string} tagId - RFID tag ID
   * @returns {Object} Location data
   */
  static checkAssetLocation(tagId) {
    try {
      if (!this.validateRFIDTag(tagId)) {
        throw new Error('Invalid RFID tag format');
      }

      return {
        success: true,
        tagId,
        lastScanned: new Date(),
        status: 'located'
      };
    } catch (error) {
      console.error('Location check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch process RFID scans
   * @param {Array} scans - Array of scan data
   * @returns {Object} Batch processing result
   */
  static async batchProcessScans(scans) {
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const scan of scans) {
        const result = await this.processScan(scan);
        results.push(result);
        if (result.success) successCount++;
        else errorCount++;
      }

      return {
        success: true,
        total: scans.length,
        successful: successCount,
        failed: errorCount,
        results
      };
    } catch (error) {
      console.error('Batch processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate RFID inventory report
   * @param {Array} assets - Array of assets with RFID tags
   * @returns {Object} Inventory report
   */
  static generateInventoryReport(assets) {
    try {
      const report = {
        generatedAt: new Date(),
        totalAssets: assets.length,
        taggedAssets: assets.filter(a => a.rfidTag).length,
        untaggedAssets: assets.filter(a => !a.rfidTag).length,
        activeAssets: assets.filter(a => a.status === 'active' && a.rfidTag).length,
        inactiveAssets: assets.filter(a => a.status === 'inactive' && a.rfidTag).length,
        assets: assets.map(a => ({
          assetId: a.id,
          assetTag: a.assetTag,
          name: a.name,
          rfidTag: a.rfidTag,
          status: a.status,
          lastScanned: a.lastScannedAt
        }))
      };

      return {
        success: true,
        report
      };
    } catch (error) {
      console.error('Report generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect missing assets via RFID scan
   * @param {Array} scannedTags - Array of scanned RFID tags
   * @param {Array} expectedAssets - Array of expected assets
   * @returns {Object} Detection result
   */
  static detectMissingAssets(scannedTags, expectedAssets) {
    try {
      const missingAssets = expectedAssets.filter(
        asset => !scannedTags.includes(asset.rfidTag)
      );

      return {
        success: true,
        totalExpected: expectedAssets.length,
        totalScanned: scannedTags.length,
        missing: missingAssets.length,
        missingAssets
      };
    } catch (error) {
      console.error('Missing asset detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = RFIDService;
