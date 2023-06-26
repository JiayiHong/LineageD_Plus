
const interfaceState = require('./interfaceState');
const cell3dState = require('./cell3dState');
const treeState = require('./treeState');
const treeModel = require('./treeModel');
const utils = require('./utils');
const studyState = require('./studyState');
const mlState = require('./mlState');
const modelState = require('./modelState');

function createInstructions() {
  d3.select('#instructions')
  .append('svg')
  .attr('width', interfaceState.svgWidth)
  .attr('height', 48);
}

function createTopButtons(callback) {
  // click the default radio button
  var radiobtn = document.forms["colorForm"].elements['choice'];
  for (var i = 0; i < radiobtn.length; i++) {
      radiobtn[i].onclick = function(){
          callback(this.value);
      };
  }
}

function addParentBarView(childName1, childName2, color){
    if (childName1 != childName2){
        const index1 = cell3dState.cellOrder.indexOf(childName1),
            index2 = cell3dState.cellOrder.indexOf(childName2);
        let x1 = treeState.nodesXs[index1],
            x2 = treeState.nodesXs[index2],
            y1 = treeModel.nodeY(index1);
        let width = treeState.nodeWidths[index1] + treeState.nodeWidths[index2];
        const x = Math.min(x1, x2) - treeState.focusMoved/treeState.diff,
            y = y1 - interfaceState.nodeVerticalMargin + interfaceState.nodeHorizontalMargin;
        let id = [childName1, childName2];
        id.sort();
        treeState.background
            .append("rect")
            .attr("class", "lines")
            .attr("id", id)
            .attr("x", x)
            .attr("y", y)
            .attr("width", width + interfaceState.nodeHorizontalMargin)
            .attr("height", interfaceState.nodeVerticalMargin - 2 * interfaceState.nodeHorizontalMargin)
            .attr("fill", color);
    } else {
        const index = cell3dState.cellOrder.indexOf(childName1);
        let x = treeState.nodesXs[index] - treeState.focusMoved/treeState.diff;
        let y = treeModel.nodeY(index);
        let width = treeState.nodeWidths[index];
        treeState.background
            .append("rect")
            .attr("class", "lines")
            .attr("id", [childName1, childName2])
            .attr("x", x)
            .attr("y", y + (interfaceState.nodeDefaultHeight - interfaceState.nodeVerticalMargin))
            .attr("width", width)
            .attr("height", interfaceState.nodeVerticalMargin - interfaceState.nodeHorizontalMargin)
            .attr("fill", color);
    }
    // if (sister == null) {console.log("error happened when trying to find the sister;"); return;}
    // get two points of two cell
    
}

function changeParentBarColor(parentName, color){
    let children = null;
    if (parentName != 0){
        children = cell3dState.children[cell3dState.cellOrder.indexOf(parentName)].slice();
    }
    children.sort();
    treeState.background
        .selectAll("rect[id='"+children+"']")
        .attr("fill", color);
    
    let arrayIndex = utils.checkIteminObjectArray(children[0], treeState.parentBar, "name");
    if (arrayIndex != -1){treeState.parentBar[arrayIndex].color = color;}
}

function addTopTreeBarColor() {
    for (let lassoParent of treeState.lassoParent) {
        if (lassoParent.children.length > 0) {
            const index = treeState.lassoParent.indexOf(lassoParent);
            let height = interfaceState.nodeVerticalMargin - 2 * interfaceState.nodeHorizontalMargin;
            let x = treeModel.lassoX(index);
            let y = treeModel.lassoY(index) + treeModel.lassoHeight(index)+ (interfaceState.nodeVerticalMargin-height)/2;
            let width = treeModel.lassoWidth(index);
            d3.select("svg#mainsvg")
                .append("g")
                .attr("id", "topTreeBarG")
                .append("rect")
                .attr("class", "topBars")
                .attr("x", x)
                .attr("y", y)
                .attr("width", width)
                .attr("height", height)
                .attr("fill", "blue");
        }
    }
}

function confirmAllCurrentPairs() {
    if (treeState.levelNum.length >= 2) {
        for (let bar of treeState.parentBar) {
            if (bar.color == "orange") {continue;}
            if (bar.color == "url(#pattern)") {
                treeModel.recordParentBar(bar.name[0], bar.name[1], "url(#pattern_confirmed)")
            }
            else if (bar.color != "green") {
                treeModel.recordParentBar(bar.name[0], bar.name[1], "green");
            }
        }
    }
}


function clear() {
  d3.select("svg#mainsvg").selectAll("*").remove();
  d3.select("div#thumb_container").selectAll("*").remove();
  d3.select("#target_neighbors").select("svg").remove();
  d3.select("div#slider_level").selectAll("*").remove();
}

