const { Op } = require('sequelize');

const equipmentTerms = ['computer', 'desktop', 'laptop', 'monitor', 'printer', 'scanner', 'projector', 'ups', 'server', 'tablet', 'peripheral', 'keyboard', 'mouse', 'docking', 'storage', 'hard drive', 'it equipment'];
const networkTerms = ['network', 'router', 'switch', 'firewall', 'wireless', 'access point', 'gateway', 'modem', 'bridge', 'repeater', 'patch panel', 'network rack'];

const categoryOrNameMatches = (terms) => ({
  [Op.or]: terms.flatMap((term) => [
    { category: { [Op.like]: `%${term}%` } },
    { name: { [Op.like]: `%${term}%` } },
  ]),
});

const equipmentPredicate = () => categoryOrNameMatches(equipmentTerms);
const networkPredicate = () => categoryOrNameMatches(networkTerms);

module.exports = { equipmentTerms, networkTerms, equipmentPredicate, networkPredicate };