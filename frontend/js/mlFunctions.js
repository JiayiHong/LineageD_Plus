const mlState = require('./mlState.js');
const modelState = require('./modelState');
const fetches = require('./fetches');
const datasetState = require('./datasetState');
const cell3dState = require('./cell3dState');
const visualization = require('./visualization');
const utils = require('./utils');
const vectorUtils = require('./vectorUtils');
const SVM = require('libsvm-js/asm');
const KNN = require('ml-knn');
const Bayes = require('ml-naivebayes');
const crossValidation = require('ml-cross-validation');
import { RandomForestClassifier as RFClassifier } from 'ml-random-forest';
import { valueSimilarity, valueDistance } from 'ml-tanimoto';

async function getDefaultModelProperties() {
  const properties = await fetches.fetchJson('/data/model/model.json');
  for (let property of properties) {
    modelState.defaultModelProperties.push({});
    modelState.defaultModelProperties[modelState.defaultModelProperties.length-1]['name'] = property.name;
    modelState.defaultModelProperties[modelState.defaultModelProperties.length-1]['accuracy'] = property.accuracy;
    modelState.defaultModelProperties[modelState.defaultModelProperties.length-1]['recall'] = property.recall;
  }
  visualization.visualizeModelProperties(modelState.defaultModelProperties);
}

async function getTrainingData() {
  mlState.data = await fetches.fetchJson('/data/training_data/trainingData.json');
  for (let attr of modelState.droppedFeatures) {
    mlState.data.forEach(function(v){delete v[attr];});
  }
  mlState.separationSize = 0.9 * mlState.data.length;
  mlState.data = utils.shuffleArray(mlState.data);
  [mlState.trainingSetX, mlState.trainingSetY, mlState.testSetX, mlState.testSetY] = dressData(mlState.data);
}

function findDropAttrs(selectedFeatures) {
  // const header = ['distance', 'angle', 'neighborCount1', 'neighborCount2', 'volumeRatio', 'surfaceRatio', 'sharedArea', 'layer1', 'layer2', 'timeStage', 'cellsCountInStage', 'possibility'];
  let dropAttrs = [];
  const defaultAttrs = ['Distance', 'Relative Angle', 'Neighbor Counts', 'Volume', 'Surface Area', 'Shared Area', 'Layer', 'Generation'];
  const differences = defaultAttrs.filter(x => !selectedFeatures.includes(x));
  for (let difference of differences) {
    switch(difference) {
      case 'Distance':
        dropAttrs.push('distance');       break;
      case 'Relative Angle':
        dropAttrs.push('angle');         break;
      case 'Neighbor Counts':
        dropAttrs.push('neighborCount1');
        dropAttrs.push('neighborCount2'); break;
      case 'Volume':
        dropAttrs.push('volumeRatio');    break;
      case 'Surface Area':
        dropAttrs.push('surfaceRatio');   break;
      case 'Shared Area':
        dropAttrs.push('sharedArea');     break;
      case 'Layer':
        dropAttrs.push('layer1');
        dropAttrs.push('layer2');         break;
      case 'Generation':
        dropAttrs.push('timeStage');
        dropAttrs.push('cellsCountInStage');  break;
    }
  }
  return dropAttrs;
}

function dressData(data) {
  let x = [];
  let y = [];
  let trainingSetX = [];
  let trainingSetY = [];
  let testSetX = [];
  let testSetY = [];
  data.forEach((row) => {
      let rowArray = [];
      let possibilityNumber;
      // Feature number : 12
      for (let key of Object.keys(row)) {
        if (key != "possibility") {
          rowArray.push(parseFloat(row[key]));
        }
      }
      possibilityNumber = row.possibility;

      x.push(rowArray);
      y.push(possibilityNumber);
  });

  trainingSetX = x.slice(0, mlState.separationSize);
  trainingSetY = y.slice(0, mlState.separationSize);
  testSetX = x.slice(mlState.separationSize);
  testSetY = y.slice(mlState.separationSize);

  return [trainingSetX, trainingSetY, testSetX, testSetY];
}

function solveImbalancedProblem() {
  const counts = [];
  counts.push(mlState.trainingSetY.filter(v => v === 0).length);
  counts.push(mlState.trainingSetY.filter(v => v === 1).length);
  let trainingFeatures = [];
  let trainingTarget = [];
  let target0 = 0;
  let target1 = 0;
  for (let i = 0; i < mlState.trainingSetY.length; i++) {
    if (mlState.trainingSetY[i] == 1) {
      trainingFeatures.push(mlState.trainingSetX[i]);
      trainingTarget.push(mlState.trainingSetY[i]);
      target1 ++;
    } else if (target0 <= counts[1]) {
      trainingFeatures.push(mlState.trainingSetX[i]);
      trainingTarget.push(mlState.trainingSetY[i]);
      target0 ++;
    }
  }
  return [trainingFeatures, trainingTarget];
}

