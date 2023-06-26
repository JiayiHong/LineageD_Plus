const cell3dState = require('./cell3dState');
const utils = require('./utils');
const datasetState = require('./datasetState');
const interfaceState = require('./interfaceState');
const treeState = require('./treeState');
const dataset = require('./dataset');
const mlState = require('./mlState');
const modelState = require('./modelState');

function create(cell3dData, cellData) {
  updateVtk(cell3dData);
  getCell3dData(cellData);
  cell3dState.currentExistingCells['names'] = defaultCurrentExistingCells();
  cell3dState.currentExistingCells['center'] = utils.getAverageCenter(cell3dState, cell3dState.currentExistingCells['names']);
  getSurfaceDefaultDepths();
}

function defaultCurrentExistingCells(){
    let cells = [];
    const biggest = cell3dState.existingCells[cell3dState.actors.length-1];
    for (let existingCell of cell3dState.existingCells) {
        if (existingCell <= biggest) {
            cells.push(existingCell)
        }
    }
    return cells;
}

function updateVtk(cell3dData) {
  datasetState.tissues = cell3dData.tissues;
  datasetState.trianglesInfo = cell3dData.trianglesInfo;
  datasetState.triangles = cell3dData.triangles;
  var startPoint = recordStartPoints();
  dataset.getAllTrianglesNorms(startPoint, cell3dData.points);
  for (var i = 1; i < cell3dData.tissues.length; i++) {
      var id = 0;
      var volume = 0;
      var triangles = tissueFindTriangle(i, datasetState.trianglesInfo);
      if (triangles.length == 0) {continue;}
      if (datasetState.type == "plant" && triangles.length < 7) {continue;}
      datasetState.tissuesTriangles.push(triangles);
      var polyArray = [];
      var vertexArray = [];
      for (var j of datasetState.tissuesTriangles[datasetState.tissuesTriangles.length-1]) {
          // use triangles number as volume
          volume += datasetState.trianglesInfo[j][2];
          for (var k = startPoint[j]; k < startPoint[j]+datasetState.trianglesInfo[j][2]; k++) {
              for (var m = 0; m < 3; m++) {
                  // TODO: replace cell3dData attributes by variables
                  // for performance and readability
                  vertexArray.push(cell3dData.points[cell3dData.triangles[k][m]-1][0], cell3dData.points[cell3dData.triangles[k][m]-1][1], cell3dData.points[cell3dData.triangles[k][m]-1][2]);
              }
              polyArray.push(3, id, id+1, id+2);
              id += 3;
          }
      }
      var polydata = vtk.Common.DataModel.vtkPolyData.newInstance();
      polydata.getPoints().setData(Float32Array.from(vertexArray), 3);
      polydata.getPolys().setData(Uint32Array.from(polyArray));

      const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
      mapper.setInputData(polydata);
      const actor = vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(mapper);

      // calculate actor volume and center
      var datasetMapper = mapper.getInputData();
      var bounds = datasetMapper.getBounds();
      cell3dState.centers.push([(bounds[0]+bounds[1])/2, (bounds[2]+bounds[3])/2, (bounds[4]+bounds[5])/2]);
      cell3dState.volumes.push(volume);

      interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(actor);
      cell3dState.actors.push(actor);
  }
  utils.getDistrictColor(cell3dState);
  cell3dState.colors_district = cell3dState.colors;
  for (var i = 0; i < cell3dState.actors.length; i++) {
      cell3dState.actors[i].getProperty().setColor(cell3dState.colors[i]);
  }
}

