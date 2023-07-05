const express = require('express');
const cors = require('cors');

const BACKEND_ADDRESS = process.env.BACKEND_ADDRESS || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT || 3000;
const BACKEND_URL = `http://${BACKEND_ADDRESS}:${BACKEND_PORT}`;
const FRONTEND_URL = process.env.BACKEND_FRONTEND_URL || '*';

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(cors({
    // Access-Control-Allow-Origin
    // needed to fetch from a frontend
    // regexp or function can also be used
    origin: FRONTEND_URL
}));


app.use('/data', express.static('static-backend/data'));

app.listen(BACKEND_PORT, BACKEND_ADDRESS, () => {
    console.log(`Example app listening at ${BACKEND_URL}`);
});
