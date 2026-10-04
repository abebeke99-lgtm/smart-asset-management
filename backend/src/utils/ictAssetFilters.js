const { Op } = require('sequelize');

const equipmentTerms = ['computer', 'desktop', 'laptop', 'monitor', 'printer', 'scanner', 'projector', 'ups', 'server', 'tablet', 'peripheral', 'keyboard', 'mouse', 'docking', 'storage', 'hard drive', 'it equipment'];
const networkTerms = ['network', 'router', 'switch', 'firewall', 'wireless', 'access point', 'gateway', 'modem', 'bridge', 'repeater', 'patch panel', 'network rack'];
const equipmentCategoryTermsByName = {
  computing: ['computing', 'computer', 'desktop', 'laptop', 'tablet', 'workstation'],
  networking: networkTerms,
  printing: ['printing', 'printer', 'print', 'scanner'],
  display: ['display', 'monitor', 'projector'],
  power: ['power', 'ups', 'uninterruptible', 'surge'],
  storage: ['storage', 'hard drive', 'disk', 'drive'],
  communication: ['communication', 'telephone', 'phone', 'radio', 'voip'],
};

const categoryOrNameMatches = (terms) => ({
  [Op.or]: terms.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
});

const equipmentPredicate = () => categoryOrNameMatches([
  ...new Set([...equipmentTerms, ...Object.values(equipmentCategoryTermsByName).flat()]),
]);
const networkPredicate = () => categoryOrNameMatches(networkTerms);

module.exports = { equipmentTerms, networkTerms, equipmentCategoryTermsByName, equipmentPredicate, networkPredicate };