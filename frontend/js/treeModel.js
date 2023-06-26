const treeState = require('./treeState');
const cell3dState = require('./cell3dState');
const interfaceState = require('./interfaceState');
const utils = require('./utils');
const mlState = require('./mlState');
const modelState = require('./modelState');

function initLevels(assignmentData) {
  for (const cell of assignmentData) {
      if (cell.depth.includes(1)) {
          treeState.level1.push(cell.name);
      }
      // console.log(cell.depth);
      for (var j of cell.depth) {
          while (treeState.levelNum.length < j){
              treeState.levelNum.push(0);
              treeState.levelEmptyNum.push(0);
          }
          treeState.levelNum[j-1] ++;
      }
      if (cell.parent == 0) {
          treeState.levelEmptyNum[j-1] ++;
      }
  }
}

// calculate the first level cells normalization
function normalizeVolume() {
  var former = 0; // The previous level counts
  var array = [];
  for (var i of treeState.level1) {
      var index = cell3dState.existingCells.indexOf(i);
      array.push(cell3dState.volumes[index]);
  }
  treeState.normalizedVolumes = utils.normalizationArr(array);
}

function update(cellData) {
  initLevels(cellData);
  normalizeVolume();
}

function updateFromOrder(cellOrder){
  // TODO: create a dedicated function
  treeState.level1 = [];
  treeState.levelNum = [];
  treeState.levelEmptyNum = [];
  treeState.nodeWidths = [];
  treeState.cellColors = [];
  treeState.focusMoved = 0;
  treeState.nodesXs = [];
  for (var cell of cellOrder) {
      if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell)].includes(1)) {
          treeState.level1.push(cell);
      }
      // console.log(cell.depth);
      for (var j of cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell)]) {
          while (treeState.levelNum.length < j){
              treeState.levelNum.push(0);
              treeState.levelEmptyNum.push(0);
          }
          treeState.levelNum[j-1] ++;
      }
      if (cell3dState.assignedParent[cell3dState.cellOrder.indexOf(cell)] == 0) {
          treeState.levelEmptyNum[j-1] ++;
      }
  }
  normalizeVolume();
}

function readNewAssignment(assignmentData) {
  cell3dState.assignment = assignmentData.slice();

  for (var i of cell3dState.assignment) {
      if (i != 0 && !cell3dState.existingCells.includes(i)) {
          cell3dState.existingCells.push(i);
      }
  }
  cell3dState.existingCells.sort(function(a, b){return a - b});
  var removeValFromIndex = [];
  for (var i = 0; i < cell3dState.existingCells[cell3dState.existingCells.length-1]; i++){
      if (!cell3dState.existingCells.includes(i+1)){
          removeValFromIndex.push(i);
      }
  }
  for (var i = removeValFromIndex.length-1; i >=0; i--) {
      cell3dState.assignment.splice(removeValFromIndex[i], 1);
  }
}

// get the index order
function getIndexInLevel(i) {
  var formerCellId = [];
  // if (d.depth.length == 1) {
      for (var m = 0; m < i; m++) {
          if (cell3dState.timeDepths[m].includes(cell3dState.timeDepths[i][0])){
              formerCellId.push(m);
          }
      }
      return formerCellId;
}

function nodeX(i) {
  if (cell3dState.timeDepths[i].includes(1)) {
      var formerCellId = getIndexInLevel(i);
      var x = 0;
      for (var j of formerCellId) {
          x += treeState.nodeWidths[j] + interfaceState.nodeHorizontalMargin;
      }
      // console.log(i, nodesXs.length);
      if (i >= treeState.nodesXs.length) {treeState.nodesXs.push(x);}
  }
  // else, then use the first/second cell3dState.children's x
  else {
      var x1 = nodeX(cell3dState.cellOrder.indexOf(cell3dState.children[i][0]));
      var x2 = nodeX(cell3dState.cellOrder.indexOf(cell3dState.children[i][1]));
      var x = Math.min(x1, x2);
      if (i >= treeState.nodesXs.length) {treeState.nodesXs.push(x);}
  }
  return x;
}

