"use strict";

class StudyState{
    constructor() {
        this.init();
    }

    init() {
        this.startingTime = 0;
        this.actionRow = [];
    }

    clear() {
        this.init();
    }
}

const studyState = new StudyState();

module.exports = studyState;