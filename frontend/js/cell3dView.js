const interfaceState = require('./interfaceState');
const cell3dState = require('./cell3dState');
const cell3dModel = require('./cell3dModel');
const utils = require('./utils');
const treeState = require('./treeState');
const vectorUtils = require('./vectorUtils');

// TODO: this is launched once when the module is imported
// transform it to a function than can be called instead of
// relying in module loading mechanism
createRenderWindow('#mainView', interfaceState.mainViewWindow);
createRenderWindow('#sister', interfaceState.sisterViewWindow);
// TODO: replace this module scope variable
const mainRenderWindow = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].getInteractor().getView();

function createRenderWindow(div_id, id) {
  let rightButtonHold = false;
  let originalMouseY;
  // The renderers
  const container = document.querySelector(div_id);
  const renderer     = vtk.Rendering.Core.vtkRenderer.newInstance();
  const renderWindow = vtk.Rendering.Core.vtkRenderWindow.newInstance();
  interfaceState.activeWindows.push({});
  if (div_id == '#mainView') {interfaceState.activeWindows[interfaceState.activeWindows.length-1]['content'] = "Overview";}
  else if (div_id == '#sister') {interfaceState.activeWindows[interfaceState.activeWindows.length-1]['content'] = "Target & Sister";}
  else if (div_id == '#neighborhood') {interfaceState.activeWindows[interfaceState.activeWindows.length-1]['content'] = "Neighbors";}
  interfaceState.activeWindows[interfaceState.activeWindows.length-1]['renderWindow'] = renderWindow;
  interfaceState.activeWindows[interfaceState.activeWindows.length-1]['renderer'] = renderer;
  // VTK renderWindow/renderer
  renderWindow.addRenderer(renderer);
  renderer.resetCamera();
  // WebGL/OpenGL impl
  const openGLRenderWindow = vtk.Rendering.OpenGL.vtkRenderWindow.newInstance();
  openGLRenderWindow.setContainer(container);
  // console.log($(document).width()*0.6, $(document).height()*0.7);
  if (div_id == '#mainView') {
      openGLRenderWindow.setSize($(document).width()*0.6, $(document).height()*0.8);
  }
  else {
      openGLRenderWindow.setSize($(document).width()*interfaceState.smallWindowWidthRatio, $(document).height()*interfaceState.smallWindowHeightRatio);
  }
  renderWindow.addView(openGLRenderWindow);

  // Interactor
  const interactor = vtk.Rendering.Core.vtkRenderWindowInteractor.newInstance();
  interactor.setView(openGLRenderWindow);
  interactor.initialize();
  interactor.bindEvents(container);

  // Interactor style
  const trackball = vtk.Interaction.Style.vtkInteractorStyleTrackballCamera.newInstance();
  interactor.setInteractorStyle(trackball);

  interactor.onMouseMove(function(event){interactorMouseMove(event, id, rightButtonHold, originalMouseY)});
  interactor.onMouseWheel(function() {synchroCamera(id);});

  if (id == interfaceState.mainViewWindow) {
    interactor.onRightButtonPress(function(e) {
        rightButtonHold = true;
        originalMouseY = e.position.y;
    })
    interactor.onRightButtonRelease(function(e) {
        rightButtonHold = false;
    })
  }
}

function interactorMouseMove(e, id, rightButtonHold, originalMouseY) {
    synchroCamera(id);
    if (rightButtonHold == true) {
        let value = (e.position.y - originalMouseY)/2000;
        value += interfaceState.explosionValue;
        if (value > 2){value = Math.min(value, 2);}
        else if (value < 0) {value = Math.max(value, 0);}
        explosionView(value);
    }
}

function synchroCamera(masterWindow) {
  var master_renderer = interfaceState.activeWindows[masterWindow]['renderer'];
  var camera = master_renderer.getActiveCamera();
  // console.log(masterWindow);
  // console.log(camera.getPosition(), camera.getFocalPoint(), camera.getViewUp(), camera.getDistance());
  for (var i = 0 ; i < 2; i++) {
    if (i != masterWindow) {
      var renderWindow = interfaceState.activeWindows[i]['renderWindow'];
      var renderer = interfaceState.activeWindows[i]['renderer'];
      renderer.setActiveCamera(camera);
      // camera rotate changes its position and viewup
      // var position = camera.getPosition();
      // var viewup = camera.getViewUp();
      // renderer.getActiveCamera().setPosition(position[0], position[1], position[2]);
      // renderer.getActiveCamera().setViewUp(viewup[0], viewup[1], viewup[2]);
      renderWindow.render();
    }
  }
}

function clearAllView() {
  clearTargetView();
  if (interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().length != 0) {
      for (var i of interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors()) {
          interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(i);
      }
  }
}