function nodeY(i) {
    const [depthMin, depthMax] = findMinMaxDepthTopTree();
    if (treeState.merged == true) {
        return interfaceState.nodeDefaultHeight*(treeState.levelNum.length - Math.max(...cell3dState.timeDepths[i]));
    }
    return interfaceState.nodeDefaultHeight*(treeState.levelNum.length - Math.max(...cell3dState.timeDepths[i])+depthMax-depthMin+2);
}

function nodeHeight(d) {
  if (d.depth == undefined) {
      return cell3dState.timeDepths[cell3dState.cellOrder.indexOf(d)].length*interfaceState.nodeDefaultHeight-interfaceState.nodeVerticalMargin;
  }
  return d.depth.length*interfaceState.nodeDefaultHeight-interfaceState.nodeVerticalMargin;
}

function nodeWidth(i) {
  let temp = 0;
  if (cell3dState.timeDepths[i][0] == 1) {
      const index = treeState.level1.indexOf(cell3dState.cellOrder[i]);
      temp = interfaceState.nodeDefaultWidth*(1+treeState.normalizedVolumes[index]) + interfaceState.verticalBarWidth;
  }
  else {
      const children_index1 = cell3dState.cellOrder.indexOf(cell3dState.children[i][0]),
          children_index2 = cell3dState.cellOrder.indexOf(cell3dState.children[i][1]);
      // console.log(i, children_index1, children_index2);
      temp = nodeWidth(children_index1) + nodeWidth(children_index2) + interfaceState.nodeHorizontalMargin;
  }
  if (treeState.nodeWidths.length <= i) {
      treeState.nodeWidths.push(temp);
  }
  return temp;
}

function editPossibilities(sister1, sister2, pre_sister1, pre_sister2){
  var changedColor = [1,0.86,0];
  // confirm that these two are sisters
  if (pre_sister1 == -1 && pre_sister2 == -1) {
      for (var i of cell3dState.pair_possibilities) {
          if (i['pairs'].includes(sister1) && i['pairs'].includes(sister2)) {
              i['possibility'] = 1;
          }
      }
      changedColor = [0.28,0.76,0.44];
  }
  else if (pre_sister1 == 0 && pre_sister2 == 0) {
      cell3dState.pair_possibilities.push({});
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['pairs'] = [sister1, sister2];
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['possibility'] = 1;
  }
  else if (pre_sister1 == 0) {
      for (var i of cell3dState.pair_possibilities) {
          if (i['pairs'].includes(sister2) && i['pairs'].includes(pre_sister2)) {
              i['possibility'] = 1;
          }
          i['pairs'] = [sister1, sister2];
      }
  }
  else if (pre_sister2 == 0) {
      for (var i of cell3dState.pair_possibilities) {
          if (i['pairs'].includes(sister1) && i['pairs'].includes(pre_sister1)) {
              i['possibility'] = 1;
          }
          i['pairs'] = [sister1, sister2];
      }
  }
  // change the assignments       
  else {
      for (var i of cell3dState.pair_possibilities) {
          if (i['pairs'].includes(sister1) || i['pairs'].includes(sister2)){
              cell3dState.pair_possibilities.slice(cell3dState.pair_possibilities.indexOf(i),1);
          }
      }
      cell3dState.pair_possibilities.push({});
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['pairs'] = [sister1, sister2];
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['possibility'] = 1;
      cell3dState.pair_possibilities.push({});
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['pairs'] = [pre_sister1, pre_sister2];
      cell3dState.pair_possibilities[cell3dState.pair_possibilities.length-1]['possibility'] = 0.3;
  }
  changeAssignedColor(changedColor, sister1, sister2);
}

// only change 
function changeAssignedColor(changedColor, sister1, sister2) {
  cell3dState.colors_confidence[cell3dState.existingCells.indexOf(sister1)] = changedColor;
  cell3dState.colors_confidence[cell3dState.existingCells.indexOf(sister2)] = changedColor;
  for (var k of findAllNodesBelow(sister1)) {
      cell3dState.colors_confidence[cell3dState.existingCells.indexOf(k)] = changedColor;
  }
  for (var k of findAllNodesBelow(sister2)) {
      cell3dState.colors_confidence[cell3dState.existingCells.indexOf(k)] = changedColor;
  }
}