// if value > 1, oversampling; if value < 1, undersampling
function sampling(data, classValue, value) {
  let classArray = [];
  let otherClassArray = [];
  let totalArray = [];
  data.forEach((row) => {
    if(row.possibility == classValue) {
      classArray.push(row);
    } else {
      otherClassArray.push(row);
    }
  });

  const totalCountClass = classArray.length;
  const decimalPlace = value - parseInt(value);
  const randomCount = parseInt(totalCountClass*decimalPlace);

  if (value > 1) {
    const times = parseInt(value);
    for (let i = 0; i < times; i++) {
      totalArray = totalArray.concat(classArray);
    }
    classArray = utils.shuffleArray(classArray);
    for (let i = 0; i < randomCount; i++) {
      totalArray.push(classArray[i]);
    }
    totalArray = totalArray.concat(otherClassArray);
  } else if (value > 0) {
    classArray = utils.shuffleArray(classArray);
    for (let i = 0; i < randomCount; i++) {
      totalArray.push(classArray[i]);
    }
    totalArray = totalArray.concat(otherClassArray);
  }
  return utils.shuffleArray(totalArray);
}

async function getNeuralNetworkModel() {
  modelState.activeModel = "Neural Network";
  let neuralNetworkModel;

  if (modelState.ifDefaultOrTrained == "trained") {
    let toTrain = [];
    for (let i = 0; i < mlState.separationSize; i++) {
      toTrain.push(neuralNetworkDataTransform(mlState.data.slice(i, i+1)));
    }
    // [neuralNetworkDataTransform(mlState.data.slice(0, mlState.separationSize))]
    const trainingData = tf.data.array(toTrain)
      .batch(64);
      
    neuralNetworkModel = tf.sequential({
      layers: [
        tf.layers.dense({inputShape: [12-modelState.droppedFeatures.length], units: 128, activation:'relu'}),
        tf.layers.dropout({rate: 0.1}),
        tf.layers.dense({units: 64, activation:'relu'}),
        tf.layers.dropout({rate: 0.1}),
        tf.layers.dense({units: 2, activation: 'sigmoid'}),
      ]
    });

    neuralNetworkModel.compile({
      optimizer: tf.train.adam(),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    await neuralNetworkModel.fitDataset(trainingData, {
      epochs: 50,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          console.log(`epoch ${epoch + 1} : ${logs.loss}`);
        }
      }
    });
    console.log('accuracy', neuralEvaluate(neuralNetworkModel));
  }
  // Save the model ////////////
  // const saveModel = await neuralNetworkModel.save('downloads://neuralNetwork');

  else {
    // Load the model ////////////
    neuralNetworkModel = await fetches.getMLModel();
    // console.log('recall', await recallNeuralEvaluate(neuralNetworkModel));
  }

  return neuralNetworkModel;
}

function range(start, end) {
  return Array(end - start + 1).fill().map((_, idx) => start + idx)
}

async function getNeuralNetworkCrossValidation(){
  let toTrain = [];
  for (let i = 0; i < mlState.separationSize; i++) {
    toTrain.push(neuralNetworkDataTransform(mlState.data.slice(i, i+1)));
  }
  const quotient = Math.floor(toTrain.length/50);
  let accuracies = 0;
  for (i = 1; i <= 50; i++) {
    let array;
    if (i == 50) {array = range((i-1)*quotient, toTrain.length-1);}
    else {array = range((i-1)*quotient, i*quotient-1);} 
    const data = array.map(x=>toTrain[x]);
    const trainingData = tf.data.array(data)
      .batch(64);
      
    neuralNetworkModel = tf.sequential({
      layers: [
        tf.layers.dense({inputShape: [12-modelState.droppedFeatures.length], units: 128, activation:'relu'}),
        tf.layers.dropout({rate: 0.1}),
        tf.layers.dense({units: 64, activation:'relu'}),
        tf.layers.dropout({rate: 0.1}),
        tf.layers.dense({units: 2, activation: 'sigmoid'}),
      ]
    });

    neuralNetworkModel.compile({
      optimizer: tf.train.adam(),
      loss: 'sparseCategoricalCrossentropy',
      metrics: ['accuracy']
    });

    await neuralNetworkModel.fitDataset(trainingData, {
      epochs: 60,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          console.log(`epoch ${epoch + 1} : ${logs.loss}`);
        }
      }
    });
    const accuracy = neuralEvaluate(neuralNetworkModel);
    console.log('accuracy', accuracy);
    accuracies += accuracy;    
  }
  console.log("Neural Network Cross Validation Accuracy: " + accuracies/50);
}


function neuralNetworkDataTransform(data){
  let transformedData = {};
  let values = [];
  let possibilities = [];
  for (let i of data){
    let arr = ['distance','angle','neighborCount1','neighborCount2','volumeRatio','surfaceRatio','sharedAreaRatio1',
    'sharedAreaRatio2','layer1','layer2','timeStage','cellsCountInStage'];
    let value = [];
    for (let item of arr) {
      if (!modelState.droppedFeatures.includes(item)){value.push(i[item]);}
    }
    values.push(value);
    possibilities.push(i.possibility);
  }
  transformedData.xs = values;
  transformedData.ys = possibilities;
  return transformedData;
}

function neuralEvaluate(model) {
  let accuracy = 0;
  for (let i = 0; i < mlState.testSetX.length; i++) {
    const value = predictNeuralNetwork(model, mlState.testSetX[i]);
    if (value == mlState.testSetY[i]) {
      accuracy++;
    }
  }
  accuracy = accuracy/mlState.testSetX.length;
  return accuracy;
}

