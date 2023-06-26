"use strict";

function findIntersection(array1, array2) {
    return (array1.filter(value => array2.includes(value)));
}

function random_rgb() {
    var o = Math.round, r = Math.random, s = 255;
    return [o(r()*s)/255, o(r()*s)/255, o(r()*s)/255];
}

function normalizationArr(array) {
    var norm_array = [];
    var max = 0;
    var min = 20000;
    for (var i = 0; i < array.length; i++) {
        if (array[i] > max)    {max = array[i];}
        if (array[i] < min)    {min = array[i];}
    }
    // console.log(min);
    for (var i = 0; i < array.length; i++) {
        var norm = (array[i]-min)/(max-min);
        norm_array.push(norm);
    }
    return norm_array;
}

function getAllChildren(name) {
    var index = cell3dState.cellOrder.indexOf(name);
    if (cell3dState.children[index] == 0) {return [name];}
    else{
        var left = getAllChildren(cell3dState.children[index][0]);
        var right = getAllChildren(cell3dState.children[index][1]);
        return [cell3dState.children[index][0], cell3dState.children[index][1]].concat(left, right);
    }
}

function swapTwoValuesInArray(array, index1, index2){
    var value1 = array[index1],
        value2 = array[index2];
    array[index1] = value2;
    array[index2] = value1;
    return array;
}

function getAverageCenter(cell3dState, cells) {
    var x = 0, y = 0, z = 0;
    for (var i of cells) {
        var index = cell3dState.existingCells.indexOf(i);
        x += cell3dState.centers[index][0];
        y += cell3dState.centers[index][1];
        z += cell3dState.centers[index][2];
    }
    return [x/cells.length, y/cells.length, z/cells.length];
}

function getCenterFromBounds(bounds) {
    // we had to create this function as actor.getCenter()
    // seems to not be always updated after actor.setPosition()
    // is called
    // actor.getBounds() is always updated, so we calculate
    // the actor center manually

    // bounds in is the form [xmin, xmax, ymin, ymax, zmin, zmax]
    const xCenter = bounds[0] + (bounds[1] - bounds[0]) / 2;
    const yCenter = bounds[2] + (bounds[3] - bounds[2]) / 2;
    const zCenter = bounds[4] + (bounds[5] - bounds[4]) / 2;

    return [xCenter, yCenter, zCenter];
}

function getDistrictColor(cell3dState)
{
    var x = [],
        y = [],
        z = [];
    for (var i of cell3dState.centers) {
        x.push(i[0]);
        y.push(i[1]);
        z.push(i[2]);
    }
    
    var x1 = normalizationArr(x),
        y1 = normalizationArr(y),
        z1 = normalizationArr(z);
    for (var i = 0; i < cell3dState.centers.length; i++) {
        cell3dState.colors.push([x1[i], y1[i], z1[i]]);
    }
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16)/255,
      g: parseInt(result[2], 16)/255,
      b: parseInt(result[3], 16)/255
    } : null;
}


function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
 }

function rgbToHex(color) {
    return "#" + componentToHex(parseInt(color[0]*255)) + componentToHex(parseInt(color[1]*255)) + componentToHex(parseInt(color[2]*255));
}

function averageColorOfTwo(c1, c2) {
    return [(c1[0]+c2[0])/2, (c1[1]+c2[1])/2, (c1[2]+c2[2])/2];
}

function averageColors(leaves, existingCells, colors) {
    let color = [0,0,0];
    for (let leaf of leaves) {
        const index = existingCells.indexOf(leaf);
        color[0] += colors[index][0];
        color[1] += colors[index][1];
        color[2] += colors[index][2];
    }
    for (let i = 0 ; i <= 2; i++) {
        color[i] = color[i]/leaves.length;
    }
    return color;
}

// remove all the elements of the same value in one array
function removeItemAll(arr, value) {
    let count = 0;
    while (count < arr.length) {
        if (arr[count] === value) {
            arr.splice(count, 1);
        } else {
            count ++;
        }
    }
    return arr;
}