function createSlider(callback){
  let maxValue = treeState.levelNum.length;
  if (treeState.lassoParent.length >= 1) {maxValue = Math.max(treeState.lassoParent[0].depth);}
  const mainTreeMax = treeState.levelNum.length;  
  let slider_height = interfaceState.nodeDefaultHeight*(maxValue-1)+10,
      slider_width = 70,
      half_node = (interfaceState.svgHeight/mainTreeMax-interfaceState.nodeVerticalMargin)/2,
      slider_margin = {top: interfaceState.nodeDefaultHeight/2, 
        bottom: half_node};

  let values = [];
  for (let i = 1; i <= maxValue; i++) {
      if (i <= mainTreeMax) {
          values.push(i);
      } else if (i == mainTreeMax+1) {
          values.push("...");
      } else if (i == maxValue){
          values.push("N");
      } else {
          values.push("N-"+(maxValue-i));
      }
  }

  treeState.slider = d3.sliderVertical()
      .min(1)
      .max(maxValue)
      .step(1.0)
      .width(slider_width)
      .height(slider_height)
      .tickFormat(function(d,i){return values[i]})
      .ticks(maxValue-1)
      .displayValue(false)
      .handle(
        d3.symbol()
          .type(d3.symbolCircle)
          .size(200)
      )
      .on('onchange', val => {
            callback(val);
            let focusView = null;
            if (treeState.workingTree == "mainTree") {focusView = d3.select("svg#mainsvg").select("#bottomTreeG");}
            else {focusView = d3.select("svg#mainsvg").select("#topTreeG");}
            if (treeState.marked != null) {
                focusView.selectAll("rect")
                    .filter(function(d,i){
                        if (d.name == undefined) {return d == treeState.marked;}
                        else {return d.name == treeState.marked;}
                    })
                    .style("stroke", "none");
            }
      });

  d3.select("div#slider_level").append('svg')
      .attr('width', slider_width)
      .attr('height', slider_height+50)
      .append('g')
      .attr("transform", 'translate(' + slider_width/2 + ',' + slider_margin.top +')')
      .call(treeState.slider);
}

// TODO: module scoped var
let focusView;
function createTree(incomingData, callback, clickingCallback) {
    treeState.background = d3.select("svg#mainsvg");
    const [depthMin, depthMax] = treeModel.findMinMaxDepthTopTree();
    let height;
    if (treeState.merged == true) {
        height = (interfaceState.nodeDefaultHeight+interfaceState.nodeVerticalMargin)*(treeState.levelNum.length);
    } else {
        height = (interfaceState.nodeDefaultHeight+interfaceState.nodeVerticalMargin)*(treeState.levelNum.length+depthMax-depthMin+2);
    }
    var tree = d3.select("svg#mainsvg")
        .attr("width", interfaceState.svgWidth)
        .attr("height", height)
        .attr("data-cy", "tree-mainsvg-g")
        .append("g")
        .attr("id", "bottomTreeG")
        .selectAll(".bottomTreeG")
        .data(incomingData)
        .enter()

    focusView = tree
        .append("g")
        .attr("class", "nodes");
    var treeNodes = d3.selectAll("g.nodes")
                    .attr("class", "node");
    
    treeNodes
        .append("rect")
        .attr("class", "left")
        .attr("width", function(d, i) {return treeModel.nodeWidth(i); })
        .attr("height", function(d, i) {return treeModel.nodeHeight(d);})
        .attr("x", function(d, i) {return treeModel.nodeX(i);})
        .attr("y", function(d,i) {return treeModel.nodeY(i);})
        .attr("fill", function(d, i) {
            if (interfaceState.currentColorMode == "district") {return utils.rgbToHex(treeModel.nodeColor(i));}
            else {callback(interfaceState.currentColorMode); return utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(cell3dState.cellOrder[i])]);}
        })
        .attr('pointer-events', 'mouseover')
        .on("mouseover", function(d) { 
            d3.select(this).attr("fill", "rgb(1,1,1,0.2)");
            // if (cell3dState.currentMode == "mainView" && 
            //     ( (d.name == undefined && cell3dState.highlighted == d) || (d.name != undefined && cell3dState.highlighted == d.name))) {
            //     const index = cell3dState.cellOrder.indexOf(cell3dState.highlighted);
            //     const x = treeState.nodesXs[index] + treeState.nodeWidths[index]/2 - treeState.focusMoved/treeState.diff;
            //     const y = treeModel.nodeY(index) + interfaceState.nodeDefaultHeight/2-15;
            //     createOverviewPrediction(cell3dState.highlighted, x, y);
            // }
        })
        .on("mouseout", function(d,i){
            if (cell3dState.colors.length < cell3dState.existingCells.length) {
                d3.select(this).attr("fill", utils.rgbToHex(treeModel.nodeColor(i)));
            }
            else {
                d3.select(this).attr("fill", utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(cell3dState.cellOrder[i])]));
            }
            // if (cell3dState.currentMode == "mainView" && 
            //     ( (d.name == undefined && cell3dState.highlighted == d) || (d.name != undefined && cell3dState.highlighted == d.name))) {
            //     d3.select("svg#mainsvg").selectAll("g#modelTooltip").remove();
            // }
        });

    treeNodes
        .append("text")
        .attr("x", function(d, i){return treeModel.nodeX(i)+treeState.nodeWidths[i]/2;})
        .attr("y", function(d,i) {return treeModel.nodeY(i)+interfaceState.nodeDefaultHeight/2;})
        .style("fill", "white")
        .style("stroke", "white")
        .text(function(d) {
            if (d.name == undefined) {return d;}
            else {return d.name;}
        })  
        .on("click", function(d){
            studyState.actionRow.push(["2d click", performance.now()-studyState.startingTime]);
            clickingCallback(d);
        });

    for (let parentBar of treeState.parentBar) {
        addParentBarView(parentBar["name"][0], parentBar["name"][1], parentBar["color"]);
    }

    // create the single right stacked bar to show the overall predictions
    if (modelState.modelPredictionsPerCell.length > 0) {
        createVerticalBars();
    }
}

function constructTreePicking(callback, doubleClickCallback) {
    d3.selectAll("#bottomTreeG").selectAll("rect")
        .on("click", function(d){
            treeState.workingTree = "mainTree";
            if (cell3dState.currentMode == "neighboringView") {
                doubleClickCallback();
            }
            studyState.actionRow.push(["2d click", performance.now()-studyState.startingTime]);
            callback(d);
        })
        .on("dblclick", function(d){
            treeState.workingTree = "mainTree";
            doubleClickCallback();
        });    
}

