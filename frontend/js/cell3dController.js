"use strict";

const fetches = require('./fetches');
const cell3dState = require('./cell3dState');
const interfaceState = require('./interfaceState');
const datasetState = require('./datasetState');
const treeState = require('./treeState')
const cell3dView = require('./cell3dView');
const cell3dModel = require('./cell3dModel');
const interactionsBetween = require('./interactionsBetween');
const utils = require('./utils');
const mlState = require('./mlState');

function getPossibilities() {
    cell3dState.pair_possibilities = mlState.pairPossibilities;
}


function pickOnMouseConfirm(event) {
    if (interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].getInteractor().isAnimating()) {
        return;
    }
}

function clearAll() {
    cell3dView.clearAllView();
    cell3dState.clear();
}


module.exports = {
    getPossibilities,
    clearAll
}