// judge whether an object array contains one specific item
function checkIteminObjectArray(item, objectArr, title) {
    for (let object of objectArr) {
        if (Array.isArray(object[title]) && object[title].includes(item)) {
            return objectArr.indexOf(object);
        }
        else if (!Array.isArray(object[title]) && object[title] == item) {
            return objectArr.indexOf(object);
        }
    }
    return -1;
}

function extendedAssignmentsToExport(cells, assignments) {
    const lastElement = Math.max(...cells);
    let exported = assignments.slice();
    for (let item = 1; item <= lastElement; item++) {
        if (!cells.includes(item)){
            exported.splice(item-1, 0, 0);
        }
    }
    return exported;
}

function checkPointInside(point, planePoints) {
    const x = point[0],
          y = point[1];
    let inside = false;
    for (let i = 0, j = planePoints.length-1; i < planePoints.length;j = i++) {
        const xi = planePoints[i][0], yi = planePoints[i][1];
        const xj = planePoints[j][0], yj = planePoints[j][1];
        const intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) {inside = !inside;}
    }
    return inside;
}

function isSuperset(set, subset) {
    for (let elem of subset) {
        if (!set.includes(elem)) {
            return false;
        }
    }
    return true;
}

function differenceOfSets(set, subset) {
    let _difference = new Set(set)
    for (let elem of subset) {
        _difference.delete(elem)
    }
    return Array.from(_difference);
}

function sortArrayDescending(array) {
    let copy = array.slice();
    copy.sort(function(a,b){return b - a});
    return copy;
}

function elementIncluded(array2d, array) {
    for (let elem of array) {
        for (let arr of array2d) {
            if (arr.includes(elem)){
                return true;
            }
        }
    }
    return false;
}

function getOccurrence(array, value) {
    var count = 0;
    array.forEach((v) => (v === value && count++));
    return count;
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

function findProjectedPoint(normalVector, point, planePoint) {
    // const vector = [planePoint[0]-point[0], planePoint[1]-point[1], planePoint[2]-point[2]];
    // const dist = vector[0]*normalVector[0] + vector[1]*normalVector[1] + vector[2]*normalVector[2];
    // let projectedPoint = [];
    // projectedPoint.push(point[0]-dist*normalVector[0]);
    // projectedPoint.push(point[1]-dist*normalVector[1]);
    // projectedPoint.push(point[2]-dist*normalVector[2]);
    // return projectedPoint;

    const up = dotMulti(normalVector, planePoint)-dotMulti(normalVector,point);
    const down = normalVector[0]*normalVector[0] + normalVector[1]*normalVector[1] + normalVector[2]*normalVector[2];
    const t = up/down;
    let projectedPoint = [];
    projectedPoint.push(point[0]+t*normalVector[0]);
    projectedPoint.push(point[1]+t*normalVector[1]);
    projectedPoint.push(point[2]+t*normalVector[2]);
    return projectedPoint;
}

function dotMulti(vector1, vector2) {
    let multiple = 0;
    for (let i = 0; i < 3; i++) {
        multiple += vector1[i]*vector2[i];
    }
    return multiple;
}

function addTwoPoints(point1, point2) {
    const point = [point1[0] + point2[0], point1[1] + point2[1], point1[2] + point2[2]];
    return point;
}

function scaleArray(array, scaleNum){
    let scaled = array.slice();
    for (let i = 0; i < scaled.length; i++) {
        scaled[i] *= scaleNum;
    }
    return scaled;
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function exportTextFile(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function exportCsvFile(filename, rows) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + rows.map(e => e.join(",")).join("\n"));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function exportJsonFile(filename, obj) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj));
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

module.exports = {
    findIntersection,
    averageColorOfTwo,
    averageColors,
    rgbToHex,
    getDistrictColor,
    getAverageCenter,
    getAllChildren,
    random_rgb,
    swapTwoValuesInArray,
    normalizationArr,
    removeItemAll,
    checkIteminObjectArray,
    extendedAssignmentsToExport,
    checkPointInside,
    isSuperset,
    differenceOfSets,
    sortArrayDescending,
    elementIncluded,
    getOccurrence,
    arraysEqual,
    getCenterFromBounds,
    findProjectedPoint,
    addTwoPoints,
    scaleArray,
    shuffleArray,
    exportTextFile,
    exportCsvFile,
    exportJsonFile
}