function update(mouseDownCallback, pickEventCallback) {
  // Render
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].resetCamera();
  synchroCamera(interfaceState.mainViewWindow);
  constructPicking(mainRenderWindow, mouseDownCallback, pickEventCallback);
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function createPeelingSlider() {
    const sliderSelect = '#slider_peel';
    const slider_height = 100;
    const slider_width = $(document).width()*0.5;
    const margin = {right:30, left:30};
    const depth = Math.max(...cell3dState.surfaceDepths)-1;

    let peelingSlider = d3.sliderHorizontal()
        .min(0)
        .max(depth)
        .step(1)
        .width(slider_width*interfaceState.smallWindowWidthRatio)
        .height(slider_height)
        .displayValue(false)
        .ticks(depth)
        .on('onchange', val => {
            interfaceState.peelSliderValue = val;
            peelLayer(val);
        })
    
    const d3SliderSelect = d3.select(sliderSelect);
  
    d3SliderSelect.append('svg')
        .attr('width', slider_width)
        .attr('height', slider_height)
        .attr('data-cy', 'cell3d-slider-svg')
        .append('g')
        .attr("transform", 'translate(' + margin.left + ',' + margin.right +')')
        .call(peelingSlider);

    let element = document.getElementById("slider_peel");
    element.style.marginTop = "-20px";
    element.style.marginBottom = "-20px";
  }

function showChildren(name) {
  var index = cell3dState.cellOrder.indexOf(name);
  if (cell3dState.children[index] == 0) {console.log("This cell has no children."); return;}
  var child1 = cell3dState.children[index][0],
      child2 = cell3dState.children[index][1];
  let leaves1 = cell3dModel.findAllLeaves(child1);
  let leaves2 = cell3dModel.findAllLeaves(child2);
  for (var i of leaves1) {
      var tmp = cell3dState.existingCells.indexOf(i);
      var actor = vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(cell3dState.actors[tmp].getMapper());
      if (cell3dState.existingCells.indexOf(child1) > cell3dState.colors.length) {
          actor.getProperty().setColor(cell3dModel.getAverageColor(cell3dState,child1));}
      else {
          actor.getProperty().setColor(cell3dState.colors[cell3dState.existingCells.indexOf(child1)]);}
      actor.setPosition(cell3dState.actors[tmp].getPosition());
      interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
  }
  for (var i of leaves2) {
      var tmp = cell3dState.existingCells.indexOf(i);
      var actor = vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(cell3dState.actors[tmp].getMapper());
      if (cell3dState.existingCells.indexOf(child2) > cell3dState.colors.length) {
          actor.getProperty().setColor(cell3dModel.getAverageColor(cell3dState,child2));}
      else {
          actor.getProperty().setColor(cell3dState.colors[cell3dState.existingCells.indexOf(child2)]);}
      actor.setPosition(cell3dState.actors[tmp].getPosition());
      interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
  }
  interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();
}

// Color change
function changeColor(value) {
  let length = cell3dState.actors.length;
  let currentLevel = cell3dState.currentLevel;
  if (value == 'confidence' || value == 'area' || value == 'random') {
      for (let i = 0; i < length; i++) {
          let parent = cell3dState.existingCells[i];
          for (let j = 1; j <= currentLevel-1; j++){
              if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(parent)].includes(j+1)){continue;}
              parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(parent)];
              if (parent == 0) {break;}
          }
          let index = cell3dState.existingCells.indexOf(parent);
          cell3dState.actors[i].getProperty().setColor(cell3dState.colors[index]);
      }
  }
  if (value == 'district'){
      for (let i = 0; i < length; i++) {
          let parent = cell3dState.existingCells[i];
          for (let j = 1; j <= currentLevel-1; j++){
              if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(parent)].includes(j+1)){continue;}
              parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(parent)];
              if (parent == 0) {break;}
          }
          if (parent == 0) {continue;}
          let leaves = cell3dModel.findAllLeaves(parent),
              r = 0, g = 0, b = 0;
          for (let j of leaves) {
              let index = cell3dState.existingCells.indexOf(j);
              r += cell3dState.colors[index][0];
              g += cell3dState.colors[index][1];
              b += cell3dState.colors[index][2];
          }
          cell3dState.actors[i].getProperty().setColor(r/leaves.length, g/leaves.length, b/leaves.length);
      }
  }
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
  interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();
}