function createVerticalBars() {
    const data = treeModel.getCellPredictionDataForVerticalBars();
    let verticalBars = d3.select("svg#mainsvg").append("g")
        .attr("id", "predictionOverviewBars")
        .selectAll(null)
        .data(data)
        .enter();
    
    verticalBars.append("rect")
        .attr('class', "rectStacked")
        .attr('width', interfaceState.verticalBarWidth)
        .attr('height', function(d, i) {
            const arr = d.allNeighborsArr;
            const sum = arr.reduce((a, b) => a + b, 0);
            return (d.accuracy / sum) * interfaceState.nodeDefaultHeight * 0.8;
        })
        .attr('x', function(d, i) {return treeModel.verticalBarX(d.name);})
        .attr('y', function(d, i) {return treeModel.verticalBarY(d);})
        .attr('fill', function (d,i) {
            if (d.neighbor == "Uncertain") {return "grey";}
            else {
                const index = cell3dState.cellOrder.indexOf(d.neighbor);
                return utils.rgbToHex(treeModel.nodeColor(index));
            }
        })
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style("stroke-dasharray", function(d,i) {
            const arr = d.allNeighborsArr;
            const sum = arr.reduce((a, b) => a + b, 0);
            const height = (d.accuracy / sum) * interfaceState.nodeDefaultHeight * 0.8;
            return "0," + interfaceState.verticalBarWidth + "," + height*2;
        })
}

function clearVerticalBars() {
    d3.select("svg#mainsvg").selectAll("#predictionOverviewBars").remove();
}

// function createOverviewPrediction(name, x, y) {
//     const index = utils.checkIteminObjectArray(name, modelState.modelPredictionsPerCell, "name");
//     if (index != -1) {
//         const allPredictions = treeModel.getCellPredictionDataForVerticalBars();
//         let possibleNeighbors = [];
//         for (let prediction of allPredictions) {
//             if (prediction.name == name) {
//                 possibleNeighbors.push(prediction);
//             }
//         }
//         possibleNeighbors.sort((a,b) => b.accuracy - a.accuracy);

//         let modelPrediction = [];
//         for (let item of possibleNeighbors) {
//             for (let model of item.models) {
//                 let obj = {};
//                 obj.model = model;
//                 let modelIndex = utils.checkIteminObjectArray(model, modelState.modelPredictions, "model");

//             }
//         }
//     }
// }

// lasso select to form the top
function createTopTree() {
    let topTree = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", "topTreeG")
        .selectAll(".topTreeG")
        .data(treeState.lassoParent)
        .enter();

    topTree
        .append("rect")
        .attr("width", function(d, i) {return treeModel.lassoWidth(i);})
        .attr("height", function(d, i) {return treeModel.lassoHeight(i);})
        .attr("x", function(d, i) {return treeModel.lassoX(i);})
        .attr("y", function(d, i) {return treeModel.lassoY(i);})
        .attr("fill", function(d,i) {const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                                    return utils.rgbToHex(color)})
        .on("mouseover", function(d) { 
            d3.select(this).attr("fill", "rgb(1,1,1,0.2)");
        })
        .on("mouseout", function(d,i){
            d3.select(this).attr("fill", utils.rgbToHex(utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors)));
        });

    topTree
        .append("text")
        .attr("x", function(d, i) {return treeModel.lassoX(i)+treeModel.lassoWidth(i)/2})
        .attr('y', function(d, i) {return treeModel.lassoY(i)+interfaceState.nodeDefaultHeight/2})
        .style("fill", "white")
        .style("stroke", "white")
        .text(function(d, i) {return ("Cell " +treeState.lassoParent[i].name)});
    
    addTopTreeBarColor();
}


// dots are representing emptys there
function createDots(){
    const [depthMin, depthMax] = treeModel.findMinMaxDepthTopTree();
    const data = [1,2,3,4,5];
    const r = 5;
    let dots = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", "possibleNeighbors")
        .selectAll("g")
        .data(eval(data))
        .enter()
        .append("circle")
        .attr("cx", function(d, i){return 4*r*d-2*r})
        .attr("cy", 50/2 + interfaceState.nodeDefaultHeight*(depthMax-depthMin+1))
        .attr("r", r)
        .attr("fill", "grey");
}

function constructTopTreePicking(treePickingCallback, doubleClickCallback) {
    d3.select("svg#mainsvg").select("#topTreeG").selectAll("rect")
        .on("click", function(d){
            treeState.workingTree = "topTree";
            studyState.actionRow.push(["2d click", performance.now()-studyState.startingTime]);
            treePickingCallback(d);
        })
        .on("dblclick", function(d) {
            treeState.workingTree = "topTree";
            doubleClickCallback();
        });
}

