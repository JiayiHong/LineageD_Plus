"use strict";
const treeState = require('./treeState');
const cell3dState = require('./cell3dState');
const interfaceState = require('./interfaceState');
const datasetState = require('./datasetState');
const studyState = require('./studyState');
const utils = require('./utils');
const cell3dModel = require('./cell3dModel');
const cell3dView = require('./cell3dView');
const treeModel = require('./treeModel');
const treeView = require('./treeView');
const mlFunctions = require('./mlFunctions');
const mlState = require('./mlState');
const modelState = require('./modelState');
const visualization = require('./visualization');

let startingTime;
let clicked_times = 0;
let last_clicking_timestamp = null;

// Change colors in both cell3d and tree
function changeColor(colorMode) {
    let tempColors = [];
    if (colorMode == "district") {
        cell3dState.colors = cell3dState.colors_district;
        interfaceState.currentColorMode = colorMode;
    }
    else if (colorMode == "area") {
        cell3dState.colors = cell3dState.colors_area;
        interfaceState.currentColorMode = colorMode;
        tempColors = ['#4C004C', '#FF00FF'];
    }
    else if (colorMode == "random") {
        cell3dState.colors = cell3dState.colors_random;
        interfaceState.currentColorMode = colorMode;
    }
    else if (colorMode == "confidence") {
        cell3dState.colors = cell3dState.colors_confidence;
        interfaceState.currentColorMode = colorMode;
        tempColors = ['#007F7F', '#00FFFF'];
    }
    cell3dView.changeColor(colorMode);
    treeView.changeColors(colorMode, tempColors);
    if (cell3dState.highlighted!= null) {highlightCell(cell3dState.highlighted);}
}

// highlight cell in 3d and in tree
function highlightCell(d) {
    if (cell3dState.targetView != null) {
        const index = utils.checkIteminObjectArray(cell3dState.targetView, treeState.lassoParent, "name");
        let leaves = treeState.lassoParent[index].leaves;
        for (let leaf of leaves) {
            leaves = leaves.concat(treeModel.getParent(leaf));
        }
        if (d.name == undefined && !leaves.includes(d)){
            topTreeDoubleClick();
        } else if (d.name != undefined && !leaves.includes(d.name)) {
            topTreeDoubleClick();
        }
    }
    treeView.returnHighlightedCells(d);
    treeView.highlightCellinTree(d);
    let index;
    if (d.name == undefined) {
        index = cell3dState.cellOrder.indexOf(d);
        cell3dView.highlightCell3d(d);
    } else {
        index = cell3dState.cellOrder.indexOf(d.name);
        cell3dView.highlightCell3d(d.name);
    }
    // Find similar pairs in the website
    if (index != -1 && cell3dState.children[index] != 0 && treeState.similarPatterns == true) {
        mlFunctions.findSimilarPairs(cell3dState.children[index][0], highlightSimilarCell);
    }
}

function highlightSimilarCell(d) {
    let toMark = [];
    for (let pair of d) {
        if (pair.similarity >= 0.25) {
            const names = modelState.pairFeatures[pair.index].cells;
            const index1 = cell3dState.cellOrder.indexOf(names[0]);
            const parent = cell3dState.assignedParent[index1];
            if (parent != 0) {
                const sisters = cell3dState.children[cell3dState.cellOrder.indexOf(parent)];
                if (sisters.includes(names[1])) {
                    toMark.push(parent);
                }
            }
        }
    }
    cell3dView.highlightSimilarCell3d(toMark);
    treeView.highlightSimilarCell2d(toMark);
}

function freshTree() {
    treeView.clear();
    treeModel.updateFromOrder(cell3dState.cellOrder);
    treeView.update(cell3dState.cellOrder, cell3dView.switchToLevel, highlightCell, changeColor, doubleClickReaction, topTreeDoubleClick);
    treeState.slider.value(cell3dState.currentLevel);
    cell3dModel.getAreaColor();
    changeColor(interfaceState.currentColorMode);
}

function processClickDivisionSelection(event) {
    const {parent, worldPosition} = cell3dView.getProcessedSelection(event);
    if (parent == -1) {return;}
    if (!treeState.clickDivideCells.includes(parent)){
        treeState.clickDivideCells.push(parent);
        let index = cell3dState.existingCells.indexOf(parent);
        cell3dState.actors[index].getProperty().setColor([0,1,0]);
    }
    cell3dView.updateWorldPosition(worldPosition);
}

function processMainViewSelections(event) {
    const {parent, worldPosition} = cell3dView.getProcessedSelection(event);
    if (parent == -1) {return;}
    treeView.moveTree(parent);
    highlightCell(parent);
    // Update picture for the user so we can see the green one
    cell3dView.updateWorldPosition(worldPosition);
}

function changeToMainView() {
    cell3dView.changeToMainView();
    clicked_times = 0;
}

// double click in the main view will switch to neighbors view
function changeToNeighborsView(name) {
    cell3dView.changeToNeighborsView(name);
    clicked_times = 0;
}

function pickOnMouseDownEvent() {
    startingTime = performance.now();
}