// find all nodes below
function findAllNodesBelow(name) {
  const index = cell3dState.cellOrder.indexOf(name);
  if (cell3dState.children[index] == 0) {return [name];}
  else {
      let node = [name];
      node = node.concat(findAllNodesBelow(cell3dState.children[index][0]));
      node = node.concat(findAllNodesBelow(cell3dState.children[index][1]));
      return node;
  }    
}

function deleteAllParentAbove(pre_sister1, pre_sister2) {
  var parents = [];
  var parent = cell3dState.assignment[cell3dState.existingCells.indexOf(pre_sister2)];
  cell3dState.children[cell3dState.cellOrder.indexOf(parent)] = [pre_sister1 , pre_sister2];
  while (parent != 0) {
      parents.push(parent);
      parent = cell3dState.assignment[cell3dState.existingCells.indexOf(parent)];
  }
  for (var i of parents) {
      var child1 = cell3dState.children[cell3dState.cellOrder.indexOf(i)][0];
      var child2 = cell3dState.children[cell3dState.cellOrder.indexOf(i)][1];
      cell3dState.assignment[cell3dState.existingCells.indexOf(child1)] = 0;
      cell3dState.assignment[cell3dState.existingCells.indexOf(child2)] = 0;
  }
  var parentsIndex = [];
  for (var i of parents) {
      parentsIndex.push(cell3dState.existingCells.indexOf(i));
  }
  for (var i = parents.length-1; i >=0 ; i--) {
      for (var j = cell3dState.existingCells.indexOf(parents[i]); j < cell3dState.assignment.length-1; j++) {    
          cell3dState.assignment[j] = cell3dState.assignment[j+1];
      }
      cell3dState.assignment.pop();
      cell3dState.existingCells.splice(cell3dState.existingCells.indexOf(parents[i]),1);
  }
  for (var i = 0; i < cell3dState.assignment.length; i++) {
      for (var j = parents.length-1; j >=0; j--) {
          if (cell3dState.assignment[i] > parents[j]) {
              cell3dState.assignment[i] -= j+1;
              break;
          }
      }
  }
  for (var i = 0; i < cell3dState.existingCells.length; i++) {
      for (var j = parents.length-1; j >=0; j--) {
          if (cell3dState.existingCells[i] > parents[j]) {
              cell3dState.existingCells[i] -= j+1;
              break;
          }
      }
  }
}

function nodeColor(i){
    if (cell3dState.timeDepths[i].includes(1)) {
        var index = cell3dState.existingCells.indexOf(cell3dState.cellOrder[i]);
        if (treeState.cellColors.length <= i) {treeState.cellColors.push(utils.rgbToHex(cell3dState.colors[index]));}
        return cell3dState.colors[index];
    }
    else {
        var color1 = nodeColor(cell3dState.cellOrder.indexOf(cell3dState.children[i][0]));
        var color2 = nodeColor(cell3dState.cellOrder.indexOf(cell3dState.children[i][1]));
        var color12 = utils.averageColorOfTwo(color1, color2);
        if (treeState.cellColors.length <= i) {treeState.cellColors.push(utils.rgbToHex(color12));}
        return color12;
    }
}

function greyUncertainty(pre_sister1, pre_sister2) {
    colors_confidence[cell3dState.existingCells.indexOf(pre_sister1)] = [0.6,0.6,0.6];
    colors_confidence[cell3dState.existingCells.indexOf(pre_sister2)] = [0.6,0.6,0.6];
    for (var k of findAllNodesBelow(pre_sister1)) {
        colors_confidence[cell3dState.existingCells.indexOf(k)] = [0.6,0.6,0.6];
    }
    for (var k of findAllNodesBelow(pre_sister2)) {
        colors_confidence[cell3dState.existingCells.indexOf(k)] = [0.6,0.6,0.6];
    }
}