// Explosion view
function explosionView(value){
  interfaceState.explosionValue = value;
  let center;
  if (cell3dState.targetView != null) {
    const index = utils.checkIteminObjectArray(cell3dState.targetView, treeState.lassoParent, "name");
    let leaves = treeState.lassoParent[index].leaves;
    center = utils.getAverageCenter(cell3dState, leaves);
  }
  else if (cell3dState.currentMode == "neighboringView" && cell3dState.highlighted != null) { 
    center = utils.getAverageCenter(cell3dState, cell3dModel.findAllLeaves(cell3dState.highlighted));
  }
  else {center = cell3dState.currentExistingCells['center'];}
  if (cell3dState.currentExistingCells.names == undefined || cell3dState.currentExistingCells.names.length == 0) {return;}
  for (let i of cell3dState.currentExistingCells['names']) {
    let leaves;
    if (isNaN(i)) {
        const index = utils.checkIteminObjectArray(i, treeState.lassoParent, "name");
        leaves = treeState.lassoParent[index].leaves;
    } else {
        leaves = cell3dModel.findAllLeaves(i);
    }
    let cellCenter = utils.getAverageCenter(cell3dState, leaves);
    let distance = [];
    for (let j = 0; j < 3; j++) {
        distance.push(value*(cellCenter[j]-center[j]));
    }
    for (let j of leaves) {
        cell3dState.actors[cell3dState.existingCells.indexOf(j)].setPosition(distance);
    }
  }
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActiveCamera().setFocalPoint(center[0],center[1],center[2]);
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function showCurrentCells() {
    cell3dState.currentExistingCells['names'] = [];
    let diff = cell3dState.currentLevel-1;
    if (cell3dState.currentLevel > treeState.levelNum.length+1) {
        const level = cell3dState.currentLevel
        switchToLevel(1);
        switchToLevel(level);
        return;
    }
    for (let i = 0; i < cell3dState.actors.length; i++) {
        let parent = cell3dState.existingCells[i];
        for (let j = 1; j <= diff; j++){
            if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(parent)].includes(j+1)){
                continue;
            }
            parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(parent)];
            if (parent == 0) {break;}
        }
        if (parent == 0) {
            if (interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(cell3dState.actors[i])){
                interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(cell3dState.actors[i]);
            }
            continue;
            }
        interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(cell3dState.actors[i]);
        cell3dState.currentExistingCells["names"].push(parent);
    }
    explosionView(interfaceState.explosionValue);
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function clearTargetView(){
  for (var i = 1; i < 2; i++) {
      if (interfaceState.activeWindows[i]['renderer'].getActors().length != 0) {
          for (var j of interfaceState.activeWindows[i]['renderer'].getActors()) {
              interfaceState.activeWindows[i]['renderer'].removeActor(j);
          }
      }
      interfaceState.activeWindows[i]['renderWindow'].render();
  }
}

function greyAllSisterViewCells() {
    const actors = interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].getActors();
    for (let actor of actors) {
        if (actor.getProperty().getColor()!=[1,1,1]){
            actor.getProperty().setColor(1,1,1);
            actor.getProperty().setOpacity(0.1);
        }
    }
}

// When the slider circle is dragged
// Cells(cell3dState.actors) that are shown in main view now
function switchToLevel(level) {
  var diff = level - 1;
  if (level == cell3dState.currentLevel || level == treeState.levelNum.length+1) {return;}
  cell3dState.currentExistingCells['names'] = [];
  // switch to topTree & dots level
  if (level > treeState.levelNum.length + 1) {
      let cells = [];
      let indexes = [];
      let leaves = [];
      for (let cell of treeState.lassoParent) {
          if (cell.depth.includes(level)) {
              cells = cells.concat(cell.name);
              leaves = leaves.concat(cell.leaves);
              indexes = indexes.concat(treeState.lassoParent.indexOf(cell));
          }
      }
      const actors = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors();
      for (let actor of actors) {
        interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(actor);
      }
      cell3dState.currentExistingCells['names'] = treeState.lassoParent[0].leaves;
      for (let i = 0; i < cells.length; i++) {
          const index = utils.checkIteminObjectArray(cells[i], treeState.lassoParent, "name");
          const leaves = treeState.lassoParent[index].leaves;
          const color = utils.averageColors(leaves, cell3dState.existingCells, cell3dState.colors);
          for (let leaf of leaves) {
            const index = cell3dState.existingCells.indexOf(leaf);
            let actor = cell3dState.actors[index];
            actor.getProperty().setColor(color);
            interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(actor);
          }
      }
  }
  else if (level == treeState.levelNum.length + 1) {return;}
  else {
    for (var i = 0; i < cell3dState.actors.length; i++) {
        // find the right parent cell color
        var parent = cell3dState.existingCells[i];
        for (var j = 1; j <= diff; j++){
            if (cell3dState.timeDepths[cell3dState.cellOrder.indexOf(parent)].includes(j+1)){
                continue;
            }
            parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(parent)];
            // if no parent, means the actor should be hidden
            if (parent == 0 && interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(cell3dState.actors[i])) {
                interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(cell3dState.actors[i]);
                break;
            }
            if (parent == 0) {break;}
            if (level < cell3dState.currentLevel && parent && 
                !interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(cell3dState.actors[i])) {
                    if (cell3dState.targetView != null) {
                        const index = utils.checkIteminObjectArray(cell3dState.targetView, treeState.lassoParent, "name");
                        let leaves = treeState.lassoParent[index].leaves;
                        if (!leaves.includes(cell3dState.existingCells[i])) {continue;}                        
                    }
                    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(cell3dState.actors[i]);
            }
            // parent = cell3dState.cellOrder.indexOf(parent);
        }
        if (parent == 0) {continue;}
        // switching to 1
        if (level == 1 && cell3dState.cellOrder.indexOf(parent) && !interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(cell3dState.actors[i])) {
            if (cell3dState.targetView != null) {
                const index = utils.checkIteminObjectArray(cell3dState.targetView, treeState.lassoParent, "name");
                let leaves = treeState.lassoParent[index].leaves;
                if (!leaves.includes(cell3dState.existingCells[i])) {continue;}                        
            }    
            interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(cell3dState.actors[i]);
        }
        // console.log(i,parent);
        cell3dState.currentExistingCells["names"].push(parent);
        if (cell3dState.colors.length >= cell3dState.existingCells.length) {
            cell3dState.actors[i].getProperty().setColor(cell3dState.colors[cell3dState.existingCells.indexOf(parent)]);
        }
        else {
            var leaves = cell3dModel.findAllLeaves(parent),
                r = 0, g = 0, b = 0;
            // console.log(leaves);
            for (var j of leaves) {
                var index = cell3dState.existingCells.indexOf(j);
                r += cell3dState.colors[index][0];
                g += cell3dState.colors[index][1];
                b += cell3dState.colors[index][2];
            }
            cell3dState.actors[i].getProperty().setColor(r/leaves.length, g/leaves.length, b/leaves.length);
        }
    }
  }
  cell3dState.currentLevel = level;
  cell3dState.highlighted = null;
  clearTargetView();
  explosionView(interfaceState.explosionValue);
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function showNeighborsInView(name, windowIndex) {
  cell3dState.currentExistingCells['names'] = [];
  // Form neighbors in the right window
  var neighborsNames = cell3dModel.findTheNeighbors(name, cell3dState.currentLevel);
  neighborsNames.push(name);      // include the highlight cell
  for (var i of neighborsNames) {
      for (var j of cell3dModel.findAllLeaves(i)) {
          var temp = cell3dState.existingCells.indexOf(j);
          if (!interfaceState.activeWindows[windowIndex]['renderer'].getActors().includes(cell3dState.actors[temp])){
              interfaceState.activeWindows[windowIndex]['renderer'].addActor(cell3dState.actors[temp]);
              cell3dState.currentExistingCells["names"].push(i);
          }
      }
  }
  interfaceState.activeWindows[windowIndex]['renderWindow'].render();
}


