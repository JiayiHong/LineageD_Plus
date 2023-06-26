class ModelState {
    constructor() {
        this.init();
    }
  
    init() {
        this.activeModel = null;            // model name
        this.models = {};
        this.modelPredictions = [];
        this.defaultModelProperties = [];
        this.modelPredictionsPerCell = [];
        this.pairFeatures = [];
        this.droppedFeatures = [];
        this.selectedModels = ['Neural Network', 'SVM', 'KNN', 'Random Forest', 'Bayes'];
        this.ifDefaultOrTrained = "default";
        this.newPairedCells = [];
        this.svmWeight = 1;
        this.rfWeight = 1;
        this.knnWeight = 1;
        this.nnWeight = 1;
        this.bayeWeight = 1;
    }
  
    clear() {
        this.init();
    }
  }
  
  const modelState = new ModelState();
  
  module.exports = modelState;