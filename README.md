# Website for Cell Lineages

Website Link: https://plantembryoml.saclay.inria.fr/

**Cell Lineage Web** is the website that allows biologists to freely do cell lineages with the help of Machine Learning.

## Pre-Requisites

* copy `.env.sample` to `.env` and edit variables accordingly
* Note that the website cannot run on Macbooks with M1 chips since TensorflowJS is incompatible with them.
* To use the Windows system, it would be better to use stable Node.js and npm versions. We tested on Node.js (v14.17.1) and npm (v7.7.6), and it works well.

## Installation
---

```
npm install
```

```
npm run build
```
## Starting up
---

### Run the website

Start the backend (static) file server:
```
npm run backend
```

Start the frontend (parcel with hot reload for developpers)
```
npm run frontend
```

## Browse

http://localhost:1234