function getSurfaceDefaultDepths() {
    let depths = [];
    for (let i of cell3dState.defaultCells) {depths.push(0);}
    let surfaceTriangles = []; 
    for (let triangle of datasetState.trianglesInfo) {
        if (triangle[0] == "Exterior") {surfaceTriangles.push(datasetState.trianglesInfo.indexOf(triangle));}
        else if (triangle[1] == "Exterior") {surfaceTriangles.push(datasetState.trianglesInfo.indexOf(triangle));}
    }
    for (let cell of cell3dState.defaultCells) {
        const triangles = datasetState.tissuesTriangles[cell3dState.defaultCells.indexOf(cell)];
        if (utils.findIntersection(triangles, surfaceTriangles).length > 0) {
            cell3dState.surfaceCells.push(cell);
            depths[cell3dState.defaultCells.indexOf(cell)] = 1; // 1 represents the cell is on the surface
        }
    }
    let counts = 1; // to prevent the infinite loop
    while (depths.includes(0) && counts < 20) {
        let tmpDepth = depths.slice();
        const depthsLength = depths.length;
        for (let i = 0; i < depthsLength; i++) {
            if (depths[i] == 0) {
                let neighborsDepths = [];
                const neighbors = findNeighborsForSingleCell(cell3dState.defaultCells[i]);
                for (let neighbor of neighbors) {
                    neighborsDepths.push(depths[cell3dState.defaultCells.indexOf(neighbor)]);
                }
                if (Math.max(...neighborsDepths) > 0) {
                    tmpDepth[i] = counts+1;
                }
            }
        }
        depths = tmpDepth.slice();
        counts++;
    }
    cell3dState.surfaceDepths = depths;
}

function getSurfaceDepths() {
    let depths = cell3dState.surfaceDepths.slice();
    for (let cell of cell3dState.existingCells) {
        const index = cell3dState.existingCells.indexOf(cell);
        if (index >= depths.length) {
            const leaves = findAllLeaves(cell);
            if (utils.findIntersection(leaves, cell3dState.surfaceCells).length > 0) {
                depths.push(1);
            } else {
                depths.push(0);
            }
        }
    }
    for (let i = 1; i <= 10; i++) {
        let tmpDepth = depths.slice();
        for (let cell of cell3dState.existingCells) {
            const index = cell3dState.existingCells.indexOf(cell);
            if (depths[index] == 0) {
                const timeDepths = cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell)];
                const level = timeDepths[timeDepths.length-1];
                const neighbors = findTheNeighbors(cell, level);
                if (neighbors.length > 0) {
                    let neighborsDepths = [];
                    for (let neighbor of neighbors) {
                        const indexNeighbor = cell3dState.existingCells.indexOf(neighbor);
                        neighborsDepths.push(depths[indexNeighbor]);
                    }
                    if (Math.max(...neighborsDepths) > 0) {
                        tmpDepth[index] = i+1;
                    }
                }
            }
        }
        depths = tmpDepth.slice();
    }
    cell3dState.surfaceDepths = depths;
}

function getAreaColor(){
    cell3dState.colors_area = [];
    for (var i of cell3dState.existingCells) {
        var sister = 0,
            areas = [];
        var level = 1;
        const index = cell3dState.cellOrder.indexOf(i),
              parent = cell3dState.assignedParent[index];
        if (parent != 0) {
            const parentIndex = cell3dState.cellOrder.indexOf(parent);
            var sisterName = cell3dState.children[parentIndex].slice();
            sisterName.splice(sisterName.indexOf(i),1);
            level = cell3dState.timeDepths[index].filter(value => cell3dState.timeDepths[cell3dState.cellOrder.indexOf(sisterName[0])].includes(value));
            level = level[0];
            const neighbors = findTheNeighbors(i,level);
            for (let j of neighbors) {
                areas.push(findSharedArea(i, j));
                if (cell3dState.assignedParent[index] == cell3dState.assignedParent[cell3dState.cellOrder.indexOf(j)]) {
                    sister = areas[areas.length-1];
                }
            }
        }
        var areaMax = Math.max(...areas);
        var ratio = sister/areaMax;
        if (ratio == 0) {cell3dState.colors_area.push([1,0,1]);}
        else {cell3dState.colors_area.push([ratio*0.7+0.3, 0, ratio*0.7+0.3]);} 
    }
}