async function recallNeuralEvaluate(model) {
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < mlState.testSetX.length; i++) {
    const value = predictNeuralNetwork(model, mlState.testSetX[i]);
    if (mlState.testSetY[i] == 1) {
      denominator ++;
      if (value == 1) {
        numerator ++;
      }
    }
  }
  return numerator/denominator;
}

function recallEvaluate(predicted, expected) {
  let numerator = 0;
  let denominator = 0;
  for (var index = 0; index < predicted.length; index++) {
      // console.log(`truth : ${expected[index]} and prediction : ${predicted[index]}`);
      if (expected[index] == 1) {
        denominator ++;
        if (predicted[index] == 1) {
          numerator ++;
        }
      }
  }
  return numerator/denominator;
}

async function getSVMModel() {
  modelState.activeModel = "SVM";

  let svm;

  if (modelState.ifDefaultOrTrained == "trained") {
    let options = {
      kernel: SVM.KERNEL_TYPES.RBF,
      type: SVM.SVM_TYPES.C_SVC,
      gamma: 1.4,
      cost: 1
    }
    svm = new SVM(options);
    
    mlState.data = sampling(mlState.data, 1, 1.2);
    mlState.data = sampling(mlState.data, 0, 0.7);
    [trainingSetX, trainingSetY, testSetX, testSetY] = dressData(mlState.data);
    // const [trainingFeatures, trainingTarget] = solveImbalancedProblem();
    // const confusionMatrix = crossValidation.kFold(SVM, mlState.trainingSetX, mlState.trainingSetY, options, 50)
    // const accuracy = confusionMatrix.getAccuracy();
    // console.log("SVM Cross Validation Accuracy: " + accuracy);
    svm.train(trainingSetX, trainingSetY);
    // const result = svm.predict(testSetX);
    // const predictionError = error(result, testSetY);
    // console.log(`Misclassifications Ratio= ${predictionError/(testSetY.length)}`);
  }
  // Export the model ////////////
  // const model = svm.serializeModel();
  // utils.exportJsonFile("svm", model);

  else {
  // Get the model ////////////
    const obj = await fetches.fetchJson('/data/model/svm.json');
    svm = SVM.load(obj);
    // const result = svm.predict(mlState.testSetX);
    // const predictionError = error(result, mlState.testSetY);
    // console.log('recall', recallEvaluate(result, mlState.testSetY));
    // console.log(`Misclassifications Ratio= ${predictionError/(mlState.separationSize*0.1)}`);
  }

  return svm;
}

async function getKnnModel() {
  modelState.activeModel = "KNN";

  let knn;
  if (modelState.ifDefaultOrTrained == "trained") {
    // Training online ////////////
    // const confusionMatrix = crossValidation.kFold(KNN.default, mlState.trainingSetX, mlState.trainingSetY, {k:5}, 50);
    // crossValidation.leaveOneOut(mlState.trainingSetX, mlState.trainingSetY, function(trainFeatures, trainLabels, testFeatures) {
    //   knn = new KNN.default(trainFeatures, trainLabels, {k:5});
    //   return knn.predict(testFeatures);
    // })
    // const accuracy = confusionMatrix.getAccuracy();
    // console.log("KNN Cross Validation Accuracy: " + accuracy);
    knn = new KNN.default(mlState.trainingSetX, mlState.trainingSetY, {k:5});
    const result = knn.predict(mlState.testSetX);
    const predictionError = error(result, mlState.testSetY);
    console.log(`Misclassifications Ratio= ${predictionError/(mlState.separationSize*0.1)}`);
  }

  // Export the model ////////////
  // const model = knn.toJSON();
  // utils.exportJsonFile("knn", model);
  else {
    // Get the model ////////////
    const obj = await fetches.fetchJson('/data/model/knn.json');
    knn = KNN.default.load(obj);
    // const result = knn.predict(mlState.testSetX);
    // console.log('recall', recallEvaluate(result, mlState.testSetY));
  }

  return knn;
}

async function getBayesModel() {
  modelState.activeModel = "Bayes";

  let bayes;
  const options = {};
  if (modelState.ifDefaultOrTrained == "trained") {
  // Training online ////////////
  // const confusionMatrix = crossValidation.kFold(Bayes.GaussianNB, mlState.trainingSetX, mlState.trainingSetY, null, 50);
  // const accuracy = confusionMatrix.getAccuracy();
  // console.log("Bayes Cross Validation Accuracy: " + accuracy);
    bayes = new Bayes.GaussianNB();
    const [trainingFeatures, trainingTarget] = solveImbalancedProblem();
    bayes.train(trainingFeatures, trainingTarget);
  // const result = bayes.predict(mlState.testSetX);
  // const predictionError = error(result, mlState.testSetY);
  // console.log(`Misclassifications Ratio= ${predictionError/(mlState.separationSize*0.2)}`);
  }

  // Export the model ////////////
  // const model = bayes.toJSON();
  // utils.exportJsonFile("bayes", model);
  else {
    // Get the model ////////////
    const obj = await fetches.fetchJson('/data/model/bayes.json');
    bayes = Bayes.GaussianNB.load(obj);
    // const result = bayes.predict(mlState.testSetX);
    // console.log('recall', recallEvaluate(result, mlState.testSetY));
  }

  return bayes;
}

