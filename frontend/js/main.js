const fetches = require('./fetches');
const cell3dState = require('./cell3dState');
const treeState = require('./treeState');
const interfaceState = require('./interfaceState');
const cell3dController = require('./cell3dController');
const cell3dView = require('./cell3dView');
const cell3dModel = require('./cell3dModel');
const treeController = require('./treeController');
const treeModel = require('./treeModel');
const treeView = require('./treeView');
const interactionsBetween = require('./interactionsBetween');
const utils = require('./utils');
const studyState = require('./studyState');
const datasetState = require('./datasetState');
const mlFunctions = require('./mlFunctions');
const mlState = require('./mlState');
const modelState = require('./modelState');
const visualization = require('./visualization');

async function selectDefaultDataSet(datasetName) {
    // TODO: another test to see if state is set
    // and that rendering already took place ?
    if (treeState.levelNum.length != 0) {
        treeController.clearAll();
        cell3dController.clearAll();
    } else {
        treeView.createTopButtons(interactionsBetween.changeColor);
        treeView.createInstructions();
    }

    let cellDataUrl;
    let cell3dDataUrl;

    cellDataUrl = '/data/assignment'+ datasetName + '.json';
    cell3dDataUrl = '/data/parsed' + datasetName + '.json';
    datasetState.type = "plant";

    const cellData = await fetches.fetchJson(cellDataUrl);
    const cell3dData = await fetches.fetchJson(cell3dDataUrl);

    studyState.startingTime = performance.now();    
    cell3dModel.create(cell3dData, cellData);
    if (treeState.levelNum.length == 0) {cell3dView.createPeelingSlider();}
    cell3dView.update(interactionsBetween.pickOnMouseDownEvent, interactionsBetween.pickOnMouseEventOverview);
    
    // TODO: hidden depencency to cell3dModelUpdate
    // side effects on cell3dState.volumes and
    // cell3dState.timeDepths
    treeModel.update(cellData);
    treeModel.initialLassoParent();
    if (datasetName == '32-64c_Col0_977') {defaultTopTreeFor64CellEmbryo();}
    treeView.update(cell3dState.cellOrder, cell3dView.switchToLevel, interactionsBetween.highlightCell, interactionsBetween.changeColor, interactionsBetween.doubleClickReaction, interactionsBetween.topTreeDoubleClick);
    treeView.createZoomSlider(interactionsBetween.freshTree);
}

function loadDataset(cellsDataset) {
    /*
    let cells = JSON.parse(data);
    let trianglesInfo = cells.trianglesInfo;
    let tissues = cells.tissues;
    let supporting = findSupportingCellsfromParsed(tissues, trianglesInfo);
    modelService.setDefaults(sessionId, tissues, trianglesInfo, datasetName, supporting);
    */
   datasetState.trianglesInfo = cellsDataset.trianglesInfo;
   datasetState.tissues = cellsDataset.tissues;
}

async function processCommand(value) {
    if (value == 0 || value == 1 || value == 2) {
        // not implemented yet server side
        await fetches.sendCommandsToServer(value);
        if (value == 1) {
            const exported = utils.extendedAssignmentsToExport(cell3dState.existingCells, cell3dState.assignment);
            utils.exportTextFile("assignment.txt", exported.toString());
            // treeView.exportCsvFile("study.csv", studyState.actionRow);
        }
    }
    if (value == 3 || value == 4 || value == 5) {
        let datasetName = '';
        switch(value) {
            case 3:
                // 16 cells
                datasetName = '16c_Col0_654';
                break;
            case 4:
                // 64 cells
                datasetName = '32-64c_Col0_977';
                break;
            case 5:
                // 256 cells
                datasetName = 'coeur_Col0_915';
                break;
        }
        cell3dView.addLoader();
        const jsonParsedDataset = await fetches.fetchJson('/data/parsed' + datasetName + '.json');
        loadDataset(jsonParsedDataset);

        await selectDefaultDataSet(datasetName);
        cell3dView.removeLoader();
        const config = await fetches.fetchJson('/data/' + datasetName + '.json');
        mlFunctions.setDefaults(config); 
        if (value == 4) {
            treeModel.updateConstrains();
            mlFunctions.supportingUpdate(cell3dState.supportingCells);
        }
        const selectedFeatures = checkSelectedFeatures();
        if (selectedFeatures.length != 8) {modelState.ifDefaultOrTrained = "trained";}
        modelState.droppedFeatures = mlFunctions.findDropAttrs(selectedFeatures);
        await mlFunctions.getTrainingData();
        await mlFunctions.getSelectedModels();
        await mlFunctions.getDefaultModelProperties();
    }
    // predict new level
    if (value == 6) {
        treeView.confirmAllCurrentPairs();
        if (treeState.merged == false) {
            mlFunctions.predictSingleLevel(modelState.models);
            treeControllerAddOneLevel();
        }
    }
    // re-predict the current level
    if (value == 7) {
        removeOneLevel();
        mlFunctions.predictSingleLevel(modelState.models);
        treeControllerAddOneLevel();
    }
}