// TODO: code duplication, to refactor
function highlightCellinTree(cell){
    let focusView = null;
    if (treeState.workingTree == "mainTree") {focusView = d3.select("svg#mainsvg").select("g#bottomTreeG");}
    else {focusView = d3.select("svg#mainsvg").select("g#topTreeG");}
    if (cell.name == undefined && !isNaN(cell)) {
        if (!cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell)].includes(cell3dState.currentLevel)) {
            const value = cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell)][0];
            // TODO: bug here, switchToLevel in cell3dView, should we include another view in a view ?
            // or move the logic to a controller ?
            // switchToLevel(value);
            treeState.slider.value(value);
        }
        treeState.marked.push(cell);
        if (treeState.marked.includes(cell)) { 
            focusView.selectAll("rect")
                .filter(function(d,i){
                    if (d.name == undefined) {return d == cell;}
                    else {return d.name == cell;}
                })
                .style("stroke", "red")
                .style("stroke-width", "2px");
        }
    }
    else {
        if (treeState.workingTree == "mainTree" &&
            !cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell.name)].includes(cell3dState.currentLevel)) {
            const value = cell3dState.timeDepths[cell3dState.cellOrder.indexOf(cell.name)][0];
            treeState.slider.value(value);
            treeState.marked.push(cell.name);
        } else if (treeState.workingTree == "mainTree") {
            treeState.marked.push(cell.name);
            focusView.selectAll("rect")
                .filter(function(d,i){
                    if (d.name == undefined) {return d == cell;}
                    else {return d.name == cell;}
                })
                .style("stroke", "red")
                .style("stroke-width", "2px");
        }
        if (treeState.workingTree == "topTree") {
            let object;
            if (cell.name == undefined) {
                const index = utils.checkIteminObjectArray(cell, treeState.lassoParent, "name");
                object = treeState.lassoParent[index];
            } else { object = cell;}
            if (!object.depth.includes(cell3dState.currentLevel)){
                const value = object.depth;
                treeState.slider.value(value);
            }
            treeState.marked.push(object.name);
        } 
        focusView.selectAll("rect")
            .filter(function(d,i){
                if (d.name == undefined) {return d == treeState.marked[treeState.marked.length-1];}
                else {return d.name == treeState.marked[treeState.marked.length-1];}
            })
            .style("stroke", "red")
            .style("stroke-width", "2px");
    }
    if (treeState.workingTree == "mainTree"){
        let index = null;
        if (cell.name == undefined) {index = cell3dState.cellOrder.indexOf(cell);}
        else {index = cell3dState.cellOrder.indexOf(cell.name);}
        let temp = treeState.nodesXs[index] + treeState.nodeWidths[index]/2- treeState.focusMoved/treeState.diff;
        if (temp>interfaceState.svgWidth-treeState.nodeWidths[index]/2) {moveabit(1);}
        if (temp<treeState.nodeWidths[index]/2) {moveabit(-1)};
    }
}

function returnHighlightedCells(d) {
    let lastFocusView = null;
    if (isNaN(treeState.marked[0])){lastFocusView = d3.select("svg#mainsvg").select("#topTreeG");}
    else {lastFocusView = d3.select("svg#mainsvg").select("#bottomTreeG");}
    for (let markedCell of treeState.marked) {
        // remove stroke
        if (markedCell != null && markedCell != d && markedCell != d.name) {
            lastFocusView.selectAll("rect")
                .filter(function(d,i){
                    if (d.name == undefined) {return d == markedCell;}
                    else {return d.name == markedCell;}
                })
                .style("stroke", "none");
        }
    }
    treeState.marked = [];
}

function highlightPairsPredictedBySpecificModel(model) {
    const modelIndex = utils.checkIteminObjectArray(model, modelState.modelPredictions, "model");
    if (modelIndex != -1) {
        for (let posi of modelState.modelPredictions[modelIndex].possibilities) {
            if (posi[2] == 1) {
                let index = cell3dState.cellOrder.indexOf(posi[0]);
                let parent = cell3dState.assignedParent[index];
                if (parent != 0){
                    let sister = cell3dState.children[cell3dState.cellOrder.indexOf(parent)].slice();
                    sister.splice(sister.indexOf(posi[0]),1);
                    sister = sister[0];
                    if (sister == posi[1]) {
                        highlightCellInThumbnail(parent);
                        highlightCellinTree(parent);
                        treeState.highlightedThumbnails.push(parent);
                    }
                }
            }
        }
    }
}

function highlightCellInThumbnail(name) {
    d3.select("div#thumb_container").select("svg")
        .selectAll("rect")
        .filter(function(d,i){return i == cell3dState.cellOrder.indexOf(name);})
        .attr("fill", "red");
}

function returnCellInThumbnail(name, leaves) {
    d3.select("div#thumb_container").select("svg")
        .selectAll("rect")
        .filter(function(d,i){return i == cell3dState.cellOrder.indexOf(name);})
        .attr("fill", function(d,i) {
            if (d < cell3dState.cellOrder.length){
                if (interfaceState.currentColorMode == 'district') {return treeState.cellColors[d];}
                else {return utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(cell3dState.cellOrder[d])]);}
            } else {
                const color = utils.averageColors(leaves, cell3dState.existingCells, cell3dState.colors);
                return utils.rgbToHex(color);
            }
        });
}

// 1 == right, -1 == left
function moveabit(direction) {
    let focusView = d3.select("svg#mainsvg").select("g");
    var moveDistance = interfaceState.nodeDefaultWidth * direction * treeState.diff;
    var thumb_rectX = Math.max(0, Math.min(interfaceState.svgWidth-50-interfaceState.svgWidth*treeState.diff, treeState.focusMoved+moveDistance));
    treeState.focusMoved = thumb_rectX;
    d3.select("svg.thumbnail_svg").select("rect.range")
        .attr("x", function(){
            return thumb_rectX;
        });
    focusView.selectAll("rect")
        .attr("x", function(d, i){
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            const temp = treeState.nodesXs[index] - thumb_rectX/treeState.diff;
            return temp;
        });
    focusView.selectAll("text")
        .attr("x", function(d,i) {
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            const temp = treeState.nodesXs[index] + treeState.nodeWidths[index]/2- thumb_rectX/treeState.diff;
            return temp;
    });
    if (treeState.parentBar.length > 0) {
      treeState.background.selectAll(".lines")
        .attr("x", function(d, i){
            const children = treeState.parentBar[i]["name"];
            const child1 = children[0], 
                child2 = children[1];
            const index1 = cell3dState.cellOrder.indexOf(child1),
                index2 = cell3dState.cellOrder.indexOf(child2);
            var temp = Math.min(treeState.nodesXs[index1], treeState.nodesXs[index2]) - thumb_rectX/treeState.diff;
            return temp;
        });
    }
    let verticalBars = d3.select("svg#mainsvg").select("#predictionOverviewBars");
    verticalBars.selectAll("rect")
        .attr("x", function(d, i) {
            let tmp = treeModel.verticalBarX(d.name) - thumb_rectX/treeState.diff;
            return tmp;
        });
}

