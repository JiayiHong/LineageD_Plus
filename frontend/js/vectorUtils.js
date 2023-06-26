
/**
 * 
 * home made lib to do vector operations
 * and projections
 * 
 * The target will be to use VTK functions
 * (we discovered them too late for now)
 * 
 * https://kitware.github.io/vtk-js/api/Common_DataModel_Plane.html
 * 
 * also, vtk use arrays of 3 elements [x_value, y_value, z_value] for coordinates, unlike
 * here where we chose object {x: x_value, y: y_value, z: z_value}
 */


function dotProduct(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function crossProduct(v1, v2) {
  let result = {};

  result.x = v1.y * v2.z - v1.z * v2.y;
  result.y = v1.z * v2.x - v1.x * v2.z;
  result.z = v1.x * v2.y - v1.y * v2.x;

  return result;
}

function scalarProduct(scalar, v) {
  let result = {};

  result.x = scalar * v.x;
  result.y = scalar * v.y;
  result.z = scalar * v.z;

  return result;
}

function squareAmplitude(v1) {
  return v1.x * v1.x + v1.y * v1.y + v1.z * v1.z
}

function vectorFromPoints(p1, p2) {
  let result = {};

  result.x = p2.x - p1.x;
  result.y = p2.y - p1.y;
  result.z = p2.z - p1.z;

  return result;
}

function triangleArea(v1, v2) {
  const x = v1.y*v2.z - v1.z*v2.y;
  const y = v1.z*v2.x - v1.x*v2.z;
  const z = v1.x*v2.y - v1.y*v2.x;
  const v = {
    x: x,
    y: y,
    z: z
  }
  const area = Math.sqrt(squareAmplitude(v))/2;
  return area;
}

function normalizeVector(v) {
  let result = {};
  const magnitude = Math.sqrt(squareAmplitude(v));
  result.x = v.x / magnitude;
  result.y = v.y / magnitude;
  result.z = v.z /magnitude;
  return result;
}

function subVector(v1, v2) {
  let result = {};

  result.x = v1.x - v2.x;
  result.y = v1.y - v2.y;
  result.z = v1.z - v2.z;

  return result;
}

function addVector(v1, v2) {
  let result = {};

  result.x = v1.x + v2.x;
  result.y = v1.y + v2.y;
  result.z = v1.z + v2.z;

  return result;
}

function projVectorOnVector(sourceVector, targetVector) {
  const squareAmp = squareAmplitude(targetVector);
  const dotProd = dotProduct(sourceVector, targetVector);
  const lhs = dotProd / squareAmp;

  return scalarProduct(lhs, targetVector);
}

function projVectorOnPlane(sourceVector, plane) {
  const rhs = projVectorOnVector(sourceVector, plane.normalVector);

  return subVector(sourceVector, rhs);
}

function findPlane(origPoint, secondPoint, thirdPoint) {
  // TODO: unit vectors instead ?
  let result = {};
  const planeFirstAxis = vectorFromPoints(origPoint, secondPoint);
  const planeOtherVector = vectorFromPoints(origPoint, thirdPoint);
  const planeNormalVector = crossProduct(planeFirstAxis, planeOtherVector);

  result.origin = origPoint;
  result.xAxis = planeFirstAxis;
  result.yAxis = crossProduct(planeFirstAxis, planeNormalVector);
  result.normalVector = planeNormalVector;

  return result;
}

function convertToPlaneCoordinates(projectedVector, plane) {
  result = {};
  const {xAxis, yAxis} = plane;

  result.x = (dotProduct(projectedVector, xAxis)) / squareAmplitude(xAxis) ;
  result.y = (dotProduct(projectedVector, yAxis)) / squareAmplitude(yAxis) ;

  return result;
}

function getProjectedCoordinates(point, plane) {
  /*console.log('in getpc');
  console.log(plane);
  console.log(point);*/
  const {origin} = plane;

  const sourceVector = vectorFromPoints(origin, point);
  /*console.log('sourcevector: ');
  console.log(sourceVector);*/
  const projectedVector = projVectorOnPlane(sourceVector, plane);
  /*console.log('projectedVector: ');
  console.log(projectedVector);*/
  result = convertToPlaneCoordinates(projectedVector, plane);

  return result;
}

function angleBetweenTwoVectors(v1, v2) {
  const dot = dotProduct(v1, v2);
  const magSq = squareAmplitude(v1)*squareAmplitude(v2);
  const angle = Math.acos(dot/Math.sqrt(magSq));
  let degree = angle*(180/Math.PI);
  if (degree > 90){degree = 180 - degree;} 
  return degree;
}

module.exports = {
  dotProduct,
  crossProduct,
  scalarProduct,
  squareAmplitude,
  vectorFromPoints,
  subVector,
  addVector,
  projVectorOnVector,
  projVectorOnPlane,
  findPlane,
  triangleArea,
  convertToPlaneCoordinates,
  normalizeVector,
  getProjectedCoordinates,
  angleBetweenTwoVectors
}