function highlightCell3d(name) {
  console.log("now: ", name);
  // when the current cell3dState.highlighted is in upper level
  if (cell3dState.highlighted != null) {
    makeCellOriginalColor3d(cell3dState.highlighted);
  }
  colorCellIn3d(name, [1, 0, 0]);
  cell3dState.highlighted = name;
  targetCell(name);
  // showChildren(name);
  showSister(name);
  // showNeighbors(name);
  if (!isNaN(name) &&  interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].getActors().length < 20) {showAllOtherCells(name);}
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function highlightSimilarCell3d(names) {
    for (let cell of cell3dState.highlightedSimilarCells) {
        if (cell != cell3dState.highlighted) {
            makeCellOriginalColor3d(cell);
        }
    }
    const diff = 100/names.length;
    for (let i = 0; i < names.length; i++) {
        const g = (80 + diff*i) / 255;
        colorCellIn3d(names[i], [1, g, g]);
    }
    cell3dState.highlightedSimilarCells = names;
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function makeCellOriginalColor3d(name) {
    // var rgb = hexToRgb(myColor(cell3dState.cellOrder.indexOf(cell3dState.existingCells[cell3dState.highlighted])));
    if (cell3dState.existingCells.indexOf(name) >= cell3dState.actors.length) {
        var averageColor = cell3dModel.getAverageColor(cell3dState,name);
        for (var i of cell3dModel.findAllLeaves(name)) {
            var j = cell3dState.existingCells.indexOf(i);
            cell3dState.actors[j].getProperty().setColor(averageColor);
        }
    }
    else if (isNaN(name)) {
        const index = utils.checkIteminObjectArray(name, treeState.lassoParent, "name");
        const leaves = treeState.lassoParent[index].leaves;
        for (let leaf of leaves) {
            const i = cell3dState.existingCells.indexOf(leaf);
            cell3dState.actors[i].getProperty().setColor(cell3dState.colors[i]);
        }
    }
    else {
        cell3dState.actors[cell3dState.existingCells.indexOf(name)].getProperty().setColor(cell3dState.colors[cell3dState.existingCells.indexOf(name)]);
    }
}

// color == rgb [1,0,0] red
function colorCellIn3d(name, color) {
    // when the level is more than 1
  // var index = cell3dState.existingCells.indexOf(cell3dState.cellOrder[number]);
  // console.log(index);
  if (isNaN(name)) {
    const index = utils.checkIteminObjectArray(name, treeState.lassoParent, "name");
    const leaves = treeState.lassoParent[index].leaves;
    for (let leaf of leaves) {
        const i = cell3dState.existingCells.indexOf(leaf);
        cell3dState.actors[i].getProperty().setColor(color);
    }
  }
  else {
    if (cell3dState.existingCells.indexOf(name) >= cell3dState.actors.length) {
        // console.log(cell3dModel.findAllLeaves(number));
        const leaves = cell3dModel.findAllLeaves(name);
        for (let leaf of leaves) {
            let index = cell3dState.existingCells.indexOf(leaf);
            cell3dState.actors[index].getProperty().setColor(color);      
        }
    }
    else {
        cell3dState.actors[cell3dState.existingCells.indexOf(name)].getProperty().setColor(color); 
    }
  }
}

// show the cell above and its neighborhood
function targetCell(name){
  // remove cell3dState.highlighted actor
  if (cell3dState.highlighted != null) {
    //   clearTargetView();
    greyAllSisterViewCells();
  }
  // Form target cells in the left window
  // if the actor is in the higher level
  if (cell3dState.existingCells.indexOf(name) >= cell3dState.actors.length || 
    isNaN(name)) {
      let leaves = null;
      if (cell3dState.existingCells.indexOf(name) >= cell3dState.actors.length) {
          leaves = cell3dModel.findAllLeaves(name);
      } else {
          const index = utils.checkIteminObjectArray(name, treeState.lassoParent, "name");
          leaves = treeState.lassoParent[index].leaves;
      }
      for (let i of leaves) {
          const temp = cell3dState.existingCells.indexOf(i);
          let actor = vtk.Rendering.Core.vtkActor.newInstance();
          actor.setMapper(cell3dState.actors[temp].getMapper());
          actor.getProperty().setColor(1,0,0);
          actor.setPosition([0,0,0]);
          interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
      }
  }
  else {
      let actor = vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(cell3dState.actors[cell3dState.existingCells.indexOf(name)].getMapper());
      actor.getProperty().setColor(1,0,0);
      actor.setPosition([0,0,0]);
      interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
  }
  interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
  interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();
}

function showSister(name) {
  let sister_leaves = [];
  let sister;
  if (isNaN(name)){
      const index = utils.checkIteminObjectArray(name, treeState.lassoParent, "name");
      if (treeState.lassoParent.sister == null) {return;}
      else {sister_leaves = treeState.lassoParent[treeState.lassoParent[index].sister].leaves;}
  } else {
      const index = cell3dState.cellOrder.indexOf(name);
      const parent = cell3dState.assignedParent[index];
      if (parent == 0) {return;}
      else {
        sister = cell3dState.children[cell3dState.cellOrder.indexOf(parent)].slice();
        sister.splice(sister.indexOf(name),1);
        sister_leaves = cell3dModel.findAllLeaves(sister[0]);
      }
  }
  for (let i of sister_leaves) {
    const tmp = cell3dState.existingCells.indexOf(i);
    let actor = vtk.Rendering.Core.vtkActor.newInstance();
    actor.setMapper(cell3dState.actors[tmp].getMapper());
    actor.setPosition([0,0,0]);
    if (cell3dState.existingCells.indexOf(sister[0]) > cell3dState.colors.length) {
        const color = cell3dModel.getAverageColor(cell3dState,sister[0]);
        actor.getProperty().setColor(color);}
    else {
        const color = cell3dState.colors[cell3dState.existingCells.indexOf(sister[0])];
        actor.getProperty().setColor(color);}
        interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
    }
    interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();
}

function showAllOtherCells(name) {
    const index1 = cell3dState.cellOrder.indexOf(name);
    const parent = cell3dState.assignedParent[index1];
    const leaves1 = cell3dModel.findAllLeaves(name);
    let leaves;
    if (parent != 0){
        let sister = cell3dState.children[cell3dState.cellOrder.indexOf(parent)].slice();
        sister.splice(sister.indexOf(name),1);
        const leaves2 = cell3dModel.findAllLeaves(sister[0]);
        leaves = leaves1.concat(leaves2);
    } else {
        leaves = leaves1.slice();
    }
    for (let oriActor of cell3dState.actors) {
        const index = cell3dState.actors.indexOf(oriActor);
        const name = cell3dState.existingCells[index];
        if (! leaves.includes(name)) {
            let actor = vtk.Rendering.Core.vtkActor.newInstance();
            actor.setMapper(oriActor.getMapper());
            actor.setPosition([0,0,0]);
            actor.getProperty().setColor(1,1,1);
            actor.getProperty().setOpacity(0.1);
            interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].addActor(actor);
        }
    }
    interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();    
}

