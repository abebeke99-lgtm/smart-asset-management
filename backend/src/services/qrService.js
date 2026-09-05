/**
 * QR Code Service
 * Generates and manages QR codes for assets
 */

const QRCode = require('qrcode');

class QRService {
  /**
   * Generate QR code for an asset
   * @param {Object} asset - Asset data
   * @returns {Promise<string>} QR code data URL
   */
  static async generateQRCode(asset) {
    try {
      if (!asset || !asset.id) {
        throw new Error('Asset ID is required to generate QR code');
      }

      // Create QR data containing asset information
      const qrData = {
        assetId: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        category: asset.category,
        timestamp: new Date().toISOString()
      };

      // Convert to JSON string for QR code
      const qrString = JSON.stringify(qrData);

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300
      });

      return {
        success: true,
        qrCodeDataUrl,
        data: qrData
      };
    } catch (error) {
      console.error('QR code generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate QR code and return as buffer (for file download)
   * @param {Object} asset - Asset data
   * @returns {Promise<Buffer>} QR code buffer
   */
  static async generateQRCodeBuffer(asset) {
    try {
      if (!asset || !asset.id) {
        throw new Error('Asset ID is required');
      }

      const qrData = {
        assetId: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        timestamp: new Date().toISOString()
      };

      const qrString = JSON.stringify(qrData);

      // Generate QR code as PNG buffer
      const qrBuffer = await QRCode.toBuffer(qrString, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        width: 300
      });

      return {
        success: true,
        buffer: qrBuffer,
        filename: `${asset.assetTag}_QR.png`
      };
    } catch (error) {
      console.error('QR code buffer generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Decode QR code data (typically done on client side)
   * Note: This is a helper function for validating QR data format
   * @param {string} qrString - QR code decoded string
   * @returns {Object} Parsed QR data
   */
  static decodeQRCode(qrString) {
    try {
      const data = JSON.parse(qrString);
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('QR code decode error:', error);
      return {
        success: false,
        error: 'Invalid QR code format'
      };
    }
  }

  /**
   * Validate QR code data
   * @param {Object} qrData - Decoded QR data
   * @param {Object} asset - Asset to validate against
   * @returns {boolean} Validation result
   */
  static validateQRCode(qrData, asset) {
    try {
      return (
        qrData.assetId === asset.id &&
        qrData.assetTag === asset.assetTag &&
        qrData.name === asset.name
      );
    } catch (error) {
      console.error('QR code validation error:', error);
      return false;
    }
  }

  /**
   * Generate batch QR codes for multiple assets
   * @param {Array} assets - Array of assets
   * @returns {Promise<Array>} Array of QR code results
   */
  static async generateBatchQRCodes(assets) {
    try {
      const results = await Promise.all(
        assets.map(asset => this.generateQRCode(asset))
      );

      return {
        success: true,
        total: assets.length,
        generated: results.filter(r => r.success).length,
        results
      };
    } catch (error) {
      console.error('Batch QR generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = QRService;