function updateColors(){
    getConfidenceColor();
    getRandomColor();
    getAreaColor();
}

// find neighbors within the same level
function findTheNeighbors(name, level){
    var neighborsName = [];
    // if the cell is in the higher level
    if (cell3dState.existingCells.indexOf(name) >= cell3dState.actors.length || cell3dState.timeDepths[cell3dState.cellOrder.indexOf(name)].length>1) {
        var basicCellsName = findAllLeaves(name);
        var allNeighbors = [];
        for (var i of basicCellsName) {
            allNeighbors = allNeighbors.concat(findNeighborsForSingleCell(i));
        }
        // console.log(allNeighbors);
        var uni_neighbors = [...new Set(allNeighbors)];
        // console.log(uni_neighbors);

        // find all parent cells with the same depth
        var cellWithSameDepth = [];
        for (var i = 0; i < cell3dState.timeDepths.length; i++){
            if (cell3dState.timeDepths[i].includes(level)) {
                cellWithSameDepth.push(cell3dState.cellOrder[i]);
            }
        }
        // console.log(cellWithSameDepth);
        for (var i of cellWithSameDepth) {
            var j = utils.findIntersection(findAllLeaves(i), uni_neighbors);
            // console.log(i,j);
            if (j.length != 0 && i != name) {
                neighborsName.push(i);
            }
        }
    }
    else {
        // if the cell is in the first level
        neighborsName = findNeighborsForSingleCell(name);
    }
    return neighborsName;
}

function recordStartPoints() {
  var startPoints = [];
  for (var i = 0; i < datasetState.trianglesInfo.length; i++) {
      if (i == 0) {startPoints = [0];}
      else {
          var temp = startPoints[startPoints.length-1] + datasetState.trianglesInfo[i-1][2];
          startPoints.push(temp);
      }
  }
  return startPoints;
}

function tissueFindTriangle(tissueIndex) {
  var trianglesList = [];
  for (var i = 0; i < datasetState.trianglesInfo.length; i ++) {
      if (datasetState.trianglesInfo[i][0] == datasetState.tissues[tissueIndex][0] || 
          datasetState.trianglesInfo[i][1] == datasetState.tissues[tissueIndex][0]) {
              trianglesList.push(i);
          }
  }
  return trianglesList;
}

function getCell3dData(data) {
  const order = [];
  for (let cell of data) {
      order.push(cell.name);
      cell3dState.assignedParent.push(cell.parent);
      cell3dState.timeDepths.push(cell.depth);
      cell3dState.children.push(cell.children);
  }
  cell3dState.cellOrder = order;
  cell3dState.existingCells = order.slice();
  cell3dState.existingCells.sort(function(a, b){return a - b});
  // Keep track of the very original data
  cell3dState.defaultCells = cell3dState.existingCells.slice();
  console.log(cell3dState.assignedParent);
  console.log(cell3dState.cellOrder);
  console.log(cell3dState.existingCells);
  updateColors();
}

function getConfidenceColor(){
  cell3dState.colors_confidence = [];
  if (cell3dState.pair_possibilities.length > 0) {
      for (var i = 0; i < cell3dState.existingCells.length; i++) {
          var name = cell3dState.existingCells[i];
          for (var pair of cell3dState.pair_possibilities) {
              if (pair['pairs'].includes(name)) {
                  cell3dState.colors_confidence.push([0,(pair['possibility']-0.5)*2,(pair['possibility']-0.5)*2]);
                  break;
              }
          }
          if (cell3dState.colors_confidence.length != i+1) {
              cell3dState.colors_confidence.push([0,1,1]);
          }
      }
  }
  else {
      for (var i = 0; i < cell3dState.existingCells.length; i++) {
          cell3dState.colors_confidence.push([0,1,1]);
      }
  }
}