function editAssignments() {
  const cell1 = cell3dState.highlighted,
        cell2 = cell3dState.neighboringTried;
  const index1 = cell3dState.cellOrder.indexOf(cell1);
  const parent1 = cell3dState.assignedParent[index1];
  let sister1 = [];
  if (parent1 != 0) {
      sister1 = cell3dState.children[cell3dState.cellOrder.indexOf(parent1)].slice();
      sister1.splice(sister1.indexOf(cell1), 1);
  }
  let tmpSister = cell3dState.assignment[cell3dState.existingCells.indexOf(cell2)];
  let parent2 = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(cell2)];
  // all of them have no parents
  if (sister1.length == 0 && parent2 == 0) {
      cell3dState.assignment.push(0);
      var toCreate = cell3dState.existingCells[cell3dState.existingCells.length-1] +1;
      cell3dState.existingCells.push(toCreate);
      cell3dState.assignment[cell3dState.existingCells.indexOf(cell1)] = toCreate;
      cell3dState.assignment[cell3dState.existingCells.indexOf(cell2)] = toCreate;
      editPossibilities(cell1, cell2, 0, 0);
  }
  else if (sister1.length == 0 && parent2 != 0){
      var sister2 = cell3dState.children[cell3dState.cellOrder.indexOf(parent2)].slice();
      sister2.splice(sister2.indexOf(cell2),1);

      let arrayIndex = utils.checkIteminObjectArray(sister2[0], treeState.parentBar, "name");
      if (arrayIndex != -1){treeState.parentBar.splice(arrayIndex, 1);}

      cell3dState.assignment[cell3dState.existingCells.indexOf(sister2[0])] = 0;
      cell3dState.assignment[cell3dState.existingCells.indexOf(cell1)] = cell3dState.assignment[cell3dState.existingCells.indexOf(cell2)];
      editPossibilities(cell1, cell2, 0, sister2[0]);
  }
  else if (sister1.length > 0 && parent2 == 0) {
    let arrayIndex = utils.checkIteminObjectArray(sister1[0], treeState.parentBar, "name");
    if (arrayIndex != -1){treeState.parentBar.splice(arrayIndex, 1);}

    cell3dState.assignment[cell3dState.existingCells.indexOf(sister1[0])] = 0;
    cell3dState.assignment[cell3dState.existingCells.indexOf(cell2)] = cell3dState.assignment[cell3dState.existingCells.indexOf(cell1)];
    editPossibilities(cell1, cell2, sister1[0], 0);
  }
  else {
    let arrayIndex1 = utils.checkIteminObjectArray(sister1[0], treeState.parentBar, "name");
    if (arrayIndex1 != -1){treeState.parentBar.splice(arrayIndex1, 1);}
    let arrayIndex2 = utils.checkIteminObjectArray(sister2[0], treeState.parentBar, "name");
    if (arrayIndex2 != -1){treeState.parentBar.splice(arrayIndex2, 1);}

    var sister2 = cell3dState.children[cell3dState.cellOrder.indexOf(parent2)].slice();
    sister2.splice(sister2.indexOf(cell2),1);
    cell3dState.assignment[cell3dState.existingCells.indexOf(cell2)] = cell3dState.assignment[cell3dState.existingCells.indexOf(cell1)];
    cell3dState.assignment[cell3dState.existingCells.indexOf(sister1[0])] = tmpSister;
    deleteAllParentAbove(sister1[0], sister2[0]);
    editPossibilities(cell1, cell2, sister1[0], sister2[0]);
  }
}

// change the color in tree nodes (mark as checked)
function recordParentBar(cellName1, cellName2, color) {
    let line = {};
    line["name"] = [cellName1, cellName2];
    line["color"] = color;
    const indexInBars1 = utils.checkIteminObjectArray(cellName1, treeState.parentBar, "name");
    const indexInBars2 = utils.checkIteminObjectArray(cellName2, treeState.parentBar, "name");
    if ((indexInBars1 != -1 && indexInBars1 == indexInBars2) || (indexInBars1 != -1 && indexInBars2 == indexInBars1)){
        treeState.parentBar[indexInBars1].color = color;
    } else if (indexInBars1 != -1 && treeState.parentBar[indexInBars1].color == "url(#pattern)" && 
        indexInBars2 != -1 && treeState.parentBar[indexInBars2].color == "url(#pattern)") {
        let toDelete = [indexInBars1, indexInBars2];
        toDelete.sort();
        treeState.parentBar.splice(toDelete[1],1);
        treeState.parentBar.splice(toDelete[0],1);
        treeState.parentBar.push(line);
    } else {
        treeState.parentBar.push(line);
    }
}

