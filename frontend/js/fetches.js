require('dotenv').config();

const backend_url = process.env.FRONTEND_BACKEND_URL;

const defaultRequestOptions = {
    // send cookies, even for cross-origin calls, needs proper CORS setup
    // on the backend
    headers: { 'Content-Type': 'application/json' }
}

async function sendCommandsToServer(value) {
    const requestOptions = {
        ...defaultRequestOptions,
        method: 'POST',
        body: JSON.stringify([value])
    };

    await fetch(backend_url + '/menu/', requestOptions);
}

async function predictionConstrainsUpdate(treeState) {
    // get leftCells
    // get supportingCells
    const postObject = {
        predictionConstrains: treeState.predictionConstrains
    };
    await fetch(backend_url + '/global/predictionConstrains', {
        ...defaultRequestOptions,
        method: 'POST',
        body: JSON.stringify(postObject),
    });
}

async function fetchJson(path) {
    const requestOptions = {
        ...defaultRequestOptions,
        method: 'GET'
    }

    const response = await fetch(backend_url + path, requestOptions);
    const jsonResponse = await response.json();
    return jsonResponse;
}

async function fetchText(path) {
    const requestOptions = {
        ...defaultRequestOptions,
        method: 'GET'
    }

    const response = await fetch(backend_url + path, requestOptions);
    const textResponse = await response.text();
    return textResponse;
}

async function submitOneLevelPrediction() {
    const requestOptions = {
        ...defaultRequestOptions,
        method: 'POST',
        // later we will have to had job type = onelevelprediction
        // body: JSON.stringify('')
    };

    let jobId = -1;
    // should be backend url
    const response = await fetch(backend_url + '/job/', requestOptions);
    const jsonResponse = await response.json();
    return jsonResponse.jobId;
}

// usable by any type of jobs
async function getJobStatus(jobId) {
    // should be backend url
    const response = await fetch(backend_url + '/job/' + jobId, defaultRequestOptions)
    const jsonResponse = await response.json();
    return jsonResponse.status;
}

async function getMLModel() {
    // const model = await tf.loadLayersModel(backend_url + '/data/model/model.json');
    const model = await tf.loadLayersModel(backend_url + '/data/model/neuralNetwork.json');
    
    return model;
}

module.exports = {
    sendCommandsToServer,
    fetchJson,
    fetchText,
    submitOneLevelPrediction,
    getJobStatus,
    predictionConstrainsUpdate,
    getMLModel
}