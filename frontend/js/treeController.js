"use strict";

const treeState = require('./treeState');
const treeView = require('./treeView');

function clearAll() {
    treeView.clear();
    treeState.clear();
}

module.exports = {
    clearAll,
}