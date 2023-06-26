"use strict";

class InterfaceState {
    constructor() {
        this.init();
    }

    init() {
        this.smallWindowHeightRatio = 0.4;
        this.smallWindowWidthRatio = 0.3;
        // Define the view window index
        this.mainViewWindow = 0;
        this.sisterViewWindow = 1;
        this.windowsName = ["#mainView", '#sister', '#neighborhood'];
        this.svgHeight = $(document).height()*0.65;
        this.svgWidth = $(document).width()*0.4;
        this.explosionValue = 0;
        this.peelValue = 0;
        this.peelSliderValue = 0;
        this.currentColorMode = "district";
        // Define the tree's scales
        this.nodeDefaultWidth = 30;
        this.nodeDefaultHeight = parseInt(this.svgHeight/11);
        this.nodeVerticalMargin = 11;
        this.nodeHorizontalMargin = 3;
        this.verticalBarWidth = 7;
        this.activeWindows = [];
        // lasso division
        this.widgetManager = null;
    }

    clear() {
        this.init();
    }
}

const interfaceState = new InterfaceState();

module.exports = interfaceState;