async function getRandomForest(){
  modelState.activeModel = "Random Forest";

  let randomForest;
  if (modelState.ifDefaultOrTrained == "trained") {
    // Training online ////////////
    const options = {
      seed: 3,
      maxFeatures: 0.8,
      replacement: true,
      nEstimators: 25
    };
    const confusionMatrix = crossValidation.kFold(RFClassifier, mlState.trainingSetX, mlState.trainingSetY, options, 50);
    const accuracy = confusionMatrix.getAccuracy();
    console.log("Random Forest Cross Validation Accuracy: " + accuracy);
    randomForest = new RFClassifier(options);
    randomForest.train(mlState.trainingSetX, mlState.trainingSetY);
    // const result = randomForest.predict(mlState.testSetX);
    // const predictionError = error(result, mlState.testSetY);
    // console.log(`Misclassifications Ratio= ${predictionError/(mlState.separationSize*0.1)}`);
    // const oobResult = randomForest.predictOOB();
    // const confusionMatrix = randomForest.getConfusionMatrix();
  }

  // // Export the model ////////////
  // const model = randomForest.toJSON();
  // utils.exportJsonFile("randomForest", model);
  else {
    // Get the model ////////////
    const obj = await fetches.fetchJson('/data/model/randomForest.json');
    randomForest = RFClassifier.load(obj);
    // const result = randomForest.predict(mlState.testSetX);
    // console.log('recall', recallEvaluate(result, mlState.testSetY));
  }

  return randomForest;
}

async function getSelectedModels() {
  modelState.models.neuralNetwork = await getNeuralNetworkModel();
  modelState.models.knn = await getKnnModel();
  modelState.models.bayesian = await getBayesModel();
  modelState.models.svm = await getSVMModel();
  modelState.models.randomForest = await getRandomForest();
}

function findSupportingCellsfromParsed(tissues, trianglesInfo) {
  let count = 0;
  let supporting = [];
  for (let j = 0; j < tissues.length; j++) {
      for (let i = 0; i < trianglesInfo.length; i++) {
          if (trianglesInfo[i][0] == tissues[j][0] || trianglesInfo[i][1] == tissues[j][0]) {
              count ++;
          }
      }
      if (count < 7) {supporting.push(tissues[j][0]);}
      count = 0;
  }
  return supporting;
}

// every time a dataset is loaded, runed once
function setDefaults(config) {
  mlState.clear();
  // generate supportingCells and globalLeftCells from tissues
  const regexpNum = /^\D+/g;
  const supporting = findSupportingCellsfromParsed(datasetState.tissues, datasetState.trianglesInfo);

  for (let i = 1; i < datasetState.tissues.length; i++) {
    const cellName = parseInt(datasetState.tissues[i][0].replace(regexpNum, ""));
    if (supporting.includes(datasetState.tissues[i][0])) {
        mlState.supportingCells.push(cellName);
        continue;
    }
    mlState.leftCells.push(cellName);
  }
  mlState.predictionConstrains = [mlState.leftCells];
  setDefaultBasicCells(config);
  mlState.currentAssignments = new Array(mlState.basicCells[mlState.basicCells.length-1]['name']).fill(0);
}

function setDefaultBasicCells(config) {
  for (const configItem of config) {
      if (configItem.trianglesArea != undefined) {
          mlState.building.trianglesArea = configItem.trianglesArea;
          mlState.building.tissues = datasetState.tissues;
          mlState.building.trianglesInfo = datasetState.trianglesInfo;
          mlState.building.trianglesNorm = datasetState.trianglesNorm;
      }
      if (mlState.supportingCells.includes(configItem.name)) {
        continue;
      }
      mlState.basicCells.push({});
      mlState.basicCells[mlState.basicCells.length-1]['name'] = configItem.name;
      mlState.basicCells[mlState.basicCells.length-1]['index'] = configItem.index;
      mlState.basicCells[mlState.basicCells.length-1]['center'] = configItem.center;
      mlState.basicCells[mlState.basicCells.length-1]['neighbors'] = configItem.neighbor;
      mlState.basicCells[mlState.basicCells.length-1]['volume'] = configItem.volume;
      mlState.basicCells[mlState.basicCells.length-1]['surface'] = configItem.surface;
  }
}

function findLeaves(name, currentAssignments, basicCells) {
  if (name <= basicCells[basicCells.length-1]['name']) {return [name];}
  else {
      var l = [];
      for (var i = 0; i < currentAssignments.length; i++){
          if (currentAssignments[i] == name) {
              l.push(i+1);
          }
          if (l.length == 2) {return findLeaves(l[0], currentAssignments, basicCells).concat(findLeaves(l[1], currentAssignments, basicCells));}
      }
  }
}

function calculateCenters(leaves, basicCells) {
  var x = 0, y = 0, z = 0;
  var volume = 0;
  for (var i of leaves) {
      var index = searchIndexByName(i, basicCells);
      var tempVolume = basicCells[index]['volume'];
      volume += tempVolume;
      x += basicCells[index]['center'][0]*tempVolume;
      y += basicCells[index]['center'][1]*tempVolume;
      z += basicCells[index]['center'][2]*tempVolume;
  }
  return [x/volume, y/volume, z/volume];
}