// TODO: module scoped var
var thumbnails;
function createThumbnail(cellOrder, doubleClickCallback) {
    let incomingData = cellOrder;
    if (treeState.lassoParent.length > 0) {
        incomingData = incomingData.concat(treeState.lassoParent);
    }

    let maxYTopTree = 0;
    if (treeState.lassoParent.length > 0) {
        const depth = Math.max(...treeState.lassoParent[0].depth);
        for (let top of treeState.lassoParent) {
            const tmp = depth - Math.max(...top.depth);
            if (tmp > maxYTopTree) {
                maxYTopTree = tmp;
            }
        }
        maxYTopTree += 1;
    }
    
    d3.select("div#thumb_container")
        .append("svg")
        .attr("width", interfaceState.svgWidth)
        .attr("height", interfaceState.nodeDefaultHeight/6*1.1*(treeState.levelNum.length+maxYTopTree)+50)
        .attr("class", "thumbnail_svg")
        .append("g")
        .selectAll("g")
        .data(incomingData)
        .enter()
        .append("g")
        .attr("class", "thumbnails");

    thumbnails = d3.selectAll("g.thumbnails");
    const totalWidth = treeModel.getTotalWidthOfTree();
    treeState.diff = interfaceState.svgWidth/totalWidth;

    thumbnails
        .append("rect")
        .attr("width",function(d,i) {
            if (i < cellOrder.length) {return treeState.nodeWidths[i]*treeState.diff;}
            else {return treeModel.lassoWidth(i-cellOrder.length)*treeState.diff;}
        })
        .attr("height", function(d,i) {
            if (i < cellOrder.length) {return treeModel.nodeHeight(d)/6;}
            else {return treeModel.lassoHeight(i-cellOrder.length)/6;}
        })
        .attr("x", function(d, i) {
            if (i < cellOrder.length) {return treeModel.nodeX(i)*treeState.diff;}
            else {return treeModel.lassoX(i-cellOrder.length)*treeState.diff;}
        })
        .attr("y", function(d, i) {
            if (i < cellOrder.length) {
                if (d.name == undefined) {
                    const y = treeModel.nodeY(cell3dState.cellOrder.indexOf(d));
                    return y/6;}
                else {
                    const y = treeModel.nodeY(cell3dState.cellOrder.indexOf(d.name));
                    return y/6;}
            }
            else {return treeModel.lassoY(i-cellOrder.length)/6;}
        })
        .attr("fill", function(d, i) {
            if (i < cellOrder.length){
                if (interfaceState.currentColorMode == 'district') {return treeState.cellColors[i];}
                else {return utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(cell3dState.cellOrder[i])]);}
            } else {
                const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                return utils.rgbToHex(color);
            }
        })
        .attr("opacity", 0.8);
    
    let height;
    if (treeState.merged == true) {height = interfaceState.nodeDefaultHeight/6*(treeState.levelNum.length+maxYTopTree);}
    else {height = interfaceState.nodeDefaultHeight/6*(treeState.levelNum.length+maxYTopTree+1);}
    d3.select("svg.thumbnail_svg")
        .append("rect")
        .attr("width", function(){return interfaceState.svgWidth*treeState.diff;})
        .attr("height", height)
        .attr("x", 0)
        .attr("class", "range")
        .attr('fill', 'white')
        .attr("opacity", 0.4)
        .style("stroke", "red")
        .style("stroke-width", 3)
        .call(d3.drag()
            .on("drag", function(){thumbnailDragged(doubleClickCallback)})
            );
}

function createZoomSlider(freshCallback) {
    const sliderSelect = '#slider_zoomTree';
    const slider_height = 100;
    const slider_width = $(document).width()*0.5;
    const margin = {right:30, left:30};
    const fixedMargin = interfaceState.nodeHorizontalMargin*(cell3dState.existingCells.length-1);
    const zoomSliderMax = 1-(interfaceState.svgWidth-fixedMargin)/(treeModel.getTotalWidthOfTree()-fixedMargin);

    const slider = d3.sliderHorizontal()
        .min(0)
        .max(zoomSliderMax)
        .width(slider_width*interfaceState.smallWindowWidthRatio)
        .height(slider_height)
        .displayValue(false)
        .ticks(5)
        .on('onchange', val => {
            console.log(val);
            interfaceState.nodeDefaultWidth = 30 * (1-val);
            freshCallback();
        })
    
    const d3SliderSelect = d3.select(sliderSelect);

    d3SliderSelect.append('svg')
        .attr('width', slider_width)
        .attr('height', slider_height)
        .attr('data-cy', 'cell3d-slider-svg')
        .append('g')
        .attr("transform", 'translate(' + margin.left + ',' + margin.right +')')
        .call(slider);

    let element = document.getElementById("slider_zoomTree");
    element.style.marginTop = "-20px";
    element.style.marginBottom = "-20px";
}