function getRandomColor() {
  for (var i = 0; i < cell3dState.existingCells.length; i++) {
      var color = utils.random_rgb();
      cell3dState.colors_random.push(color);
  }
}

function postCellOrder(name) {
  if (!cell3dState.assignment.includes(name)) {cell3dState.cellOrder.push(name);return;}
  var child = [];
  for (var i = cell3dState.existingCells[cell3dState.existingCells.length-1]; i > 0; i--) {
      if (!cell3dState.existingCells.includes(i)){continue;}
      if (cell3dState.assignment[cell3dState.existingCells.indexOf(i)] == name) {child.push(i);}
      if (child.length == 2) {break;}
  }
  if (child.length == 1) {
      console.log(name);
  }
  postCellOrder(child[0]);
  postCellOrder(child[1]);
  cell3dState.cellOrder.push(name);
}

function getCellOrder(name) {
    const groups = getGroups();
    let newAddedCells = [];
    for (let cell of modelState.newPairedCells) {
        newAddedCells.push(cell3dState.assignment[cell3dState.existingCells.indexOf(cell[0])]);
    }
    for (let group of groups) {
        group.sort((a, b) => newAddedCells.indexOf(b) - newAddedCells.indexOf(a));
        for (let i of group) {
            if (!cell3dState.cellOrder.includes(i)) {
                postCellOrder(i);
            }
        }
    }
}

function getGroups(){
    // constrains group
    let groups = [];
    for (let constrain of treeState.predictionConstrains) {
        groups.push([]);
        for (let cell of constrain) {
            let index = cell3dState.existingCells.indexOf(cell);
            while (cell3dState.assignment[index] != 0 && cell3dState.assignment[index] != null) {
                let mostParent = cell3dState.assignment[index];
                index = cell3dState.existingCells.indexOf(mostParent);
            }
            if (!groups[groups.length-1].includes(cell3dState.existingCells[index])){
                groups[groups.length-1].push(cell3dState.existingCells[index]);
            }
        }
    }
    return groups;
}

function freshData() {
    cell3dState.cellOrder = [];
    cell3dState.assignedParent = [];
    cell3dState.timeDepths = [];
    cell3dState.children = [];

    const tempAssignment = cell3dState.assignment.filter(function(item) {
        return item != null;
    });
    getCellOrder(Math.max(...tempAssignment));
    let sister = [];
    let tmpDepthsMax = 0;
    for (let cell of cell3dState.cellOrder) {
        if (cell3dState.existingCells.indexOf(cell) < cell3dState.actors.length) {
            cell3dState.timeDepths.push([1]);
            cell3dState.children.push(0);
            cell3dState.assignedParent.push(cell3dState.assignment[cell3dState.existingCells.indexOf(cell)]);
        }
        else {
            var child = [],
                tmp_depth = 0;
            for (var j = 0; j < cell3dState.existingCells.length; j++) {
                var tmp = cell3dState.existingCells[j];
                if (cell3dState.assignment[j] == cell) {
                    child.push(tmp);
                    var tmp_max = Math.max(...cell3dState.timeDepths[cell3dState.cellOrder.indexOf(tmp)]);
                    if (j < cell3dState.actors.length && tmp_depth <= 2) {
                        tmp_depth = 2;
                    }
                    else if (tmp_max >= tmp_depth) {
                        tmp_depth = tmp_max+1;
                    }
                }
                if (child.length == 2) {break;}
            }
            if (tmp_depth > tmpDepthsMax) {tmpDepthsMax = tmp_depth;}
            cell3dState.timeDepths.push([tmp_depth]);
            cell3dState.children.push(child);
            cell3dState.assignedParent.push(parseInt(cell3dState.assignment[cell3dState.existingCells.indexOf(cell)]));
        }
        for (var j = 0; j < cell3dState.assignment.length; j++) {
            if (cell3dState.assignment[cell3dState.existingCells.indexOf(cell)] == 0) {
                sister.push(0);
                break;
            }
            if (cell3dState.existingCells[j] != cell && cell3dState.assignment[j] != 0 && cell3dState.assignment[j] == cell3dState.assignment[cell3dState.existingCells.indexOf(cell)]){
                sister.push(cell3dState.existingCells[j]);
                break;
            }
        }
        if (sister.length-1 != cell3dState.cellOrder.indexOf(cell)) {
            sister.push(0);
        }
    }

    // some cells have two depth
    const cellOrderLength = cell3dState.cellOrder.length;
    for (var i = 0; i < cellOrderLength; i++) {
        if (sister[i] == 0) {
            for (let j = cell3dState.timeDepths[i][0]+1; j <= tmpDepthsMax; j++) {
                cell3dState.timeDepths[i].push(j);
            }
            continue;
        }
        var depth_sister = cell3dState.timeDepths[cell3dState.cellOrder.indexOf(sister[i])][0];
        if (cell3dState.timeDepths[i][0] < depth_sister) {
            for (var j = cell3dState.timeDepths[i][0]+1; j <= depth_sister; j++){
                cell3dState.timeDepths[i].push(j);
            }
        }
    }
    getSurfaceDepths();
    cell3dState.highlighted = null;
    updateColors();
}