function getLevelNeighbors(leaves, name, globalLeftCells, currentAssignments, basicCells, supportingCells) {
  var allNeighbors = [];
  var neighborsInLevel = [];
  for (var leaf of leaves) {
      var index = searchIndexByName(leaf, basicCells);
      allNeighbors = allNeighbors.concat(basicCells[index]['neighbors']);
  }
  var setNeighbors = [...new Set(allNeighbors)];
  for (const i of setNeighbors) {
      if (supportingCells.includes(i)) {continue;}
      var parentInLevel = i;
      while (!globalLeftCells.includes(parentInLevel)){
          parentInLevel = currentAssignments[parentInLevel-1];
      }
      if (parentInLevel != name) {
          neighborsInLevel.push(parentInLevel);
      }
  }
  return [... new Set(neighborsInLevel)];
}

function getLevelVolumes(leaves, basicCells) {
  var volumeInLevel = 0;
  for (var leaf of leaves) {
      var index = searchIndexByName(leaf, basicCells);
      volumeInLevel += basicCells[index]['volume'];
  }
  return volumeInLevel;
}

function getLevelSurfaces(leaves, basicCells, trianglesArea, tissues, trianglesInfo) {
  var surfaceInLevel = 0;
  var trianglesInLevel = findParentTriangles(leaves, basicCells, tissues, trianglesInfo);
  for (var tri of trianglesInLevel) {
      surfaceInLevel += trianglesArea[tri];
  }
  return surfaceInLevel;
}

function normalizationArr(array) {
  var normArray = [];
  var max = 0;
  var min = 20000;
  for (var i = 0; i < array.length; i++) {
      if (array[i] > max)    {max = array[i];}
      if (array[i] < min && array[i] != 0)    {min = array[i];}
  }
  for (var i = 0; i < array.length; i++) {
      var norm = (array[i]-min)/(max-min);
      normArray.push(norm);
  }
  return normArray;
}

function getDistance(position1, position2){
  const x = position1[0] - position2[0];
  const y = position1[1] - position2[1];
  const z = position1[2] - position2[2];
  return Math.sqrt(x**2 + y**2 + z**2);
}

function findSharedAreaAndNorms(cell1, cell2, currentAssignments, basicCells, trianglesArea, trianglesInfo, tissues){
  let sharedArea = 0;
  let totalNorm = {x:0, y:0, z:0};
  let intersectList = [];
  if (cell1 != cell2){
      const leaves1 = findLeaves(cell1, currentAssignments, basicCells);
      const leaves2 = findLeaves(cell2, currentAssignments, basicCells);
      const triangleList1 = findParentTriangles(leaves1, basicCells, tissues, trianglesInfo);
      const triangleList2 = findParentTriangles(leaves2, basicCells, tissues, trianglesInfo);
      intersectList = triangleList1.filter(value => triangleList2.includes(value));
  }
  else {
      return 0;
  }
  for (let i of intersectList){
      sharedArea += trianglesArea[i];
      totalNorm = vectorUtils.addVector(vectorUtils.scalarProduct(trianglesArea[i], datasetState.trianglesNorm[i]), totalNorm);
  }
  totalNorm = vectorUtils.scalarProduct(1/sharedArea, totalNorm);
  return [sharedArea, totalNorm];
}

function findParentTriangles(leaves, basicCells, tissues, trianglesInfo) {
  let trianglesList = [];
  for (let leaf of leaves) {
      const index = basicCells[searchIndexByName(leaf, basicCells)]['index'];
      trianglesList = addTwoArray(trianglesList, MLfindTriangle(index, tissues, trianglesInfo));
  }
  return trianglesList;
}