function getTotalWidthOfTree() {
    let totalWidth = 0;
    for (let i = 0; i < cell3dState.timeDepths.length; i++) {
        if (cell3dState.timeDepths[i].includes(1)){
            totalWidth += treeState.nodeWidths[i]+interfaceState.nodeHorizontalMargin;
        }
    }
    totalWidth -= interfaceState.nodeHorizontalMargin;
    return totalWidth;
}

// the children here could be grandchildren or children of grandchildren (just leaves)
function getWidthOfTopNodes(childrenArr) {
    let width = 0;
    for (let i of childrenArr) {
        const index = cell3dState.cellOrder.indexOf(i);
        width += treeState.nodeWidths[index]+interfaceState.nodeHorizontalMargin;
    }
    width -= interfaceState.nodeHorizontalMargin;
    return width;
}

function initialLassoParent(){
    treeState.lassoParent.push({});
    const lastIndex = treeState.lassoParent.length - 1;
    treeState.lassoParent[lastIndex]["name"] = "N";
    treeState.lassoParent[lastIndex]["depth"] = [treeState.levelNum.length+1+1];
    treeState.lassoParent[lastIndex]["leaves"] = utils.sortArrayDescending(cell3dState.existingCells.slice());
    treeState.lassoParent[lastIndex]["sister"] = null;
    treeState.lassoParent[lastIndex]["children"] = [];
    treeState.predictionConstrains.push(cell3dState.existingCells.slice());
}

function lassoWidth(i) {
    return getWidthOfTopNodes(treeState.lassoParent[i]["leaves"]);
}

function lassoHeight(i) {
    const height = treeState.lassoParent[i].depth.length*interfaceState.nodeDefaultHeight-interfaceState.nodeVerticalMargin;
    return height;
}

function lassoX(i) {
    let xs = [];
    for (let leave of treeState.lassoParent[i].leaves) {
        xs.push(nodeX(cell3dState.cellOrder.indexOf(leave)));
    }
    return Math.min(...xs);
}

function lassoY(i) {
    // const depth = Math.round(Math.log2(cell3dState.existingCells.length))+1;
    const depth = Math.max(...treeState.lassoParent[0].depth);
    return (interfaceState.nodeDefaultHeight*(depth - Math.max(...treeState.lassoParent[i].depth)));
}

function verticalBarX(name) {
    const direction = judgeVerticalBarDirection(name);
    const index = cell3dState.cellOrder.indexOf(name);
    if (direction === "right"){return treeState.nodesXs[index] + treeState.nodeWidths[index] - interfaceState.verticalBarWidth;}
    else if (direction === "left") {return treeState.nodesXs[index];}
}

function verticalBarY(d) {
    let index = d.index;
    const arr = d.allNeighborsArr;
    let total = 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    for (let i = 0; i < index; i++) {total += arr[i];}
    
    const indexCell = cell3dState.cellOrder.indexOf(d.name);
    const y = nodeY(indexCell) + interfaceState.nodeDefaultHeight/2;
    if (index == -1) {
        total = d.accuracy;
        return y + (1-total/sum)*interfaceState.nodeDefaultHeight * 0.8 - interfaceState.nodeDefaultHeight/2;
    }
    return y + total/sum * interfaceState.nodeDefaultHeight * 0.8 - interfaceState.nodeDefaultHeight/2;
}

