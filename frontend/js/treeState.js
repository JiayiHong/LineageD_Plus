"use strict";

class TreeState {
    constructor() {
        this.init();
    }

    init() {
        this.levelNum = [];              // How many nodes in one level
        this.level1 = [];
        this.levelEmptyNum = [];
        this.normalizedVolumes = [];
        this.nodeWidths = [];
        this.cellColors = [];
        this.focusMoved = 0;
        this.nodesXs = [];
        this.slider = null;
        this.diff = 0;
        this.marked = [];
        this.background = null;
        this.parentBar = []; // [{cell:"name", color:""}]
        // lasso selection
        this.lassoParent = [];
        this.clickDivideCells = [];
        this.clickDivideStatus = false;
        this.workingTree = null;
        this.predictionConstrains = [];
        this.merged = false;
        this.highlightedThumbnails = [];
        this.similarPatterns = false;
    }

    clear() {
        this.init();
    }
}

const treeState = new TreeState();

module.exports = treeState;