function listenNav() {
    // users choose one embryo dataset
    // querySelectorAll returns a NodeList, which has forEach, even if it is not an Array
    document.querySelectorAll('.menu_option').forEach((item, index) => {
        item.onclick = async function() {
            console.log(index);
            await processCommand(index);
        }
    });

    document.onkeyup = function(e) {
        if (treeState.clickDivideStatus == true && e.key == "Enter") {
            document.getElementById(clickSelection).style.border = "2px solid black";
            reformDivision(treeState.clickDivideCells, clickSelection);
            treeState.clickDivideCells = [];
            treeState.clickDivideStatus = false;
        }
    }

    document.getElementById('featuresConfirmButton').onclick = function() {
        if (datasetState.tissues != null) {
            alert("Please pick the features before selecting the datasets.");
            return;
        }
    }

    document.getElementById('weightConfirmButton').onclick = function() {
        getModelWeight();
        treeView.clearVerticalBars();
        treeView.createVerticalBars();
    }

    document.getElementById('weightResetButton').onclick = function() {
        resetModelWeight();
        treeView.clearVerticalBars();
        treeView.createVerticalBars();
    }

    document.getElementById('similar_cells').onclick = function() {
        let similar_cells = document.getElementById('similar_cells').checked;
        treeState.similarPatterns = similar_cells;
        if (similar_cells == false) {
            cell3dView.highlightSimilarCell3d([]);
            treeView.highlightSimilarCell2d([]);
        }
    }
}

// Ensure DOM is fully loaded and parsed
window.addEventListener('DOMContentLoaded', (event) => {
    listenNav();
});

interactionButtonsSetting();
hoverOverModels();
let lassoSelectVar = false;
let clickSelection = null;

function lassoSelectionReply() {
    if (interfaceState.widgetManager == null) {cell3dView.settingLasso();}
    if (lassoSelectVar == false) {
        lassoSelectVar = true;
        cell3dView.startingLasso();
        document.getElementById(this.id).style.border = "2px solid red";
    } else if (lassoSelectVar == true) {
        lassoSelectVar = false; 
        document.getElementById(this.id).style.border = "2px solid black";
        const intersectedCells = cell3dView.lassoSelect();
        cell3dView.removingLasso();
        reformDivision(intersectedCells, this.id);
    }
}

function clickSelectionReply() {
    clickSelection = this.id;
    document.getElementById(this.id).style.border = "2px solid red";
    treeState.clickDivideStatus = true;
}

function reformDivision(intersectedCells, id){
    if (cell3dState.highlighted == null || 
        !isNaN(cell3dState.highlighted)) {alert("Select the right cell to divide."); return;}
    const [leaves, sisterLeaves] = checkTempLassoParent(intersectedCells, id);
    if (leaves == null) {return;}
    const flag = treeView.updateLassoParent(leaves, sisterLeaves, id, cell3dState.highlighted);
    if (flag == true) {
        if (treeState.levelNum.length > 1) {cell3dModel.freshData();}
        else {treeModel.reorderTree();}
        interactionsBetween.freshTree();
        // await fetches.predictionConstrainsUpdate(treeState);
    }
}