function updateLassoParent(leaves, sisterLeaves, mode, parentCell) {
    if (mode == "lassoSelect") {
        const parentIndex = utils.checkIteminObjectArray(parentCell, treeState.lassoParent, "name");
        const parentDepth = treeState.lassoParent[parentIndex].depth;
        let addLayer = true;
        for (let lasso of treeState.lassoParent) {
            if (lasso.depth[0] == parentDepth-1) {addLayer = false; break;}
        }
        treeState.lassoParent.push({});
        let lastIndex = treeState.lassoParent.length - 1;
        treeState.lassoParent[lastIndex]["name"] = "N-"+(lastIndex).toString();
        treeState.lassoParent[lastIndex]["depth"] = [parentDepth-1];
        treeState.lassoParent[lastIndex]["leaves"] = leaves;
        treeState.lassoParent[lastIndex]["sister"] = lastIndex+1;
        treeState.lassoParent[lastIndex]["children"] = [];
        treeState.lassoParent[parentIndex]["children"].push("N-"+(lastIndex).toString());
        treeState.lassoParent.push({});
        // lastIndex has changed since we pushed in
        lastIndex = treeState.lassoParent.length - 1;
        treeState.lassoParent[lastIndex]["name"] = "N-"+(lastIndex).toString();
        treeState.lassoParent[lastIndex]["depth"] = [parentDepth-1];
        treeState.lassoParent[lastIndex]["leaves"] = sisterLeaves;
        treeState.lassoParent[lastIndex]["sister"] = lastIndex-1;
        treeState.lassoParent[lastIndex]["children"] = [];
        treeState.lassoParent[parentIndex]["children"].push("N-"+(lastIndex).toString());
        // When the new layer is generated, the depths of every node should be changed
        if (addLayer == true) {
            for (let lasso of treeState.lassoParent) {
                lasso.depth = [lasso.depth[0]+1];
            }
        }
        
    } else {
        const targetIndex = utils.checkIteminObjectArray(parentCell, treeState.lassoParent, "name");
        const sisterIndex = treeState.lassoParent[targetIndex]["sister"];
        treeState.lassoParent[targetIndex]["leaves"] = leaves;
        treeState.lassoParent[sisterIndex]["leaves"] = sisterLeaves;
    }
}

function reorderTree() {
    const length = treeState.lassoParent.length;
    let toInsert = [];
    for (let len = length-2; len <= length-1; len++) {
        toInsert = toInsert.concat(treeState.lassoParent[len].leaves);
    }
    const oldOrder = cell3dState.cellOrder.slice()
    for (let cell of oldOrder) {
        if (toInsert.includes(cell)) {
            const index = cell3dState.cellOrder.indexOf(cell);
            cell3dState.cellOrder.splice(index,1);
        }
    }
    cell3dState.cellOrder = toInsert.concat(cell3dState.cellOrder);
}

function findMinMaxDepthTopTree() {
    if (treeState.lassoParent.length == 0) {return [0,0];}
    let min = treeState.lassoParent[0].depth[0];
    let max = treeState.lassoParent[0].depth[0];
    for (let ob of treeState.lassoParent) {
        if (ob.depth[0] > max) {max = ob.depth[0];}
        else if (ob.depth[0] < min) {min = ob.depth[0];}
    }
    return [min, max];
}

function updateConstrains() {
    let constrains = [];
    const length = treeState.lassoParent.length;
    for (let i = length-1; i >= 0; i--) {
        const leaves = treeState.lassoParent[i].leaves;
        if (!utils.elementIncluded(constrains, leaves)) {
            constrains.push(leaves);
        }
    }
    treeState.predictionConstrains = constrains;
    mlState.predictionConstrains = treeState.predictionConstrains;
}

function addParentBarInPrediction(){
    let parentList = Array.from(new Set(cell3dState.assignment));
    for (let i = 0; i < parentList.length; i++) {
        let parent = parentList[i];
        if (parent == 0) {continue;}
        const children = cell3dState.children[cell3dState.cellOrder.indexOf(parent)];
        const index1 = utils.checkIteminObjectArray(children[0], treeState.parentBar, "name");
        const index2 = utils.checkIteminObjectArray(children[1], treeState.parentBar, "name");
        if (index1 == -1 || index2 == -1){
            const anyChildIndex = cell3dState.existingCells.indexOf(children[0]);
            let color = utils.scaleArray(cell3dState.colors_confidence[anyChildIndex], 255);
            color = "rgb("+ color+")";
            recordParentBar(children[0], children[1], color);
        }
    }
    for (let i of cell3dState.existingCells) {
        if (!parentList.includes(i) || cell3dState.timeDepths[cell3dState.cellOrder.indexOf(i)].length>1) {
            const index = utils.checkIteminObjectArray(i, treeState.parentBar, "name");
            if (index == -1){
                recordParentBar(i, i, "url(#pattern)");
            }
        }
    }
}

