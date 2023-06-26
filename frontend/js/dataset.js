const datasetState = require('./datasetState');
const vectorUtils = require('./vectorUtils');

// get the normal vectors of triangles
function getAllTrianglesNorms(startPoint, points) {
    for (let i = 0; i < datasetState.trianglesInfo.length; i++) {
        let totalArea = 0;
        let totalNorm = {x:0, y:0, z:0};
        const triangleList = datasetState.triangles;
        for (let j = startPoint[i]; j < startPoint[i]+datasetState.trianglesInfo[i][2]; j++) {
            // first step: convert from array of coordinates to point object (x, y, z)
            const triangleIndex1 = triangleList[j][0] - 1;
            const p1 = {
                x: points[triangleIndex1][0],
                y: points[triangleIndex1][1],
                z: points[triangleIndex1][2]
            }
            const triangleIndex2 = triangleList[j][1] - 1;
            const p2 = {
                x: points[triangleIndex2][0],
                y: points[triangleIndex2][1],
                z: points[triangleIndex2][2]
            }
            const triangleIndex3 = triangleList[j][2] - 1;
            const p3 = {
                x: points[triangleIndex3][0],
                y: points[triangleIndex3][1],
                z: points[triangleIndex3][2]
            }

            // second step: do the calculations
            const v1 = vectorUtils.vectorFromPoints(p1, p3);
            const v2 = vectorUtils.vectorFromPoints(p1, p2);
            const area = vectorUtils.triangleArea(v1,v2);
            totalArea += area;
            let norm = getTriangleNorms(v1, v2);
            norm = vectorUtils.scalarProduct(area, norm);
            totalNorm = vectorUtils.addVector(totalNorm, norm);
        }
        datasetState.trianglesNorm.push(vectorUtils.scalarProduct(1/totalArea, totalNorm));
    }
}

function getTriangleNorms(v1, v2) {
    const cp = vectorUtils.crossProduct(v1, v2);
    const normalizedCp = vectorUtils.normalizeVector(cp);
    return normalizedCp;
}

module.exports = {
    getAllTrianglesNorms
}