function thumbnailDragged(doubleClickCallback) {
    if (cell3dState.currentMode == "neighboringView") {
        doubleClickCallback();
    }
    const thumb_rectX = Math.max(0, Math.min(interfaceState.svgWidth-interfaceState.svgWidth*treeState.diff, d3.event.x-interfaceState.svgWidth*treeState.diff/2));
    treeState.focusMoved = thumb_rectX;
    d3.select("svg.thumbnail_svg").select("rect.range")
        .attr("x", function(){
            return thumb_rectX;
        });
    focusView.selectAll("rect")
        .attr("x", function(d, i){
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            var temp = treeState.nodesXs[index] - thumb_rectX/treeState.diff;
            return temp;
        });
    focusView.selectAll("text")
        .attr("x", function(d,i) {
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            var temp = treeState.nodesXs[index] + treeState.nodeWidths[index]/2- thumb_rectX/treeState.diff;
            return temp;
        });
    if (treeState.parentBar.length > 0) {
        treeState.background.selectAll(".lines")
            .attr("x", function(d, i){
                if (i >= treeState.parentBar.length) {return;}
                const children = treeState.parentBar[i]["name"];
                const child1 = children[0], 
                    child2 = children[1];
                const index1 = cell3dState.cellOrder.indexOf(child1),
                    index2 = cell3dState.cellOrder.indexOf(child2);
                var temp = Math.min(treeState.nodesXs[index1], treeState.nodesXs[index2]) - thumb_rectX/treeState.diff;
                return temp;
            });
    }

    let topTreeFocused = d3.select("svg#mainsvg").select("#topTreeG");
    topTreeFocused.selectAll("rect")
        .attr("x", function(d, i) {
            let tmp = treeModel.lassoX(i) - thumb_rectX/treeState.diff;
            return tmp;
        });
    topTreeFocused.selectAll("text")
        .attr("x", function(d, i) {
            let tmp = treeModel.lassoX(i) + treeModel.lassoWidth(i)/2 - thumb_rectX/treeState.diff;
            return tmp;
        })

    let verticalBars = d3.select("svg#mainsvg").select("#predictionOverviewBars");
    verticalBars.selectAll("rect")
        .attr("x", function(d, i) {
            let tmp = treeModel.verticalBarX(d.name) - thumb_rectX/treeState.diff;
            return tmp;
        });
}

// if flag = false, means to hide. otherwise, show the nodes
function hideOrShowInThumbnail(name, flag) {
  var allChildren = utils.getAllChildren(name);
  thumbnails.selectAll("rect")
      .filter(function(d,i){return allChildren.includes(d.name);})
      .style("visibility", function(){
          return (flag) ? "visible":"hidden";
      });
}

function update(cellOrder, callback, treePickingCallback, changeColorCallback, doubleClickCallback, topTreeDoubleClickCallback) {
  createTree(cellOrder, changeColorCallback, treePickingCallback);
  constructTreePicking(treePickingCallback, doubleClickCallback);
  if (treeState.merged == false) {
    createTopTree();
    constructTopTreePicking(treePickingCallback, topTreeDoubleClickCallback);
    createDots();
  }
  createSlider(callback);
  createThumbnail(cellOrder, doubleClickCallback);
}

function updateLassoParent(leaves, sisterLeaves, mode, parentCell) {
    treeModel.updateLassoParent(leaves, sisterLeaves, mode, parentCell);
    treeModel.updateConstrains();
    return true;
}

function deleteItemFromTopTree(cell) {
    for (let lp of treeState.lassoParent) {
        if (lp.leaves.includes(cell)) {
            const index = lp.leaves.indexOf(cell);
            lp.leaves.splice(index, 1);
        }
    }
    for (let constrain of treeState.predictionConstrains) {
        if (constrain.includes(cell)) {
            const index = constrain.indexOf(cell);
            constrain.splice(index, 1);
        }
    }
}

function changeColors(colorMode, tempColor) {
    changeTreeColors(colorMode, tempColor);
    changeInstructionsColor(tempColor);
}

// change the tree colors
function changeTreeColors(colorMode, tempColor){
    let focusView = d3.select("svg#mainsvg").select("g");
    let thumbnails = d3.selectAll("g.thumbnails");
    if (colorMode == "confidence" || colorMode == "area" || colorMode == "random") {
        focusView.selectAll('rect')
            .attr("fill", function(d,i) {
                var name;
                if (d.name == undefined) {name = d;}
                else {name = d.name;}
                return utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(name)])});
        thumbnails.selectAll('rect')
            .attr("fill", function(d, i) {
                    let name;
                    if (d.name == undefined) {name = d;}
                    else {name = d.name;}
                    if (cell3dState.cellOrder.includes(name)) {
                        return utils.rgbToHex(cell3dState.colors[cell3dState.existingCells.indexOf(name)]);
                    } else if (tempColor.length > 0){
                        return tempColor[1];
                    } else {
                        const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                        return utils.rgbToHex(color);
                    }
                });
        d3.select("svg#mainsvg").select("#topTreeG").selectAll('rect')
            .attr("fill", function(d, i) {
                if (d != undefined) {
                    if (tempColor.length > 0){ return tempColor[1];}
                    else {
                        const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                        return utils.rgbToHex(color);
                    }
                }else {return utils.rgbToHex([0,0,1]);}
            });
    }
    if (colorMode == "district") {
        focusView.selectAll('rect')
            .attr("fill", function(d,i) {
                var name;
                if (d.name == undefined) {name = d;}
                else {name = d.name;}
                return utils.rgbToHex(treeModel.nodeColor(cell3dState.cellOrder.indexOf(name)))});
        thumbnails.selectAll('rect')
            .attr("fill", function(d, i) {
                let name;
                if (d.name == undefined) {name = d;}
                else {name = d.name;}                
                if (cell3dState.cellOrder.includes(name)) {
                    return utils.rgbToHex(treeModel.nodeColor(cell3dState.cellOrder.indexOf(name)));
                } else {
                    const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                    return utils.rgbToHex(color);
                }
            });
        d3.select("svg#mainsvg").select("#topTreeG").selectAll('rect')
            .attr("fill", function(d, i) {
                if (d != undefined) {
                    const color = utils.averageColors(d.leaves, cell3dState.existingCells, cell3dState.colors);
                    return utils.rgbToHex(color);
                } else {return utils.rgbToHex([0,0,1]);}
            });
    }
}