function interactionButtonsSetting() {
    const confirmButtons = document.querySelectorAll("#confirmButton");
    for (let confirmButton of confirmButtons) {
        confirmButton.onclick = function() {confirmCurrentAssign()};
    }

    const wrongChildButtons = document.querySelectorAll("#wrongChildButton");
    for (let wrongChildButton of wrongChildButtons) {
        wrongChildButton.onclick = function() {childrenUnlink(cell3dState.highlighted)};
    }

    const newSisterButtons = document.querySelectorAll("#newSisterButton");
    for (let newSisterButton of newSisterButtons) {
        newSisterButton.onclick = function() {setAsNewSister()};
    }

    const supportingButtons = document.querySelectorAll("#supportingButton");
    for (let supportingButton of supportingButtons) {
        supportingButton.onclick = function() {setAsSupportingCells(cell3dState.highlighted);};
    }

    const lineDivide = document.getElementById("lassoSelect");
    const addToSelection = document.getElementById("lassoSelectAdd");
    const subtractSelection = document.getElementById("lassoSelectSubtract");

    lineDivide.onclick = lassoSelectionReply;
    addToSelection.onclick = lassoSelectionReply;
    subtractSelection.onclick = lassoSelectionReply;

    const clickAdd = document.getElementById("clickSelectAdd");
    const clickSubtract = document.getElementById("clickSelectSubtract");

    clickAdd.onclick = clickSelectionReply;
    clickSubtract.onclick = clickSelectionReply;
}

function confirmCurrentAssign() {
    const index = cell3dState.cellOrder.indexOf(cell3dState.highlighted);
    if (cell3dState.timeDepths[index].includes(treeState.levelNum.length-1)) {
        treeModel.recordParentBar(cell3dState.highlighted, cell3dState.highlighted, "url(#pattern_confirmed)");
        let id = [cell3dState.highlighted, cell3dState.highlighted];
        treeState.background
            .selectAll("rect[id='"+id+"']")
            .attr("fill", "url(#pattern_confirmed)");
    } else {
        treeView.changeParentBarColor(cell3dState.highlighted, "green");
    }
}

function childrenUnlink(parentName) {
    if (treeState.merged == true) {return;}
    // change the assignments
    if (parentName != null) {
        let children = cell3dState.children[cell3dState.cellOrder.indexOf(parentName)];
        if (children != undefined && children != 0 && children.length == 2){
            let sister1 = children.slice()[0],
                sister2 = children.slice()[1];
            treeModel.deleteAllParentAbove(sister1, sister2);
            let arrayIndex = utils.checkIteminObjectArray(sister1, treeState.parentBar, "name");
            if (arrayIndex != -1 && treeState.parentBar[arrayIndex]["name"].includes(sister2)){
                treeState.parentBar.splice(arrayIndex, 1);
            }
            // reorder the tree
            fresh3dData();
            interactionsBetween.freshTree();
            mlFunctions.assignmentUpdate(cell3dState.existingCells, cell3dState.assignment);
        }
    }
}

function setAsNewSister() {
    if (treeState.merged == true) {return;}
    if (cell3dState.neighboringTried != null && cell3dState.highlighted != null && cell3dState.neighboringTried != cell3dState.highlighted) {
        const leaves1 = cell3dModel.findAllLeaves(cell3dState.highlighted);
        const leaves2 = cell3dModel.findAllLeaves(cell3dState.neighboringTried);
        // Tell whether two sisters are from the same group
        for (let constrain of treeState.predictionConstrains) {
            if ((utils.isSuperset(constrain, leaves1) && !utils.isSuperset(constrain, leaves2)) ||
            (!utils.isSuperset(constrain, leaves1) && utils.isSuperset(constrain, leaves2))) {
                alert("You have choose two cells from different parts!");return;
            }
        }
        const highlight = cell3dState.highlighted;
        treeModel.editAssignments();
        fresh3dData();
        mlFunctions.assignmentUpdate(cell3dState.existingCells, cell3dState.assignment)
        interactionsBetween.freshTree();
        treeView.moveTree(cell3dState.neighboringTried);
        treeModel.recordParentBar(highlight, cell3dState.neighboringTried, "orange");
        treeView.addParentBarView(highlight, cell3dState.neighboringTried, "orange");
        interactionsBetween.changeToMainView();
    }
}

