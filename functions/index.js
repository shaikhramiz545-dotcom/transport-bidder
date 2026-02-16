/**
 * Firebase Cloud Function wrapper for Tbidder Express backend
 */

const functions = require("firebase-functions");
const app = require("./src/app");

// Export Express app as Firebase Cloud Function
// This handles all HTTP requests to the backend API
exports.api = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    maxInstances: 10,
  })
  .https.onRequest(app);