function levelTensors(model){
  const globalLeftCells = mlState.leftCells,
        currentAssignments = mlState.currentAssignments,
        basicCells = mlState.basicCells,
        supportingCells = mlState.supportingCells;
  const trianglesArea = mlState.building.trianglesArea,
        tissues = mlState.building.tissues,
        trianglesInfo = mlState.building.trianglesInfo;
  var centersLevel = [],
      distances = [],
      neighborsLevel = [],
      volumesLevel = [],
      surfacesLevel = [];
  for (var i of globalLeftCells) {
      var leaves = findLeaves(i, currentAssignments, basicCells);
      centersLevel.push(calculateCenters(leaves, basicCells));
      neighborsLevel.push(getLevelNeighbors(leaves, i, globalLeftCells, currentAssignments, basicCells, supportingCells));
      volumesLevel.push(getLevelVolumes(leaves, basicCells));
      surfacesLevel.push(getLevelSurfaces(leaves, basicCells, trianglesArea, tissues, trianglesInfo));
  }
  // find all pairs & calculate the distance
  for (var i of globalLeftCells) {
      var indexI = globalLeftCells.indexOf(i);
      for (var j of neighborsLevel[indexI]) {
          if (j <= i) {continue;}
          var indexJ = globalLeftCells.indexOf(j);
          distances.push(getDistance(centersLevel[indexI], centersLevel[indexJ]));
      }
  }
  var distancesNor = normalizationArr(distances);
  var volumesNor = normalizationArr(volumesLevel);
  var volumesLevel1 = volumesLevel.slice();
  volumesLevel1 = volumesLevel1.filter(i => i!=0);
  var volumesMin = Math.min(...volumesLevel1);
  var surfacesNor = normalizationArr(surfacesLevel);
  var surfaceMax = Math.max(...surfacesLevel);
  var surfacesLevel1 = surfacesLevel.slice();
  surfacesLevel1 = surfacesLevel1.filter(i => i!=0);
  var surfaceMin = Math.min(...surfacesLevel1);


  let count = 0,
      possibilities = [];
  // Each record features
  // 'distance', 'angle', 'neighborCount1', 'neighborCount2', 'volumeRatio', 'surfaceRatio', 'sharedArea', 
  // 'layer1', 'layer2', 'timeStage', 'cellsCountInStage', 'possibility'
  for (var i of globalLeftCells) {
      var indexI = globalLeftCells.indexOf(i);
      for (var j of neighborsLevel[indexI]) {
          if (j < i) {continue;}
          var tensor = [];
          var indexJ = globalLeftCells.indexOf(j);
          const [sharedArea, norm] = findSharedAreaAndNorms(i,j, currentAssignments, basicCells, trianglesArea, trianglesInfo, tissues);

          // calculate the distance
          if (!modelState.droppedFeatures.includes('distance')) {tensor.push(distancesNor[count]);}
          
          // calculate the angle
          const p1 = {
            x: centersLevel[indexI][0],
            y: centersLevel[indexI][1],
            z: centersLevel[indexI][2]
          }
          const p2 = {
            x: centersLevel[indexJ][0],
            y: centersLevel[indexJ][1],
            z: centersLevel[indexJ][2]
          }
          let v1 = vectorUtils.vectorFromPoints(p2, p1);
          const degree = vectorUtils.angleBetweenTwoVectors(v1, norm);
          // console.log(i, j, degree);
          if (!modelState.droppedFeatures.includes('angle')) {tensor.push(degree/90);}

          // calculate the neighborsCount1
          const normNeighborsCount1 = (neighborsLevel[indexI].length-mlState.NEIGHBOR_COUNT_MIN)/(mlState.NEIGHBOR_COUNT_MAX-mlState.NEIGHBOR_COUNT_MIN);
          const normNeighborsCount2 = (neighborsLevel[indexJ].length-mlState.NEIGHBOR_COUNT_MIN)/(mlState.NEIGHBOR_COUNT_MAX-mlState.NEIGHBOR_COUNT_MIN);
          if (neighborsLevel[indexI].length <= neighborsLevel[indexJ].length && !modelState.droppedFeatures.includes('neighborCount1')) {
            tensor.push(normNeighborsCount1);
            tensor.push(normNeighborsCount2);
          } else if (!modelState.droppedFeatures.includes('neighborCount1')) {
            tensor.push(normNeighborsCount2);
            tensor.push(normNeighborsCount1);
          }

          // calculate the volumesRatio
          if (!modelState.droppedFeatures.includes('volumeRatio')){
            if (volumesLevel[indexI] >= volumesLevel[indexJ]){tensor.push(volumesLevel[indexI]/volumesLevel[indexJ]);}
            else {tensor.push(volumesLevel[indexJ]/volumesLevel[indexI]);}
          }
          // tensor.push(volumesNor[indexI]);
          // tensor.push(volumesNor[indexJ]);

          // calculate the volumesRatio
          if (surfacesLevel[indexI] >= surfacesLevel[indexJ]){
            if (!modelState.droppedFeatures.includes('surfaceRatio')){
              tensor.push(surfacesLevel[indexI]/surfacesLevel[indexJ]);
            }
            // calculate the shared surface
            if (!modelState.droppedFeatures.includes('sharedArea')){
              tensor.push(sharedArea/surfacesLevel[indexI]);
              tensor.push(sharedArea/surfacesLevel[indexJ]);
            }
          }
          else {
            if (!modelState.droppedFeatures.includes('surfaceRatio')){
              tensor.push(surfacesLevel[indexJ]/surfacesLevel[indexI]);
            }
            // calculate the shared surface
            if (!modelState.droppedFeatures.includes('sharedArea')){
              tensor.push(sharedArea/surfacesLevel[indexJ]);
              tensor.push(sharedArea/surfacesLevel[indexI]);
            }
          }
          // tensor.push(surfacesNor[indexI]);
          // tensor.push(surfacesNor[indexJ]);

          // calculate the shared surface
          // tensor.push(normalize(sharedArea, surfaceMax, surfaceMin));
          // tensor.push(normalize(findSharedArea(i,j, currentAssignments, basicCells, trianglesArea, trianglesInfo, tissues), surfaceMax, surfaceMin));

          // calculate the layer
          const layer1 = cell3dState.surfaceDepths[cell3dState.existingCells.indexOf(i)];
          const layer2 = cell3dState.surfaceDepths[cell3dState.existingCells.indexOf(j)];
          const normLayer1 = (layer1-mlState.LAYER_MIN)/(mlState.LAYER_MAX-mlState.LAYER_MIN);
          const normLayer2 = (layer2-mlState.LAYER_MIN)/(mlState.LAYER_MAX-mlState.LAYER_MIN);
          if (!modelState.droppedFeatures.includes('layer1')){
            if (layer1 <= layer2) {
              tensor.push(normLayer1);
              tensor.push(normLayer2);
            } else {
              tensor.push(normLayer2);
              tensor.push(normLayer1);
            }
          }
          
          // calculate the timeStage
          if (!modelState.droppedFeatures.includes('timeStage')){
            const normTimeStage = (parseInt(Math.log2(globalLeftCells.length))-mlState.TIME_STAGE_MIN)/(mlState.TIME_STAGE_MAX - mlState.TIME_STAGE_MIN);
            tensor.push(normTimeStage);

          // calculate the cellsCountInStage
            const normCellsCountInStage = (globalLeftCells.length-mlState.CELL_COUNT_IN_STAGE_MIN)/(mlState.CELL_COUNT_IN_STAGE_MAX-mlState.CELL_COUNT_IN_STAGE_MIN);
            tensor.push(normCellsCountInStage);
          }
          
          if (model == "neuralNetwork") {
            const posi = predictNeuralNetwork(modelState.models[model], tensor);
            possibilities.push([i,j,posi]);
          } else {
            let posi = modelState.models[model].predict([tensor]);
            if (Array.isArray(posi) == true) {posi = posi[0];}
            possibilities.push([i,j,posi]);
          }
          if (possibilities[possibilities.length-1][2] == 1) {
            let object = {};
            object.cells = [i, j];
            object.timeStage = parseInt(Math.log2(globalLeftCells.length));
            object.features = tensor;
            modelState.pairFeatures.push(object);
          }
          count ++;
      }
  }
  return possibilities;
}

