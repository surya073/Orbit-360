'use strict';

const { crudRoutes } = require('./crudRoutes');

module.exports = crudRoutes('/product-items', 'product_items');