function deleteAllOtherCells(name) {
    const index1 = cell3dState.cellOrder.indexOf(name);
    const parent = cell3dState.assignedParent[index1];
    const leaves1 = cell3dModel.findAllLeaves(name);
    let leaves;
    if (parent != 0){
        let sister = cell3dState.children[cell3dState.cellOrder.indexOf(parent)].slice();
        sister.splice(sister.indexOf(name),1);
        const leaves2 = cell3dModel.findAllLeaves(sister[0]);
        leaves = leaves1.concat(leaves2);
    } else {
        leaves = leaves1.slice();
    }
    for (let oriActor of cell3dState.actors) {
        const index = cell3dState.actors.indexOf(oriActor);
        const name = cell3dState.existingCells[index];
        const actors = interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].getActors();
        if (! leaves.includes(name)) {
            for (let actor of actors) {
                if (actor.getMapper() === oriActor.getMapper()) {
                    interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].removeActor(actor);
                }
            }
        }
    }
    interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();   
}

function tryOtherNeighbors(name) {
  const sisterViewWindow = interfaceState.sisterViewWindow;
  if (cell3dState.neighboringTried != null && cell3dState.neighboringTried != cell3dState.highlighted) {
    let parent = cell3dState.assignedParent[cell3dState.cellOrder.indexOf(cell3dState.highlighted)];
    if (parent == 0 || !cell3dState.children[cell3dState.cellOrder.indexOf(parent)].includes(cell3dState.neighboringTried)){
        let leaves = cell3dModel.findAllLeaves(cell3dState.neighboringTried);
        const sister = cell3dModel.findSister(cell3dState.neighboringTried);
        if (sister != null) {
            leaves = leaves.concat(cell3dModel.findAllLeaves(sister));
        }
        const actors = interfaceState.activeWindows[sisterViewWindow]['renderer'].getActors();
        for (let actor of actors) {
            for (let leaf of leaves) {
                const index = cell3dState.existingCells.indexOf(leaf);
                const oriActor = cell3dState.actors[index];
                if (actor.getMapper() === oriActor.getMapper()) {
                    interfaceState.activeWindows[sisterViewWindow]['renderer'].removeActor(actor);
                }
            }
        }
    }
  }
  let leaves = cell3dModel.findAllLeaves(name);
  const sister = cell3dModel.findSister(name);
  if (sister == cell3dState.highlighted) {return;}
  let sisterLeaves = [];
  if (sister != null) {
      sisterLeaves = cell3dModel.findAllLeaves(sister)
      leaves = leaves.concat(sisterLeaves);
  }
  for (let i of leaves) {
      const tmp = cell3dState.existingCells.indexOf(i);
      const actor = vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(cell3dState.actors[tmp].getMapper());
      actor.setPosition([0,0,0]);
      if (sisterLeaves.includes(i)) {
        actor.getProperty().setColor(1,1,1);
        actor.getProperty().setOpacity(0.4);
      } else if (cell3dState.existingCells.indexOf(name) > cell3dState.colors.length) {
        actor.getProperty().setColor(cell3dModel.getAverageColor(cell3dState,name));}
      else {
        actor.getProperty().setColor(cell3dState.colors[cell3dState.existingCells.indexOf(name)]);}
      interfaceState.activeWindows[sisterViewWindow]['renderer'].addActor(actor);
  }
  interfaceState.activeWindows[sisterViewWindow]['renderWindow'].render();
  cell3dState.neighboringTried = name;
}