function setAsSupportingCells(supportingCell) {
    if (cell3dState.currentMode != "mainView") {alert("Please mark it from the main view."); return;}
    if (!cell3dState.defaultCells.includes(supportingCell)) {alert("Please choose supporting cells from the first level."); return;}
   if (confirm('Are you sure that you want to mark it as a supporting cell?')){
       console.log("Supporting:" + supportingCell);
        unlinkAssignedChild(supportingCell);
        cell3dState.supportingCells.push(supportingCell);        
        cell3dView.hideCell([supportingCell]);
        treeView.deleteItemFromTopTree(supportingCell);
        cell3dModel.deleteItemFromEmbryo(supportingCell);
        mlFunctions.supportingUpdate(cell3dState.supportingCells);
        cell3dModel.updateColors();
        interactionsBetween.freshTree();
   }
}

function unlinkAssignedChild(name) {
    let parents = [];
    let index = cell3dState.cellOrder.indexOf(name);
    let parent = cell3dState.assignedParent[index];
    while (parent != 0) {
        parents.push(parent);
        index = cell3dState.cellOrder.indexOf(parent);
        parent = cell3dState.assignedParent[index];
    }
    for (let i = parents.length-1; i >= 0; i--) {
        childrenUnlink(parents[i]);
    }
}


function fresh3dData() {
    cell3dModel.freshData();
    cell3dView.clearTargetView();
    cell3dView.showCurrentCells();
    cell3dController.getPossibilities();
}

function treeControllerAddOneLevel() {
    const previousCellOrder = cell3dState.cellOrder;
    treeModel.readNewAssignment(mlState.currentAssignments);
    cell3dState.pair_possibilities = mlState.pairPossibilities;
    cell3dModel.freshData();
    console.log(cell3dState.cellOrder);
    treeModel.addParentBarInPrediction();
    visualization.getModelPredictionsPerCell();
    if (cell3dModel.checkWhetherMerge()) {
        interactionsBetween.mergeTwoTrees();
        treeState.merged = true;
        treeState.lassoParent = [];
    } else if (!utils.arraysEqual(previousCellOrder, cell3dState.cellOrder)){
        // When the new layer is generated, the depths of every node should be changed
        for (let lasso of treeState.lassoParent) {
            lasso.depth = [lasso.depth[0]+1];
        }
    }
    interactionsBetween.freshTree();
}

function removeOneLevel() {
    let cellsToRemove = [];
    for (let i = 0; i < cell3dState.cellOrder.length; i++) {
        if (cell3dState.timeDepths[i].includes(treeState.levelNum.length)
         && !cell3dState.timeDepths[i].includes(treeState.levelNum.length-1)){
            cellsToRemove.push(cell3dState.cellOrder[i]);
        }
    }
    cellsToRemove.sort();
    cellsToRemove.reverse();
    for(let cell of cellsToRemove) {
        childrenUnlink(cell);
    }
    // remove one slider level
    for (let lasso of treeState.lassoParent) {
        lasso.depth = [lasso.depth[0]-1];
    }
    interactionsBetween.freshTree();
    // remove vertical bars
    treeView.clearVerticalBars();
}

