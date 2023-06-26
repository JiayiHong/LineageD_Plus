"use strict";

class Cell3dState {
    constructor() {
        this.init();
    }

    init() {
        this.actors = [];
        this.centers = [];
        this.volumes = [];
        this.colors = [];
        this.colors_random = [];
        this.colors_district = [];
        this.colors_confidence = [];
        this.colors_area = [];
        this.pair_possibilities = [];
        this.highlighted = null;    // targeted cell
        this.neighboringTried = null;
        this.highlightedSimilarCells = [];
        this.cellOrder = [];
        this.defaultCells = [];
        this.existingCells = [];
        this.assignment = [];
        this.assignedParent = [];
        this.timeDepths = [];
        this.surfaceDepths = [];    // same order with existing cells
        this.surfaceCells = [];     // with names
        this.children = [];
        this.currentLevel = 1;
        this.currentExistingCells = {};
        this.currentMode = "mainView";
        this.targetView = null;
        this.supportingCells = [];
    }

    clear() {
        this.init();
    }
};

const cell3dState = new Cell3dState();

module.exports = cell3dState;