function changeInstructionsColor(tempColors) {
    d3.select("#instructions").selectAll("*").remove();
  const instructionWidth = interfaceState.svgWidth*interfaceState.smallWindowWidthRatio, instructionHeight = 48;
  var svg = d3.select("#instructions")
      .append("svg")
      .attr('width',instructionWidth+10)
      .attr('height',instructionHeight);
  var grad = svg.append('defs')
      .append("svg:linearGradient")
      .attr('id', 'grad')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '100%')
      .attr('y2', '100%')
      .attr("spreadMethod", "pad");
  if (tempColors.length > 1) {
      grad.append('stop')
          .attr("offset", "0%")
          .attr("stop-color", tempColors[0])
          .attr("stop-opacity", 1);
      grad.append('stop')
          .attr("offset", "100%")
          .attr("stop-color", tempColors[1])
          .attr("stop-opacity", 1);
      svg.append('rect')
          .attr('x',0)
          .attr('y',0)
          .attr('width', instructionWidth)
          .attr('height', 20)
          .style('fill', 'url(#grad)');

      var y = d3.scaleLinear()
          .range([instructionWidth-10, 10])
          .domain([1, 0]);
    
      var yAxis = d3.axisBottom()
          .scale(y)
          .ticks(3);
    
      svg.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0,20)")
          .call(yAxis)
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 0)
          .attr("dy", ".71em");
  }
}

function moveTree(name) {
    var index1 = cell3dState.cellOrder.indexOf(name);
    var moveDistance = treeState.nodesXs[index1];
    var difference = treeState.nodeWidths[index1]/2;
    var thumb_rectX = Math.max(0, Math.min(interfaceState.svgWidth-interfaceState.svgWidth*treeState.diff, (difference+moveDistance-interfaceState.svgWidth/2)*treeState.diff));
    let focusView = d3.select("svg#mainsvg").select("g");
    treeState.focusMoved = thumb_rectX;
    d3.select("svg.thumbnail_svg")
        .select("rect.range")
        .attr("x", function (d, i){
            return thumb_rectX;
        });

    focusView.selectAll("rect")
        .attr("x", function(d, i){
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            var temp = treeState.nodesXs[index]-thumb_rectX/treeState.diff;
            return temp;
        });
    focusView.selectAll("text")
        .attr("x", function(d,i) {
            if (d.name == undefined) {var index = cell3dState.cellOrder.indexOf(d);}
            else {var index = cell3dState.cellOrder.indexOf(d.name);}
            var temp = treeState.nodesXs[index] + treeState.nodeWidths[index]/2- thumb_rectX/treeState.diff;
            return temp;
        });
    if (treeState.parentBar.length > 0) {
        treeState.background.selectAll(".lines")
            .attr("x", function(d, i){
                const children = treeState.parentBar[i]["name"];
                const child1 = children[0], 
                    child2 = children[1];
                const index1 = cell3dState.cellOrder.indexOf(child1),
                    index2 = cell3dState.cellOrder.indexOf(child2);
                var temp = Math.min(treeState.nodesXs[index1], treeState.nodesXs[index2]) - thumb_rectX/treeState.diff;
                return temp;
            });
        }
    if (treeState.lassoParent != null) {
        let topTreeFocused = d3.select("svg#mainsvg").select("#topTreeG");
        topTreeFocused.selectAll("rect")
            .attr("x", function(d, i) {
                let tmp = treeModel.lassoX(i) - thumb_rectX/treeState.diff;
                return tmp;
            });
        topTreeFocused.selectAll("text")
            .attr("x", function(d, i) {
                let tmp = treeModel.lassoX(i) + treeModel.lassoWidth(i)/2 - thumb_rectX/treeState.diff;
                return tmp;
            })
    }
    if (treeState.marked != null && treeState.marked != name) {
        focusView.selectAll("rect")
            .filter(function(d,i){
                if (d.name == undefined) {return d == treeState.marked;}
                else {return d.name == treeState.marked;}
            })
            .style("stroke", "none");
    }
    treeState.marked.push(name);
    focusView.selectAll("rect")
        .filter(function(d,i){
            if (d.name == undefined) {return d == treeState.marked;}
            else {return d.name == treeState.marked;}
        })
        .style("stroke", "red")
        .style("stroke-width", 2);
    let verticalBars = d3.select("svg#mainsvg").select("#predictionOverviewBars");
    verticalBars.selectAll("rect")
        .attr("x", function(d, i) {
            let tmp = treeModel.verticalBarX(d.name) - thumb_rectX/treeState.diff;
            return tmp;
        });
}


