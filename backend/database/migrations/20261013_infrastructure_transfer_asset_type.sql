ALTER TABLE transfers
  ADD COLUMN asset_type VARCHAR(32) NOT NULL DEFAULT 'asset';

-- Backfill only transfers that cannot belong to a regular asset with the same id.
UPDATE transfers AS transfer_record
JOIN infrastructure_assets AS infrastructure_asset
  ON infrastructure_asset.id = transfer_record.asset_id
LEFT JOIN assets AS regular_asset
  ON regular_asset.id = transfer_record.asset_id
LEFT JOIN users AS requester
  ON requester.id = transfer_record.requested_by
LEFT JOIN users AS creator
  ON creator.id = transfer_record.created_by
SET transfer_record.asset_type = 'infrastructure'
WHERE regular_asset.id IS NULL
   OR requester.role = 'infrastructure'
   OR creator.role = 'infrastructure';