const pointerActor = vtk.Rendering.Core.vtkActor.newInstance();
const hardwareSelector = vtk.Rendering.OpenGL.vtkHardwareSelector.newInstance({
        captureZValues: true,
    });
let lastProcessedActor = null;
var throttleMouseHandlerOverview, 
    throttleMouseHandlerNeighbors;
let rightClickToConfirm;
let mainRenderWindowLocal;

function constructPicking(mainRenderWindow, mouseDownCallback, pickEventCallback) {
    const pointerSource = vtk.Filters.Sources.vtkSphereSource.newInstance({
        phiResolution: 15,
        thetaResolution: 15,
        radius: 0.01,
    });
    const pointerMapper = vtk.Rendering.Core.vtkMapper.newInstance();
    pointerActor.setMapper(pointerMapper);
    pointerMapper.setInputConnection(pointerSource.getOutputPort());
    mainRenderWindowLocal = mainRenderWindow;
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(pointerActor);   
    addOverviewListeners(0, mouseDownCallback, pickEventCallback);
}

function addOverviewListeners(number, mouseDownCallback, pickEventCallback) {
    var divName = interfaceState.windowsName[number];
    attachHardwareSelector(number);
    document.querySelector(divName).addEventListener('mousedown', mouseDownCallback);
    // Single Left click design
    throttleMouseHandlerOverview = vtk.macro.throttle(pickEventCallback, 100);
    // Left click interaction in 3D
    document.querySelector(divName).addEventListener('click', throttleMouseHandlerOverview);
}

function attachHardwareSelector(number) {
    hardwareSelector.setFieldAssociation(
        vtk.Common.DataModel.vtkDataSet.FieldAssociations.FIELD_ASSOCIATION_POINTS
    );
    hardwareSelector.attach(mainRenderWindowLocal, interfaceState.activeWindows[number]['renderer']);
}

function eventToWindowXY(renderWindow, event) {
    const [width, height] = renderWindow.getSize();
    const rect = event.target.getBoundingClientRect();
    const {clientX, clientY} = event;

    // we use a pixel ratio as HTML canvas (the target of the event)
    // is smaller than the VTK renderWindow
    const x = Math.round((clientX - rect.left) * (width / rect.width));
  
    // Y axis direction in VTK is opposed to HTML, so we need the bottom 
    // of the canvas
    const rectBottom = rect.height + rect.top;
    const y = Math.round((rectBottom - clientY) * (height / rect.height));

    return [x, y];
}

function processSelection(selections) {
    if (!selections || selections.length === 0) {
      pointerActor.setVisibility(false);
      interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
      lastProcessedActor = null;
      const parent = -1, worldPosition = [0,0,0];
      return {parent, worldPosition};
    }
    const { worldPosition, compositeID, prop } = selections[0].getProperties();
    if (lastProcessedActor === prop) {
      // Skip render call when nothing change
      updateWorldPosition(worldPosition);
      const parent = cell3dModel.findPackedActorsParent(prop);
      return {parent, worldPosition};
    }
    lastProcessedActor = prop;
    const parent = cell3dModel.findPackedActorsParent(prop);
    return {parent, worldPosition};
}

function processNeighboringSelections(event) {
    const {parent, worldPosition} = getProcessedSelection(event);
    if (parent == -1) {return;}
    tryOtherNeighbors(parent);
    // Update picture for the user so we can see the green one
    updateWorldPosition(worldPosition);
}