function checkWhetherMerge() {
    const mostDepthName = Math.max(...cell3dState.assignment);
    const mostDepth = Math.max(...cell3dState.timeDepths[cell3dState.cellOrder.indexOf(mostDepthName)]);
    console.log(mostDepth);
    let leaves = findAllLeaves(mostDepthName);
    leaves.sort(function(a,b){return b - a});
    if (treeState.lassoParent.length == 1 && treeState.levelNum.length == mostDepth) {
        let countInLevel = 0;
        for (let i of cell3dState.timeDepths) {
            if (i.includes(mostDepth)){countInLevel++;}
        }
        if (countInLevel == 2) {return true;}
        else {return false;}
    }
    for (let lassoParent of treeState.lassoParent) {
        let dividedLeaves = lassoParent.leaves;
        dividedLeaves.sort(function(a,b){return b - a});
        if (utils.arraysEqual(dividedLeaves, leaves)) {return true;}
    }
    return false;
}

function updateNewSisterDepth(index1, index2) {
  var maxDepth1 = Math.max(...cell3dState.timeDepths[index1]),
      maxDepth2 = Math.max(...cell3dState.timeDepths[index2]);
  var larger = (maxDepth1 > maxDepth2)? index1:index2;
  var smaller = (maxDepth1 > maxDepth2)? index2:index1;
  var larger_array = Math.max(...cell3dState.timeDepths[larger]),
      smaller_array = Math.max(...cell3dState.timeDepths[smaller]);
  if (cell3dState.timeDepths[larger].includes(smaller_array)) {
      for (var i of cell3dState.timeDepths[larger]) {
          var index = cell3dState.timeDepths[larger].indexOf(i);
          if (i > smaller_array) {
              cell3dState.timeDepths[larger].splice(index, 1);
          }
      }
  }
  else {
      for (var i = smaller_array+1; i <= larger_array; i++) {
          cell3dState.timeDepths[smaller].push(i);
      }
  }
}

// find neighbors for cells in the first level
function findNeighborsForSingleCell(name) {
    var neighborsName = [];
    for (var i = 0; i < cell3dState.actors.length; i++) {
        var temp_name = cell3dState.existingCells[i];
        if (temp_name == name) {continue;}
        var ar1 = datasetState.tissuesTriangles[cell3dState.defaultCells.indexOf(name)],
            ar2 = datasetState.tissuesTriangles[cell3dState.defaultCells.indexOf(temp_name)];
        if (utils.findIntersection(ar1,ar2).length != 0) {
            // console.log(temp_name);
            neighborsName.push(temp_name);
        }
    }
    // console.log(neighborsName);
    return neighborsName;
}