function showNeighborsInLine(neighbors, possibleNeighbors, neighborsTryingOutCallback) {
    const index = cell3dState.cellOrder.indexOf(cell3dState.highlighted);
    const margin = 30;
    const width = treeState.nodeWidths[index] + margin;
    const r = interfaceState.nodeDefaultHeight;
    const x = treeState.nodesXs[index] + treeState.nodeWidths[index]/2 - treeState.focusMoved/treeState.diff;
    const y = treeModel.nodeY(index) + interfaceState.nodeDefaultHeight/2-15;

    let remainedCells = [];
    for(let i of possibleNeighbors) {
        remainedCells.push(i.neighbor);
    }
    const neighborsToCircle = neighbors.filter( (el) => !remainedCells.includes(el) );
    const circleR = 15;
    const neighborCirclesGap = 2;
    
    let offset = 0;
    if ((neighborCirclesGap+circleR*2)*((1-neighborsToCircle.length)/2)+x < 0) {
        offset = - (neighborCirclesGap+circleR*2)*(-(neighborsToCircle.length-1)/2);
    } else if ((neighborCirclesGap+circleR*2)*(neighborsToCircle.length/2 + 1/2)+ x > interfaceState.svgWidth) {
        offset = interfaceState.svgWidth - (neighborCirclesGap+circleR*2)*(neighborsToCircle.length/2 + 1/2) - x;
    }
    const points = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", "neighborsG")
        .selectAll(".neighborsG")
        .data(neighborsToCircle)
        .enter()
        .append("circle")
        .attr("class", "neighbors")
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style("fill", function(d) {
            const i = cell3dState.cellOrder.indexOf(d);
            return utils.rgbToHex(treeModel.nodeColor(i));
        })
        .attr("r", circleR)
        .attr("transform", "translate(" + [x, y] + ")")
        .attr("cx", function(d,i) {
            return (neighborCirclesGap+circleR*2)*(i-(neighborsToCircle.length-1)/2) + offset;
        })
        .attr("cy", function(d,i) {
            return interfaceState.nodeDefaultHeight;
        })

    const neighborsName = d3.select("svg#mainsvg").append("g").selectAll(null)
        .data(neighborsToCircle)
        .enter()
        .append("text")
        .attr("class", "neighbors")
        .style("fill", "white")
        .style("stroke", "white")
        .attr("transform", function(d, i) {
            const cx = (neighborCirclesGap+circleR*2)*(i-(neighborsToCircle.length-1)/2);
            return "translate(" + [x + cx + offset, y + interfaceState.nodeDefaultHeight+1] + ")";
        })
        .text(function(d) {return d;})
        .on("mouseover", function(d) {
            neighborsTryingOutCallback(d);
            points.filter(function(d1,i1) {return d1 == d})
                .attr("stroke", "red");
        })
        .on("mouseout", function(d) {
            points.attr("stroke", "none");
        });
      
    points.on("mouseover", function(d) {
            neighborsTryingOutCallback(d);
            points.filter(function(d1,i1) {return d1 == d})
                .attr("stroke", "red");
        })
        .on("mouseout", function(d) {
            points.attr("stroke", "none");
        });
}

function clearNeighborsInLine() {
    d3.select("svg#mainsvg").selectAll("g").selectAll(".neighbors").remove();
}

function highlightSimilarCell2d(cells) {
    for (let cell of cell3dState.highlightedSimilarCells) {
        if (cell != cell3dState.highlighted) {
            returnHighlightedCells(cell);
        }
    }
    const diff = 100/cells.length;
    for (let i = 0; i < cells.length; i++) {
        const g = (80 + diff*i) / 255;
        colorCellIn3d(cells[i], [1, g, g]);
    }
}

function colorCellIn3d(cell, color) {
    let focusView = d3.select("svg#mainsvg").select("g#bottomTreeG");
    focusView.selectAll("rect")
        .filter(function(d,i){
            if (d.name == undefined) {return d == cell;}
            else {return d.name == cell;}
        })
        .style("stroke", utils.rgbToHex(color))
        .style("stroke-width", "2px");
}

function targetSpecificGroup() {
    const index = utils.checkIteminObjectArray(cell3dState.highlighted, treeState.lassoParent, "name");
    let leaves = treeState.lassoParent[index].leaves;
    for (let leaf of leaves) {
        leaves = leaves.concat(treeModel.getParent(leaf));
    }
    let focusView = d3.select("svg#mainsvg").select("g#bottomTreeG");
    focusView.selectAll("rect")
        .filter(function(d,i){
            if (d.name == undefined) {return !leaves.includes(d);}
            else {return !leaves.includes(d.name);}
        })
        .attr("opacity", 0.3);
}

function cancelTransparentNodes() {
    let focusView = d3.select("svg#mainsvg").select("g#bottomTreeG");
    focusView.selectAll("rect")
        .attr("opacity", 1);
}

module.exports = {
  createInstructions,
  createTopButtons,
  createZoomSlider,
  addParentBarView,
  changeParentBarColor,
  clear,
  update,
  updateLassoParent,
  deleteItemFromTopTree,
  changeColors,
  moveTree,
  highlightCellinTree,
  returnHighlightedCells,
  highlightPairsPredictedBySpecificModel,
  highlightCellInThumbnail,
  returnCellInThumbnail,
  confirmAllCurrentPairs,
  showNeighborsInLine,
  clearNeighborsInLine,
  createVerticalBars,
  clearVerticalBars,
  highlightSimilarCell2d,
  targetSpecificGroup,
  cancelTransparentNodes
}