function updateWorldPosition(worldPosition) {
    if (lastProcessedActor) {
      pointerActor.setVisibility(true);
      var transferred = [].slice.call(worldPosition);
      pointerActor.setPosition(transferred);
    } else {
      pointerActor.setVisibility(false);
    }
    // interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

// Re-double click in the neighbors view will return to the main view
function changeToMainView() {
    cell3dState.currentMode = "mainView";
    if (interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().length > 0) {
        let actors = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors();
        for (let i of actors) {
            interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(i);
        }
    }
    showCurrentCells();
    peelLayer(interfaceState.peelSliderValue);
    cell3dState.neighboringTried = null;
}

function clearCurrentActors() {
    // remove all the current actors
    if (interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().length > 0) {
        let actors = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors();
        for (let i of actors) {
            interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(i);
        }
    }
}

function isAnimating() {
  return interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].getInteractor().isAnimating();
}

// double click in the main view will switch to neighbors view
function changeToNeighborsView(name) {
  cell3dState.currentMode = "neighboringView";
  clearCurrentActors();
  showNeighborsInView(name, interfaceState.mainViewWindow);
  explosionView(interfaceState.explosionValue);
  interfaceState.peelValue = 0;
}

function getProcessedSelection(event) {
    const [x, y] = eventToWindowXY(mainRenderWindowLocal, event);
    hardwareSelector.setArea(x, y, x, y);
    hardwareSelector.releasePixBuffers();
    pointerActor.setVisibility(false);
    if (hardwareSelector.captureBuffers()) {
        const selections = hardwareSelector.generateSelection(x, y, x, y);
        return processSelection(selections);
    } else {
        return null;
    }
}

function hideCell(cellArray) {
    for (let cell of cellArray) {
        const index = cell3dState.existingCells.indexOf(cell);
        const actor = cell3dState.actors[index];
        interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(actor);
    }
    const actors = interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].getActors();
    for (let actor of actors) {
        interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderer'].removeActor(actor);
    }
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
    interfaceState.activeWindows[interfaceState.sisterViewWindow]['renderWindow'].render();
}

function peelLayer(value) {
    const diff = Math.abs(value - interfaceState.peelValue);
    if (diff == 0) {return;}
    for (let layer = 0; layer < diff; layer ++) {
        for (const actor of cell3dState.actors) {
            const index = cell3dState.actors.indexOf(actor);
            const name = cell3dState.existingCells[index];
            if (value > interfaceState.peelValue &&
                cell3dState.surfaceDepths[cell3dState.defaultCells.indexOf(name)] == value - layer &&
                interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(actor)) {
                    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(actor);
            } else if (value < interfaceState.peelValue &&
                cell3dState.surfaceDepths[cell3dState.defaultCells.indexOf(name)] == value + layer + 1 &&
                !interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(actor)) {
                    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].addActor(actor);
            }
        }
    }
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
    interfaceState.peelValue = value;
}

function settingLasso() {
    interfaceState.widgetManager = vtk.Widgets.Core.vtkWidgetManager.newInstance();
    // interfaceState.widgetManager.setCaptureOn(vtk.Widgets.Core.vtkWidgetManager.Constants.CaptureOn.MOUSE_RELEASE);
    const renderer = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'];
    interfaceState.widgetManager.setRenderer(renderer);
}


function startingLasso() {
    const widget = vtk.Widgets.Widgets3D.vtkSplineWidget.newInstance({resolution: 1});
    let handle = interfaceState.widgetManager.addWidget(widget, vtk.Widgets.Core.vtkWidgetManager.Constants.ViewTypes.SLICE);
    handle.setOutputBorder(true);
    handle.updateRepresentationForRender();
    interfaceState.widgetManager.grabFocus(widget);
}

function removingLasso() {
    const w = interfaceState.widgetManager.getWidgets()[0];
    if (w.hasFocus()) {interfaceState.widgetManager.releaseFocus();}
    interfaceState.widgetManager.removeWidget(w);
    // interfaceState.widgetManager.enablePicking();
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();
}

function getPlaneFromPolyline(polyLinePoints) {
    // ensure we have at least 3 points on the polyline
    if (polyLinePoints.length <= 2) {
        alert("Please select cells you think they are divided from the same one");
        return;
    }

    const planeOrigin = polyLinePoints[0].getOrigin();
    const planePoint1 = polyLinePoints[1].getOrigin();
    const planePoint2 = polyLinePoints[2].getOrigin();

    // this is only needed while we use our home-made vector utils
    const p0 = {
        x: planeOrigin[0],
        y: planeOrigin[1],
        z: planeOrigin[2]
    }

    const p1 = {
        x: planePoint1[0],
        y: planePoint1[1],
        z: planePoint1[2]
    }

    const p2 = {
        x: planePoint2[0],
        y: planePoint2[1],
        z: planePoint2[2]
    }

    // Note: we could have also use renderer.getActiveCamera().getViewPlaneNormal()
    const camera = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActiveCamera();
    const normalVector = camera.getViewPlaneNormal();
    const plane = vectorUtils.findPlane(p0, p1, p2);

    return plane;
}