function findSharedArea(cell1, cell2){
    var sharedArea = 0;
    if (cell1 != cell2){
        var leaves1 = findAllLeaves(cell1),
            leaves2 = findAllLeaves(cell2);
        var array1 = findParentTriangles(leaves1),
            array2 = findParentTriangles(leaves2);
        var intersect = array1.filter(value => array2.includes(value));
    }
    else {
        return 0;
    }
    for (var i of intersect){
        sharedArea += datasetState.trianglesInfo[i][2];
    }
    return sharedArea;
}

function findParentTriangles(names) {
    var triangles_temp = [];
    for (var name of names) {
        triangles_temp = triangles_temp.concat(datasetState.tissuesTriangles[cell3dState.defaultCells.indexOf(name)]);
    }
    var triangles = [... new Set(triangles_temp)];
    return triangles;
}

// parent = names
// return names
function findAllLeaves(parent) {
    var index = cell3dState.cellOrder.indexOf(parent);
    if (cell3dState.children[index] == 0) {return [parent];}
    else {
        var leaf1 = findAllLeaves(cell3dState.children[index][0]);
        var leaf2 = findAllLeaves(cell3dState.children[index][1]);
        return leaf1.concat(leaf2);
    }
}

function getAverageColor(cell3dState, name) {
    var color = [0,0,0];
    var leaves = findAllLeaves(name);
    for (var i of leaves) {
        var index = cell3dState.existingCells.indexOf(i);
        color[0] += cell3dState.colors[index][0];
        color[1] += cell3dState.colors[index][1];
        color[2] += cell3dState.colors[index][2];
    }
    color[0] = color[0]/leaves.length;
    color[1] = color[1]/leaves.length;
    color[2] = color[2]/leaves.length;
    return color;
}

function findPackedActorsParent(actor) {
    var index = cell3dState.actors.indexOf(actor);
    var parent = cell3dState.existingCells[index];
    if (cell3dState.currentLevel > treeState.levelNum.length) {return parent;}
    for (var i = 1; i <= cell3dState.currentLevel-1; i++) {
        if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(parent)].includes(i+1)) {continue;}
        parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(parent)];
    }
    return parent;
}

function deleteItemFromEmbryo(name) {
    const index = cell3dState.existingCells.indexOf(name);
    cell3dState.existingCells.splice(index, 1);
    cell3dState.surfaceDepths.splice(index, 1);
    cell3dState.actors.splice(index, 1);
    cell3dState.colors_district.splice(index, 1);
    cell3dState.centers.splice(index, 1);
    cell3dState.volumes.splice(index, 1);
    cell3dState.assignment.splice(index, 1);
    const indexCellOrder = cell3dState.cellOrder.indexOf(name);
    cell3dState.assignedParent.splice(indexCellOrder, 1);
    cell3dState.cellOrder.splice(indexCellOrder,1);
    cell3dState.children.splice(indexCellOrder,1);
    cell3dState.timeDepths.splice(indexCellOrder,1);
    if (cell3dState.currentExistingCells['names'].includes(name)) {
        const i = cell3dState.currentExistingCells['names'].indexOf(name);
        cell3dState.currentExistingCells['names'].splice(i, 1);
    }
    cell3dState.highlighted = null;
}

function findSister(name) {
    const index = cell3dState.cellOrder.indexOf(name);
    const parent = cell3dState.assignedParent[index];
    if (parent != 0) {
        let sister = cell3dState.children[cell3dState.cellOrder.indexOf(parent)].slice();
        sister.splice(sister.indexOf(name),1);
        return sister[0];
    }
    return null;
}

module.exports = {
  create,
  freshData,
  getAreaColor,
  findTheNeighbors,
  findNeighborsForSingleCell,
  findAllLeaves,
  getAverageColor,
  findPackedActorsParent,
  updateColors,
  deleteItemFromEmbryo,
  checkWhetherMerge,
  findSister
}