function pickOnMouseEventOverview(event) {
    if (cell3dView.isAnimating()) {
        // we should not do picking when interacting with the scene
        return;
    }
    if (treeState.clickDivideStatus == true) {
        processClickDivisionSelection(event);
        return;
    }
    if ((performance.now()-startingTime) > 300) {
        // this is used to detect if rotation to not change the cell picked
        return;
    }
    if (cell3dState.currentLevel>treeState.levelNum.length) {return;}

    clicked_times++;
        
    // single click
    if (performance.now()-last_clicking_timestamp > 300){
        clicked_times = 1;
        studyState.actionRow.push(["single click", performance.now()-studyState.startingTime]);
        last_clicking_timestamp = performance.now();
        // with all cells
        if (cell3dState.currentMode == "mainView") {
            processMainViewSelections(event);
        }
        // with only neighbors
        if (cell3dState.currentMode == "neighboringView") {
            cell3dView.processNeighboringSelections(event);
        }
    }
    // double click - show all the neighbors in the view
    if (clicked_times == 2) {
        studyState.actionRow.push(["double click", performance.now() - studyState.startingTime]);
        doubleClickReaction();
    }
}

function doubleClickReaction() {
    if (cell3dState.currentMode == "mainView" && cell3dState.highlighted != null) {
        cell3dView.deleteAllOtherCells(cell3dState.highlighted);
        changeToNeighborsView(cell3dState.highlighted);
        const neighborsNames = cell3dModel.findTheNeighbors(cell3dState.highlighted, cell3dState.currentLevel);        
        const index = utils.checkIteminObjectArray(cell3dState.highlighted, modelState.modelPredictionsPerCell, "name");
        if (index != -1) {
            const allPredictions = treeModel.getCellPredictionDataForVerticalBars();
            let possibleNeighbors = [];
            for (let prediction of allPredictions) {
                if (prediction.name == cell3dState.highlighted) {
                    possibleNeighbors.push(prediction);
                }
            }
            possibleNeighbors.sort((a,b) => b.accuracy - a.accuracy);
            visualization.visualizePossibleSisters(possibleNeighbors, neighboringTryingOutReaction);
            treeView.showNeighborsInLine(neighborsNames, possibleNeighbors, neighboringTryingOutReaction);
        } else {
            treeView.showNeighborsInLine(neighborsNames, [], neighboringTryingOutReaction);
        }
    }
    else if (cell3dState.currentMode == "neighboringView") {
        changeToMainView();
        treeView.clearNeighborsInLine();
        visualization.clearModelPossibleSisters();
    }
}

function topTreeDoubleClick() {
    if (cell3dState.targetView == null && cell3dState.highlighted != null) {
        cell3dView.targetSpecificGroup();
        treeView.targetSpecificGroup();
    } else if (cell3dState.targetView != null) {
        changeToMainView();
        treeView.cancelTransparentNodes();
        cell3dState.targetView = null;
    }
}

function neighboringTryingOutReaction(d) {
    cell3dView.tryOtherNeighbors(d);
}

function mergeTwoTrees() {
    let highestDepthOfLasso = 0,
        lowestDepthOfLasso = 100;
    for (let lasso of treeState.lassoParent) {
        if (Math.max(...lasso.depth) > highestDepthOfLasso) {highestDepthOfLasso = Math.max(...lasso.depth);}
        if (Math.min(...lasso.depth) < lowestDepthOfLasso) {lowestDepthOfLasso = Math.min(...lasso.depth);}
    }
    for (let i = lowestDepthOfLasso; i <= highestDepthOfLasso; i++) {
        let cells = getNoParentCell();
        for (let lasso of treeState.lassoParent) {
            if (lasso.depth.includes(i)) {
                for (let cell of cells) {
                    if (utils.arraysEqual(cell.leaves,lasso.leaves)) {break;}
                    if (utils.isSuperset(lasso.leaves, cell.leaves)) {
                        const difference = utils.sortArrayDescending(utils.differenceOfSets(lasso.leaves, cell.leaves));
                        for (let cell2 of cells) {
                            if (utils.arraysEqual(cell2.leaves,difference)) {
                                cell3dState.assignment.push(0);
                                let toCreate = cell3dState.existingCells[cell3dState.existingCells.length-1] +1;
                                cell3dState.existingCells.push(toCreate);
                                cell3dState.assignment[cell3dState.existingCells.indexOf(cell.name)] = toCreate;
                                cell3dState.assignment[cell3dState.existingCells.indexOf(cell2.name)] = toCreate;
                                if (cell.name < cell2.name) {treeModel.recordParentBar(cell.name, cell2.name, "blue");}
                                else {treeModel.recordParentBar(cell2.name, cell.name, "blue");}
                                treeModel.editPossibilities(cell.name, cell2.name, 0, 0);
                                cell3dModel.freshData();
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
}

function getNoParentCell() {
    let cells = [];
    for (let i = 0; i < cell3dState.assignment.length; i++) {
        if (cell3dState.assignment[i] == 0) {
            cells.push({});
            cells[cells.length-1]["name"] = cell3dState.existingCells[i];
            let leaves = cell3dModel.findAllLeaves(cell3dState.existingCells[i]);
            cells[cells.length-1]["leaves"] = utils.sortArrayDescending(leaves);
        }
    }
    return cells;
}

module.exports = {
    changeColor,
    highlightCell,
    freshTree,
    pickOnMouseEventOverview,
    pickOnMouseDownEvent,
    changeToMainView,
    mergeTwoTrees,
    doubleClickReaction,
    topTreeDoubleClick
}