function getPolylinePointsInPlaneCoordinates(polyLinePoints, plane) {
    const planePointsXY = [];
    for (let polyLinePoint of polyLinePoints) {
        // get the point position in the world
        const point = polyLinePoint.getOrigin();
        // convert point coordinates to our lib point object
        const p = {
            x: point[0],
            y: point[1],
            z: point[2],
        }
        const projectedPoint = vectorUtils.getProjectedCoordinates(p, plane);
        // projected to x-y plane
        planePointsXY.push([projectedPoint.x, projectedPoint.y]);
    }

    return planePointsXY;
}

// find the actors in the bounds
// function lassoSelect() {
//     // for now we have only one Widget, which is the polyline
//     const polyLineWidget = interfaceState.widgetManager.getWidgets()[0];
//     // retrieve the points of the polyline
//     const handleList = polyLineWidget.getWidgetState().getHandleList();

//     // get the plane object from the polylinepoints
//     const polylinePlane = getPlaneFromPolyline(handleList);

//     // get the polyline points coordinate projected on the polyline plane
//     const planePointsXY = getPolylinePointsInPlaneCoordinates(handleList, polylinePlane);

//     let intersectedCells = [];
//     for (let actor of cell3dState.actors) {
//         if (!interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors().includes(actor)){continue;}
//         // get the actor world position
//         const actorPosition = utils.getCenterFromBounds(actor.getBounds());
//         // convert to our lib format
//         const position = {
//             x: actorPosition[0],
//             y: actorPosition[1],
//             z: actorPosition[2],
//         }
//         // find the coordinate of its projection on the polyLine plane
//         const actorPlaneCoordinates = vectorUtils.getProjectedCoordinates(position, polylinePlane);
//         // convert 2D coordinates {x: x_value, y: y_value}
//         // to array [x_value, y_value]
//         const projectedPoint = [actorPlaneCoordinates.x, actorPlaneCoordinates.y];

//         if (utils.checkPointInside(projectedPoint, planePointsXY)) {
//             const actorIndex = cell3dState.actors.indexOf(actor);
//             intersectedCells.push(cell3dState.existingCells[actorIndex]);
//         }
//     }

//     return intersectedCells;
// }

function lassoSelect() {
    const w = interfaceState.widgetManager.getWidgets()[0];
    const handleList = w.getWidgetState().getHandleList();
    if (handleList.length <= 2) {alert("Please select cells you think they are divided from the same one"); return;}
    let planePoints = [];
    let planePointsXY = [];
    const camera = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActiveCamera();
    const normalVector = camera.getViewPlaneNormal();
    for (let item of handleList) {
        const origin = item.getOrigin();
        if (planePoints.length == 0) {
            planePoints.push(origin);
        } else {
            let tmp = utils.findProjectedPoint(normalVector, origin, planePoints[0]);
            planePoints.push(tmp);
        }
        // projected to x-y plane
        planePointsXY.push([origin[0], origin[1]]);
    }

    let intersectedCells = [];
    for (let actor of cell3dState.actors) {
        let position = utils.addTwoPoints(actor.getCenter(), actor.getPosition());

        // first projected to polyline plane
        const projectOnPlane = utils.findProjectedPoint(normalVector, position, planePoints[0]);
        // projected to x-y plane
        const projectedPoint = [projectOnPlane[0], projectOnPlane[1]];
        if (utils.checkPointInside(projectedPoint, planePointsXY)) {
            const actorIndex = cell3dState.actors.indexOf(actor);
            intersectedCells.push(cell3dState.existingCells[actorIndex]);
        }
    }
    return intersectedCells;
}

function targetSpecificGroup() {
    const index = utils.checkIteminObjectArray(cell3dState.highlighted, treeState.lassoParent, "name");
    let leaves = treeState.lassoParent[index].leaves;
    cell3dState.targetView = cell3dState.highlighted;
    // hide all the other cells 
    for (let oriActor of cell3dState.actors) {
        const index = cell3dState.actors.indexOf(oriActor);
        const name = cell3dState.existingCells[index];
        const actors = interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActors();
        if (!leaves.includes(name)) {
            for (let actor of actors) {
                if (actor.getMapper() === oriActor.getMapper()) {
                    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].removeActor(actor);
                }
            }
        }
    }
    const center = utils.getAverageCenter(cell3dState, leaves);
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderer'].getActiveCamera().setFocalPoint(center[0],center[1],center[2]);
    interfaceState.activeWindows[interfaceState.mainViewWindow]['renderWindow'].render();   
}


function addLoader() {
    // progress animation
    document.getElementById("fader").style.display = "block";
    document.getElementById("load").classList.add("loader");
}

function removeLoader() {
    document.getElementById("fader").style.display = "none";
    document.getElementById("load").classList.remove("loader");
}

module.exports = {
  update,
  clearAllView,
  createPeelingSlider,
  changeColor,
  explosionView,
  showCurrentCells,
  clearTargetView,
  switchToLevel,
  highlightCell3d,
  highlightSimilarCell3d,
  changeToMainView,
  eventToWindowXY,
  clearCurrentActors,
  updateWorldPosition,
  tryOtherNeighbors,
  isAnimating,
  getProcessedSelection,
  changeToNeighborsView,
  processNeighboringSelections,
  showAllOtherCells,
  deleteAllOtherCells,
  hideCell,
  settingLasso,
  startingLasso,
  removingLasso,
  lassoSelect,
  addLoader,
  removeLoader,
  targetSpecificGroup
}