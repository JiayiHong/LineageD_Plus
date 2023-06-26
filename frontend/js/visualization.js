const mlState = require('./mlState');
const modelState = require('./modelState');
const interfaceState = require('./interfaceState');
const utils = require('./utils');
const treeState = require('./treeState');
const treeModel = require('./treeModel');
const cell3dState = require('./cell3dState');
const cell3dModel = require('./cell3dModel');
const { model } = require('mongoose');


function visualizeModelProperties(data) {
    const margin = 30;
    const width = $(document).width()*0.38 - 2*margin - 30;
    const height = 140 - 2*margin;

    document.getElementById('model_performance').setAttribute("width", $(document).width()*0.5);
    const chart = d3.select("svg#model_performance")
                    .append('g')
                    .attr('transform', `translate(${margin*2}, ${margin})`);

    const yScale = d3.scaleLinear()
                    .range([height, 0])
                    .domain([0,100])
                    .nice();

    chart.append('g')
        .call(d3.axisLeft(yScale)
                .tickSizeInner([10])
                .ticks(4));
    chart.selectAll("g.tick").selectAll("text")
        .attr("transform", 'translate(-15,0)');

    const xScale = d3.scaleBand()
                    .range([0, width])
                    .domain(data.map((d) => d.name))
                    .padding([0.2]);

    chart.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    // bar charts
    const subgroups = ["accuracy", "recall"];
    const xSubGroup = d3.scaleBand()
                        .domain(subgroups)
                        .range([0, xScale.bandwidth()])
                        .padding([0.05]);
    
    const color = d3.scaleOrdinal()
                    .domain(subgroups)
                    .range(['#0094b1', 'crimson']);

    const barGroups = chart.selectAll()
                        .data(data)
                        .enter()
                        .append('g')
                        .attr("transform", function(d) { return "translate(" + xScale(d.name) + ",0)"; })
                        .selectAll("rect")
                        .data(function(d){return subgroups.map(function(key) { return {key: key, value: d[key]}; }); })
                        .enter();
    barGroups
        .append('rect')
        .attr('class', 'bar')
        .attr('x', function(d) {return xSubGroup(d.key)})
        .attr('y', function(d) {return yScale(d.value)})
        .attr('height', (d) => height - yScale(d.value))
        .attr('width', xSubGroup.bandwidth())
        .attr('fill', function(d) { return color(d.key); })
        .on('mouseenter', function (actual, i) {
            d3.selectAll('.accuracy')
                .attr('opacity', 0)

            d3.select(this)
                .transition()
                .duration(300)
                .attr('opacity', 0.6)
                .attr('x', (d) => xSubGroup(d.key) - 5)
                .attr('width', xSubGroup.bandwidth() + 10)
            
            const y = yScale(actual.value);

            chart.append('line')
                .attr('id', 'limit')
                .attr('x1', 0)
                .attr('y1', y)
                .attr('x2', width)
                .attr('y2', y)
                .attr('stroke', "rgb(255, 174, 43)")
                .attr('stroke-width', '2px')
                .style('stroke-dasharray', '6 3');;
            
            barGroups.append('text')
                .attr('class', 'divergence')
                .attr('x', (d) => xSubGroup(d.key) + xSubGroup.bandwidth() / 2)
                .attr('y', (d) => yScale(d.value) + 30)
                .style('fill', 'white')
                .style("stroke", "white")
                .attr('text-anchor', 'middle')
                .text((d, idx) => {
                    const divergence = (d.value - actual.value).toFixed(1)
                    let text = '';
                    if (divergence > 0) {text += '+';}
                    text += `${divergence}%`;
                    return idx == i ? text : '';
                })
        })
        .on('mouseleave', function (actual, i) {
            d3.selectAll('.accuracy')
                .attr('opacity', 1)

            d3.select(this)
                .transition()
                .duration(300)
                .attr('opacity', 1)
                .attr('x', (a) => xSubGroup(a.key))
                .attr('width', xSubGroup.bandwidth())

            chart.selectAll('#limit').remove()
            chart.selectAll('.divergence').remove()
        })

    barGroups
        .append('text')
        .attr('class', 'accuracy')
        .attr('x', (a) => xSubGroup(a.key) + xSubGroup.bandwidth() / 2)
        .attr('y', (a) => yScale(a.value) + 30)
        .attr('text-anchor', 'middle')
        .text((a) => `${a.value}`)
        .style('fill', 'white')
        .style("stroke", "white");


    // add grid system
    chart.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0, ${height})`)
        .attr('opacity', 0.3)
        .call(d3.axisBottom()
                .scale(xScale)
                .tickSize(-height, 0, 0)
                .tickFormat(''))

    chart.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.3)
        .call(d3.axisLeft()
            .scale(yScale)
            .ticks(5)
            .tickSize(-width, 0, 0)
            .tickFormat(''))

    d3.select("svg#model_performance").append('text')
        .attr('x', -(height / 2) - margin)
        .attr('y', margin/2.4)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .text('Accuracy / Recall(%)')
 
}

let insertLineBreaks = function (d) {
    const el = d3.select(this);
    const words = d.split(' ');
    el.text('');

    for (let i = 0; i < words.length; i++) {
        let tspan = el.append('tspan').text(words[i]);
        if (i > 0)
            tspan.attr('x', 0).attr('dy', '15');
    }
};

function getModelPredictionsPerCell() {
    for (let cell of cell3dState.existingCells) {
        if (utils.checkIteminObjectArray(cell, modelState.modelPredictionsPerCell, "name") == -1 &&
            cell3dModel.findSister(cell) != null) {
            let obj = {};
            obj.name = cell;
            obj.modelPrediction = possibleSistersFromModel(cell);
            modelState.modelPredictionsPerCell.push(obj);
        }
    }
}

function possibleSistersFromModel(name) {
    let possibleNeighbors = [];
    if (modelState.modelPredictions.length == 0) {return;}
    const modelCount = modelState.modelPredictions.length;
    const pairsCount = modelState.modelPredictions[modelCount-1].possibilities.length;
    // i == pair
    for (let i = 0; i < pairsCount; i++) {
        let neighbor;
        if (modelState.modelPredictions[0].possibilities[i][0] == name){
            neighbor = modelState.modelPredictions[0].possibilities[i][1];
        } else if (modelState.modelPredictions[0].possibilities[i][1] == name){
            neighbor = modelState.modelPredictions[0].possibilities[i][0];
        } else {continue;}
        
        // j == model
        for (let j = 0; j < modelCount; j++) {
            // if the model predicts that these two are sisters
            if (modelState.modelPredictions[j].possibilities[i][2] == 1) {
                const index = utils.checkIteminObjectArray(neighbor, possibleNeighbors, "neighbor");
                if (index != -1) {
                    possibleNeighbors[index].models.push(modelState.modelPredictions[j].model);
                } else {
                    let obj = {};
                    obj.neighbor = neighbor;
                    obj.models = [modelState.modelPredictions[j].model];
                    possibleNeighbors.push(obj);
                }
            }
        }
    }
    return possibleNeighbors;
}

function visualizePossibleSisters(possibleNeighbors, neighborsTryingOutCallback) {
    const index = cell3dState.cellOrder.indexOf(cell3dState.highlighted);
    const x = treeState.nodesXs[index] + treeState.nodeWidths[index]/2 - treeState.focusMoved/treeState.diff;
    const y = treeModel.nodeY(index) + interfaceState.nodeDefaultHeight/2-15;

    let vis = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", "neighborsModelG")
        .data([possibleNeighbors])
        .attr("transform", "translate(" + [x, y] + ")")

    let arc = d3.arc()
        .innerRadius(interfaceState.nodeDefaultHeight/2)
        .outerRadius(interfaceState.nodeDefaultHeight/2+20)
    
    let pie = d3.pie()
        .startAngle(-90 * (Math.PI/180))
        .endAngle(90 * (Math.PI/180))
        .padAngle(.02)
        .sort(null)
        .value(function(d) {return d.accuracy;});
    
    let arcs = vis.selectAll("g.neighborsModelG.slice")
        .data(pie)
        .enter()
        .append("g")
        .attr("class", "slice")
    
    arcs.append("path")
        .attr("fill", function(d){
            if (d.data.neighbor == "Uncertain") {return "grey";}
            const index = cell3dState.cellOrder.indexOf(d.data.neighbor);
            return utils.rgbToHex(treeModel.nodeColor(index));
        })
        .attr("stroke", "white")
        .attr('stroke-width', 2)
        .attr("d", arc)
        .on("mouseover", function(d) {
            if (d.data.neighbor != "Uncertain") {
                let [predictionNum, rectsToBuild] = getRectToBuild(d);
                formSinglePairModelInformation(predictionNum, rectsToBuild, d, x, y, "modelTooltip");
                neighborsTryingOutCallback(d.data.neighbor);
            } else {
                // formUncertaintyPair(d, x, y);
            }
        })
        .on("mouseout", function(d) {		
            d3.select("svg#mainsvg").selectAll("g#modelTooltip").remove();
        });
    
    arcs.append("text")
        .style("fill", "white")
        .style("stroke", "white")
        .attr("transform", function(d) {
            d.innerRadius = 0;
            d.outerRadius = interfaceState.nodeDefaultHeight/2+20;
            return "translate(" + arc.centroid(d)[0] + "," + (arc.centroid(d)[1]+5) + ")";
        })
        .attr("text-anchor", "middle")
        .text(function(d){ if (d.data.neighbor != "Uncertain") {return d.data.neighbor;}})
        .on("mouseover", function(d) {
            if (d.data.neighbor != "Uncertain") {
                let [predictionNum, rectsToBuild] = getRectToBuild(d);
                formSinglePairModelInformation(predictionNum, rectsToBuild, d, x, y, "modelTooltip");
                neighborsTryingOutCallback(d.data.neighbor);
            } else {
                // formUncertaintyPair(d, x, y);
            }
        })
        .on("mouseout", function(d) {		
            d3.select("svg#mainsvg").selectAll("g#modelTooltip").remove();
        });

    getOverviewDataset(possibleNeighbors);
}

function getOverviewDataset(data) {
    let rectsToBuild = [];
    let modelPrediction = [];
    for (let item of data) {
        for (let i of modelState.modelPredictions) {
            let model = i.model;
            const modelIndex = utils.checkIteminObjectArray(model, modelPrediction, "model");
            const modelIndex1 = modelState.modelPredictions.indexOf(i);
            if (modelIndex == -1) {
                let obj = {};
                obj.model = model;
                let proposedSisters = getAllProposedSisterFromModel(modelIndex1, item.name);
                obj.prediction = proposedSisters;
                modelPrediction.push(obj);
            }
        }
    }
    let predictionNum = [0, 0, 0, 0, 0]; //each model has one num
    for (let i of modelPrediction) {
        const modelIndex = utils.checkIteminObjectArray(i.model, modelState.modelPredictions, "model");
        predictionNum[modelIndex] = i.prediction.length;
        for (let j of i.prediction) {
            let obj = {};
            obj.model = i.model;
            obj.prediction = j;
            rectsToBuild.push(obj);
        }
    }   
    // add the non-sister predictions here
    for (let i = 0; i < predictionNum.length; i++) {
        if (predictionNum[i] == 0){
            let obj = {};
            obj.model = modelState.modelPredictions[i].model;
            obj.prediction = "non_sisters";
            rectsToBuild.push(obj);
        }
    }
    const index = cell3dState.cellOrder.indexOf(cell3dState.highlighted);
    const x = treeState.nodesXs[index] + treeState.nodeWidths[index]/2 - treeState.focusMoved/treeState.diff;
    const y = treeModel.nodeY(index) + interfaceState.nodeDefaultHeight/2-15;
    formSinglePairModelInformation(predictionNum, rectsToBuild, {}, x, y, "overview");
}

function formUncertaintyPair(data, x, y) {
    let rectsToBuild = [];
    let obj = {};
    obj.model = data.data.model;
    obj.prediction = data.data.neighbor;
    rectsToBuild.push(obj);

    let tips = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", "modelTooltip")       
        .selectAll(null)
        .attr("transform", "translate(" + [x, y-interfaceState.nodeDefaultHeight] + ")")
        .data(rectsToBuild).enter();

    const width = 200;
    const margin = 5;
    const height = 15;
    
    let background = tips
                    .append("rect")
                    .attr("x", margin)
                    .attr("y", margin)
                    .attr("width", width)
                    .attr("height", height + 2 * margin)
                    .attr("fill", "white")
                    .attr("opacity", 0.8)
                    .attr("stroke", "black")
                    .attr('stroke-width', 2);
    let bar = tips
                .append("rect")
                .attr("y", margin * 2)
                .attr("x", 80)
                .attr("width", 120)
                .attr("height", 15)
                .attr("fill", "grey");

    tips.append("text")
        .attr("x", margin * 2 + 40)
        .attr("y", margin * 4)
        .style("fill", "black")
        .style("stroke", "black")
        .text("Uncertainty")
}

function getRectToBuild(data) {
    let rectsToBuild = [];
    let modelPrediction = getPairModelInfoData(data.data);
    let predictionNum = [0, 0, 0, 0, 0]; //each model has one num
    for (let i of modelPrediction) {
        const modelIndex = utils.checkIteminObjectArray(i.model, modelState.modelPredictions, "model");
        predictionNum[modelIndex] = i.prediction.length;
        for (let j of i.prediction) {
            let obj = {};
            obj.model = i.model;
            obj.prediction = j;
            rectsToBuild.push(obj);
        }
    }   
    // add the non-sister predictions here
    for (let i = 0; i < predictionNum.length; i++) {
        if (predictionNum[i] == 0){
            let obj = {};
            obj.model = modelState.modelPredictions[i].model;
            obj.prediction = "non_sisters";
            rectsToBuild.push(obj);
        }
    }
    return [predictionNum, rectsToBuild];
}

function formSinglePairModelInformation(predictionNum, rectsToBuild, data, x, y, id){
    // define the div for the tooltip
    let tips = d3.select("svg#mainsvg")
        .append("g")
        .attr("id", id)       
        .selectAll(null)
        .attr("transform", "translate(" + [x, y-interfaceState.nodeDefaultHeight] + ")")
        .data(rectsToBuild).enter();

    const width = 250;
    const margin = 5;
    const height = (15 + margin) * (predictionNum.length - 1) + 15;

    let background = tips
                    .append("rect")
                    .attr("x", margin)
                    .attr("y", margin)
                    .attr("width", width)
                    .attr("height", height + 2 * margin)
                    .attr("fill", "white")
                    .attr("opacity", 0.8)
                    .attr("stroke", "black")
                    .attr('stroke-width', 2);
    let bar = tips
                .append("rect")
                .attr("class", "tooltipBars")
                .attr("y", function (d, i) {
                    let modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
                    return (15+margin)*modelIndex + margin * 2;
                })
                .attr("x", function (d, i) {
                    if (d.prediction == "non_sisters") {return 130;}
                    const modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
                    let sumPre = 0;
                    for (let i of Array(modelIndex).keys()) {
                        sumPre += predictionNum[i];
                    }
                    return 120/predictionNum[modelIndex]*(i - sumPre) + 130;
                })
                .attr("width", function(d) {
                    if (d.prediction == "non_sisters") {return 120;}
                    const modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
                    return 120/predictionNum[modelIndex];
                })
                .attr("height", 15)
                .attr("fill", function(d) {
                    if (d.prediction == "non_sisters") {return "url(#pattern)";}
                    const index = cell3dState.cellOrder.indexOf(d.prediction);
                    return utils.rgbToHex(treeModel.nodeColor(index));
                })
                .attr('stroke', 'black')
                .attr('stroke-width', 1);
        
    tips.append("text")
        .filter(function(d,i) {return (d.prediction != 'non_sisters')})
        .attr("y", function (d, i) {
            let modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
            return (15+margin)*modelIndex + margin * 2 + 13;
        })
        .attr("x", function (d, i) {
            const modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
            let sumPre = 0;
            for (let i of Array(modelIndex).keys()) {
                sumPre += predictionNum[i];
            }
            return 120/predictionNum[modelIndex]*(i - sumPre) + 130 + 60/predictionNum[modelIndex];
        })
        .style("fill", "white")
        .style("stroke", "white")
        .text(function(d) {return d.prediction})
    
    // highlight the hovered prediction
    tips.selectAll("rect.tooltipBars")
                .filter(function(d, i) {if (data.data != undefined) {return (d.prediction == data.data.neighbor)}})
                .attr('stroke', 'red');

    tips.append("text")
        .attr("x", function(d) {
            const modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
            if (modelIndex == 0) {return margin*2 + 50;}
            if (modelIndex == 1) {return margin*2 + 12.5;}
            if (modelIndex == 2) {return margin*2 + 30;}
            if (modelIndex == 3) {return margin*2 + 14;}
            if (modelIndex == 4) {return margin*2 + 47;}
        })
        .attr("y", function(d, i) {
            let modelIndex = utils.checkIteminObjectArray(d.model, modelState.modelPredictions, "model");
            return (15+margin)*modelIndex + margin * 4;
        })
        .style("fill", "black")
        .style("stroke", "black")
        .text(function(d){return d.model})
}

function getPairModelInfoData(data) {
    let modelPrediction = [];
    for (let model of data.models) {
        let item = {};
        item.model = model;
        const modelIndex = utils.checkIteminObjectArray(model, modelState.modelPredictions, "model");
        let proposedSisters = getAllProposedSisterFromModel(modelIndex, data.name);
        item.prediction = proposedSisters;
        modelPrediction.push(item);
    }
    return modelPrediction;
}

function getAllProposedSisterFromModel(modelIndex, cell) {
    let proposedSisters = [];
    for (let posi of modelState.modelPredictions[modelIndex].possibilities) {
        if ((posi[0] == cell || posi[1] == cell) && (posi[2] == 1)) {
            if (posi[0] == cell) {
                proposedSisters.push(posi[1]);
            } else if (posi[1] == cell) {
                proposedSisters.push(posi[0]);
            }
        }
    }
    return proposedSisters;
}

function getDimensions(selection) {
    selection.each(function(d) {d.bbox = this.getBBox();})
}

function clearModelPossibleSisters(){
    d3.select("svg#mainsvg").selectAll("g#neighborsModelG").remove();
    d3.select("svg#mainsvg").selectAll("g#overview").remove();
    d3.select("svg#model_performance").selectAll("*").remove();
    visualizeModelProperties(modelState.defaultModelProperties);
}

module.exports = {
    visualizeModelProperties,
    getModelPredictionsPerCell,
    possibleSistersFromModel,
    visualizePossibleSisters,
    clearModelPossibleSisters
}