function checkTempLassoParent(intersectedCells, mode) {
    let groupA = [], groupB = [];
    let tmpHighlight = cell3dState.highlighted;
    // mode = new selection
    if (mode == "lassoSelect") {
        const parentIndex = utils.checkIteminObjectArray(cell3dState.highlighted, treeState.lassoParent, "name");
        const parentLeaves = treeState.lassoParent[parentIndex].leaves;
        const filteredArray = parentLeaves.filter(value => intersectedCells.includes(value));
        groupA = utils.sortArrayDescending(filteredArray);
        const sisterCells = utils.differenceOfSets(parentLeaves, filteredArray);
        groupB = utils.sortArrayDescending(sisterCells);
    } else {
        const targetIndex = utils.checkIteminObjectArray(cell3dState.highlighted, treeState.lassoParent, "name");
        let leaves = treeState.lassoParent[targetIndex].leaves.slice();
        const sisterIndex = treeState.lassoParent[targetIndex]["sister"];
        let sisterLeaves = treeState.lassoParent[sisterIndex].leaves.slice();
        // mode = add to selection
        if (mode == "lassoSelectAdd" || mode == "clickSelectAdd") {
            let toAdd = [];
            for (let cell of intersectedCells) {
                if (!leaves.includes(cell) && sisterLeaves.includes(cell)) {toAdd.push(cell);}
            }
            leaves = leaves.concat(toAdd);
            groupA = utils.sortArrayDescending(leaves);
            groupB = utils.differenceOfSets(sisterLeaves, toAdd);
        } else if (mode == "lassoSelectSubtract" || mode == "clickSelectSubtract") { // mode = subtract from selection
            let toRemove = [];
            for (let cell of intersectedCells) {
                if (leaves.includes(cell) && !sisterLeaves.includes(cell)) {toRemove.push(cell);}
            }
            groupA = utils.differenceOfSets(leaves, toRemove);
            sisterLeaves = sisterLeaves.concat(toRemove);
            groupB = utils.sortArrayDescending(sisterLeaves);
        }
    }
    // if the conflict, ask biologists whether they want to continue
    if (treeState.levelNum.length > 1) {
        const conflicted = checkConflictsInDivisionPrediction(groupA, groupB);
        if (conflicted.length > 0) {
            // if they confirm, then unlink all the conflicts
            if (confirm("The division is conflicted with the current assignments. Do you want to continue?")) {
                for (let conflictedItem of conflicted) {
                    childrenUnlink(conflictedItem);
                }
            } else {return [null,null];}
        }
    }
    cell3dState.highlighted = tmpHighlight;
    return [groupA, groupB];
}

function checkConflictsInDivisionPrediction(groupA, groupB) {
    let conflicted = [];
    for (let i = cell3dState.existingCells.length-1; i >= 0; i--) {
        const leaves = cell3dModel.findAllLeaves(cell3dState.existingCells[i]);
        if (utils.differenceOfSets(groupA, leaves).length == groupA.length && 
        utils.differenceOfSets(groupB, leaves).length == groupB.length) {continue;}
        if (!utils.isSuperset(groupA, leaves) && !utils.isSuperset(groupB, leaves)) {
            conflicted.push(cell3dState.existingCells[i]);
        }
    }
    return conflicted;
}

function checkSelectedFeatures() {
    let selectedFeatures = [];
    let divs = document.getElementById("features").getElementsByClassName('chip--active');
    for (let div of divs) {
        selectedFeatures.push(div.textContent.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim());
    }
    return selectedFeatures;
}

function checkSelectedModels() {
    let selectedModels = [];
    let models = document.getElementById('models');
    if (models.getElementById("nn").className.includes("chip--active")) {selectedModels.push('Neural Network');}
    if (models.getElementById("svm").className.includes("chip--active")) {selectedModels.push('SVM');}
    if (models.getElementById("knn").className.includes("chip--active")) {selectedModels.push('KNN');}
    if (models.getElementById("rf").className.includes("chip--active")) {selectedModels.push('Random Forest');}
    if (models.getElementById("baye").className.includes("chip--active")) {selectedModels.push('Bayes');}
    return selectedModels;
}

