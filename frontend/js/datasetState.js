"use strict";

class DatasetState{
    constructor() {
        this.init();
    }

    init() {
        this.tissuesTriangles = [];
        this.tissues = null;
        this.trianglesInfo = null;
        this.type = null;
        this.trianglesNorm = [];            // the format is (x:.., y:.., z:..)
        this.triangles = [];                // triangles info: points index
    }

    clear() {
        this.init();
    }
}

const datasetState = new DatasetState();

module.exports = datasetState;