function getCellPredictionDataForVerticalBars() {
    let dataArray = [];
    for (let cell of modelState.modelPredictionsPerCell) {
        let allNeighborsArr = [];
        let sortedModelPrediction = cell.modelPrediction.slice();
        sortedModelPrediction.sort((a,b) => b.models.length - a.models.length);
        for (let prediction of sortedModelPrediction) {
            let weight = 0;
            for (let model of prediction.models) {
                switch (model) {
                    case "neuralNetwork": weight += modelState.nnWeight; break;
                    case "knn": weight += modelState.knnWeight; break;
                    case "bayesian": weight += modelState.bayeWeight; break;
                    case "svm": weight += modelState.svmWeight; break;
                    case "randomForest": weight += modelState.rfWeight; break;
                }
            }
            allNeighborsArr.push(weight);
        }
        let accuracies = [];
        for (let prediction of sortedModelPrediction){
            let obj = {};
            let accuracy = 0;
            obj.name = cell.name;
            obj.neighbor = prediction.neighbor;
            obj.models = prediction.models;
            for (let model of prediction.models) {
                switch (model) {
                    case "neuralNetwork": accuracy += modelState.defaultModelProperties[3].accuracy/100*modelState.nnWeight; break;
                    case "knn": accuracy += modelState.defaultModelProperties[2].accuracy/100*modelState.knnWeight; break;
                    case "bayesian": accuracy += modelState.defaultModelProperties[4].accuracy/100*modelState.bayeWeight; break;
                    case "svm": accuracy += modelState.defaultModelProperties[0].accuracy/100*modelState.svmWeight; break;
                    case "randomForest": accuracy += modelState.defaultModelProperties[1].accuracy/100*modelState.rfWeight; break;
                }
            }
            accuracies.push(accuracy);
            obj.accuracy = accuracy;
            obj.allNeighborsArr = allNeighborsArr;            
            obj.index = sortedModelPrediction.indexOf(prediction);
            dataArray.push(obj);
        }
        let uncertain = {};
        uncertain.name = cell.name;
        uncertain.neighbor = "Uncertain";
        uncertain.models = ["Uncertain"];
        uncertain.accuracy = allNeighborsArr.reduce((a, b) => a + b, 0) - accuracies.reduce((a, b) => a + b, 0);
        uncertain.allNeighborsArr = allNeighborsArr;
        uncertain.index = -1;
        dataArray.push(uncertain);
    }
    return dataArray;
}

function judgeVerticalBarDirection(name) {
    const index = cell3dState.cellOrder.indexOf(name);
    const parent = cell3dState.assignedParent[index];
    if (parent != 0) {
        const parentIndex = cell3dState.cellOrder.indexOf(parent);
        let sisterName = cell3dState.children[parentIndex].slice();
        sisterName.splice(sisterName.indexOf(name), 1);
        const sisterIndex = cell3dState.cellOrder.indexOf(sisterName[0]);
        if (sisterIndex < index) {return "left";}
        else {return "right";}
    } else {
        return "right";
    }
}

function getParent(name) {
    const index = cell3dState.cellOrder.indexOf(name);
    const parent = cell3dState.assignedParent[index];
    return parent;
}

module.exports = {
  update,
  updateFromOrder,
  readNewAssignment,
  nodeX,
  nodeY,
  nodeHeight,
  nodeWidth,
  editPossibilities,
  deleteAllParentAbove,
  editAssignments,
  nodeColor,
  recordParentBar,
  getTotalWidthOfTree,
  initialLassoParent,
  lassoWidth,
  lassoHeight,
  lassoX,
  lassoY,
  verticalBarX,
  verticalBarY,
  updateLassoParent,
  reorderTree,
  updateConstrains,
  addParentBarInPrediction,
  findMinMaxDepthTopTree,
  getCellPredictionDataForVerticalBars,
  judgeVerticalBarDirection,
  getParent
}