function hoverOverModels(){
    document.getElementById('nn').addEventListener("mouseover", function() {
        treeView.highlightPairsPredictedBySpecificModel('neuralNetwork');
    });
    document.getElementById('svm').addEventListener("mouseover", function() {
        treeView.highlightPairsPredictedBySpecificModel('svm');
    });
    document.getElementById('knn').addEventListener("mouseover", function() {
        treeView.highlightPairsPredictedBySpecificModel('knn');
    });
    document.getElementById('rf').addEventListener("mouseover", function() {
        treeView.highlightPairsPredictedBySpecificModel('randomForest');
    });
    document.getElementById('baye').addEventListener("mouseover", function() {
        treeView.highlightPairsPredictedBySpecificModel('bayesian');
    });

    document.getElementById('nn').addEventListener("mouseout", returnThumbnails);
    document.getElementById('svm').addEventListener("mouseout", returnThumbnails);
    document.getElementById('knn').addEventListener("mouseout", returnThumbnails);
    document.getElementById('rf').addEventListener("mouseout", returnThumbnails);
    document.getElementById('baye').addEventListener("mouseout", returnThumbnails);
}

function returnThumbnails(){
    treeView.returnHighlightedCells(treeState.highlightedThumbnails);
    for (let cell of treeState.highlightedThumbnails) {
        const leaves = cell3dModel.findAllLeaves(cell);
        treeView.returnCellInThumbnail(cell, leaves);
    }
    treeState.highlightedThumbnails = [];
}

function getModelWeight() {
    modelState.svmWeight = parseFloat(document.getElementById("svm_weight").value);
    modelState.rfWeight = parseFloat(document.getElementById("rf_weight").value);
    modelState.knnWeight = parseFloat(document.getElementById("knn_weight").value);
    modelState.nnWeight = parseFloat(document.getElementById("nn_weight").value);
    modelState.bayeWeight = parseFloat(document.getElementById("baye_weight").value);
}

function resetModelWeight() {
    modelState.svmWeight = 1;
    modelState.rfWeight = 1;
    modelState.knnWeight = 1;
    modelState.nnWeight = 1;
    modelState.bayeWeight = 1;
    document.getElementById("svm_weight").value = 1;
    document.getElementById("rf_weight").value = 1;
    document.getElementById("knn_weight").value = 1;
    document.getElementById("nn_weight").value = 1;
    document.getElementById("baye_weight").value = 1;
}

function defaultTopTreeFor64CellEmbryo() {
    const supporter = [18, 25];
    for (let i of supporter) {
        cell3dState.supportingCells.push(i);        
        cell3dView.hideCell([i]);
        treeView.deleteItemFromTopTree(i);
        cell3dModel.deleteItemFromEmbryo(i);
        cell3dModel.updateColors();
    }
    
    const set1 = [24,17,15,5,4,3,2];
    const set2 = [31,29,28,23,19,14,9,8];
    const set3 = [65,64,47,46,42,41,40,37,26,22];
    const set4 = [61,54,53,52,45,44,38,34];
    const set5 = [68,63,62,57,55,50,49];
    const set6 = [69,67,66,60,59,58,56,51];
    const set7 = [35,33,30,27,21,11,10];
    const set8 = [48,43,39,36,32,20];

    // build the first level of top tree
    let leaves = set1.concat(set2, set3, set4);
    let sisterLeaves = set5.concat(set6, set7, set8);
    treeModel.updateLassoParent(leaves, sisterLeaves, "lassoSelect", "N");

    // build the second level of the top tree
    leaves = set1.concat(set2);
    sisterLeaves = set3.concat(set4);
    treeModel.updateLassoParent(leaves, sisterLeaves, "lassoSelect", "N-1");

    leaves = set5.concat(set6);
    sisterLeaves = set7.concat(set8);
    treeModel.updateLassoParent(leaves, sisterLeaves, "lassoSelect", "N-2");

    // build the third level of the top tree
    treeModel.updateLassoParent(set1, set2, "lassoSelect", "N-3");
    treeModel.updateLassoParent(set3, set4, "lassoSelect", "N-4");
    treeModel.updateLassoParent(set5, set6, "lassoSelect", "N-5");
    treeModel.updateLassoParent(set7, set8, "lassoSelect", "N-6");
    cell3dState.cellOrder = set1.concat(set2, set3, set4, set5, set6, set7, set8);
}