function predictNeuralNetwork(model, sample) {
  let result = model.predict(tf.tensor(sample, [1, sample.length])).arraySync();
  let maxValue = 0;
  let predictedPitch = 2;
  for (let i = 0; i < 2; i++) {
    if (result[0][i] > maxValue) {
      predictedPitch = i;
      maxValue = result[0][i];
    }
  }
  return predictedPitch;
}

function checkTwoValuesInSameArray(value1, value2, array2d, assignments, basicCells) {
  const leaves1 = findLeaves(value1, assignments, basicCells);
  const leaves2 = findLeaves(value2, assignments, basicCells);
  for (let array of array2d) {
      if (checkIntersected(array, leaves1) && checkIntersected(array, leaves2)) {
          return true;
      }
  }
  return false;
}

function checkIntersected(array1, array2) {
  for (let element of array1) {
      if (array2.includes(element)){return true;}
  }
  return false;
}

function fromPossibilityToParent(possibilities) {
  // clone to avoid mutation of global object
  const newLeftCells = mlState.leftCells.slice();
  const newCurrentAssignments = mlState.currentAssignments.slice();
  const newPairPossibilities = mlState.pairPossibilities.slice();
  const basicCells = mlState.basicCells.slice();
  let newPairedCells = [];

  possibilities.sort((a,b) => { return b[2] - a[2]; });

  for (let possibility of possibilities) {
      // only record pairs with more than 0.5 possibilities
      if (possibility[2] >= 0.4 && newLeftCells.includes(possibility[0]) && 
      newLeftCells.includes(possibility[1]) && checkTwoValuesInSameArray(possibility[0],possibility[1],mlState.predictionConstrains, newCurrentAssignments, basicCells)) {
          newPairPossibilities.push({});
          newPairPossibilities[newPairPossibilities.length-1]['pairs'] = [possibility[0], possibility[1]];
          const pos = possibility[2]/getRealPossibilities(possibility[0], possibility[1], possibilities);
          newPairPossibilities[newPairPossibilities.length-1]['possibility'] = pos;
          
          //TODO: cache length
          newCurrentAssignments[possibility[0]-1] = newCurrentAssignments.length + 1;
          newCurrentAssignments[possibility[1]-1] = newCurrentAssignments.length + 1;
          newCurrentAssignments.push(0);
          newPairedCells.push([possibility[0], possibility[1], pos]);

          
          newLeftCells.splice(newLeftCells.indexOf(possibility[0]), 1);
          newLeftCells.splice(newLeftCells.indexOf(possibility[1]), 1);
          newLeftCells.push(newCurrentAssignments.length);
      }
  }
  newPairedCells.sort(function(a,b) {return b[2]-a[2]});

  return {
      newLeftCells,
      newCurrentAssignments,
      newPairPossibilities,
      newPairedCells
  }
}

function getRealPossibilities(cell1, cell2, possibilities) {
  let pos = 0;
  for (let possibility of possibilities) {
    if (possibility[0] == cell1 || possibility[1] == cell1 || possibility[0] == cell2 || possibility[1] == cell2) {
      pos += possibility[2];
    }
  }
  return pos;
}

function getPossibilitiesFromAllModels(models) {
  let possibilities = [];
  for (let model of Object.keys(models)) {
    const modelPredictionIndex = utils.checkIteminObjectArray(model, modelState.modelPredictions, "model");
    if (modelPredictionIndex != -1) {
      modelState.modelPredictions[modelPredictionIndex].possibilities = modelState.modelPredictions[modelPredictionIndex].possibilities.concat(levelTensors(model));
    } else {
      let obj = {};
      obj.model = model;
      obj.possibilities = levelTensors(model);
      modelState.modelPredictions.push(obj);
    }
  }
  let modelCount = modelState.modelPredictions.length;
  const pairsCount = modelState.modelPredictions[modelCount-1].possibilities.length;
  for (let i = 0; i < pairsCount; i++) {
    let prediction = 0;
    for (let j = 0; j < modelCount; j++) {
      let weight = 0;
      switch (modelState.modelPredictions[j].model) {
        case "neuralNetwork": weight = modelState.nnWeight; break;
        case "knn": weight = modelState.knnWeight; break;
        case "bayesian": weight = modelState.bayeWeight; break;
        case "svm": weight = modelState.svmWeight; break;
        case "randomForest": weight = modelState.rfWeight; break;
      }
      prediction += modelState.modelPredictions[j].possibilities[i][2] * weight;
    }
    possibilities.push([modelState.modelPredictions[0].possibilities[i][0], modelState.modelPredictions[0].possibilities[i][1], prediction/modelCount]);
  }
  return possibilities;
}

