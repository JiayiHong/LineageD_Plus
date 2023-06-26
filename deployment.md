# Architecture

Only ports tcp 80 and 443 are opened from Internet.

So we will have both frontend and backend reachable at the same
server/port.

It will ease CORS but CORS is setup to support a standard architecture
like a frontend on a CDN and the backend on a server.

In our case the reverse proxy will get all the traffic from Internet.

When we'll switch to TLS it will be the TLS endpoint

Internet --TCP 80/443 --> Reverse Proxy ---> Backend path: Express --> MongoDB
                                        ---> Frontend path: static JS/CSS/HTML files

# Infrastructure deployment

## root (should be maintained and updated by the hoster)
* Install and configure the reverse proxy (NGINX or Apache)
* Install and configure MongoDB.
* Create an application user, create a /app and give access
to the application user


## application user (maintained by the devs)
* Install nvm (Node version manager) https://github.com/nvm-sh/nvm
* Install node v14 with nvm
* Create /app/frontend folder
* Create /app/backend folder
* Create /app/previous folder
* Create /app/deployment folder

# Application deployment

In a temporary folder, as the application user:

* change directory to /app/deployment
* ensure it is empty
* git clone the release to plant
* cd plant

## Frontend

* change the backend_url in /app/deployment/plant/frontend/js/fetches.js
from:
```const backend_url = 'http://localhost:3000';```
to:
```const backend_url = 'http://cell-lineage-u18.saclay.inria.fr';```
Note: will disappear with the bundler and dotenv
* move the /app/frontend to /app/previous (one rolling backup)
* move /app/deployment/plant/frontend to /app/frontend

## Backend

* npm install
* ensure /app/backend/.env is not missing variables from /app/deployment/plant/.env.sample
* TODO: npm test (no tests for now)
* move the /app/backend folder to /app/previous (one rolling backup)
* move the /app/deployment/plant/backend to /app/backend
* copy the /app/previous/backend/.env file to /app/backend/
* kill and restart express

# Test the deployment

Browse http://cell-lineage-u18.saclay.inria.fr

