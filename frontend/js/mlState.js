class MLState {
  constructor() {
      this.init();
  }

  init() {
      this.NEIGHBOR_COUNT_MAX = 28;
      this.NEIGHBOR_COUNT_MIN = 1;
      this.LAYER_MAX = 4;
      this.LAYER_MIN = 1;
      this.TIME_STAGE_MAX = 8;
      this.TIME_STAGE_MIN = 0;
      this.CELL_COUNT_IN_STAGE_MAX = 271;
      this.CELL_COUNT_IN_STAGE_MIN = 2;
      this.leftCells = [];
      this.currentAssignments = [];
      this.basicCells = [];
      this.pairPossibilities = [];
      this.supportingCells = [];
      this.predictionConstrains = [];
      this.building = {};
      this.data = [];
      this.trainingSetX = [];
      this.trainingSetY = [];
      this.testSetX = [];
      this.testSetY = [];
      this.separationSize = 0;
  }

  clear() {
      this.init();
  }
}

const mlState = new MLState();

module.exports = mlState;