function searchIndexByName(name, basicCells) {
  for (var i = 0; i < basicCells.length; i++) {
      if (basicCells[i]['name'] == name) {
          return i;
      }
  }
}

// delete the same elements
function addTwoArray(array1, array2) {
  for (var i of array2){
      if (!array1.includes(i)) {
          array1.push(i);
      }
      else {
          array1.splice(array1.indexOf(i),1);
      }
  }
  return array1;
}

function MLfindTriangle(tissueIndex, tissues, trianglesInfo) {
  var triangleList = [];
  for (var i = 0; i < trianglesInfo.length; i++) {
      if (trianglesInfo[i][0] == tissues[tissueIndex][0] ||
      trianglesInfo[i][1] == tissues[tissueIndex][0]) {
              triangleList.push(i);
          }
  }
  return triangleList;
}

function normalize(value, min, max) {
  if (min == undefined || max == undefined) {return value;}
  else {return (value-min)/(max-min);}
}

function predictSingleLevel(models) {
  console.log("Predicting a single level.");
  const possibilities = getPossibilitiesFromAllModels(models);
  // update the global document
  const { newLeftCells, newCurrentAssignments, newPairPossibilities, newPairedCells} = fromPossibilityToParent(possibilities);
  mlState.leftCells = newLeftCells;
  mlState.currentAssignments = newCurrentAssignments;
  mlState.pairPossibilities = newPairPossibilities;
  modelState.newPairedCells = newPairedCells;
}

function supportingUpdate(supportingCells){
  let newSupportingCells = [];
  let newLeftCells = mlState.leftCells.slice();
  if (mlState.supportingCells.length == 0) {
    newSupportingCells = supportingCells;
  } else {
    let oldSupportingCells = mlState.supportingCells.slice();
    newSupportingCells = [...new Set(oldSupportingCells.concat(supportingCells))];
  }
  for (let cell of newSupportingCells) {
    if (newLeftCells.includes(cell)) {
      const index = newLeftCells.indexOf(cell);
      newLeftCells.splice(index, 1);
    }
  }
  mlState.leftCells = newLeftCells;
  mlState.supportingCells = newSupportingCells;
}

function assignmentUpdate(existingCells, currentAssignments) {
  // assume that job type is predictSingleLevel
  let lastCell = Math.max(...currentAssignments);
  let newCurrentAssignments = currentAssignments.slice();
  if (lastCell == 0) {
    lastCell = Math.max(...existingCells);
  }
  let newLeftCells = [];
  for (let cell = 1; cell <= lastCell; cell++) {
      if (existingCells.includes(cell)) {
          let index = existingCells.indexOf(cell);
          if (currentAssignments[index] == 0) {
              newLeftCells.push(cell);
          }
      } else if (cell > existingCells[existingCells.length-1]) {
          newLeftCells.push(cell);
      }
      else {
          newCurrentAssignments.splice(cell-1 ,0, 0);
      }
  }
  mlState.leftCells = newLeftCells;
  mlState.currentAssignments = newCurrentAssignments;
}

function error(predicted, expected) {
  let misclassifications = 0;
  for (var index = 0; index < predicted.length; index++) {
      // console.log(`truth : ${expected[index]} and prediction : ${predicted[index]}`);
      if (predicted[index] !== expected[index]) {
          misclassifications++;
      }
  }
  return misclassifications;
}

function findSimilarPairs(name, highlightSimilarCellCallBack) {
  // find the target pair features
  let targetIndex;
  let toCompare = [];
  for (let pair of modelState.pairFeatures) {
    if (pair.cells.includes(name)) {
      targetIndex = modelState.pairFeatures.indexOf(pair);
      break;
    }
  }
  for (let i = 0; i < modelState.pairFeatures.length; i++) {
    if (i != targetIndex && modelState.pairFeatures[targetIndex].timeStage == modelState.pairFeatures[i].timeStage) {
      let obj = {};
      obj.index = i;
      obj.similarity = valueSimilarity(modelState.pairFeatures[targetIndex].features, modelState.pairFeatures[i].features);
      toCompare.push(obj);
    }
  }
  toCompare.sort(function(a, b) {return b.similarity - a.similarity;});
  highlightSimilarCellCallBack(toCompare);
}

module.exports = {
  getDefaultModelProperties,
  getTrainingData,
  findDropAttrs,
  getSVMModel,
  getKnnModel,
  getBayesModel,
  getNeuralNetworkModel,
  getNeuralNetworkCrossValidation,
  getRandomForest,
  getSelectedModels,
  setDefaults,
  predictSingleLevel,
  supportingUpdate,
  assignmentUpdate,
  findSimilarPairs
}

